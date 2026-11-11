// Turns a work-log / major-update issue into a Markdown file (§7.1).
// Called from .github/workflows/post-entry.yml via actions/github-script:
//
//   const run = require('./.github/scripts/post-entry.cjs');
//   await run({ github, context, core, root: process.cwd() });       // build the entry
//   await run.report({ github, context, core, entry, pushStatus });  // comment, close, summarise
//
// run() ALWAYS sets the `entry_result` output — one of:
//   skip | rejected | invalid | written | duplicate | misconfigured | error
// plus: issue, title, trigger, kind, via, login, matched, author, file, url, message,
// fingerprint, form, headings (JSON), missing.
// It never commits — the workflow does that between run() and report().
//
// The output must NOT be called `result`: actions/github-script writes its script
// block's return value to an output of that name after the block finishes, which
// overwrites anything set here. That silently broke every post once.
//
// The form's labels come from ./form-fields.cjs (shared with the script that writes
// the form); the file's layout comes from .github/templates/*.md via
// ./entry-template.cjs. No dependencies: the Action does not install node_modules.
//
// Tested offline by `npm run test:post` (scripts/test-post-entry.mjs), which runs the
// workflow's real script blocks the way github-script does.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { LABELS, fieldsFor, normalizeLabel } = require('./form-fields.cjs');
const template = require('./entry-template.cjs');

const NO_RESPONSE = '_No response_';

/**
 * Bracketed placeholder text such as "[TODO: David's part]" (any case). Nothing addressed
 * to the team may reach the site, so a field still holding one is sent back for editing
 * rather than posted. Plain prose ("our TODO list") is fine; only the bracketed form counts.
 */
const PLACEHOLDER = /\[\s*todo\b[^\]\n]*\]?/i;
const placeholderIn = text => (text.match(PLACEHOLDER) || [''])[0].slice(0, 60);
const TEMPLATES = path.join(__dirname, '..', 'templates');
const TEMPLATE_FILE = { 'work-log': 'work-log-entry.md', 'major-update': 'major-update.md' };

