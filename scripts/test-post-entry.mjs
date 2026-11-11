// Offline dry run of the posting pipeline:  npm run test:post
//
// This does NOT call post-entry.cjs directly. It reads .github/workflows/post-entry.yml,
// pulls out the real `script:` blocks, and runs them the way actions/github-script does:
// same arguments, same `require`, and — the part that matters — the same handling of
// outputs. github-script writes the script block's return value to an output called
// `result` AFTER the block finishes, so anything our code stored under that name is
// overwritten. The harness reproduces that, then reads outputs back exactly as the
// workflow does (`steps.entry.outputs.*` and `toJSON(steps.entry.outputs)`).
//
// Every file a test makes the bot write is then read back the way the site build reads
// it — Astro's own frontmatter parser — and checked against the real content schema
// (src/content.schemas.ts). A file that would fail the build fails the test.
//
// Nothing touches the network or the repo: the GitHub API and `fetch` are stubs and
// files are written to a temp folder. The team in these tests is made up on purpose —
// the real one lives in src/config/site.ts.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire, registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT_PATH = path.join(repoRoot, '.github', 'scripts', 'post-entry.cjs');
const run = require(SCRIPT_PATH);
const { parseForm, detectKind, parseHours } = run;
const { fieldsFor, memberLabels, normalizeLabel } = require(path.join(repoRoot, '.github', 'scripts', 'form-fields.cjs'));
const { compile, TemplateError } = require(path.join(repoRoot, '.github', 'scripts', 'entry-template.cjs'));

// The site's own code is TypeScript written for Vite: imports without a ".ts" extension,
// and the virtual "astro:content" module. These hooks let plain Node load it so the
// tests use the real schema and the real hour arithmetic, not copies of them.
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'astro:content') {
      return { url: 'data:text/javascript,export const getCollection = async () => [];', shortCircuit: true };
    }
    try {
      return next(specifier, context);
    } catch (err) {
      if (specifier.startsWith('.') && context.parentURL?.endsWith('.ts')) return next(`${specifier}.ts`, context);
      throw err;
    }
  },
});
const { workLogSchema, updateSchema } = await import(pathToFileURL(path.join(repoRoot, 'src', 'content.schemas.ts')).href);
const entries = await import(pathToFileURL(path.join(repoRoot, 'src', 'lib', 'entries.ts')).href);
// The parsers the build itself uses: Astro's frontmatter reader, and js-yaml (which it
// wraps) for the issue forms. Both come with Astro; neither is a dependency of ours.
const { parseFrontmatter } = await import('@astrojs/internal-helpers/frontmatter');
const yaml = (await import('js-yaml')).default;

// ── The workflow, as written ──────────────────────────────────────────
const workflow = fs.readFileSync(path.join(repoRoot, '.github', 'workflows', 'post-entry.yml'), 'utf8').replace(/\r\n/g, '\n');

/** One step of the `post` job: its github-script `script:` block, `if:` and result-encoding. */
function workflowStep(name) {
  const lines = workflow.split('\n');
  const start = lines.findIndex(l => l.trim() === `- name: ${name}`);
  assert.notEqual(start, -1, `post-entry.yml has no step named "${name}"`);
  let end = lines.findIndex((l, i) => i > start && /^ {6}- /.test(l));
  if (end === -1) end = lines.length;
  const block = lines.slice(start, end);
  const at = block.findIndex(l => /^\s+script: \|\s*$/.test(l));
  let script = null;
  if (at !== -1) {
    const indent = block[at].match(/^ */)[0].length;
    const body = [];
    for (const l of block.slice(at + 1)) {
      if (l.trim() !== '' && l.match(/^ */)[0].length <= indent) break;
      body.push(l);
    }
    script = body.join('\n');
  }
  return {
    script,
    condition: block.find(l => /^\s+if: /.test(l))?.replace(/^\s+if:\s*/, '').trim(),
    encoding: block.find(l => /^\s+result-encoding: /.test(l))?.split(':')[1].trim() || 'json',
  };
}
const BUILD = workflowStep('Build entry from issue');
const COMMIT = workflowStep('Commit and push');
const REPORT = workflowStep('Report outcome');

/** `steps.entry.outputs.<name> == '<value>'` — the only shape of condition the workflow uses. */
const gate = COMMIT.condition?.match(/^steps\.entry\.outputs\.(\w+) == '(\w+)'$/);
assert.ok(gate, `"Commit and push" has an if: this harness cannot read: ${COMMIT.condition}`);
const [, RESULT_KEY, WRITTEN] = gate;

/** @actions/core's setOutput: every value becomes a string; the last write to a name wins. */
function fakeCore() {
  const core = {
    outputs: {},
    failures: [],
    notices: [],
    warnings: [],
    log: [],
    summaryText: '',
    setOutput(k, v) { this.outputs[k] = v == null ? '' : typeof v === 'string' ? v : JSON.stringify(v); },
    setFailed(m) { this.failures.push(String(m)); },
    notice(m) { this.notices.push(String(m)); },
    warning(m) { this.warnings.push(String(m)); },
    info(m) { this.log.push(String(m)); },
  };
  core.summary = {
    addRaw(text) { core.summaryText += text; return this; },
    async write() {},
  };
  return core;
}

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;

/**
 * Runs one `script:` block as actions/github-script would: wraps it in an async function,
 * resolves relative require() from the workspace, and afterwards sets the `result` output
 * to the block's return value. `module` swaps post-entry.cjs for a stub.
 */
async function githubScript(step, { github, context, env, cwd, module }) {
  const core = fakeCore();
  const scriptRequire = id => {
    if (!id.startsWith('.')) return require(id);
    const file = path.resolve(repoRoot, id);
    return module !== undefined && file === SCRIPT_PATH ? module : require(file);
  };
  const scriptProcess = { env, cwd: () => cwd };
  try {
    const fn = new AsyncFunction('github', 'context', 'core', 'require', 'process', step.script);
    const value = await fn(github, context, core, scriptRequire, scriptProcess);
    core.setOutput('result', step.encoding === 'string' ? String(value) : JSON.stringify(value));
  } catch (err) {
    core.setFailed(`Unhandled error: ${err}`);
  }
  return core;
}

// ── Fixtures ──────────────────────────────────────────────────────────
const TEAM = [
  { slug: 'ada-one', name: 'Ada One', github: 'ada1' },
  { slug: 'bo-two', name: 'Bo Two', github: 'BoTwo' },
  { slug: 'cy-three', name: 'Cy Three', github: null },
  { slug: 'di-four', name: 'Di Four', github: 'di4' },
  { slug: 'ed-five', name: 'Ed Five', github: null },
];
const EMPTY_TEAM = TEAM.map(m => ({ ...m, github: null }));
const name = slug => TEAM.find(m => m.slug === slug).name;

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
const JPG = Buffer.from('ffd8ffe000104a4649460001', 'hex');
const ATTACHMENT = 'https://github.com/user-attachments/assets/11111111-2222-3333-4444-555555555555';
const ATTACHMENT_2 = 'https://github.com/user-attachments/assets/66666666-7777-8888-9999-000000000000';

const section = (label, value) => `### ${label}\n\n${value === '' ? '_No response_' : value}`;

/** Per-person boxes for the work-log form: { slug: { c: contribution, h: hours } }. */
const DEFAULT_PEOPLE = {
  'ada-one': { c: '', h: '2.5' },
  'bo-two': { c: 'Held the latch and called out each reading.', h: '2.5' },
};

/**
 * An issue body exactly as GitHub renders a submitted issue form: every field's heading,
 * in form order, "_No response_" for a blank one. Labels come from form-fields.cjs, the
 * module that also writes the real form (checked against it in a test below).
 */
