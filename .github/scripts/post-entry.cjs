// Turns a work-log / major-update issue into a Markdown file (§7.1).
// Called from .github/workflows/post-entry.yml via actions/github-script:
//
//   const run = require('./.github/scripts/post-entry.cjs');
//   await run({ github, context, core, root: process.cwd() });
//
// Sets outputs:  result = skip | rejected | invalid | written
//                file, url, message
// It never commits — the workflow does that after this returns.

const fs = require('node:fs');
const path = require('node:path');

const NO_RESPONSE = '_No response_';

/** Issue-form bodies are "### Label\n\nvalue" blocks. */
function parseForm(body) {
  const fields = {};
  const parts = (body || '').replace(/\r\n/g, '\n').split(/^### /m).slice(1);
  for (const part of parts) {
    const nl = part.indexOf('\n');
    const label = part.slice(0, nl).trim();
    const value = part.slice(nl + 1).trim();
    fields[label] = value === NO_RESPONSE ? '' : value;
  }
  return fields;
}

/** Ticked checkbox labels: "- [X] Name". */
function checked(value) {
  return (value || '')
    .split('\n')
    .map(l => l.match(/^- \[[xX]\] (.+)$/))
    .filter(Boolean)
    .map(m => m[1].trim());
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

const yamlStr = s => JSON.stringify(s); // JSON strings are valid YAML scalars

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

async function download(url, token) {
  const headers = {};
  if (/^https:\/\/(github\.com|[\w.-]*githubusercontent\.com)\//.test(url)) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { headers, redirect: 'follow' });
  if (!res.ok) throw new Error(`could not download ${url} (HTTP ${res.status})`);
  const type = (res.headers.get('content-type') || '').split(';')[0].trim();
  const ext = EXT[type] || (url.match(/\.(jpe?g|png|webp|gif|avif)(?:$|\?)/i)?.[1] || '').toLowerCase().replace('jpeg', 'jpg');
  if (!ext) throw new Error(`${url} is not a supported image (${type || 'unknown type'})`);
  return { bytes: Buffer.from(await res.arrayBuffer()), ext };
}

module.exports = async function run({ github, context, core, root = process.cwd(), token = process.env.GITHUB_TOKEN, fetchImage = download }) {
  const issue = context.payload.issue;
  const labels = (issue.labels || []).map(l => (typeof l === 'string' ? l : l.name));
  const kind = labels.includes('work-log') ? 'work-log' : labels.includes('major-update') ? 'major-update' : null;
  const done = (result, extra = {}) => {
    core.setOutput('result', result);
    for (const [k, v] of Object.entries(extra)) core.setOutput(k, v);
    return { result, ...extra };
  };

  if (!kind || issue.state !== 'open') return done('skip');

  // ── Step 1: allowlist gate ─────────────────────────────────────────
  const allow = JSON.parse(fs.readFileSync(path.join(root, '.github', 'allowlist.json'), 'utf8'));
  const login = String(issue.user.login).toLowerCase();
  const author = allow.members.find(m => m.github && m.github.toLowerCase() === login);
  if (!author) {
    return done('rejected', {
      message:
        `Thanks for your interest! Posting to this log is limited to the ${allow.members.length} team members, ` +
        `and @${issue.user.login} isn't on the list, so this issue has been closed automatically. ` +
        'If you are a team member, ask whoever maintains the site to add your GitHub username to `src/config/site.ts`.',
    });
  }

  // ── Step 2: parse and validate ─────────────────────────────────────
  const f = parseForm(issue.body);
  const errors = [];
  const title = (f['Title'] || '').trim();
  const date = (f['Date'] || '').trim() || today();
  const hoursRaw = (f['Time committed'] || '').trim().replace(/h(ours?)?$/i, '').trim();
  const hours = Number(hoursRaw);
  const content = (f['Content of progress'] ?? f['Content'] ?? '').trim();
  const images = extractImages(f['Images']);

  if (title.length < 5 || title.length > 120) errors.push('**Title** must be 5–120 characters.');
  if (!validDate(date)) errors.push(`**Date** "${date}" is not a real date in YYYY-MM-DD form.`);
  else if (date > today()) errors.push(`**Date** ${date} is in the future.`);
  if (!Number.isFinite(hours) || hours <= 0) errors.push(`**Time committed** "${hoursRaw}" must be a positive number of hours.`);
  else if (kind === 'work-log' && hours > 24) errors.push('**Time committed** must be 24 hours or less for a single entry.');
  if (!content) errors.push('**Content** is empty.');
  if (kind === 'major-update' && images.length === 0) errors.push('**Images**: major updates need at least one image.');

  let collaborators = [];
  if (kind === 'work-log') {
    const names = checked(f['Collaborators']);
    for (const name of names) {
      const m = allow.members.find(x => x.name === name);
      if (!m) errors.push(`**Collaborators**: "${name}" is not a current team member.`);
      else if (m.slug !== author.slug) collaborators.push(m.slug);
    }
    collaborators = [...new Set(collaborators)];
  }

  if (errors.length) return done('invalid', { message: errors.map(e => `- ${e}`).join('\n') });

  // ── Download images ────────────────────────────────────────────────
  const base = `${date}-${kind === 'work-log' ? author.slug : kebab(title)}`;
  const imgDir = path.join(root, 'public', 'img', kind === 'work-log' ? 'work-log' : 'updates');
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
      saved.push({ src: `/img/${kind === 'work-log' ? 'work-log' : 'updates'}/${name}`, alt });
    }
  } catch (err) {
    return done('invalid', { message: `- **Images**: ${err.message}` });
  }

  // ── Write the Markdown file ────────────────────────────────────────
  const dir = kind === 'work-log'
    ? path.join(root, 'src', 'content', 'work-log', author.slug)
    : path.join(root, 'src', 'content', 'updates');
  fs.mkdirSync(dir, { recursive: true });
  let slug = `${date}-${kebab(title)}`;
  for (let n = 2; fs.existsSync(path.join(dir, `${slug}.md`)); n++) slug = `${date}-${kebab(title)}-${n}`;

  const fm = ['---', `title: ${yamlStr(title)}`, `date: ${date}`];
  if (kind === 'work-log') {
    fm.push(`author: ${author.slug}`);
    fm.push(`collaborators: [${collaborators.join(', ')}]`);
  }
  fm.push(`timeCommitted: ${hours}`);
  if (saved.length) {
    fm.push('images:');
    for (const s of saved) fm.push(`  - src: ${s.src}`, `    alt: ${yamlStr(s.alt)}`);
  }
  fm.push(`# Posted from issue #${issue.number} by @${issue.user.login}`, 'draft: false', '---', '');
  const file = path.join(dir, `${slug}.md`);
  fs.writeFileSync(file, `${fm.join('\n')}\n${content}\n`);

  const site = `https://${context.repo.owner.toLowerCase()}.github.io`;
  const url = kind === 'work-log' ? `${site}/work-log/${author.slug}/${slug}/` : `${site}/updates/${slug}/`;
  return done('written', { file: path.relative(root, file).replace(/\\/g, '/'), url, author: author.slug });
};

module.exports.parseForm = parseForm;
module.exports.extractImages = extractImages;