/** "### Label" → "Label". Tolerates up to three leading spaces and a closing "###". */
function readHeading(line) {
  const m = line.match(/^ {0,3}###\s+(.*?)(?:\s+#+)?\s*$/);
  return m && m[1] !== '' ? m[1] : undefined;
}

/** Field values from a "### Label\n\nvalue" body, blank (or "_No response_") as ''. */
const clean = value => {
  const v = value.trim();
  return v === NO_RESPONSE ? '' : v;
};

/**
 * Splits an issue-form body into fields.
 *
 * Headings are matched to `fields` by normalizeLabel() — case, spacing, dashes and
 * trailing punctuation don't matter.
 *
 * Which occurrence starts a field: GitHub writes every field's heading once, in form
 * order, and anything a member types sits between two of them. So, working back from
 * the last field, each field starts at the LAST line carrying its heading that comes
 * before the next field's start. A copy of any field's heading typed inside someone's
 * text — "### Images" in Content, "### Title" in a contribution, a "### Next steps" —
 * therefore stays part of that text, wherever that field sits in the form. Nothing
 * here depends on which field comes last.
 *
 * Returns every `### ` heading found, and what it was read as, so a heading that
 * matched nothing is reported rather than lost; and the fields never found.
 */
function parseForm(body, fields) {
  const lines = (body || '').replace(/\r\n?/g, '\n').split('\n');
  const index = new Map(fields.map((f, i) => [normalizeLabel(f.label), i]));
  const seen = fields.map(() => []); // line numbers carrying each field's heading
  lines.forEach((line, i) => {
    const h = readHeading(line);
    const at = h === undefined ? undefined : index.get(normalizeLabel(h));
    if (at !== undefined) seen[at].push(i);
  });
  const startsField = new Map(); // line number → field index
  let bound = Infinity;
  for (let at = fields.length - 1; at >= 0; at--) {
    const before = seen[at].filter(i => i < bound);
    if (before.length) {
      bound = before[before.length - 1];
      startsField.set(bound, at);
    }
  }

  const values = {};
  const headings = [];
  let current = -1;
  let buf = [];
  const flush = () => {
    if (current >= 0) values[fields[current].key] = clean(buf.join('\n'));
  };
  lines.forEach((line, i) => {
    const h = readHeading(line);
    if (h === undefined) return void buf.push(line);
    const at = startsField.get(i);
    const isField = at !== undefined;
    if (isField) {
      flush();
      current = at;
      buf = [];
      headings.push({ heading: h, field: fields[at].label });
    } else {
      headings.push({ heading: h, field: null, inside: current >= 0 ? fields[current].label : null });
      buf.push(line);
    }
  });
  flush();
  const missing = fields.filter(f => !(f.key in values)).map(f => f.label);
  return { values, headings, missing };
}

/** The "Entry type" field alone, read before the kind (and so the layout) is known. */
function kindField(body) {
  const lines = (body || '').replace(/\r\n?/g, '\n').split('\n');
  const start = lines.findIndex(l => normalizeLabel(readHeading(l) ?? '') === normalizeLabel(LABELS.kind));
  if (start === -1) return '';
  const end = lines.findIndex((l, i) => i > start && readHeading(l) !== undefined);
  return clean(lines.slice(start + 1, end === -1 ? undefined : end).join('\n'));
}

/**
 * Which kind of entry is this issue? Nothing here may depend on a label existing
 * in the repo, so labels are only one of four signals, tried in this order.
 */
function detectKind(issue) {
  const marker = (issue.body || '').match(/<!--\s*g27:kind=(work-log|major-update)\s*-->/);
  if (marker) return { kind: marker[1], via: 'body marker' };

  const type = kindField(issue.body).toLowerCase();
  if (type.startsWith('work log')) return { kind: 'work-log', via: `"${LABELS.kind}" form field` };
  if (type.startsWith('major update')) return { kind: 'major-update', via: `"${LABELS.kind}" form field` };

  const labels = (issue.labels || []).map(l => (typeof l === 'string' ? l : l.name));
  if (labels.includes('work-log')) return { kind: 'work-log', via: 'label' };
  if (labels.includes('major-update')) return { kind: 'major-update', via: 'label' };

  const title = issue.title || '';
  if (/^\s*\[\s*work[\s-]*log\s*\]/i.test(title)) return { kind: 'work-log', via: 'title prefix' };
  if (/^\s*\[\s*major[\s-]*update\s*\]/i.test(title)) return { kind: 'major-update', via: 'title prefix' };

  return { kind: null, via: 'none' };
}

/**
 * The work-log form changed from collaborator checkboxes to per-person boxes. An
 * issue with the old form's headings and none of the new ones — filed from a stale
 * copy of the form, or replayed — is read with the old layout and posts as it did.
 */
function workLogLayout(body, members) {
  const found = new Set();
  for (const line of (body || '').replace(/\r\n?/g, '\n').split('\n')) {
    const h = readHeading(line);
    if (h !== undefined) found.add(normalizeLabel(h));
  }
  const has = label => found.has(normalizeLabel(label));
  const perPerson = fieldsFor('work-log', members).filter(f => f.slug);
  if (perPerson.some(f => has(f.label))) return 'work-log';
  if (has(LABELS.collaborators) || has(LABELS.yourContribution) || has(LABELS.hours)) return 'work-log-legacy';
  return 'work-log';
}

/** Ticked checkbox labels: "- [X] Name". */
function checked(value) {
  return (value || '')
    .split('\n')
    .map(l => l.match(/^- \[[xX]\] (.+)$/))
    .filter(Boolean)
    .map(m => m[1].trim());
}

/**
 * Hours as typed: "2", "2.5", "2.5 h", "2.5 hrs", "2.5 hours", "3h".
 * → { blank: true } | { value: number } (NaN when it isn't a number).
 */
function parseHours(raw) {
  const text = (raw || '').trim();
  if (text === '') return { blank: true, raw: text };
  const stripped = text.replace(/\s*(hours?|hrs?|h)\.?$/i, '').trim();
  return { blank: false, raw: text, value: stripped === '' ? NaN : Number(stripped) };
}

/** Markdown and HTML images from the "Images" textarea. */
function extractImages(value) {
  const out = [];
  const md = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  const html = /<img\b[^>]*>/gi;
  let m;
  while ((m = md.exec(value || ''))) out.push({ alt: m[1].trim(), url: m[2] });
  while ((m = html.exec(value || ''))) {
    const src = m[0].match(/\bsrc="([^"]+)"/i);
    const alt = m[0].match(/\balt="([^"]*)"/i);
    if (src) out.push({ alt: alt ? alt[1].trim() : '', url: src[1] });
  }
  return out;
}

const kebab = s =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60)
    .replace(/-$/, '') || 'entry';