function formBody(kind, o = {}) {
  const v = {
    type: kind === 'work-log' ? 'Work log entry' : 'Major update',
    title: 'Bench test of the release latch',
    date: '2026-09-30',
    hours: '2.5', // major update only
    content: 'Ran the latch through twenty cycles on the bench and logged the release force each time.',
    people: DEFAULT_PEOPLE,
    images: kind === 'work-log' ? '' : `![Latch on the bench](${ATTACHMENT})`,
    label: (m, field) => memberLabels(m)[field], // how a per-person heading is spelled
    ...o,
  };
  const parts = [];
  if (v.type !== null) parts.push(section('Entry type', v.type));
  parts.push(section('Title', v.title), section('Date', v.date));
  if (kind === 'work-log') {
    // Form order: content, then Media (Images), then each person's hours and contribution.
    parts.push(section('Content of progress', v.content), section('Images', v.images));
    for (const m of TEAM) {
      const p = v.people[m.slug] || { c: '', h: '' };
      if (p.h !== null) parts.push(section(v.label(m, 'hours'), p.h));
      if (p.c !== null) parts.push(section(v.label(m, 'contribution'), p.c));
    }
  } else {
    parts.push(section('Time committed', v.hours), section('Content', v.content), section('Images', v.images));
  }
  return parts.join('\n\n');
}

/** The work-log form as it was before per-person boxes (collaborator checkboxes). */
function legacyBody(o = {}) {
  const v = {
    type: 'Work log entry',
    title: 'Bench test of the release latch',
    date: '2026-09-30',
    collaborators: ['Bo Two'],
    hours: '2.5',
    content: 'Ran the latch through twenty cycles on the bench and logged the release force each time.',
    contribution: '',
    images: '',
    ...o,
  };
  const parts = [];
  if (v.type !== null) parts.push(section('Entry type', v.type));
  parts.push(section('Title', v.title), section('Date', v.date));
  parts.push(section('Collaborators', TEAM.map(m => `- [${v.collaborators.includes(m.name) ? 'X' : ' '}] ${m.name}`).join('\n')));
  parts.push(section('Time committed', v.hours), section('Content of progress', v.content));
  if (v.contribution !== null) parts.push(section('Your contribution', v.contribution));
  parts.push(section('Images', v.images));
  return parts.join('\n\n');
}

function makeIssue(kind, o = {}, form = {}) {
  return {
    number: 7,
    state: 'open',
    title: kind === 'work-log' ? '[Work log] Bench test' : '[Major update] Bench test',
    labels: [{ name: kind }],
    user: { login: 'ada1' },
    body: formBody(kind, form),
    ...o,
  };
}
const legacyIssue = (o = {}, form = {}) => ({ ...makeIssue('work-log'), body: legacyBody(form), ...o });

/** One fake job: a temp workspace, a fake GitHub API and a fake network. */
function harness(issue, { team = TEAM, comments = [], eventName = 'issues', deployFails = false, apiFails = false, imageStatus = 200 } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'g27-post-'));
  fs.mkdirSync(path.join(root, '.github'), { recursive: true });
  fs.writeFileSync(path.join(root, '.github', 'allowlist.json'), JSON.stringify({ members: team }));

  const calls = [];
  const github = {
    rest: {
      issues: {
        get: async () => {
          if (apiFails) throw new Error('Not Found');
          return { data: issue };
        },
        listComments: 'listComments',
        createComment: async a => void calls.push({ type: 'comment', body: a.body }),
        update: async a => void calls.push({ type: 'close', reason: a.state_reason }),
      },
      actions: {
        createWorkflowDispatch: async a => {
          if (deployFails) throw new Error('Resource not accessible by integration');
          calls.push({ type: 'deploy', workflow: a.workflow_id, ref: a.ref });
        },
      },
    },
    paginate: async () => comments,
  };
  const context = {
    eventName,
    payload: eventName === 'issues' ? { action: 'opened', issue: { number: issue.number } } : {},
    repo: { owner: 'Example-Org', repo: 'example-org.github.io' },
    runId: 1,
    serverUrl: 'https://github.com',
  };
  // The real download() runs; only the network underneath it is fake. The second
  // attachment answers application/octet-stream, as a storage redirect can.
  const fetched = [];
  const fetchStub = async url => {
    fetched.push(String(url));
    if (imageStatus !== 200) return new Response('', { status: imageStatus });
    return String(url) === ATTACHMENT_2
      ? new Response(JPG, { status: 200, headers: { 'content-type': 'application/octet-stream' } })
      : new Response(PNG, { status: 200, headers: { 'content-type': 'image/png' } });
  };
  return { issue, root, team, calls, github, context, fetched, fetchStub, eventName, read: rel => fs.readFileSync(path.join(root, rel), 'utf8') };
}

/**
 * Reads a written entry the way the site build does and checks it against the real
 * schema. Returns the parsed frontmatter (after the schema's defaults) and the body.
 */
function readEntry(h, rel = h.out.file) {
  const text = h.read(rel);
  const { frontmatter, rawFrontmatter, content } = parseFrontmatter(text);
  assert.ok(rawFrontmatter, `${rel}: Astro found no frontmatter in it`);
  const isLog = rel.includes('/work-log/');
  const schema = isLog ? workLogSchema(h.team, path.join(h.root, 'public')) : updateSchema(path.join(h.root, 'public'));
  const checked = schema.safeParse(frontmatter);
  assert.ok(checked.success, `${rel} fails the content schema:\n${checked.error?.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('\n')}\n---\n${text}`);
  if (isLog) assert.equal(rel.split('/').at(-2), checked.data.author, `${rel}: folder and author differ`);
  return { data: checked.data, raw: frontmatter, body: content, text };
}

/** Runs the "Build entry from issue" step. `h.out` is steps.entry.outputs, as strings. */
async function build(h, { module } = {}) {
  // The workflow sets ISSUE_NUMBER on the step from `inputs.issue_number` (empty on issue events).
  const issueNumber = h.eventName === 'workflow_dispatch' ? String(h.issue.number) : '';
  const env = { GITHUB_TOKEN: 'test-token', ISSUE_NUMBER: issueNumber };
  const realFetch = globalThis.fetch;
  const realNumber = process.env.ISSUE_NUMBER;
  globalThis.fetch = h.fetchStub;
  process.env.ISSUE_NUMBER = issueNumber;
  try {
    h.entry = await githubScript(BUILD, { github: h.github, context: h.context, env, cwd: h.root, module });
  } finally {
    globalThis.fetch = realFetch;
    if (realNumber === undefined) delete process.env.ISSUE_NUMBER;
    else process.env.ISSUE_NUMBER = realNumber;
  }
  h.out = h.entry.outputs;
  h.result = h.out[RESULT_KEY] ?? ''; // what `steps.entry.outputs.<key>` evaluates to
  h.commitRuns = h.result === WRITTEN; // the "Commit and push" step's if:
  // Every file written by any test must be one the site would build.
  if (h.result === 'written') h.md = readEntry(h);
  return h;
}
const post = (issue, opts) => build(harness(issue, opts));

/** Runs the "Report outcome" step with the env the workflow gives it. */
async function reportFor(h, { pushStatus = '', entry = h.out } = {}) {
  const env = { ENTRY: JSON.stringify(entry), PUSH_STATUS: pushStatus, PUSH_LOG: path.join(h.root, 'push.log'), DEFAULT_BRANCH: 'main' };
  h.report = await githubScript(REPORT, { github: h.github, context: h.context, env, cwd: h.root });
  return h.report;
}
const types = calls => calls.map(c => c.type);
const people = obj => Object.fromEntries(Object.entries(obj).map(([slug, [c, h]]) => [slug, { c, h }]));

// ── Cases ─────────────────────────────────────────────────────────────
const cases = [];
const test = (title, fn) => cases.push({ name: title, fn });

