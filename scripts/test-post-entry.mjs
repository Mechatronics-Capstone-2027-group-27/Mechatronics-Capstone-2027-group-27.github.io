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
// Nothing touches the network or the repo: the GitHub API and `fetch` are stubs and
// files are written to a temp folder. The team in these tests is made up on purpose —
// the real one lives in src/config/site.ts.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT_PATH = path.join(repoRoot, '.github', 'scripts', 'post-entry.cjs');
const { parseForm, detectKind, FIELD_ORDER } = require(SCRIPT_PATH);

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
    log: [],
    summaryText: '',
    setOutput(k, v) { this.outputs[k] = v == null ? '' : typeof v === 'string' ? v : JSON.stringify(v); },
    setFailed(m) { this.failures.push(String(m)); },
    notice(m) { this.notices.push(String(m)); },
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
];
const EMPTY_TEAM = TEAM.map(m => ({ ...m, github: null }));

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
const JPG = Buffer.from('ffd8ffe000104a4649460001', 'hex');
const ATTACHMENT = 'https://github.com/user-attachments/assets/11111111-2222-3333-4444-555555555555';
const ATTACHMENT_2 = 'https://github.com/user-attachments/assets/66666666-7777-8888-9999-000000000000';

const section = (label, value) => `### ${label}\n\n${value === '' ? '_No response_' : value}`;