function today() {
  // The team is in Waterloo; "today" means Eastern time, not UTC.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' }).format(new Date());
}

function validDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' };

/** File type from the first bytes, for servers that answer application/octet-stream. */
function sniff(bytes) {
  const hex = bytes.subarray(0, 12).toString('hex');
  const ascii = bytes.subarray(0, 12).toString('latin1');
  if (hex.startsWith('ffd8ff')) return 'jpg';
  if (hex.startsWith('89504e470d0a1a0a')) return 'png';
  if (ascii.startsWith('GIF8')) return 'gif';
  if (ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP') return 'webp';
  if (ascii.slice(4, 12) === 'ftypavif') return 'avif';
  return '';
}

/**
 * GitHub attachment URLs (https://github.com/user-attachments/assets/<uuid>) are
 * public for a public repo, so try without credentials first; only if that fails,
 * retry a GitHub-hosted URL with the workflow token.
 */
async function download(url, token) {
  let res = await fetch(url, { redirect: 'follow' });
  const onGitHub = /^https:\/\/(github\.com|[\w.-]*githubusercontent\.com)\//.test(url);
  if (!res.ok && onGitHub && token) {
    res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, redirect: 'follow' });
  }
  if (!res.ok) throw new Error(`could not download ${url} (HTTP ${res.status})`);
  const type = (res.headers.get('content-type') || '').split(';')[0].trim();
  const bytes = Buffer.from(await res.arrayBuffer());
  const ext =
    EXT[type] ||
    sniff(bytes) ||
    (url.match(/\.(jpe?g|png|webp|gif|avif)(?:$|\?)/i)?.[1] || '').toLowerCase().replace('jpeg', 'jpg');
  if (!ext) throw new Error(`${url} is not a supported image (${type || 'unknown type'})`);
  return { bytes, ext };
}

/** The "Posted from" line every entry carries; how an issue already posted is recognised. */
const postedLine = (number, login) => `# Posted from issue #${number} by @${login}`;

/** The Markdown file already written for this issue, if any (repo-relative path). */
function findPosted(root, number) {
  const marker = new RegExp(`^# Posted from issue #${number} by `, 'm');
  for (const rel of ['src/content/work-log', 'src/content/updates']) {
    const dir = path.join(root, rel);
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir, { recursive: true })) {
      const file = path.join(dir, String(name));
      if (file.endsWith('.md') && marker.test(fs.readFileSync(file, 'utf8'))) {
        return path.relative(root, file).replace(/\\/g, '/');
      }
    }
  }
  return null;
}

function entryUrl(context, file) {
  const site = `https://${context.repo.owner.toLowerCase()}.github.io`;
  return `${site}/${file.replace(/^src\/content\//, '').replace(/\.md$/, '')}/`;
}

/**
 * Who took part and for how long, from the per-person boxes.
 * participants = the author, plus everyone whose contribution box is filled in.
 */
function readPeople({ f, members, author, errors }) {
  const contributions = {};
  const hoursByMember = {};
  // Author first, then the team in MEMBERS order — the order participants() uses.
  const ordered = [...members.filter(m => m.slug === author.slug), ...members.filter(m => m.slug !== author.slug)];
  for (const m of ordered) {
    const isAuthor = m.slug === author.slug;
    const text = f[`contribution:${m.slug}`] || '';
    const h = parseHours(f[`hours:${m.slug}`]);
    const who = isAuthor ? `**${m.name}** (you)` : `**${m.name}**`;
    const involved = isAuthor || text !== '';

    if (!h.blank && !involved) {
      errors.push(`${who}: hours are filled in ("${h.raw}") but the contribution box is blank. Say what ${m.name} did, or clear the hours if they weren't involved.`);
      continue;
    }
    if (!involved) continue;
    if (h.blank) {
      errors.push(isAuthor
        ? `${who}: your own hours are required — fill in "${m.name} — hours".`
        : `${who}: the contribution is filled in but the hours are blank. Add how long ${m.name} spent.`);
    } else if (!Number.isFinite(h.value) || h.value <= 0) {
      errors.push(`${who}: hours "${h.raw}" must be a number more than 0, e.g. 2.5.`);
    } else if (h.value > 24) {
      errors.push(`${who}: hours must be 24 or less for a single entry.`);
    } else {
      hoursByMember[m.slug] = h.value;
    }
    if (text && PLACEHOLDER.test(text)) {
      errors.push(`${who}: the contribution still contains placeholder text ("${placeholderIn(text)}"). Replace it with what ${m.name} actually did, or clear the box and the hours if they weren't involved.`);
    } else if (text) {
      contributions[m.slug] = text;
    }
  }
  const participants = [author.slug, ...members.map(m => m.slug).filter(s => s !== author.slug && contributions[s])];
  return { participants, contributions, hoursByMember };
}

