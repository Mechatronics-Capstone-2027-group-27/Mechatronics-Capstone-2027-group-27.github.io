// Offline dry run of the posting pipeline:  npm run test:post
//
// Feeds .github/scripts/post-entry.cjs fake issues and checks what it would do.
// Nothing here touches the network or the repo: the GitHub API, the image download
// and the Actions `core` object are stubs, and files are written to a temp folder.
// The team in these tests is made up on purpose — the real one lives in src/config/site.ts.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = require('../.github/scripts/post-entry.cjs');
const { report, parseForm, detectKind, FIELD_ORDER } = run;

const TEAM = [
  { slug: 'ada-one', name: 'Ada One', github: 'ada1' },
  { slug: 'bo-two', name: 'Bo Two', github: 'BoTwo' },
  { slug: 'cy-three', name: 'Cy Three', github: null },
];
const EMPTY_TEAM = TEAM.map(m => ({ ...m, github: null }));

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
const ATTACHMENT = 'https://github.com/user-attachments/assets/11111111-2222-3333-4444-555555555555';
const ATTACHMENT_2 = 'https://github.com/user-attachments/assets/66666666-7777-8888-9999-000000000000';

// ── Builders ──────────────────────────────────────────────────────────
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

/** Stubs for one run: a temp repo root, a fake GitHub client, a fake `core`. */
function harness(issue, { team = TEAM, comments = [], eventName = 'issues', deployFails = false, apiFails = false } = {}) {
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
  const core = {
    outputs: {},
    failures: [],
    notices: [],
    summaryText: '',
    setOutput(k, v) { this.outputs[k] = v; },
    setFailed(m) { this.failures.push(m); },
    notice(m) { this.notices.push(m); },
  };
  core.summary = {
    addRaw(text) { core.summaryText += text; return this; },
    async write() {},
  };
  const context = {
    eventName,
    payload: eventName === 'issues' ? { action: 'opened', issue: { number: issue.number } } : {},
    repo: { owner: 'Example-Org', repo: 'example-org.github.io' },
    runId: 1,
    serverUrl: 'https://github.com',
  };
  const fetched = [];
  const fetchImage = async url => {
    fetched.push(url);
    return { bytes: PNG, ext: fetched.length % 2 ? 'png' : 'jpg' };
  };
  const args = { github, context, core, root, token: 'test-token', fetchImage };
  if (eventName === 'workflow_dispatch') args.issueNumber = String(issue.number);
  else args.issueNumber = '';
  return { root, calls, core, context, github, fetched, args, read: rel => fs.readFileSync(path.join(root, rel), 'utf8') };
}

const post = async (issue, opts) => {
  const h = harness(issue, opts);
  const out = await run(h.args);
  return { ...h, out };
};
const reportFor = (h, extra = {}) =>
  report({ github: h.github, context: h.context, core: h.core, entry: h.core.outputs, defaultBranch: 'main', ...extra });
const types = calls => calls.map(c => c.type);

// ── Cases ─────────────────────────────────────────────────────────────
const cases = [];
const test = (name, fn) => cases.push({ name, fn });

test('valid work-log entry is written to the author\'s folder', async () => {
  const h = await post(makeIssue('work-log'));
  assert.equal(h.out.result, 'written');
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
  assert.equal(h.core.outputs.result, 'written');
  assert.equal(h.core.outputs.matched, 'yes');
  assert.deepEqual(h.core.failures, []);
});

test('valid major update is written to updates/ with its image', async () => {
  const h = await post(makeIssue('major-update', { user: { login: 'botwo' } }, { hours: '22' }));
  assert.equal(h.out.result, 'written');
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
  assert.equal(h.out.result, 'rejected');
  assert.match(h.out.message, /@stranger is not on the allowlist/);
  assert.match(h.out.message, /`ada1`, `BoTwo`/);
  assert.match(h.out.message, /No username is set yet for: Cy Three/);
  assert.equal(h.core.outputs.matched, 'no');
  await reportFor(h);
  assert.deepEqual(types(h.calls), ['comment', 'close']);
  assert.equal(h.calls[1].reason, 'not_planned');
  assert.deepEqual(h.core.failures, []);
});