// ── Workflow plumbing ──
test('workflow plumbing: the output the workflow gates on survives github-script', async () => {
  assert.notEqual(RESULT_KEY, 'result', 'github-script overwrites the `result` output with the script block\'s return value');
  const used = [...workflow.matchAll(/steps\.entry\.outputs\.(\w+)/g)].map(m => m[1]);
  assert.ok(!used.includes('result'), 'post-entry.yml reads steps.entry.outputs.result, which belongs to github-script');
  const h = await post(makeIssue('work-log'));
  for (const n of used) assert.ok(n in h.out, `post-entry.yml reads steps.entry.outputs.${n}, which the script never sets`);
  assert.equal(h.result, 'written');
  assert.equal(h.commitRuns, true, 'the "Commit and push" step must run for a valid entry');
  assert.deepEqual(h.entry.failures, []);
});

test('the script logs that it was entered and how it exited', async () => {
  const h = await post(makeIssue('work-log'));
  assert.match(h.entry.log[0], /^\[post-entry\] entered/);
  assert.match(h.entry.log.at(-1), /^\[post-entry\] exit: written/);
  const rejected = await post(makeIssue('work-log', { user: { login: 'stranger' } }));
  assert.match(rejected.entry.log.at(-1), /^\[post-entry\] exit: rejected/);
});

test('a script that returns without a result fails the build step itself', async () => {
  for (const module of [async () => undefined, async () => ({}), { notAFunction: true }]) {
    const h = await build(harness(makeIssue('work-log')), { module });
    assert.equal(h.entry.failures.length, 1, 'the step must fail when no result comes back');
    assert.equal(h.commitRuns, false);
  }
});