module.exports = async function run({
  github,
  context,
  core,
  root = process.cwd(),
  token = process.env.GITHUB_TOKEN,
  issueNumber = process.env.ISSUE_NUMBER,
  fetchImage = download,
  templatesDir = TEMPLATES,
}) {
  // Everything learned so far, so even an early exit reports the kind, author, etc.
  core.info(`[post-entry] entered run() — event ${context.eventName}, issue_number input "${issueNumber || ''}"`);
  const out = {};
  // Every exit goes through here, so the log always ends with the path taken.
  const done = (result, extra = {}) => {
    Object.assign(out, extra, { entry_result: result });
    core.info(`[post-entry] exit: ${result}${out.message ? ` — ${String(out.message).split('\n')[0]}` : ''}`);
    for (const [k, v] of Object.entries(out)) core.setOutput(k, v == null ? '' : String(v));
    return { ...out };
  };
  const warn = msg => (core.warning ? core.warning(msg) : core.info(`[post-entry] warning: ${msg}`));

  try {
    const manual = context.eventName === 'workflow_dispatch';
    out.trigger = manual ? 'workflow_dispatch' : `${context.eventName}.${context.payload.action || ''}`;
    const number = Number(issueNumber) || context.payload.issue?.number;
    if (!number) {
      core.setFailed('No issue number: this run has neither an issue event nor an issue_number input.');
      return done('error', { message: 'No issue number was given.' });
    }
    out.issue = number;

    // Always re-read the issue: the event payload is a snapshot, and an earlier run
    // for the same issue (opened + labeled fire together) may have closed it already.
    const { data: issue } = await github.rest.issues.get({ ...context.repo, issue_number: number });
    out.title = issue.title;
    out.login = issue.user.login;
    out.matched = 'not checked';
    if (issue.pull_request) return done('skip', { message: `#${number} is a pull request, not an issue.` });

    const { kind, via } = detectKind(issue);
    out.kind = kind || 'none';
    out.via = via;
    core.info(`[post-entry] issue #${number} by @${issue.user.login}, state ${issue.state}, kind ${out.kind} (via ${via})`);
    if (!kind) {
      return done('skip', {
        message: 'Not a log entry: no kind marker or "Entry type" field in the body, no work-log / major-update label, and no "[Work log]" / "[Major update]" title prefix.',
      });
    }

    const posted = findPosted(root, number);
    if (posted) {
      return done('duplicate', { file: posted, url: entryUrl(context, posted), message: `Already posted as ${posted}.` });
    }
    // A manual replay may target a closed issue (e.g. one an earlier rejection closed).
    if (issue.state !== 'open' && !manual) {
      return done('skip', { message: `Issue #${number} is ${issue.state}; nothing to do.` });
    }

    // ── Step 1: allowlist gate ─────────────────────────────────────────
    const allow = JSON.parse(fs.readFileSync(path.join(root, '.github', 'allowlist.json'), 'utf8'));
    const usable = allow.members.filter(m => typeof m.github === 'string' && m.github && !m.github.startsWith('TODO'));
    if (usable.length === 0) {
      out.matched = 'allowlist is empty';
      const message =
        'The posting allowlist has not been filled in: `.github/allowlist.json` has no GitHub username for any member, ' +
        'so nobody can post. Set each member\'s `github` in `src/config/site.ts`, run `npm run sync:allowlist`, and commit the result.';
      core.setFailed(message);
      return done('misconfigured', { message });
    }
    const login = String(issue.user.login).toLowerCase();
    const author = usable.find(m => m.github.toLowerCase() === login);
    if (!author) {
      out.matched = 'no';
      const unset = allow.members.filter(m => !usable.includes(m)).map(m => m.name);
      return done('rejected', {
        message:
          `Posting to this log is limited to the team, and @${issue.user.login} is not on the allowlist, ` +
          'so this issue has been closed automatically.\n\n' +
          `Usernames currently on the allowlist: ${usable.map(m => `\`${m.github}\``).join(', ')}.` +
          (unset.length ? `\nNo username is set yet for: ${unset.join(', ')}.` : '') +
          '\n\nIf you are a team member, your GitHub username is missing or misspelled in `src/config/site.ts`. ' +
          'Ask whoever maintains the site to fix it and run `npm run sync:allowlist`, then reopen this issue.',
      });
    }
    out.matched = 'yes';
    out.author = author.slug;
    core.info(`[post-entry] allowlist match: ${author.slug}`);

    // The template is checked before anything is downloaded or written, so a broken
    // template fails here, by name, and never half-writes an entry.
    let render;
    try {
      render = template.load(path.join(templatesDir, TEMPLATE_FILE[kind]), `.github/templates/${TEMPLATE_FILE[kind]}`);
    } catch (err) {
      const message = `The entry template is broken, so nothing can be posted until it is fixed: ${err.message}`;
      core.setFailed(message);
      return done('misconfigured', { message });
    }

    // ── Step 2: parse, and say what was found ──────────────────────────
    const layout = kind === 'major-update' ? 'major-update' : workLogLayout(issue.body, allow.members);
    const fields = fieldsFor(layout, allow.members);
    const parsed = parseForm(issue.body, fields);
    const f = parsed.values;
    out.form = layout;
    out.headings = JSON.stringify(parsed.headings);
    out.missing = parsed.missing.join(', ');
    for (const h of parsed.headings.filter(x => !x.field)) {
      warn(`Issue #${number}: "### ${h.heading}" matched no form field; kept as text inside ${h.inside ? `"${h.inside}"` : 'nothing (before the first field)'}.`);
    }
    if (parsed.missing.length) warn(`Issue #${number}: form fields not found in the issue: ${parsed.missing.join(', ')}.`);

    // ── Step 3: validate ───────────────────────────────────────────────
    const errors = [];
    const title = (f.title || '').trim();
    const date = (f.date || '').trim() || today();
    const content = (f.content || '').trim();
    const images = extractImages(f.images);

    if (title.length < 5 || title.length > 120) errors.push('**Title** must be 5–120 characters.');
    if (!validDate(date)) errors.push(`**Date** "${date}" is not a real date in YYYY-MM-DD form.`);
    else if (date > today()) errors.push(`**Date** ${date} is in the future.`);
    if (!content) errors.push('**Content** is empty.');
    if (PLACEHOLDER.test(title)) errors.push(`**Title** still contains placeholder text ("${placeholderIn(title)}").`);
    if (PLACEHOLDER.test(content)) errors.push(`**Content** still contains placeholder text ("${placeholderIn(content)}"). Replace it with what actually happened.`);
    if (kind === 'major-update' && images.length === 0) errors.push('**Images**: major updates need at least one image.');

    // A per-person heading the parser did not recognise would lose that person's
    // part of the entry, so it stops the post instead of being skipped quietly.
    // A copy of a KNOWN member's heading inside someone's text is just text (and is
    // listed in the summary); only a name that matches no field means a lost block.
    if (layout === 'work-log') {
      const known = new Set(fields.map(x => normalizeLabel(x.label)));
      const lost = x => !x.field && / - (contribution|hours)$/.test(normalizeLabel(x.heading)) && !known.has(normalizeLabel(x.heading));
      for (const h of parsed.headings.filter(lost)) {
        errors.push(`**Form**: the section "${h.heading}" does not match any team member, so what it contains could not be read. If a name in the form is out of date, tell whoever maintains the site.`);
      }
    }

    let hours;
    let collaborators = [];
    let contributions = {};
    let hoursByMember = {};
    if (layout === 'work-log') {
      const people = readPeople({ f, members: allow.members, author, errors });
      collaborators = people.participants.filter(s => s !== author.slug);
      contributions = people.contributions;
      hoursByMember = people.hoursByMember;
      hours = hoursByMember[author.slug]; // timeCommitted: still "hours per participant"
    } else {
      const h = parseHours(f.hours);
      hours = h.value;
      if (h.blank || !Number.isFinite(h.value) || h.value <= 0) errors.push(`**Time committed** "${h.raw}" must be a positive number of hours.`);
      else if (kind === 'work-log' && h.value > 24) errors.push('**Time committed** must be 24 hours or less for a single entry.');
    }
    if (layout === 'work-log-legacy') {
      // Old form: ticked names, and one optional line for the poster.
      for (const name of checked(f.collaborators)) {
        const m = allow.members.find(x => x.name === name);
        if (!m) errors.push(`**Collaborators**: "${name}" is not a current team member.`);
        else if (m.slug !== author.slug) collaborators.push(m.slug);
      }
      collaborators = [...new Set(collaborators)];
      const line = (f.yourContribution || '').replace(/\s+/g, ' ').trim();
      if (line.length > 500) errors.push('**Your contribution** must be 500 characters or less — put the detail in the content.');
      else if (PLACEHOLDER.test(line)) errors.push(`**Your contribution** still contains placeholder text ("${placeholderIn(line)}").`);
      else if (line) contributions = { [author.slug]: line };
    }

    // Identifies this exact version of the issue, so the same errors aren't commented twice.
    const fingerprint = crypto.createHash('sha1').update(`${issue.title}\n${issue.body || ''}`).digest('hex').slice(0, 12);
    if (errors.length) return done('invalid', { fingerprint, message: errors.map(e => `- ${e}`).join('\n') });
    core.info(`[post-entry] validation passed (${layout} form); ${images.length} image(s) to download`);

    // ── Download images ────────────────────────────────────────────────
    // The issue number keeps two posts running at once from picking the same file name.
    const imgFolder = kind === 'work-log' ? 'work-log' : 'updates';
    const base = `${date}-${kind === 'work-log' ? author.slug : kebab(title)}-i${number}`;
    const imgDir = path.join(root, 'public', 'img', imgFolder);
    fs.mkdirSync(imgDir, { recursive: true });
    const saved = [];
    try {
      for (let i = 0; i < images.length; i++) {
        const { bytes, ext } = await fetchImage(images[i].url, token);
        let n = i + 1;
        let name = `${base}-${n}.${ext}`;
        while (fs.existsSync(path.join(imgDir, name))) name = `${base}-${++n}.${ext}`;
        fs.writeFileSync(path.join(imgDir, name), bytes);
        const alt = images[i].alt && images[i].alt.toLowerCase() !== 'image' ? images[i].alt : `Photo for "${title}"`;
        saved.push({ src: `/img/${imgFolder}/${name}`, alt });
      }
    } catch (err) {
      return done('invalid', { fingerprint, message: `- **Images**: ${err.message}` });
    }

    // ── Write the Markdown file, from the template ─────────────────────
    const dir = kind === 'work-log'
      ? path.join(root, 'src', 'content', 'work-log', author.slug)
      : path.join(root, 'src', 'content', 'updates');
    let slug = `${date}-${kebab(title)}`;
    for (let n = 2; fs.existsSync(path.join(dir, `${slug}.md`)); n++) slug = `${date}-${kebab(title)}-${n}`;

    let markdown;
    try {
      markdown = render({
        title,
        date,
        ...(kind === 'work-log' ? { author: author.slug, collaborators, contributions, hoursByMember } : {}),
        timeCommitted: hours,
        images: saved,
        issue: number,
        login: issue.user.login,
        content,
      });
    } catch (err) {
      const message = `The entry template could not be filled in, so nothing was posted: ${err.message}`;
      core.setFailed(message);
      return done('misconfigured', { message });
    }
    if (!markdown.split('\n').includes(postedLine(number, issue.user.login))) {
      const message =
        `.github/templates/${TEMPLATE_FILE[kind]} no longer writes the "# Posted from issue #… by @…" line. ` +
        'Without it the bot cannot tell that an issue was already posted, so nothing was written. Put the line back.';
      core.setFailed(message);
      return done('misconfigured', { message });
    }
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${slug}.md`);
    fs.writeFileSync(file, markdown);

    const rel = path.relative(root, file).replace(/\\/g, '/');
    return done('written', { file: rel, url: entryUrl(context, rel) });
  } catch (err) {
    core.setFailed(`post-entry.cjs crashed: ${err.stack || err.message}`);
    return done('error', { message: err.message });
  }
};

const HEADLINES = {
  skip: 'SKIPPED — nothing to post',
  rejected: 'REJECTED — the issue author is not on the allowlist',
  invalid: 'INVALID — the entry failed validation',
  duplicate: 'ALREADY POSTED — this issue has a file in the repo',
  misconfigured: 'NOT CONFIGURED — the allowlist is empty',
  error: 'ERROR — the posting script crashed',
};

/**
 * Runs on every path, after the commit step: comments on the issue, closes it when
 * appropriate, starts the deploy, fails the job when something went wrong, and
 * writes the run summary. `entry` is the build step's outputs; `pushStatus` is the
 * commit step's `status` output (pushed | protected | denied | rebase-failed |
 * failed | nothing), empty when that step didn't run.
 */
module.exports.report = async function report({
  github,
  context,
  core,
  entry = {},
  pushStatus = '',
  pushLogFile = '',
  defaultBranch = 'main',
}) {
  // `entry.result` is github-script's own output, not ours — never read it.
  const result = entry.entry_result || '';
  const issue_number = Number(entry.issue) || context.payload.issue?.number || 0;
  const runUrl = `${context.serverUrl || 'https://github.com'}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;
  const replay = `re-run it from **Actions → Post log entry → Run workflow** with issue number \`${issue_number}\``;

  /** Posts `body` unless a comment carrying `marker` is already on the issue. */
  const comment = async (body, marker) => {
    if (marker) {
      const existing = await github.paginate(github.rest.issues.listComments, { ...context.repo, issue_number, per_page: 100 });
      if (existing.some(c => (c.body || '').includes(marker))) return false;
      body += `\n\n${marker}`;
    }
    await github.rest.issues.createComment({ ...context.repo, issue_number, body });
    return true;
  };
  const close = state_reason => github.rest.issues.update({ ...context.repo, issue_number, state: 'closed', state_reason });

  let headline = HEADLINES[result] || '';
  let failure = '';
  let deploy = '';
  try {
    if (result === '') {
      headline = 'ERROR — the posting script did not finish, so no result was set';
      failure = 'post-entry.cjs did not set a result. See the "Build entry from issue" step log.';
    } else if (result === 'error') {
      failure = entry.message || 'post-entry.cjs crashed.';
    } else if (result === 'misconfigured') {
      await comment(`This entry couldn't be posted, and it is not your fault.\n\n${entry.message}\n\nOnce that is fixed, edit this issue (any change) or ${replay}.`, '<!-- g27:misconfigured -->');
      failure = entry.message;
    } else if (result === 'rejected') {
      await comment(entry.message);
      await close('not_planned');
    } else if (result === 'invalid') {
      await comment(
        `This entry couldn't be posted yet:\n\n${entry.message}\n\nEdit the issue to fix it — it will be retried automatically.`,
        `<!-- g27:invalid:${entry.fingerprint} -->`,
      );
      failure = 'Entry failed validation; details commented on the issue.';
    } else if (result === 'duplicate') {
      await comment(`This issue was already posted as \`${entry.file}\`, so nothing new was written. It is (or will shortly be) live at ${entry.url}`);
      await close('completed');
    } else if (result === 'written' && pushStatus === 'pushed') {
      headline = 'POSTED — entry committed to ' + defaultBranch;
      // Pushes made with GITHUB_TOKEN don't trigger workflows, so start the deploy explicitly.
      try {
        await github.rest.actions.createWorkflowDispatch({ ...context.repo, workflow_id: 'deploy.yml', ref: defaultBranch });
        deploy = 'started';
        await comment(`Posted! It will be live in a couple of minutes at ${entry.url}\n\nFile: \`${entry.file}\``);
      } catch (err) {
        deploy = `could not be started (${err.message})`;
        headline = 'POSTED, BUT NOT DEPLOYED — the deploy workflow could not be started';
        failure = `Entry committed, but deploy.yml could not be started: ${err.message}`;
        await comment(
          `Posted to the repository as \`${entry.file}\`, but the site deploy could not be started automatically (${err.message}). ` +
            `A maintainer needs to run **Deploy site** from the Actions tab; after that it will be live at ${entry.url}`,
        );
      }
      await close('completed');
    } else if (result === 'written') {
      const why = {
        protected:
          `a branch protection rule or ruleset on \`${defaultBranch}\` rejected the push from \`github-actions[bot]\`. ` +
          'A maintainer needs to add **github-actions** as a bypass actor on that ruleset (Settings → Rules → Rulesets), or disable it',
        denied:
          'the workflow token was refused write access to the repository (HTTP 403). ' +
          'A maintainer needs to check that `post-entry.yml` still declares `contents: write` and that no organization policy blocks it',
        'rebase-failed':
          `the new entry could not be rebased onto the latest \`${defaultBranch}\` — most likely another change touched the same file. A maintainer needs to look at the run log`,
        nothing: 'the script reported a file but there was nothing to commit. A maintainer needs to look at the run log',
      }[pushStatus] || `the push to \`${defaultBranch}\` failed twice. A maintainer needs to look at the run log`;
      headline = pushStatus === 'protected'
        ? 'NOT POSTED — branch protection rejected the bot\'s push'
        : `NOT POSTED — the commit could not be pushed (${pushStatus || 'commit step failed'})`;
      failure = `Entry was valid but was not pushed: ${pushStatus || 'commit step failed'}.`;
      await comment(
        `Your entry is valid, but it could not be saved: ${why}, then ${replay}.\n\n` +
          `Nothing is wrong with what you wrote, and this issue is left open so nothing is lost. Run log: ${runUrl}`,
      );
    }
  } catch (err) {
    failure = `${failure ? `${failure} ` : ''}Reporting failed: ${err.message}`;
  } finally {
    const cell = s => String(s || '—').replace(/\r?\n/g, '<br>').replace(/\|/g, '\\|');
    const rows = [
      ['Issue', issue_number ? `#${issue_number}${entry.title ? ` — ${entry.title}` : ''}` : ''],
      ['Trigger', entry.trigger || context.eventName],
      ['Detected kind', entry.kind ? `${entry.kind} (via ${entry.via})` : ''],
      ['Issue author', entry.login ? `@${entry.login}` : ''],
      ['On allowlist', entry.matched === 'yes' ? `yes → ${entry.author}` : entry.matched],
      ['Validation errors', result === 'invalid' ? entry.message : result === 'written' || result === 'duplicate' ? 'none' : ''],
      ['File written', result === 'written' || result === 'duplicate' ? entry.file : 'none'],
      ['Push', pushStatus],
      ['Deploy', deploy],
      ['Detail', result === 'invalid' ? '' : failure || entry.message],
    ];
    let tail = '';
    if (pushStatus && pushStatus !== 'pushed' && pushLogFile && fs.existsSync(pushLogFile)) {
      const log = fs.readFileSync(pushLogFile, 'utf8').trim().split('\n').slice(-20).join('\n');
      if (log) tail = `\n\nLast lines of the push log:\n\n\`\`\`\n${log}\n\`\`\`\n`;
    }
    const table = ['| | |', '|---|---|', ...rows.map(([k, v]) => `| ${k} | ${cell(v)} |`)].join('\n');
    await core.summary.addRaw(`### Post log entry: ${headline}\n\n${table}${tail}\n${headingsReport(entry)}`, true).write();
    if (failure) core.setFailed(`${headline}. ${failure}`);
    else core.notice(headline);
  }
  return { headline, failure, deploy };
};

/**
 * Every "### " heading in the issue and what the parser read it as. A heading that
 * matched no field is flagged: usually it is a member's own sub-heading (kept as
 * text, nothing lost), but if it is a form field, the labels have drifted and that
 * field's value went into the field above it. Fields never found are listed too.
 */
function headingsReport(entry) {
  let list = [];
  try {
    list = JSON.parse(entry.headings || '[]');
  } catch {
    return '\n#### Form headings\n\nCould not read the list of headings from the build step.\n';
  }
  if (!list.length && !entry.missing) return '';
  const code = s => `\`### ${String(s).replace(/`/g, "'").replace(/\|/g, '\\|')}\``;
  const rows = list.map(h =>
    h.field
      ? `| ${code(h.heading)} | ${h.field} |`
      : `| ${code(h.heading)} | ⚠️ **matched no form field** — kept as text inside ${h.inside ? `"${h.inside}"` : 'nothing (it comes before the first field)'} |`,
  );
  const unmatched = list.filter(h => !h.field).length;
  const lines = [
    '',
    `#### Form headings (${entry.form || 'unknown'} form)`,
    '',
    unmatched
      ? `${unmatched} heading(s) matched no field. A member's own sub-heading (e.g. "### Next steps") is expected and harmless. A form field listed here means the parser's labels and the form have drifted apart: its value was read as part of the field above it.`
      : 'Every heading matched a form field.',
    '',
    '| Heading in the issue | Read as |',
    '|---|---|',
    ...rows,
  ];
  if (entry.missing) lines.push('', `⚠️ **Form fields not found in the issue:** ${entry.missing}`);
  return `${lines.join('\n')}\n`;
}

module.exports.parseForm = parseForm;
module.exports.detectKind = detectKind;
module.exports.extractImages = extractImages;
module.exports.parseHours = parseHours;
module.exports.workLogLayout = workLogLayout;
module.exports.readHeading = readHeading;