test('empty allowlist fails the job loudly instead of rejecting', async () => {
  const h = await post(makeIssue('work-log'), { team: EMPTY_TEAM });
  assert.equal(h.out.result, 'misconfigured');
  assert.equal(h.core.failures.length, 1);
  assert.match(h.core.failures[0], /allowlist has not been filled in/);
  assert.match(h.core.failures[0], /npm run sync:allowlist/);
  await reportFor(h);
  assert.deepEqual(types(h.calls), ['comment'], 'comments once, does not close the issue');
  assert.match(h.calls[0].body, /not your fault/);
  assert.match(h.core.summaryText, /NOT CONFIGURED/);
});

test('missing label but correct title prefix still posts', async () => {
  const h = await post(makeIssue('work-log', { labels: [] }, { type: null }));
  assert.equal(h.core.outputs.via, 'title prefix');
  assert.equal(h.out.result, 'written');
});

test('no label and no title prefix: the "Entry type" form field is enough', async () => {
  const h = await post(makeIssue('major-update', { labels: [], title: 'Bench test' }));
  assert.equal(h.core.outputs.kind, 'major-update');
  assert.equal(h.core.outputs.via, '"Entry type" form field');
  assert.equal(h.out.result, 'written');
});

test('issue filed before the form had an "Entry type" field posts via its label', async () => {
  const h = await post(makeIssue('work-log', { title: 'Bench test' }, { type: null }));
  assert.equal(h.core.outputs.via, 'label');
  assert.equal(h.out.result, 'written');
});

test('future date is invalid', async () => {
  const h = await post(makeIssue('work-log', {}, { date: '2999-01-01' }));
  assert.equal(h.out.result, 'invalid');
  assert.match(h.out.message, /\*\*Date\*\* 2999-01-01 is in the future/);
});

test('malformed hours value is invalid', async () => {
  const h = await post(makeIssue('work-log', {}, { hours: 'a couple' }));
  assert.equal(h.out.result, 'invalid');
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
  assert.equal(h.out.result, 'invalid');
  assert.match(h.out.message, /\*\*Content\*\* is empty/);
  assert.equal(fs.existsSync(path.join(h.root, 'src')), false);
});

test('several problems are all reported at once', async () => {
  const h = await post(makeIssue('major-update', {}, { title: 'Hey', hours: '-1', images: '' }));
  assert.equal(h.out.result, 'invalid');
  assert.equal(h.out.message.split('\n').length, 3);
});

test('entry with two images saves both and records both', async () => {
  const images = `![Image](${ATTACHMENT})\n<img width="800" alt="Force plot" src="${ATTACHMENT_2}" />`;
  const h = await post(makeIssue('work-log', {}, { images }));
  assert.equal(h.out.result, 'written');
  assert.deepEqual(h.fetched, [ATTACHMENT, ATTACHMENT_2]);
  const dir = path.join(h.root, 'public', 'img', 'work-log');
  assert.deepEqual(fs.readdirSync(dir).sort(), ['2026-09-30-ada-one-i7-1.png', '2026-09-30-ada-one-i7-2.jpg']);
  const md = h.read(h.out.file);
  assert.match(md, /src: \/img\/work-log\/2026-09-30-ada-one-i7-1\.png\n    alt: "Photo for \\"Bench test of the release latch\\""/);
  assert.match(md, /src: \/img\/work-log\/2026-09-30-ada-one-i7-2\.jpg\n    alt: "Force plot"/);
});

test('an image that cannot be downloaded is reported, not thrown', async () => {
  const h = harness(makeIssue('major-update'));
  h.args.fetchImage = async url => { throw new Error(`could not download ${url} (HTTP 404)`); };
  const out = await run(h.args);
  assert.equal(out.result, 'invalid');
  assert.match(out.message, /\*\*Images\*\*: could not download .* \(HTTP 404\)/);
});

test('"### " headings inside the entry are kept, not treated as form fields', async () => {
  const content = 'Tested the latch.\n\n### Next steps\n\nOrder springs.\n\n### Content\n\nMore.\n\n### Images\n\nSee below.';
  const h = await post(makeIssue('work-log', {}, { content, images: `![Rig](${ATTACHMENT})` }));
  assert.equal(h.out.result, 'written');
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
  assert.equal(h.out.result, 'skip');
  assert.equal(h.core.outputs.kind, 'none');
  await reportFor(h);
  assert.deepEqual(h.calls, []);
  assert.deepEqual(h.core.failures, []);
  assert.match(h.core.summaryText, /SKIPPED/);
  assert.match(h.core.summaryText, /Not a log entry/);
});