/** An issue body exactly as GitHub renders a submitted issue form. */
function formBody(kind, o = {}) {
  const v = {
    type: kind === 'work-log' ? 'Work log entry' : 'Major update',
    title: 'Bench test of the release latch',
    date: '2026-09-30',
    collaborators: ['Bo Two'],
    hours: '2.5',
    content: 'Ran the latch through twenty cycles on the bench and logged the release force each time.',
    images: kind === 'work-log' ? '' : `![Latch on the bench](${ATTACHMENT})`,
    ...o,
  };
  const parts = [];
  if (v.type !== null) parts.push(section('Entry type', v.type));
  parts.push(section('Title', v.title), section('Date', v.date));
  if (kind === 'work-log') {
    parts.push(section('Collaborators', TEAM.map(m => `- [${v.collaborators.includes(m.name) ? 'X' : ' '}] ${m.name}`).join('\n')));
  }
  parts.push(section('Time committed', v.hours));
  parts.push(section(kind === 'work-log' ? 'Content of progress' : 'Content', v.content));
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
  return { issue, root, calls, github, context, fetched, fetchStub, eventName, read: rel => fs.readFileSync(path.join(root, rel), 'utf8') };
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

// ── Cases ─────────────────────────────────────────────────────────────
const cases = [];
const test = (name, fn) => cases.push({ name, fn });

test('workflow plumbing: the output the workflow gates on survives github-script', async () => {
  assert.notEqual(RESULT_KEY, 'result', 'github-script overwrites the `result` output with the script block\'s return value');
  const used = [...workflow.matchAll(/steps\.entry\.outputs\.(\w+)/g)].map(m => m[1]);
  assert.ok(!used.includes('result'), 'post-entry.yml reads steps.entry.outputs.result, which belongs to github-script');
  const h = await post(makeIssue('work-log'));
  for (const name of used) assert.ok(name in h.out, `post-entry.yml reads steps.entry.outputs.${name}, which the script never sets`);
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

test('valid work-log entry is written to the author\'s folder', async () => {
  const h = await post(makeIssue('work-log'));
  assert.equal(h.result, 'written');
  assert.equal(h.out.file, 'src/content/work-log/ada-one/2026-09-30-bench-test-of-the-release-latch.md');
  assert.equal(h.out.url, 'https://example-org.github.io/work-log/ada-one/2026-09-30-bench-test-of-the-release-latch/');
  const md = h.read(h.out.file);
  assert.match(md, /^title: "Bench test of the release latch"$/m);
  assert.match(md, /^date: 2026-09-30$/m);
  assert.match(md, /^author: ada-one$/m);
  assert.match(md, /^collaborators: \[bo-two\]$/m);
  assert.match(md, /^timeCommitted: 2\.5$/m);
  assert.match(md, /^# Posted from issue #7 by @ada1$/m);
  assert.match(md, /twenty cycles/);
  assert.equal(h.out.matched, 'yes');
  assert.equal(h.out.issue, '7');
});

test('valid major update is written to updates/ with its image', async () => {
  const h = await post(makeIssue('major-update', { user: { login: 'botwo' } }, { hours: '22' }));
  assert.equal(h.result, 'written');
  assert.equal(h.out.file, 'src/content/updates/2026-09-30-bench-test-of-the-release-latch.md');
  const md = h.read(h.out.file);
  assert.doesNotMatch(md, /^author:/m);
  assert.match(md, /^timeCommitted: 22$/m);
  assert.match(md, /src: \/img\/updates\/2026-09-30-bench-test-of-the-release-latch-i7-1\.png/);
  assert.match(md, /alt: "Latch on the bench"/);
  assert.deepEqual(h.fetched, [ATTACHMENT]);
});

test('unknown author is rejected, and told who IS on the allowlist', async () => {
  const h = await post(makeIssue('work-log', { user: { login: 'stranger' } }));
  assert.equal(h.result, 'rejected');
  assert.equal(h.commitRuns, false);
  assert.match(h.out.message, /@stranger is not on the allowlist/);
  assert.match(h.out.message, /`ada1`, `BoTwo`/);
  assert.match(h.out.message, /No username is set yet for: Cy Three/);
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

test('future date is invalid', async () => {
  const h = await post(makeIssue('work-log', {}, { date: '2999-01-01' }));
  assert.equal(h.result, 'invalid');
  assert.match(h.out.message, /\*\*Date\*\* 2999-01-01 is in the future/);
});

test('malformed hours value is invalid', async () => {
  const h = await post(makeIssue('work-log', {}, { hours: 'a couple' }));
  assert.equal(h.result, 'invalid');
  assert.match(h.out.message, /\*\*Time committed\*\* "a couple" must be a positive number/);
});

test('"2.5 hrs" and "3h" are accepted as hours', async () => {
  const a = await post(makeIssue('work-log', {}, { hours: '2.5 hrs' }));
  assert.match(a.read(a.out.file), /^timeCommitted: 2\.5$/m);
  const b = await post(makeIssue('work-log', {}, { hours: '3h' }));
  assert.match(b.read(b.out.file), /^timeCommitted: 3$/m);
});

test('missing required field (empty content) is invalid and writes nothing', async () => {
  const h = await post(makeIssue('work-log', {}, { content: '' }));
  assert.equal(h.result, 'invalid');
  assert.match(h.out.message, /\*\*Content\*\* is empty/);
  assert.equal(fs.existsSync(path.join(h.root, 'src')), false);
});

test('several problems are all reported at once', async () => {
  const h = await post(makeIssue('major-update', {}, { title: 'Hey', hours: '-1', images: '' }));
  assert.equal(h.result, 'invalid');
  assert.equal(h.out.message.split('\n').length, 3);
});

test('entry with two images saves both and records both', async () => {
  const images = `![Image](${ATTACHMENT})\n<img width="800" alt="Force plot" src="${ATTACHMENT_2}" />`;
  const h = await post(makeIssue('work-log', {}, { images }));
  assert.equal(h.result, 'written');
  assert.deepEqual(h.fetched, [ATTACHMENT, ATTACHMENT_2]);
  const dir = path.join(h.root, 'public', 'img', 'work-log');
  assert.deepEqual(fs.readdirSync(dir).sort(), ['2026-09-30-ada-one-i7-1.png', '2026-09-30-ada-one-i7-2.jpg']);
  assert.deepEqual(fs.readFileSync(path.join(dir, '2026-09-30-ada-one-i7-2.jpg')), JPG);
  const md = h.read(h.out.file);
  assert.match(md, /src: \/img\/work-log\/2026-09-30-ada-one-i7-1\.png\n    alt: "Photo for \\"Bench test of the release latch\\""/);
  assert.match(md, /src: \/img\/work-log\/2026-09-30-ada-one-i7-2\.jpg\n    alt: "Force plot"/);
});

test('an image that cannot be downloaded is reported, not thrown', async () => {
  const h = await post(makeIssue('major-update'), { imageStatus: 404 });
  assert.equal(h.result, 'invalid');
  assert.match(h.out.message, /\*\*Images\*\*: could not download .* \(HTTP 404\)/);
  assert.deepEqual(h.fetched, [ATTACHMENT, ATTACHMENT], 'tries without credentials, then once with the token');
});

test('"### " headings inside the entry are kept, not treated as form fields', async () => {
  const content = 'Tested the latch.\n\n### Next steps\n\nOrder springs.\n\n### Content\n\nMore.\n\n### Images\n\nSee below.';
  const h = await post(makeIssue('work-log', {}, { content, images: `![Rig](${ATTACHMENT})` }));
  assert.equal(h.result, 'written');
  const md = h.read(h.out.file);
  assert.match(md, /### Next steps\n\nOrder springs\./);
  assert.match(md, /### Content\n\nMore\./);
  assert.match(md, /### Images\n\nSee below\./);
  assert.match(md, /alt: "Rig"/);
});

test('ticking yourself as a collaborator is ignored', async () => {
  const h = await post(makeIssue('work-log', {}, { collaborators: ['Ada One', 'Bo Two', 'Cy Three'] }));
  assert.match(h.read(h.out.file), /^collaborators: \[bo-two, cy-three\]$/m);
});

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

test('report: written + pushed → starts deploy, comments, closes, writes the summary', async () => {
  const h = await post(makeIssue('work-log'));
  const r = await reportFor(h, { pushStatus: 'pushed' });
  assert.deepEqual(types(h.calls), ['deploy', 'comment', 'close']);
  assert.deepEqual(h.calls[0], { type: 'deploy', workflow: 'deploy.yml', ref: 'main' });
  assert.match(h.calls[1].body, /^Posted! It will be live/);
  assert.equal(h.calls[2].reason, 'completed');
  assert.deepEqual(r.failures, []);
  for (const want of ['POSTED', '#7', 'work-log (via "Entry type" form field)', '@ada1', 'yes → ada-one', h.out.file, 'pushed', 'started']) {
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
  const issue = makeIssue('work-log', {}, { hours: 'lots' });
  const first = await post(issue);
  const r1 = await reportFor(first);
  assert.deepEqual(types(first.calls), ['comment']);
  assert.match(first.calls[0].body, /Time committed/);
  assert.equal(r1.failures.length, 1);
  assert.match(r1.summaryText, /Time committed/);

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

test('a hand-written <!-- g27:kind=… --> marker wins over everything else', async () => {
  const issue = makeIssue('work-log', { labels: [{ name: 'major-update' }], title: 'x' }, { type: null });
  issue.body = `<!-- g27:kind=work-log -->\n\n${issue.body}`;
  assert.deepEqual(detectKind(issue), { kind: 'work-log', via: 'body marker' });
});

test('the real issue forms still match the parser', async () => {
  for (const [file, kind] of [['work-log-entry.yml', 'work-log'], ['major-update.yml', 'major-update']]) {
    const yml = fs.readFileSync(path.join(repoRoot, '.github', 'ISSUE_TEMPLATE', file), 'utf8').replace(/\r\n/g, '\n');
    const labels = [...yml.matchAll(/^      label: (.+)$/gm)].map(m => m[1].trim());
    for (const label of labels) assert.ok(label in FIELD_ORDER, `${file}: field "${label}" is not known to post-entry.cjs`);
    for (const need of ['Entry type', 'Title', 'Date', 'Time committed', 'Images']) {
      assert.ok(labels.includes(need), `${file}: field "${need}" is missing`);
    }
    assert.deepEqual([...labels].sort((a, b) => FIELD_ORDER[a] - FIELD_ORDER[b]), labels, `${file}: fields are not in the order post-entry.cjs expects`);
    const option = yml.match(/label: Entry type[\s\S]*?options:\n\s*- (.+)/)?.[1].trim();
    const body = labels.map(l => section(l, l === 'Entry type' ? option : 'x')).join('\n\n');
    assert.equal(detectKind({ title: '', labels: [], body }).kind, kind, `${file}: "Entry type" option "${option}" is not recognised`);
    assert.deepEqual(Object.keys(parseForm(body)).length, labels.length);
  }
});

test('the real allowlist has at least one GitHub username in it', async () => {
  const allow = JSON.parse(fs.readFileSync(path.join(repoRoot, '.github', 'allowlist.json'), 'utf8'));
  const set = allow.members.filter(m => typeof m.github === 'string' && m.github && !m.github.startsWith('TODO'));
  assert.ok(set.length > 0, 'every member has github: null — run `npm run sync:allowlist` after editing src/config/site.ts');
});

// ── Runner ────────────────────────────────────────────────────────────
let failed = 0;
for (const { name, fn } of cases) {
  try {
    await fn();
    console.log(`  ok    ${name}`);
  } catch (err) {
    failed++;
    console.log(`  FAIL  ${name}\n        ${String(err.message).split('\n').join('\n        ')}`);
  }
}
console.log(`\n${cases.length - failed} of ${cases.length} passed`);
process.exit(failed ? 1 : 0);
