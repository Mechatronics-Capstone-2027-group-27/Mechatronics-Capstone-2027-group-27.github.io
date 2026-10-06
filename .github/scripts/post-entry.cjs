// Turns a work-log / major-update issue into a Markdown file (§7.1).
// Called from .github/workflows/post-entry.yml via actions/github-script:
//
//   const run = require('./.github/scripts/post-entry.cjs');
//   await run({ github, context, core, root: process.cwd() });       // build the entry
//   await run.report({ github, context, core, entry, pushStatus });  // comment, close, summarise
//
// run() ALWAYS sets the `entry_result` output — one of:
//   skip | rejected | invalid | written | duplicate | misconfigured | error
// plus: issue, title, trigger, kind, via, login, matched, author, file, url, message, fingerprint.
// It never commits — the workflow does that between run() and report().
//
// The output must NOT be called `result`: actions/github-script writes its script
// block's return value to an output of that name after the block finishes, which
// overwrites anything set here. That silently broke every post once.
//
// Tested offline by `npm run test:post` (scripts/test-post-entry.mjs), which runs the
// workflow's real script blocks the way github-script does.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const NO_RESPONSE = '_No response_';

// Issue-form field labels, in the order the forms emit them. "Content of progress"
// (work log) and "Content" (major update) are the same field. These must match
// .github/ISSUE_TEMPLATE/*.yml character for character — the test harness checks that.
const KIND_FIELD = 'Entry type';
const FIELD_ORDER = {
  [KIND_FIELD]: 0,
  'Title': 1,
  'Date': 2,
  'Collaborators': 3,
  'Time committed': 4,
  'Content of progress': 5,
  'Content': 5,
  'Your contribution': 6,
  'Images': 7,
};
const LAST_FIELD = 'Images';
const fieldKey = label => (label === 'Content of progress' ? 'Content' : label);

/**
 * Issue-form bodies are "### Label\n\nvalue" blocks. Only the form's own labels,
 * in form order, start a new field — so a "### Next steps" heading that a member
 * writes inside their entry stays part of the entry.
 */
function parseForm(body) {
  const lines = (body || '').replace(/\r\n/g, '\n').split('\n');
  const heading = line => line.match(/^### (.+?)\s*$/)?.[1];
  const lastOfLastField = lines.reduce((at, line, i) => (heading(line) === LAST_FIELD ? i : at), -1);

  const fields = {};
  let label = null;
  let order = -1;
  let buf = [];
  const flush = () => {
    if (label === null) return;
    const value = buf.join('\n').trim();
    fields[fieldKey(label)] = value === NO_RESPONSE ? '' : value;
  };
  lines.forEach((line, i) => {
    const h = heading(line);
    const isField =
      h !== undefined && h in FIELD_ORDER && FIELD_ORDER[h] > order && (h !== LAST_FIELD || i === lastOfLastField);
    if (isField) {
      flush();
      label = h;
      order = FIELD_ORDER[h];
      buf = [];
    } else {
      buf.push(line);
    }
  });
  flush();
  return fields;
}

/**
 * Which kind of entry is this issue? Nothing here may depend on a label existing
 * in the repo, so labels are only one of four signals, tried in this order.
 */
function detectKind(issue, fields = parseForm(issue.body)) {
  const marker = (issue.body || '').match(/<!--\s*g27:kind=(work-log|major-update)\s*-->/);
  if (marker) return { kind: marker[1], via: 'body marker' };

  const type = (fields[KIND_FIELD] || '').trim().toLowerCase();
  if (type.startsWith('work log')) return { kind: 'work-log', via: `"${KIND_FIELD}" form field` };
  if (type.startsWith('major update')) return { kind: 'major-update', via: `"${KIND_FIELD}" form field` };

  const labels = (issue.labels || []).map(l => (typeof l === 'string' ? l : l.name));
  if (labels.includes('work-log')) return { kind: 'work-log', via: 'label' };
  if (labels.includes('major-update')) return { kind: 'major-update', via: 'label' };

  const title = issue.title || '';
  if (/^\s*\[\s*work[\s-]*log\s*\]/i.test(title)) return { kind: 'work-log', via: 'title prefix' };
  if (/^\s*\[\s*major[\s-]*update\s*\]/i.test(title)) return { kind: 'major-update', via: 'title prefix' };

  return { kind: null, via: 'none' };
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

module.exports = async function run({
  github,
  context,
  core,
  root = process.cwd(),
  token = process.env.GITHUB_TOKEN,
  issueNumber = process.env.ISSUE_NUMBER,
  fetchImage = download,
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

    const f = parseForm(issue.body);
    const { kind, via } = detectKind(issue, f);
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

    // ── Step 2: parse and validate ─────────────────────────────────────
    const errors = [];
    const title = (f['Title'] || '').trim();
    const date = (f['Date'] || '').trim() || today();
    const hoursRaw = (f['Time committed'] || '').trim().replace(/\s*(hours?|hrs?|h)\.?$/i, '').trim();
    const hours = hoursRaw === '' ? NaN : Number(hoursRaw);
    const content = (f['Content'] || '').trim();
    // The poster's own line for `contributions` (work log only, optional).
    const contribution = kind === 'work-log' ? (f['Your contribution'] || '').replace(/\s+/g, ' ').trim() : '';
    const images = extractImages(f['Images']);

    if (title.length < 5 || title.length > 120) errors.push('**Title** must be 5–120 characters.');
    if (!validDate(date)) errors.push(`**Date** "${date}" is not a real date in YYYY-MM-DD form.`);
    else if (date > today()) errors.push(`**Date** ${date} is in the future.`);
    if (!Number.isFinite(hours) || hours <= 0) errors.push(`**Time committed** "${hoursRaw}" must be a positive number of hours.`);
    else if (kind === 'work-log' && hours > 24) errors.push('**Time committed** must be 24 hours or less for a single entry.');
    if (!content) errors.push('**Content** is empty.');
    if (contribution.length > 500) errors.push('**Your contribution** must be 500 characters or less — put the detail in the content.');
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

    // Identifies this exact version of the issue, so the same errors aren't commented twice.
    const fingerprint = crypto.createHash('sha1').update(`${issue.title}\n${issue.body || ''}`).digest('hex').slice(0, 12);
    if (errors.length) return done('invalid', { fingerprint, message: errors.map(e => `- ${e}`).join('\n') });
    core.info(`[post-entry] validation passed; ${images.length} image(s) to download`);

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
      if (contribution) fm.push('contributions:', `  ${author.slug}: ${yamlStr(contribution)}`);
    }
    fm.push(`timeCommitted: ${hours}`);
    if (saved.length) {
      fm.push('images:');
      for (const s of saved) fm.push(`  - src: ${s.src}`, `    alt: ${yamlStr(s.alt)}`);
    }
    fm.push(`# Posted from issue #${number} by @${issue.user.login}`, 'draft: false', '---', '');
    const file = path.join(dir, `${slug}.md`);
    fs.writeFileSync(file, `${fm.join('\n')}\n${content}\n`);

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
    await core.summary.addRaw(`### Post log entry: ${headline}\n\n${table}${tail}\n`, true).write();
    if (failure) core.setFailed(`${headline}. ${failure}`);
    else core.notice(headline);
  }
  return { headline, failure, deploy };
};

module.exports.parseForm = parseForm;
module.exports.detectKind = detectKind;
module.exports.extractImages = extractImages;
module.exports.FIELD_ORDER = FIELD_ORDER;