test('a closed issue is skipped on an issue event, but a manual replay posts it', async () => {
  const closed = makeIssue('work-log', { state: 'closed' });
  const a = await post(closed);
  assert.equal(a.out.result, 'skip');
  const b = await post(closed, { eventName: 'workflow_dispatch' });
  assert.equal(b.out.result, 'written');
  assert.equal(b.core.outputs.trigger, 'workflow_dispatch');
});

test('an issue that already has a file is not posted twice', async () => {
  const h = await post(makeIssue('work-log'));
  const again = await run(h.args);
  assert.equal(again.result, 'duplicate');
  assert.equal(again.file, h.out.file);
  assert.equal(fs.readdirSync(path.join(h.root, 'src/content/work-log/ada-one')).length, 1);
  await reportFor(h);
  assert.deepEqual(types(h.calls), ['comment', 'close']);
  assert.equal(h.calls[1].reason, 'completed');
});

test('a crash still sets a result and fails the job', async () => {
  const h = await post(makeIssue('work-log'), { apiFails: true });
  assert.equal(h.core.outputs.result, 'error');
  assert.match(h.core.failures[0], /crashed/);
});

test('report: written + pushed → starts deploy, comments, closes, writes the summary', async () => {
  const h = await post(makeIssue('work-log'));
  const r = await reportFor(h, { pushStatus: 'pushed' });
  assert.deepEqual(types(h.calls), ['deploy', 'comment', 'close']);
  assert.deepEqual(h.calls[0], { type: 'deploy', workflow: 'deploy.yml', ref: 'main' });
  assert.match(h.calls[1].body, /^Posted! It will be live/);
  assert.equal(h.calls[2].reason, 'completed');
  assert.equal(r.failure, '');
  assert.deepEqual(h.core.failures, []);
  for (const want of ['POSTED', '#7', 'work-log (via "Entry type" form field)', '@ada1', 'yes → ada-one', h.out.file, 'pushed', 'started']) {
    assert.ok(h.core.summaryText.includes(want), `summary should mention ${want}`);
  }
});

test('report: push rejected by branch protection → explains it on the issue, leaves it open', async () => {
  const h = await post(makeIssue('work-log'));
  await reportFor(h, { pushStatus: 'protected' });
  assert.deepEqual(types(h.calls), ['comment']);
  assert.match(h.calls[0].body, /branch protection rule or ruleset on `main` rejected the push/);
  assert.match(h.calls[0].body, /\*\*github-actions\*\* as a bypass actor/);
  assert.match(h.calls[0].body, /issue number `7`/);
  assert.equal(h.core.failures.length, 1);
  assert.match(h.core.summaryText, /branch protection rejected/);
});

test('report: commit step died without a status → still explained and failed', async () => {
  const h = await post(makeIssue('work-log'));
  await reportFor(h, { pushStatus: '' });
  assert.deepEqual(types(h.calls), ['comment']);
  assert.equal(h.core.failures.length, 1);
});

test('report: deploy cannot be started → entry kept, issue told, job failed', async () => {
  const h = await post(makeIssue('work-log'), { deployFails: true });
  await reportFor(h, { pushStatus: 'pushed' });
  assert.deepEqual(types(h.calls), ['comment', 'close']);
  assert.match(h.calls[0].body, /deploy could not be started automatically/);
  assert.equal(h.core.failures.length, 1);
});

test('report: invalid → comments once, and not again for the same unchanged issue', async () => {
  const issue = makeIssue('work-log', {}, { hours: 'lots' });
  const first = await post(issue);
  await reportFor(first);
  assert.deepEqual(types(first.calls), ['comment']);
  assert.match(first.calls[0].body, /Time committed/);
  assert.equal(first.core.failures.length, 1);
  assert.match(first.core.summaryText, /Time committed/);

  const second = await post(issue, { comments: [{ body: first.calls[0].body }] });
  await reportFor(second);
  assert.deepEqual(second.calls, [], 'same errors are not commented twice');
  assert.equal(second.core.failures.length, 1);
});

test('report: no result at all → summary says so and the job fails', async () => {
  const h = harness(makeIssue('work-log'));
  await report({ github: h.github, context: h.context, core: h.core, entry: {} });
  assert.match(h.core.summaryText, /did not finish/);
  assert.equal(h.core.failures.length, 1);
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