// ── Basic posting ──
test('valid work-log entry is written to the author\'s folder', async () => {
  const h = await post(makeIssue('work-log'));
  assert.equal(h.result, 'written');
  assert.equal(h.out.file, 'src/content/work-log/ada-one/2026-09-30-bench-test-of-the-release-latch.md');
  assert.equal(h.out.url, 'https://example-org.github.io/work-log/ada-one/2026-09-30-bench-test-of-the-release-latch/');
  const md = h.md.text;
  assert.match(md, /^title: "Bench test of the release latch"$/m);
  assert.match(md, /^date: 2026-09-30$/m);
  assert.match(md, /^author: ada-one$/m);
  assert.match(md, /^collaborators: \[bo-two\]$/m);
  assert.match(md, /^timeCommitted: 2\.5$/m);
  assert.match(md, /^# Posted from issue #7 by @ada1$/m);
  assert.match(md, /twenty cycles/);
  assert.deepEqual(h.md.data.contributions, { 'bo-two': 'Held the latch and called out each reading.' });
  assert.deepEqual(h.md.data.hoursByMember, { 'ada-one': 2.5, 'bo-two': 2.5 });
  assert.equal(h.out.matched, 'yes');
  assert.equal(h.out.issue, '7');
  assert.equal(h.out.form, 'work-log');
});

test('valid major update is written to updates/ with its image', async () => {
  const h = await post(makeIssue('major-update', { user: { login: 'botwo' } }, { hours: '22' }));
  assert.equal(h.result, 'written');
  assert.equal(h.out.file, 'src/content/updates/2026-09-30-bench-test-of-the-release-latch.md');
  const md = h.md.text;
  assert.doesNotMatch(md, /^(author|collaborators|contributions|hoursByMember):/m);
  assert.match(md, /^timeCommitted: 22$/m);
  assert.match(md, /src: \/img\/updates\/2026-09-30-bench-test-of-the-release-latch-i7-1\.png/);
  assert.match(md, /alt: "Latch on the bench"/);
  assert.deepEqual(h.fetched, [ATTACHMENT]);
  assert.equal(h.out.form, 'major-update');
});

test('unknown author is rejected, and told who IS on the allowlist', async () => {
  const h = await post(makeIssue('work-log', { user: { login: 'stranger' } }));
  assert.equal(h.result, 'rejected');
  assert.equal(h.commitRuns, false);
  assert.match(h.out.message, /@stranger is not on the allowlist/);
  assert.match(h.out.message, /`ada1`, `BoTwo`, `di4`/);
  assert.match(h.out.message, /No username is set yet for: Cy Three, Ed Five/);
  assert.equal(h.out.matched, 'no');
  const r = await reportFor(h);
  assert.deepEqual(types(h.calls), ['comment', 'close']);
  assert.equal(h.calls[1].reason, 'not_planned');
  assert.deepEqual(r.failures, []);
  assert.match(r.summaryText, /REJECTED/);
});

test('empty allowlist fails the job loudly instead of rejecting', async () => {
  const h = await post(makeIssue('work-log'), { team: EMPTY_TEAM });
  assert.equal(h.result, 'misconfigured');
  assert.equal(h.entry.failures.length, 1);
  assert.match(h.entry.failures[0], /allowlist has not been filled in/);
  assert.match(h.entry.failures[0], /npm run sync:allowlist/);
  const r = await reportFor(h);
  assert.deepEqual(types(h.calls), ['comment'], 'comments once, does not close the issue');
  assert.match(h.calls[0].body, /not your fault/);
  assert.match(r.summaryText, /NOT CONFIGURED/);
  assert.equal(r.failures.length, 1);
});

// ── Kind detection ──
test('missing label but correct title prefix still posts', async () => {
  const h = await post(makeIssue('work-log', { labels: [] }, { type: null }));
  assert.equal(h.out.via, 'title prefix');
  assert.equal(h.result, 'written');
});

test('no label and no title prefix: the "Entry type" form field is enough', async () => {
  const h = await post(makeIssue('major-update', { labels: [], title: 'Bench test' }));
  assert.equal(h.out.kind, 'major-update');
  assert.equal(h.out.via, '"Entry type" form field');
  assert.equal(h.result, 'written');
});

test('issue filed before the form had an "Entry type" field posts via its label', async () => {
  const h = await post(makeIssue('work-log', { title: 'Bench test' }, { type: null }));
  assert.equal(h.out.via, 'label');
  assert.equal(h.result, 'written');
});

test('"Entry type" left on None, blank or missing falls back to the label, then the title prefix', async () => {
  // "None" is what an optional dropdown submits when nothing is selected; null drops the field.
  for (const type of ['None', '', null]) {
    for (const kind of ['work-log', 'major-update']) {
      const dir = kind === 'work-log' ? 'src/content/work-log/ada-one/' : 'src/content/updates/';
      const byLabel = await post(makeIssue(kind, { title: 'Bench test' }, { type }));
      assert.equal(byLabel.out.kind, kind, `type ${JSON.stringify(type)}: label should decide`);
      assert.equal(byLabel.out.via, 'label');
      assert.equal(byLabel.result, 'written');
      assert.ok(byLabel.out.file.startsWith(dir));

      const byTitle = await post(makeIssue(kind, { labels: [] }, { type }));
      assert.equal(byTitle.out.kind, kind, `type ${JSON.stringify(type)}: title prefix should decide`);
      assert.equal(byTitle.out.via, 'title prefix');
      assert.equal(byTitle.result, 'written');
      assert.ok(byTitle.out.file.startsWith(dir));
    }
  }
  // The other fields are still read correctly when the first one says None.
  const h = await post(makeIssue('work-log', {}, { type: 'None' }));
  assert.equal(h.md.data.title, 'Bench test of the release latch');
  // With no signal at all the run says so instead of guessing.
  const none = await post(makeIssue('work-log', { labels: [], title: 'Bench test' }, { type: 'None' }));
  assert.equal(none.result, 'skip');
  assert.match(none.out.message, /Not a log entry/);
});

test('the "Entry type" field is not required on either form', async () => {
  for (const file of ['work-log-entry.yml', 'major-update.yml']) {
    const form = yaml.load(fs.readFileSync(path.join(repoRoot, '.github', 'ISSUE_TEMPLATE', file), 'utf8'));
    const field = form.body.find(b => b.attributes?.label === 'Entry type');
    assert.ok(field, `${file}: no Entry type field`);
    assert.equal(field.attributes.default, 0);
    assert.notEqual(field.validations?.required, true, `${file}: a required Entry type blocks posting when GitHub shows "None"`);
  }
});

test('a hand-written <!-- g27:kind=… --> marker wins over everything else', async () => {
  const issue = makeIssue('work-log', { labels: [{ name: 'major-update' }], title: 'x' }, { type: null });
  issue.body = `<!-- g27:kind=work-log -->\n\n${issue.body}`;
  assert.deepEqual(detectKind(issue), { kind: 'work-log', via: 'body marker' });
});

// ── Per-person contributions (Change A) ──
test('all five contribution boxes filled: everyone is a participant', async () => {
  const p = people({
    'ada-one': ['Wrote the test plan.', '3'],
    'bo-two': ['Built the rig.', '3'],
    'cy-three': ['Ran the logger.', '3'],
    'di-four': ['Took photos and notes.', '3'],
    'ed-five': ['Attended, no specific deliverable', '3'],
  });
  const h = await post(makeIssue('work-log', {}, { people: p }));
  assert.equal(h.result, 'written');
  assert.deepEqual(h.md.data.collaborators, ['bo-two', 'cy-three', 'di-four', 'ed-five'], 'everyone but the author, in team order');
  assert.deepEqual(Object.keys(h.md.data.contributions), ['ada-one', 'bo-two', 'cy-three', 'di-four', 'ed-five']);
  assert.equal(h.md.data.contributions['ed-five'], 'Attended, no specific deliverable');
  assert.equal(Object.keys(h.md.data.hoursByMember).length, 5);
});

test('two boxes filled: the author and one other', async () => {
  const h = await post(makeIssue('work-log', {}, { people: people({ 'ada-one': ['Wrote it up.', '1'], 'di-four': ['Soldered the board.', '2'] }) }));
  assert.equal(h.result, 'written');
  assert.deepEqual(h.md.data.collaborators, ['di-four']);
  assert.deepEqual(h.md.data.contributions, { 'ada-one': 'Wrote it up.', 'di-four': 'Soldered the board.' });
  // Posted by Di: Di's lines come first in the file, then the rest of the team in order.
  const di = await post(makeIssue('work-log', { user: { login: 'di4' } }, { people: people({ 'ada-one': ['Wrote it up.', '1'], 'di-four': ['Soldered the board.', '2'] }) }));
  assert.equal(di.md.data.author, 'di-four');
  assert.deepEqual(Object.keys(di.md.data.contributions), ['di-four', 'ada-one']);
  assert.deepEqual(Object.keys(di.md.data.hoursByMember), ['di-four', 'ada-one']);
  assert.deepEqual(di.md.data.collaborators, ['ada-one']);
  assert.equal(di.md.data.timeCommitted, 2);
  assert.deepEqual(h.md.data.hoursByMember, { 'ada-one': 1, 'di-four': 2 });
  assert.equal(h.md.data.timeCommitted, 1, 'timeCommitted is the author\'s own hours');
});

test('no boxes filled: the author alone is the participant, from their hours', async () => {
  const h = await post(makeIssue('work-log', {}, { people: people({ 'ada-one': ['', '4'] }) }));
  assert.equal(h.result, 'written');
  assert.match(h.md.text, /^collaborators: \[\]$/m);
  assert.doesNotMatch(h.md.text, /contributions/, 'no empty contributions key');
  assert.deepEqual(h.md.data.hoursByMember, { 'ada-one': 4 });
  assert.equal(h.md.data.timeCommitted, 4);
});

test('a box with only whitespace, or only "_No response_", counts as blank', async () => {
  const h = await post(makeIssue('work-log', {}, {
    people: people({ 'ada-one': ['  \n\t \n', '2'], 'bo-two': ['_No response_', ''], 'cy-three': ['   _No response_  ', ''] }),
  }));
  assert.equal(h.result, 'written');
  assert.deepEqual(h.md.data.collaborators, []);
  assert.deepEqual(h.md.data.contributions, {});
});

test('a contribution keeps its Markdown: headings, lists, blank lines, and YAML-looking text', async () => {
  const text = [
    '## What I did',
    '',
    '- Wired the **servo** harness',
    '- Logged: 12 readings # not a comment',
    '',
    '### Results',
    '',
    '1. key: value stays text',
    '---',
    '    indented code {{title}}',
  ].join('\n');
  const lead = '  Two leading spaces on the first line.\nThen normal.';
  const h = await post(makeIssue('work-log', {}, { people: people({ 'ada-one': [text, '2'], 'bo-two': [lead, '1'] }) }));
  assert.equal(h.result, 'written');
  assert.equal(h.md.data.contributions['ada-one'], text, 'read back exactly as written');
  assert.equal(h.md.data.contributions['bo-two'], lead.trim(), 'trimmed like every field, otherwise exact');
  assert.match(h.md.body, /twenty cycles/, 'the body is untouched by the contribution\'s "---" line');
});

test('participation is decided by the contribution box, and the poster is always in', async () => {
  // Bo's hours appear with no contribution: invalid (tested below). Here: Bo's text, no
  // hours from Cy, and Ada's own box blank — Ada is still the author and a participant.
  const h = await post(makeIssue('work-log', {}, { people: people({ 'ada-one': ['', '2'], 'bo-two': ['Did the wiring.', '2'] }) }));
  assert.equal(h.md.data.author, 'ada-one');
  assert.deepEqual(entries.participants(h.md), ['ada-one', 'bo-two']);
});

// ── Per-person hours (Change A2) ──
test('five people with five different hours: each goes to hoursByMember', async () => {
  const p = people({ 'ada-one': ['A', '1'], 'bo-two': ['B', '2'], 'cy-three': ['C', '3.25'], 'di-four': ['D', '4'], 'ed-five': ['E', '5.5'] });
  const h = await post(makeIssue('work-log', {}, { people: p }));
  assert.equal(h.result, 'written');
  assert.deepEqual(h.md.data.hoursByMember, { 'ada-one': 1, 'bo-two': 2, 'cy-three': 3.25, 'di-four': 4, 'ed-five': 5.5 });
  assert.equal(h.md.data.timeCommitted, 1);
});

test('team total is the sum of hoursByMember, not timeCommitted × participants', async () => {
  const p = people({ 'ada-one': ['A', '1'], 'bo-two': ['B', '2'], 'cy-three': ['C', '3.25'], 'di-four': ['D', '4'], 'ed-five': ['E', '5.5'] });
  const h = await post(makeIssue('work-log', {}, { people: p }));
  const e = h.md; // { data } — the shape src/lib/entries.ts reads
  assert.equal(entries.personHours(e), 15.75);
  assert.equal(entries.workLogStats([e]).personHours, 15.75);
  assert.notEqual(entries.personHours(e), e.data.timeCommitted * entries.participants(e).length);
  for (const [slug, hours] of Object.entries(e.data.hoursByMember)) assert.equal(entries.hoursFor(e, slug), hours);
  assert.equal(entries.memberStats([e], 'ed-five').hours, 5.5);
  // And an old-style entry (no hoursByMember) still means hours per participant.
  const old = { data: { author: 'ada-one', collaborators: ['bo-two', 'cy-three', 'di-four', 'ed-five'], timeCommitted: 2, hoursByMember: {} } };
  assert.equal(entries.personHours(old), 10, 'the merged 2026-09-29 shape: 2 h × 5 people = 10 person-hours');
});

test('"2.5", "2.5 h", "2.5 hrs", "2.5 hours" (and "3h") are all accepted as hours', async () => {
  for (const raw of ['2.5', '2.5 h', '2.5 hrs', '2.5 hours', '2.5h', '2.5 Hours.']) {
    const h = await post(makeIssue('work-log', {}, { people: people({ 'ada-one': ['', raw], 'bo-two': ['Helped.', raw] }) }));
    assert.equal(h.result, 'written', `"${raw}" should be accepted: ${h.out.message}`);
    assert.deepEqual(h.md.data.hoursByMember, { 'ada-one': 2.5, 'bo-two': 2.5 });
    assert.equal(h.md.data.timeCommitted, 2.5);
  }
  assert.equal(parseHours('3h').value, 3);
});

test('a filled contribution with blank hours is INVALID and names the person', async () => {
  const h = await post(makeIssue('work-log', {}, { people: people({ 'ada-one': ['', '2'], 'bo-two': ['Built the rig.', ''] }) }));
  assert.equal(h.result, 'invalid');
  assert.match(h.out.message, /\*\*Bo Two\*\*: the contribution is filled in but the hours are blank/);
  assert.equal(fs.existsSync(path.join(h.root, 'src')), false, 'nothing written');
});

test('a filled contribution with 0 hours is INVALID and names the person', async () => {
  for (const zero of ['0', '0 h', '0.0']) {
    const h = await post(makeIssue('work-log', {}, { people: people({ 'ada-one': ['', '2'], 'bo-two': ['Built the rig.', zero] }) }));
    assert.equal(h.result, 'invalid');
    assert.match(h.out.message, /\*\*Bo Two\*\*: hours "0[^"]*" must be a number more than 0/);
  }
});

test('hours filled with a blank contribution is INVALID and names the person', async () => {
  const h = await post(makeIssue('work-log', {}, { people: people({ 'ada-one': ['', '2'], 'di-four': ['', '1.5'] }) }));
  assert.equal(h.result, 'invalid');
  assert.match(h.out.message, /\*\*Di Four\*\*: hours are filled in \("1\.5"\) but the contribution box is blank/);
});

test('placeholder text like "[TODO: …]" in a box is INVALID, names the person, and writes nothing', async () => {
  for (const text of ["[TODO: Bo's part]", '[todo]', 'Built the rig. [ TODO fill in the rest ]', '[TODO: unfinished bracket']) {
    const h = await post(makeIssue('work-log', {}, { people: people({ 'ada-one': ['', '2'], 'bo-two': [text, '1'] }) }));
    assert.equal(h.result, 'invalid', `${JSON.stringify(text)} should be refused`);
    assert.match(h.out.message, /\*\*Bo Two\*\*: the contribution still contains placeholder text \("\[/);
    assert.equal(fs.existsSync(path.join(h.root, 'src')), false, 'nothing written');
  }
  // The author's own box, the title, the content and the old form's line are covered too.
  const own = await post(makeIssue('work-log', {}, { people: people({ 'ada-one': ['[TODO: mine]', '2'] }) }));
  assert.match(own.out.message, /\*\*Ada One\*\* \(you\): the contribution still contains placeholder text/);
  const title = await post(makeIssue('work-log', {}, { title: 'Latch test [TODO: date]' }));
  assert.match(title.out.message, /\*\*Title\*\* still contains placeholder text \("\[TODO: date\]"\)/);
  const content = await post(makeIssue('work-log', {}, { content: 'Ran the latch.\n\n[TODO: results]' }));
  assert.match(content.out.message, /\*\*Content\*\* still contains placeholder text \("\[TODO: results\]"\)/);
  const major = await post(makeIssue('major-update', {}, { content: '[TODO]' }));
  assert.match(major.out.message, /\*\*Content\*\* still contains placeholder text/);
  const legacy = await post(legacyIssue({}, { contribution: '[TODO: my part]' }));
  assert.match(legacy.out.message, /\*\*Your contribution\*\* still contains placeholder text/);
  // The before/after demo issue, as typed: refused, with all four people named.
  const demo = await post(makeIssue('work-log', {}, {
    people: people({ 'ada-one': ["[TODO: Ada's part]", '1'], 'bo-two': ["[TODO: Bo's part]", '1'], 'cy-three': ["[TODO: Cy's part]", '1'], 'di-four': ["[TODO: Di's part]", '1'] }),
  }));
  assert.equal(demo.result, 'invalid');
  for (const who of ['Ada One', 'Bo Two', 'Cy Three', 'Di Four']) assert.ok(demo.out.message.includes(`**${who}**`), `names ${who}`);
});

test('the word TODO in ordinary prose is not placeholder text', async () => {
  const text = 'Went through our TODO list and closed three items (see todo.md). Brackets [like this] are fine.';
  const h = await post(makeIssue('work-log', {}, { content: text, people: people({ 'ada-one': ['Cleared the TODO backlog.', '2'] }) }));
  assert.equal(h.result, 'written', h.out.message);
  assert.equal(h.md.data.contributions['ada-one'], 'Cleared the TODO backlog.');
});

test('the author\'s own hours are required; nonsense and > 24 hours are invalid', async () => {
  const blank = await post(makeIssue('work-log', {}, { people: people({ 'ada-one': ['Wrote it.', ''] }) }));
  assert.equal(blank.result, 'invalid');
  assert.match(blank.out.message, /\*\*Ada One\*\* \(you\): your own hours are required/);
  const words = await post(makeIssue('work-log', {}, { people: people({ 'ada-one': ['', 'a couple'] }) }));
  assert.match(words.out.message, /hours "a couple" must be a number more than 0/);
  const long = await post(makeIssue('work-log', {}, { people: people({ 'ada-one': ['', '25'] }) }));
  assert.match(long.out.message, /hours must be 24 or less/);
});

test('several problems are all reported at once', async () => {
  const h = await post(makeIssue('work-log', {}, {
    title: 'Hey',
    people: people({ 'ada-one': ['', ''], 'bo-two': ['Built it.', ''], 'cy-three': ['', '2'] }),
  }));
  assert.equal(h.result, 'invalid');
  assert.equal(h.out.message.split('\n').length, 4);
  for (const who of ['Title', 'Ada One', 'Bo Two', 'Cy Three']) assert.ok(h.out.message.includes(who), `should mention ${who}`);
  const major = await post(makeIssue('major-update', {}, { title: 'Hey', hours: '-1', images: '' }));
  assert.equal(major.out.message.split('\n').length, 3);
});

// ── Robustness: headings ──
test('per-person headings are found whatever GitHub does to case, spaces, dashes and punctuation', async () => {
  const nbsp = String.fromCharCode(0xa0);
  const variants = [
    (m, f) => `${m.name} – ${f}`, // en dash
    (m, f) => `${m.name} - ${f}:`, // hyphen, trailing colon
    (m, f) => `${m.name.toUpperCase()}${String.fromCharCode(0x2014)}${f.toUpperCase()}`, // no spaces, caps
    (m, f) => `${m.name.replace(' ', nbsp)} ${String.fromCharCode(0x2014)} ${f}${nbsp}`, // non-breaking spaces
    (m, f) => `  ${m.name}   ${String.fromCharCode(0x2014)}   ${f} .`, // extra spaces, trailing dot
  ];
  for (const label of variants) {
    const h = await post(makeIssue('work-log', {}, { label, people: people({ 'ada-one': ['Mine.', '2'], 'bo-two': ['Theirs.', '1'] }) }));
    assert.equal(h.result, 'written', `${label(TEAM[1], 'hours')}: ${h.out.message}`);
    assert.deepEqual(h.md.data.contributions, { 'ada-one': 'Mine.', 'bo-two': 'Theirs.' });
    assert.deepEqual(h.md.data.hoursByMember, { 'ada-one': 2, 'bo-two': 1 });
    assert.deepEqual(JSON.parse(h.out.headings).filter(x => !x.field), [], 'every heading matched');
  }
});

test('a "### heading" that matches no field is reported in the summary, not dropped', async () => {
  const content = 'Tested the latch.\n\n### Next steps\n\nOrder springs.';
  const h = await post(makeIssue('work-log', {}, { content }));
  assert.equal(h.result, 'written');
  assert.match(h.md.body, /### Next steps\n\nOrder springs\./, 'kept in the text');
  const found = JSON.parse(h.out.headings);
  assert.deepEqual(found.filter(x => !x.field), [{ heading: 'Next steps', field: null, inside: 'Content of progress' }]);
  assert.ok(found.some(x => x.field === 'Bo Two — hours'), 'matched headings are listed too');
  assert.ok(h.entry.warnings.some(w => w.includes('"### Next steps" matched no form field')), 'and annotated on the run');
  const r = await reportFor(h, { pushStatus: 'pushed' });
  assert.match(r.summaryText, /#### Form headings \(work-log form\)/);
  assert.match(r.summaryText, /\| `### Next steps` \| ⚠️ \*\*matched no form field\*\* — kept as text inside "Content of progress" \|/);
  assert.match(r.summaryText, /\| `### Title` \| Title \|/);
});

test('a per-person heading for someone not on the team stops the post instead of losing their part', async () => {
  const issue = makeIssue('work-log');
  // A renamed or added member whose block GitHub emits but the allowlist doesn't know.
  issue.body += '\n\n### Zed Six — hours\n\n3\n\n### Zed Six — contribution\n\nDid the CAD.';
  const h = await post(issue);
  assert.equal(h.result, 'invalid');
  assert.match(h.out.message, /\*\*Form\*\*: the section "Zed Six — contribution" does not match any team member/);
  const r = await reportFor(h);
  assert.match(r.summaryText, /`### Zed Six — hours` \| ⚠️ \*\*matched no form field\*\*/);
});

test('form fields missing from the issue are listed in the summary', async () => {
  const h = await post(makeIssue('work-log', {}, { people: { ...DEFAULT_PEOPLE, 'cy-three': { c: '', h: null } } }));
  assert.equal(h.result, 'written');
  assert.equal(h.out.missing, 'Cy Three — hours');
  const r = await reportFor(h, { pushStatus: 'pushed' });
  assert.match(r.summaryText, /Form fields not found in the issue:\*\* Cy Three — hours/);
});

test('"### " headings inside the entry are kept, not treated as form fields', async () => {
  const content = 'Tested the latch.\n\n### Next steps\n\nOrder springs.\n\n### Content\n\nMore.\n\n### Images\n\nSee below.';
  const h = await post(makeIssue('work-log', {}, { content, images: `![Rig](${ATTACHMENT})` }));
  assert.equal(h.result, 'written');
  assert.match(h.md.body, /### Next steps\n\nOrder springs\./);
  assert.match(h.md.body, /### Content\n\nMore\./);
  assert.match(h.md.body, /### Images\n\nSee below\./);
  assert.equal(h.md.data.images[0].alt, 'Rig');
});

test('a copy of any field\'s heading typed inside someone\'s text stays text, wherever that field sits', async () => {
  // Images now comes right after Content, so "### Images" in Content must not cut it short.
  const content = 'Ran the latch.\n\n### Images\n\nPhotos are below.\n\n### Ada One — hours\n\nnot a field';
  // A contribution quoting an EARLIER field's heading and a LATER person's heading.
  const ada = 'Wrote it up.\n\n### Title\n\nstill Ada\'s text\n\n### Bo Two — hours\n\n9';
  const h = await post(makeIssue('work-log', {}, {
    content,
    images: `![Rig](${ATTACHMENT})`,
    people: people({ 'ada-one': [ada, '2'], 'bo-two': ['Held the latch.', '1.5'], 'ed-five': ['Took notes.\n\n### Images\n\nnone', '1'] }),
  }));
  assert.equal(h.result, 'written', h.out.message);
  assert.equal(h.md.body.trim(), content, 'content kept whole, including its "### Images" and hours-looking lines');
  assert.equal(h.md.data.images[0].alt, 'Rig', 'the real Images field still read');
  assert.equal(h.md.data.contributions['ada-one'], ada, 'Ada\'s text kept whole');
  assert.equal(h.md.data.hoursByMember['bo-two'], 1.5, 'Bo\'s real hours, not the 9 inside Ada\'s text');
  assert.equal(h.md.data.contributions['ed-five'], 'Took notes.\n\n### Images\n\nnone', 'the last field too');
  const unmatched = JSON.parse(h.out.headings).filter(x => !x.field).map(x => `${x.heading} @ ${x.inside}`);
  assert.deepEqual(unmatched, [
    'Images @ Content of progress',
    'Ada One — hours @ Content of progress',
    'Title @ Ada One — contribution',
    'Bo Two — hours @ Ada One — contribution',
    'Images @ Ed Five — contribution',
  ], 'each copy is reported, with the field it was kept in');
});

// ── YAML safety (Change B) ──
test('adversarial titles cannot break the file: colon, quote, leading dash, #, emoji, newline, digits', async () => {
  const titles = [
    'Re: latch test: round 2',
    'The "quick" fix, and \'single\' quotes',
    '- leading dash title',
    '#3 and # mid-title',
    'Launch day 🚀🎈 (balloon)',
    '12345',
    'false',
    'null ~ yes',
    'Line one\nline two',
    'Back\\slash and {{title}} and $& here',
  ];
  for (const title of titles) {
    const h = await post(makeIssue('work-log', {}, { title }));
    assert.equal(h.result, 'written', `${JSON.stringify(title)}: ${h.out.message}`);
    assert.equal(h.md.data.title, title, `${JSON.stringify(title)} must read back as the same string`);
    assert.equal(typeof h.md.raw.title, 'string');
  }
  const long = await post(makeIssue('work-log', {}, { title: 'x'.repeat(200) }));
  assert.equal(long.result, 'invalid');
  assert.match(long.out.message, /\*\*Title\*\* must be 5–120 characters/);
});

test('optional fields that are absent leave no empty key and no stray blank line', async () => {
  const h = await post(makeIssue('work-log', {}, { people: people({ 'ada-one': ['', '2'] }) }));
  const fm = h.md.text.split('\n---\n')[0];
  assert.doesNotMatch(fm, /^(contributions|images):/m);
  assert.doesNotMatch(fm, /\n\n/, 'no blank line inside the frontmatter');
  assert.doesNotMatch(h.md.text, /[ \t]$/m, 'no trailing spaces anywhere');
  assert.doesNotMatch(h.md.text, /\{\{|\}\}/, 'no template syntax left over');
  assert.match(h.md.text, /^---\ntitle: /, 'the file starts with its frontmatter');
  assert.match(h.md.text, /\ndraft: false\n---\n\nRan the latch/, 'one blank line, then the body');
});

test('a placeholder the script does not know fails the run, naming it', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'g27-tpl-'));
  const real = fs.readFileSync(path.join(repoRoot, '.github', 'templates', 'work-log-entry.md'), 'utf8');
  fs.writeFileSync(path.join(dir, 'work-log-entry.md'), real.replace('draft: false', 'draft: false\nmood: {{mood}}'));
  const module = Object.assign(args => run({ ...args, templatesDir: dir }), run);
  const h = await build(harness(makeIssue('work-log')), { module });
  assert.equal(h.result, 'misconfigured');
  assert.match(h.out.message, /unknown placeholder \{\{mood\}\}/);
  assert.match(h.entry.failures[0], /\{\{mood\}\}/);
  assert.equal(fs.existsSync(path.join(h.root, 'public')), false, 'checked before anything is downloaded or written');
  const r = await reportFor(h);
  assert.match(h.calls[0].body, /not your fault/);
  assert.equal(r.failures.length, 1);
});

test('a template that loses the "# Posted from issue" line fails rather than risk double posts', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'g27-tpl-'));
  const real = fs.readFileSync(path.join(repoRoot, '.github', 'templates', 'work-log-entry.md'), 'utf8');
  fs.writeFileSync(path.join(dir, 'work-log-entry.md'), real.replace(/^# Posted from.*$/m, ''));
  const module = Object.assign(args => run({ ...args, templatesDir: dir }), run);
  const h = await build(harness(makeIssue('work-log')), { module });
  assert.equal(h.result, 'misconfigured');
  assert.match(h.out.message, /no longer writes the "# Posted from issue/);
  assert.equal(fs.existsSync(path.join(h.root, 'src')), false);
});

test('template mistakes are caught when it is read, each with a clear message', async () => {
  const cases2 = [
    ['---\ntitle: {{title}}\n', /no closing "---"/],
    ['title: {{title}}\n---\n---\n', /must start with a "---" line/],
    ['---\ntitle: {{ nope }}\n---\n', /unknown placeholder \{\{nope\}\}/],
    ['---\ntitle: {title}}\n---\n', /"\{\{" or "\}\}" that is not a placeholder/],
    ['---\ncontent: {{content}}\n---\n', /is the entry body and cannot go inside the frontmatter/],
    ['---\n---\n{{title}}\n', /must go between the two "---" lines/],
    ['---\n  images: {{images}}\n---\n', /must be alone as the value of a top-level key/],
  ];
  for (const [text, want] of cases2) {
    assert.throws(() => compile(text, 't.md'), err => err instanceof TemplateError && want.test(err.message), `${JSON.stringify(text)} should fail with ${want}`);
  }
  // Comments, including ones that mention placeholders, vanish without a trace.
  const render = compile('{{!-- header {{title}} --}}\n\n---\n{{! note }}\ntitle: {{title}} {{! inline }}\n{{! two\n\nline note }}\n---\n\n{{content}}\n');
  assert.equal(render({ title: 'T: x', content: 'Body' }), '---\ntitle: "T: x"\n---\n\nBody\n');
  assert.throws(() => compile('---\ntitle: {{title}}\n---\n')({}), /required placeholder \{\{title\}\} has no value/);
});

test('both real templates read well-formed and use only known placeholders', async () => {
  for (const file of ['work-log-entry.md', 'major-update.md']) {
    const text = fs.readFileSync(path.join(repoRoot, '.github', 'templates', file), 'utf8');
    assert.doesNotThrow(() => compile(text, file));
    assert.match(text, /^# Posted from issue #\{\{issue\}\} by @\{\{login\}\}$/m, `${file} must keep the "# Posted from" line`);
  }
});

// ── Images ──
test('entry with two images saves both and records both', async () => {
  const images = `![Image](${ATTACHMENT})\n<img width="800" alt="Force plot" src="${ATTACHMENT_2}" />`;
  const h = await harness(makeIssue('work-log', {}, { images }));
  await build(h);
  assert.equal(h.result, 'written');
  assert.deepEqual(h.fetched, [ATTACHMENT, ATTACHMENT_2]);
  const dir = path.join(h.root, 'public', 'img', 'work-log');
  assert.deepEqual(fs.readdirSync(dir).sort(), ['2026-09-30-ada-one-i7-1.png', '2026-09-30-ada-one-i7-2.jpg']);
  assert.deepEqual(fs.readFileSync(path.join(dir, '2026-09-30-ada-one-i7-2.jpg')), JPG);
  assert.match(h.md.text, /src: \/img\/work-log\/2026-09-30-ada-one-i7-1\.png\n    alt: "Photo for \\"Bench test of the release latch\\""/);
  assert.match(h.md.text, /src: \/img\/work-log\/2026-09-30-ada-one-i7-2\.jpg\n    alt: "Force plot"/);
});

test('an image that cannot be downloaded is reported, not thrown', async () => {
  const h = await post(makeIssue('major-update'), { imageStatus: 404 });
  assert.equal(h.result, 'invalid');
  assert.match(h.out.message, /\*\*Images\*\*: could not download .* \(HTTP 404\)/);
  assert.deepEqual(h.fetched, [ATTACHMENT, ATTACHMENT], 'tries without credentials, then once with the token');
});

// ── Other validation ──
test('future date is invalid', async () => {
  const h = await post(makeIssue('work-log', {}, { date: '2999-01-01' }));
  assert.equal(h.result, 'invalid');
  assert.match(h.out.message, /\*\*Date\*\* 2999-01-01 is in the future/);
});

test('missing required field (empty content) is invalid and writes nothing', async () => {
  const h = await post(makeIssue('work-log', {}, { content: '' }));
  assert.equal(h.result, 'invalid');
  assert.match(h.out.message, /\*\*Content\*\* is empty/);
  assert.equal(fs.existsSync(path.join(h.root, 'src')), false);
});

test('major update: malformed team-hours are invalid, "22 hrs" is fine', async () => {
  const bad = await post(makeIssue('major-update', {}, { hours: 'a couple' }));
  assert.equal(bad.result, 'invalid');
  assert.match(bad.out.message, /\*\*Time committed\*\* "a couple" must be a positive number/);
  const ok = await post(makeIssue('major-update', {}, { hours: '22 hrs' }));
  assert.equal(ok.md.data.timeCommitted, 22);
});

// ── The old form still posts ──
test('an issue from the old form (collaborator checkboxes) still posts, with the same fields as before', async () => {
  const h = await post(legacyIssue({}, { contribution: 'Ran the bench test: "twenty" cycles, logged by hand.' }));
  assert.equal(h.result, 'written');
  assert.equal(h.out.form, 'work-log-legacy');
  // Same fields and order as before; the contribution is now a block scalar, like every contribution.
  assert.match(h.md.text, /^collaborators: \[bo-two\]\ncontributions:\n  ada-one: \|-\n    Ran the bench test: "twenty" cycles, logged by hand\.\ntimeCommitted: 2\.5\n# Posted/m);
  assert.equal(h.md.data.contributions['ada-one'], 'Ran the bench test: "twenty" cycles, logged by hand.');
  assert.doesNotMatch(h.md.text, /hoursByMember/);
  for (const contribution of ['', null]) {
    const none = await post(legacyIssue({}, { contribution }));
    assert.equal(none.result, 'written');
    assert.doesNotMatch(none.md.text, /contributions/);
  }
  const self = await post(legacyIssue({}, { collaborators: ['Ada One', 'Bo Two', 'Cy Three'] }));
  assert.deepEqual(self.md.data.collaborators, ['bo-two', 'cy-three'], 'ticking yourself is ignored');
  const long = await post(legacyIssue({}, { contribution: 'x'.repeat(501) }));
  assert.match(long.out.message, /\*\*Your contribution\*\* must be 500 characters or less/);
  const hrs = await post(legacyIssue({}, { hours: '3h' }));
  assert.equal(hrs.md.data.timeCommitted, 3);
});

// ── Skips, duplicates and crashes ──
test('an unrelated issue is skipped, visibly', async () => {
  const h = await post({ number: 9, state: 'open', title: 'Site is slow', labels: [], user: { login: 'ada1' }, body: 'It takes ages.' });
  assert.equal(h.result, 'skip');
  assert.equal(h.out.kind, 'none');
  assert.deepEqual(h.entry.failures, []);
  const r = await reportFor(h);
  assert.deepEqual(h.calls, []);
  assert.deepEqual(r.failures, []);
  assert.match(r.summaryText, /SKIPPED/);
  assert.match(r.summaryText, /Not a log entry/);
});

test('a closed issue is skipped on an issue event, but a manual replay posts it', async () => {
  const closed = makeIssue('work-log', { state: 'closed' });
  const a = await post(closed);
  assert.equal(a.result, 'skip');
  const b = await post(closed, { eventName: 'workflow_dispatch' });
  assert.equal(b.result, 'written');
  assert.equal(b.out.trigger, 'workflow_dispatch');
});

test('an issue that already has a file is not posted twice', async () => {
  const h = await post(makeIssue('work-log'));
  const first = h.out.file;
  await build(h);
  assert.equal(h.result, 'duplicate');
  assert.equal(h.out.file, first);
  assert.equal(fs.readdirSync(path.join(h.root, 'src/content/work-log/ada-one')).length, 1);
  await reportFor(h);
  assert.deepEqual(types(h.calls), ['comment', 'close']);
  assert.equal(h.calls[1].reason, 'completed');
});

test('a crash still sets a result and fails the build step', async () => {
  const h = await post(makeIssue('work-log'), { apiFails: true });
  assert.equal(h.result, 'error');
  assert.match(h.entry.failures[0], /crashed/);
  const r = await reportFor(h);
  assert.match(r.summaryText, /the posting script crashed/);
});

// ── Report step ──
test('report: written + pushed → starts deploy, comments, closes, writes the summary', async () => {
  const h = await post(makeIssue('work-log'));
  const r = await reportFor(h, { pushStatus: 'pushed' });
  assert.deepEqual(types(h.calls), ['deploy', 'comment', 'close']);
  assert.deepEqual(h.calls[0], { type: 'deploy', workflow: 'deploy.yml', ref: 'main' });
  assert.match(h.calls[1].body, /^Posted! It will be live/);
  assert.equal(h.calls[2].reason, 'completed');
  assert.deepEqual(r.failures, []);
  for (const want of ['POSTED', '#7', 'work-log (via "Entry type" form field)', '@ada1', 'yes → ada-one', h.out.file, 'pushed', 'started', 'Every heading matched a form field.']) {
    assert.ok(r.summaryText.includes(want), `summary should mention ${want}`);
  }
});

test('report: push rejected by branch protection → explains it on the issue, leaves it open', async () => {
  const h = await post(makeIssue('work-log'));
  const r = await reportFor(h, { pushStatus: 'protected' });
  assert.deepEqual(types(h.calls), ['comment']);
  assert.match(h.calls[0].body, /branch protection rule or ruleset on `main` rejected the push/);
  assert.match(h.calls[0].body, /\*\*github-actions\*\* as a bypass actor/);
  assert.match(h.calls[0].body, /issue number `7`/);
  assert.equal(r.failures.length, 1);
  assert.match(r.summaryText, /branch protection rejected/);
});

test('report: commit step died without a status → still explained and failed', async () => {
  const h = await post(makeIssue('work-log'));
  const r = await reportFor(h, { pushStatus: '' });
  assert.deepEqual(types(h.calls), ['comment']);
  assert.equal(r.failures.length, 1);
});

test('report: deploy cannot be started → entry kept, issue told, job failed', async () => {
  const h = await post(makeIssue('work-log'), { deployFails: true });
  const r = await reportFor(h, { pushStatus: 'pushed' });
  assert.deepEqual(types(h.calls), ['comment', 'close']);
  assert.match(h.calls[0].body, /deploy could not be started automatically/);
  assert.equal(r.failures.length, 1);
});

test('report: invalid → comments once, and not again for the same unchanged issue', async () => {
  const issue = makeIssue('work-log', {}, { people: people({ 'ada-one': ['', 'lots'] }) });
  const first = await post(issue);
  const r1 = await reportFor(first);
  assert.deepEqual(types(first.calls), ['comment']);
  assert.match(first.calls[0].body, /Ada One/);
  assert.equal(r1.failures.length, 1);
  assert.match(r1.summaryText, /Ada One/);

  const second = await post(issue, { comments: [{ body: first.calls[0].body }] });
  const r2 = await reportFor(second);
  assert.deepEqual(second.calls, [], 'same errors are not commented twice');
  assert.equal(r2.failures.length, 1);
});

test('report: no result at all → summary says so and the job fails', async () => {
  const h = harness(makeIssue('work-log'));
  // What the step's outputs look like when only github-script's own `result` was set.
  for (const entry of [{}, { result: '' }, { result: 'written' }]) {
    const r = await reportFor(h, { entry });
    assert.match(r.summaryText, /did not finish/);
    assert.equal(r.failures.length, 1);
  }
});

// ── The real repo ──
test('the real issue forms ask exactly the fields the parser reads, in its order', async () => {
  const allow = JSON.parse(fs.readFileSync(path.join(repoRoot, '.github', 'allowlist.json'), 'utf8'));
  for (const [file, layout] of [['work-log-entry.yml', 'work-log'], ['major-update.yml', 'major-update']]) {
    const form = yaml.load(fs.readFileSync(path.join(repoRoot, '.github', 'ISSUE_TEMPLATE', file), 'utf8'));
    const asked = form.body.filter(b => b.type !== 'markdown').map(b => b.attributes.label);
    const expected = fieldsFor(layout, allow.members).map(f => f.label);
    assert.deepEqual(asked, expected, `${file}: the form's fields and post-entry.cjs's expected headings differ`);
    // A body built from the real form's own labels parses with nothing unmatched or missing.
    const option = form.body.find(b => b.attributes?.label === 'Entry type').attributes.options[0];
    const body = asked.map(l => section(l, l === 'Entry type' ? option : 'x')).join('\n\n');
    assert.equal(detectKind({ title: '', labels: [], body }).kind, layout, `${file}: "Entry type" option "${option}" is not recognised`);
    const parsed = parseForm(body, fieldsFor(layout, allow.members));
    assert.deepEqual(parsed.missing, []);
    assert.deepEqual(parsed.headings.filter(h => !h.field), []);
  }
  // No old fields left on the work-log form.
  const yml = fs.readFileSync(path.join(repoRoot, '.github', 'ISSUE_TEMPLATE', 'work-log-entry.yml'), 'utf8');
  assert.doesNotMatch(yml, /type: checkboxes|label: (Collaborators|Time committed|Your contribution)$/m);
});

test('every expected heading normalises to a different key (no two fields can collide)', async () => {
  const allow = JSON.parse(fs.readFileSync(path.join(repoRoot, '.github', 'allowlist.json'), 'utf8'));
  for (const layout of ['work-log', 'work-log-legacy', 'major-update']) {
    const keys = fieldsFor(layout, allow.members).map(f => normalizeLabel(f.label));
    assert.equal(new Set(keys).size, keys.length, `${layout}: two labels normalise to the same heading`);
  }
});

test('the real allowlist has at least one GitHub username in it', async () => {
  const allow = JSON.parse(fs.readFileSync(path.join(repoRoot, '.github', 'allowlist.json'), 'utf8'));
  const set = allow.members.filter(m => typeof m.github === 'string' && m.github && !m.github.startsWith('TODO'));
  assert.ok(set.length > 0, 'every member has github: null — run `npm run sync:allowlist` after editing src/config/site.ts');
});

test('every existing entry in the repo still satisfies the schema', async () => {
  const { MEMBERS } = await import(pathToFileURL(path.join(repoRoot, 'src', 'config', 'site.ts')).href);
  const schema = workLogSchema(MEMBERS, path.join(repoRoot, 'public'));
  const dir = path.join(repoRoot, 'src', 'content', 'work-log');
  let n = 0;
  for (const rel of fs.readdirSync(dir, { recursive: true }).map(String).filter(f => f.endsWith('.md'))) {
    const { frontmatter } = parseFrontmatter(fs.readFileSync(path.join(dir, rel), 'utf8'));
    const r = schema.safeParse(frontmatter);
    assert.ok(r.success, `${rel}: ${r.error?.issues.map(i => i.message).join('; ')}`);
    n++;
  }
  assert.ok(n > 0);
});

// ── Runner ────────────────────────────────────────────────────────────
let failed = 0;
for (const { name: title, fn } of cases) {
  try {
    await fn();
    console.log(`  ok    ${title}`);
  } catch (err) {
    failed++;
    console.log(`  FAIL  ${title}\n        ${String(err.message).split('\n').join('\n        ')}`);
  }
}
console.log(`\n${cases.length - failed} of ${cases.length} passed`);
process.exit(failed ? 1 : 0);
