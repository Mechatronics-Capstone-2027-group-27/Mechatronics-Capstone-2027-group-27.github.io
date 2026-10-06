# Posting pipeline investigation

Round 2, Prompt 1 · written 2026-10-06 · read-only investigation, no source files changed.

**Symptom:** a member opens an issue from an issue form. The issue is created. Then nothing: no bot
comment, no commit, no file, and the issue stays open.

**Short answer:** the job was skipped on every issue because the labels the workflow gates on did not
exist. That alone explains the symptom. Behind it sits a second, independent fault — the allowlist has no
usernames in it — that will reject every post now that the labels exist. Behind *that* sit four latent
bugs that have never had the chance to fire.

---

## Status after Prompt 2 (2026-10-06)

Everything below this section is the original investigation, unchanged. This section records what the
fix did about each finding. **Nothing here has run on GitHub yet** — "resolved" means the code was changed
and the offline harness (`npm run test:post`, 29 cases) passes. The live test in Part C is still the only
real proof.

### Resolved in code

| Finding | What changed |
|---|---|
| Cause 1 — job skipped when labels are missing | The job-level `if:` is gone. The job runs for every issue event and `post-entry.cjs` decides the kind from, in order: a `<!-- g27:kind=… -->` comment in the body, the form's new **Entry type** field, the labels, the title prefix. Labels stay on the forms for filtering only |
| Cause 2 — allowlist all `null` | The five usernames are in `MEMBERS` and `npm run sync:allowlist` was run. An allowlist with no usable username now fails the job with an explicit message instead of rejecting the poster |
| Rejection message blamed the poster | It now lists the usernames that are on the allowlist and names any member with none set |
| 3a — concurrency group dropped queued posts | The group is now per issue (`post-entry-<number>`), so posts for different issues never cancel each other |
| 3b — push race | The commit step rebases onto the latest `main` before pushing and tries twice |
| 3c — `### ` in an entry truncated it | `parseForm` only splits on the form's own labels, in form order, and takes the last `### Images` as the field |
| 3d — deploy started before the comment; retry duplicated the entry | The deploy is started from the report step, and a failure to start it is explained on the issue. An issue that already has a file is reported as `duplicate` and never written twice |
| Old issues could not be replayed | Trigger is `[opened, edited, labeled, reopened]`, plus a `workflow_dispatch` input `issue_number`. A manual replay also works on a closed issue |
| No visible outcome | A "Report outcome" step runs on every path (`if: always()`) and writes the kind, author, allowlist match, validation errors, file, push and deploy status to the run summary. `result` is set on every path, including a crash |
| Push rejected by branch protection | Detected from the push output; the issue gets a comment naming the ruleset and the bypass actor to add, and stays open |
| `2.5 hrs` rejected | `h`, `hr`, `hrs`, `hour`, `hours` are all accepted |
| Concurrent posts choosing the same image name | Image file names now include the issue number |

### One instruction not followed as written

Prompt 2 asked for the kind marker to be an HTML comment in a hidden `type: markdown` block in each
form. That cannot work: GitHub shows `markdown` blocks on the form but **does not include them in the
submitted issue body**, so the script would never see it. The marker is instead a one-option dropdown,
**Entry type**, pre-selected, which does reach the body as `### Entry type`. The script still honours a
`<!-- g27:kind=work-log -->` comment if someone writes one by hand in a blank issue.

### Still unverifiable without a live run on `main`

1. **The whole workflow.** No part of `post-entry.yml` has ever executed successfully on GitHub.
2. **The Entry type dropdown.** A one-option dropdown with `default: 0` is valid per GitHub's form
   schema, but if GitHub rejects it the form disappears from the "New issue" chooser. Check that both
   forms still appear and that the field is pre-filled, before anything else.
3. **Image download** for `https://github.com/user-attachments/assets/<uuid>`. The repo is public, so
   the script now tries without credentials first and only retries with the token if that fails. It also
   identifies the file type from its first bytes when the server does not say. Never run against a real
   attachment.
4. **`opened` and `labeled` firing together.** A form-created issue fires both. The per-issue
   concurrency group runs them one after the other and the second should find the issue closed (or find
   the file) and skip. Expect two runs per post, the second one a short "SKIPPED" or "ALREADY POSTED".
5. **Starting the deploy** with `actions.createWorkflowDispatch` and the built-in token. This is the same
   API call `gh workflow run` made; it relies on `actions: write` being granted despite the org's
   read-only default (your `deploy.yml` evidence says `permissions:` blocks are honoured).
6. **The branch-protection message.** The detection matches GitHub's `GH006` / `GH013` push errors. It
   cannot be exercised while the ruleset is disabled.
7. **Rebase on a busy `main`.** Tested only by reading; two posts landing at once is the case to watch.

### Not changed

- Images pasted into the Content field are still left as links to github.com (finding 4.7).
- Bot commits still skip every other workflow (finding 4.8). That is a GitHub rule, not a bug here.
- Action versions (finding 4.9) are unchanged.

---

## 0. What the repo itself establishes

These come from the files and from read-only git, not from assumption.

| Fact | Evidence |
|---|---|
| The whole posting system arrived in one commit | `5acf275` (2026-09-27, "First Major Commit") is the only commit touching `post-entry.yml`, `post-entry.cjs`, `allowlist.json` and `.github/ISSUE_TEMPLATE/` |
| It reached `main` on 2026-09-27 at 15:54 -0400 | PR #1 merge `6dcd265`; `git merge-base --is-ancestor 5acf275 origin/main` succeeds |
| `main` is the default branch and is current | `origin/HEAD -> origin/main`; local `main` and `origin/main` are both `76949ca` |
| The workflow was on `main` before anyone tried to post | first hand-written entries are 2026-09-29 (`dd67ee0`, `45d1b72` "Attempt at Update") |
| The pipeline has never completed, not once | `git log --all --author="github-actions"` returns nothing |
| All eight `.github` files are on `main` | `git ls-tree -r --name-only main -- .github` |
| Every allowlist entry is `"github": null` | `.github/allowlist.json:7,12,17,22,27`; `src/config/site.ts:58-62` has `github: 'TODO'` five times |

Merged pull requests are #1, #4, #5 and #8. Issues and PRs share one number sequence, so #2, #3, #6 and
#7 are issues or closed PRs. That is an inference — check the Issues tab — but it suggests roughly four
posting attempts.

---

## 1. Ranked root causes

Ranked by how well each explains the **exact** symptom: issue created, nothing else, **no comment**.

The missing comment is the strongest clue. Every path through `post-entry.cjs` that reaches a decision
either comments (`rejected`, `invalid`, `written`) or throws and turns the run red. So the script never
ran. Whatever stopped it happened before the first step.

### Cause 1 — The labels did not exist, so the job was skipped · explains the symptom completely

**Evidence.** `.github/workflows/post-entry.yml:21-24`:

```yaml
if: >-
  github.event.issue.state == 'open' &&
  (contains(github.event.issue.labels.*.name, 'work-log') ||
   contains(github.event.issue.labels.*.name, 'major-update'))
```

The forms declare `labels: ["work-log"]` (`work-log-entry.yml:4`) and `labels: ["major-update"]`
(`major-update.yml:4`). GitHub applies a form's labels only if they already exist in the repository; it
does not create them. Until 2026-10-06 neither existed, so every issue was created with an empty label
list, both `contains()` calls returned false, and the only job in the workflow was skipped.

**What you see in the Actions tab.** A skipped job still produces a run. The workflow's trigger
(`on: issues: types: [opened, edited]`) matched, so GitHub created a run, evaluated the job's `if:`, and
skipped it. Under **Actions → Post log entry** there should be one grey run (a circle with a slash) for
every time an issue was opened or edited since 2026-09-27. Each takes about a second and has no logs.
This is category **(b)**, not "no run at all".

If that list is **empty**, this diagnosis is wrong and the cause is in category (c) below — tell me.

**Fix.** The labels now exist, so new issues pass the gate. Two things remain:

- Old issues do not replay. Adding the label by hand fires a `labeled` event, which is not in
  `types: [opened, edited]`. To replay one today: add the label, then edit the issue body (any change)
  so an `edited` event fires with the label present.
- The gate should go. See section 3.

### Cause 2 — The allowlist is empty, so every poster is rejected · fatal, but does not explain the symptom

**Evidence.** `.github/scripts/post-entry.cjs:105`:

```js
const author = allow.members.find(m => m.github && m.github.toLowerCase() === login);
```

`m.github` is `null` for all five members, so `m.github &&` short-circuits and nobody ever matches. The
script returns `rejected` (`post-entry.cjs:106-113`), and the workflow comments and closes the issue as
"not planned" (`post-entry.yml:41-50`).

The `null`s are generated, not hand-written: `scripts/sync-allowlist.mjs:17-18` turns any `github` value
starting with `TODO` into `null`, and `src/config/site.ts:58-62` still has `github: 'TODO'` for everyone.

**Why it is ranked second.** It would have commented. The team reported no comment, so this code never
ran. It is the wall every post hits *now*, since the labels were created today.

**What you see in the Actions tab.** A **green** run. The script succeeds, the "Not a team member" step
succeeds, and the issue gets a comment saying the poster "isn't on the list". The message
(`post-entry.cjs:108-111`) reads as if the poster were an outsider, which will confuse a team member.

**Fix.** Put the five confirmed usernames into `MEMBERS` in `src/config/site.ts`, run
`npm run sync:allowlist`, commit both generated files:

```
ethan-catz      → MystyM
ian-macpherson  → IanJinzoTakeda
david-makarczyk → DavidM2004
matthew-zelenka → MatthewZelenka
nitya-singh     → sky1515
```

Any issue already closed by a rejection needs to be **reopened and then edited**: `reopened` is not a
trigger, and an edit to a closed issue is skipped by the `state == 'open'` check.

### Cause 3 — Four latent bugs that fire once causes 1 and 2 are fixed

None of these explains the symptom. All of them are real, and none has ever executed.

**3a. The concurrency group drops posts.** `post-entry.yml:15-17`:

```yaml
concurrency:
  group: post-entry
  cancel-in-progress: false
```

A concurrency group holds one running run and **one** pending run. When a third arrives, the pending one
is cancelled. The group is declared at workflow level, so it is claimed before the job's `if:` is
evaluated — every issue event in the repo, including edits to unrelated issues, takes a slot. If three
people post within the same minute or two, the middle post is cancelled: a grey "cancelled" run and no
comment. Part C step 6 of the prompt pack ("have each of them post one real entry the same day") is the
situation that triggers it.
*Fix:* key the group on the issue number and make the push safe under concurrency instead (rebase and
retry), which Prompt 2 item 5 already asks for.

**3b. The push can race.** `post-entry.yml:71-76` checks out `main`, commits and runs a bare `git push`.
If anyone merges to `main` between checkout and push, the push is rejected as non-fast-forward and the
run goes red. No comment is posted, because the comment step comes after.
*Fix:* fetch and rebase before pushing, retry once.

**3c. A `### ` heading inside an entry truncates it.** `post-entry.cjs:19`:

```js
const parts = (body || '').replace(/\r\n/g, '\n').split(/^### /m).slice(1);
```

The form's own field headings are `### Title`, `### Date` and so on, and the parser splits on every line
starting with `### `. The "Content of progress" field advertises "Markdown supported"
(`work-log-entry.yml:52`). A member who writes `### Next steps` in their entry loses everything from that
line on, with no error — the run is green and the published entry is short. Worse, a heading that
happens to be `### Images` or `### Title` overwrites the real field.
*Fix:* split only on the known field labels, in the order the form emits them.

**3d. The steps are in a fragile order.** "Start deploy" (`post-entry.yml:78-82`) runs before "Comment
with link and close" (`post-entry.yml:84-98`). If `gh workflow run` fails, the entry is already pushed
but the issue gets no comment and stays open. The run is red. If the member then edits the issue to
"retry", the script writes a second file with a `-2` suffix (`post-entry.cjs:171`).
*Fix:* comment and close first, start the deploy last, and let a deploy failure warn rather than fail.

---

## 1b. The same causes, sorted by what the Actions tab shows

### (a) Would produce a visible failed (red) or cancelled run

| Cause | Status |
|---|---|
| `GITHUB_TOKEN` read-only, push refused | **Ruled out** by your evidence: a workflow's `permissions:` block elevates past the org default, and `post-entry.yml:10-13` declares `contents: write` |
| Ruleset or branch protection rejecting the bot's push | **Ruled out today**: the one ruleset is disabled. It becomes a red run the moment it is enabled, because its bypass list lacks `github-actions` |
| Org policy forbidding an action the workflow uses | Unlikely. `deploy.yml` runs, and `post-entry.yml` adds only `actions/github-script`, which is GitHub-owned. It would fail at startup, red |
| Push race (3b) | Latent |
| `gh workflow run` failing (3d) | Latent. On paper it works — see section 1c |
| Image download failing | Not red: caught at `post-entry.cjs:161-163` and reported as `invalid`, with a comment |
| Script throwing (malformed `allowlist.json`, for instance) | Red, no comment. Not happening: the file parses |
| Concurrency cancellation (3a) | Grey "cancelled", no comment. Latent |

### (b) Would produce a skipped (grey) run

| Cause | Status |
|---|---|
| Missing labels → job `if:` false | **This is what happened.** Cause 1 |
| Issue edited after it was closed | By design (`state == 'open'`) |
| A blank issue, not from a form | By design. `config.yml` has `blank_issues_enabled: true`, so these exist and each one produces a skipped run |

### (c) Would produce no run at all

| Cause | Status |
|---|---|
| Workflow not on the default branch | **Ruled out.** On `main` since 2026-09-27 15:54 -0400 |
| Actions disabled for the repo | Ruled out: `deploy.yml` runs |
| Actions minutes exhausted or a billing block | Ruled out: the repo is public, so standard runners are free, and `deploy.yml` runs |
| Trigger `types:` not covering the event | Partly true. `labeled` and `reopened` are not covered, which is why relabelling an old issue does nothing. Opening an issue is covered |
| `GITHUB_TOKEN` pushes not triggering other workflows | True and already handled: this is why the workflow dispatches `deploy.yml` explicitly. It also means a bot commit never runs `check-allowlist.yml` |
| Workflow file failing to parse | Ruled out by reading it; it would show as a failed run on push anyway |

### (d) Would produce a green run that did nothing

| Cause | Status |
|---|---|
| Script returns without setting `result` | **Cannot happen.** Every return goes through `done()` (`post-entry.cjs:94-98`), which sets it. A throw fails the step instead |
| Script returns `skip` | Unreachable today. `post-entry.cjs:100` repeats the job's `if:` condition, so the job is skipped before the script can return `skip`. It becomes reachable when Prompt 2 removes the job-level gate — at that point it must be made visible |
| Allowlist rejection (cause 2) | Green, but it comments and closes, so it is not "did nothing" |
| `### ` truncation (3c) | Green, and it does the wrong thing quietly |

---

## 1c. Pass 2 items checked and found correct

- **Form headings match the parser character for character.** Work log: `Title`, `Date`,
  `Collaborators`, `Time committed`, `Content of progress`, `Images` (`work-log-entry.yml:14,21,30,43,51,58`)
  against `post-entry.cjs:118-123,135`. Major update uses `Content` (`major-update.yml:37`), which the
  `?? f['Content']` fallback on `post-entry.cjs:122` handles.
- **Checkboxes.** GitHub renders a ticked box as `- [X] Name`; `post-entry.cjs:33` matches `[xX]`. The
  names are matched against `allowlist.json`, which the same script generates alongside the form.
- **The file the script writes passes the build.** Its frontmatter (`post-entry.cjs:173-183`) satisfies
  both schemas in `src/content.config.ts:60-96`, and it writes work-log files into the author's folder,
  which `workLogId` requires. It writes no image `width`/`height`; the schema allows that.
- **`git add src/content public/img`.** Both paths exist and contain tracked files, and the script
  creates the image folder before writing (`post-entry.cjs:149`). `git add` on a path with nothing new
  is a no-op, not an error. The step that could fail is `git commit` with nothing staged, and that
  cannot happen on the `written` path, because a new Markdown file always exists.
- **`gh workflow run deploy.yml`.** `deploy.yml:8` declares `workflow_dispatch`; `GH_TOKEN` is set
  (`post-entry.yml:81`); `actions: write` is granted (`post-entry.yml:13`). `workflow_dispatch` is one of
  the two events `GITHUB_TOKEN` is allowed to trigger. It should work. It has never run.
- **`check-allowlist.yml` without `npm ci`.** Fine. `sync-allowlist.mjs` imports only Node built-ins and
  `src/config/site.ts`, which has no imports of its own and is loaded by Node 24's type stripping.
- **The generated URL** (`post-entry.cjs:187`) lowercases the org name and matches `SITE.url`.

### Not verifiable without a live run

- **Image download.** Attachments arrive as `https://github.com/user-attachments/assets/<uuid>`, in
  either Markdown or `<img>` form; `extractImages` handles both (`post-entry.cjs:39-51`). The repo is
  public, so that URL should redirect to a signed storage URL that needs no authentication. The script
  sends `Authorization: Bearer <GITHUB_TOKEN>` to github.com (`post-entry.cjs:81`); the header is dropped
  on the cross-origin redirect. On a **private** repo this would most likely return 404, because that
  endpoint expects a browser session rather than an Actions token. Nobody has ever run this path.
- The URL has no file extension, so the type comes from the response's `Content-Type`
  (`post-entry.cjs:84-85`). If GitHub serves an attachment as `application/octet-stream`, the entry is
  reported `invalid` with "not a supported image".

---

## 2. Confirm this in 5 minutes

Only you can check these. In order of how much each one tells you.

1. **Are there skipped runs?** Repo → **Actions** tab → left sidebar → **Post log entry**.
   - Grey runs with a slashed circle, one per issue opened or edited → cause 1 confirmed.
   - "Post log entry" is not in the sidebar, or the list is empty → the workflow was never triggered.
     Stop and tell me; that contradicts this report.
   - Red runs → open one, read the first failing step, and send it to me.
2. **Were the old issues unlabeled?** **Issues** tab → clear the search box so closed issues show too →
   open one of the posting attempts → right sidebar → **Labels**. Expect "None yet".
3. **Do the labels exist now?** **Issues** → **Labels**. Expect `work-log` and `major-update`, lowercase,
   hyphenated, spelled exactly so.
4. **Is the allowlist empty on `main`?** **Code** tab → `.github` → `allowlist.json`. Expect five
   `"github": null` lines. While they say `null`, every post is rejected.
5. **Are Actions unrestricted?** **Settings** → **Actions** → **General** → **Actions permissions**.
   Expect "Allow all actions and reusable workflows". If it says "Allow … select actions", check that
   actions created by GitHub are allowed.
6. **Is the ruleset still off?** **Settings** → **Rules** → **Rulesets** → **Main push**. Expect
   **Enforcement status: Disabled**.
7. **Optional, one minute — prove cause 2.** Open a throwaway work-log issue now. Because the labels
   exist, the job will run, and you should get a comment saying you are not on the list, and the issue
   will close. That confirms the label gate now passes and the allowlist is the remaining block. Delete
   or ignore the issue afterwards.

---

## 3. Should the workflow keep gating on labels?

**No.** Remove the job-level label gate and decide the entry kind inside the script.

- A label is state that lives in repo settings, outside the code. Nothing in the repo can check that it
  exists, and it can be renamed or deleted by anyone with triage access.
- When the gate fails, it fails as a skipped job: no log, no comment, no error. That is why this took a
  week to find.
- The information is already in the issue. The title prefix (`[Work log] ` / `[Major update] `) is set by
  the form, and a hidden marker in the form body would be more robust still.

Keep `labels:` in both forms for filtering in the Issues tab. Detect the kind in `post-entry.cjs` with a
fallback chain — hidden marker, then labels, then title prefix — and when none match, return `skip`
*and say so* in the run summary. This is what Prompt 2 item 1 proposes, and the investigation supports it
as written.

One consequence to handle when the gate goes: the script's `skip` path becomes reachable for the first
time, and with it a green run that did nothing. It needs a line in `$GITHUB_STEP_SUMMARY`.

---

## 4. What the prompt did not anticipate

1. **The concurrency group silently drops posts** (3a). This is the most important unanticipated
   finding, because the planned live test would trigger it.
2. **A `### ` heading in the body truncates the entry** (3c). Silent data loss on a graded log.
3. **Step order leaves a pushed entry with an open, uncommented issue** (3d), and a retry duplicates it.
4. **Replaying old issues takes two actions, not one.** An unlabeled issue needs the label *and* an
   edit. A rejected issue needs a reopen *and* an edit. Prompt 2's `workflow_dispatch` replay input and
   wider `types:` list resolve both.
5. **The rejection message blames the poster.** With an empty allowlist it tells a team member they are
   not on the team. Prompt 2 item 4 covers this; noting it because it will be the first thing anyone
   sees if they post before the usernames are filled in.
6. **`2.5 hrs` is rejected.** `post-entry.cjs:120` strips a trailing `h`, `hour` or `hours`, but not
   `hrs` or `hr`. The member gets an `invalid` comment, so it is visible, just avoidable.
7. **Images pasted into the Content field are not downloaded.** Only the Images field is scanned
   (`post-entry.cjs:123`). An image dragged into the content box stays in the Markdown as a link to
   github.com, so the site hotlinks it.
8. **Bot commits skip every other workflow.** Already known for `deploy.yml`. It applies equally to
   `check-allowlist.yml` and to the CI workflow planned in Prompt 4: an entry posted by the bot is never
   build-checked before it goes live. A bad entry fails inside the dispatched deploy, after it is on
   `main`.
9. **Action versions.** `actions/checkout@v4`, `actions/setup-node@v4` and `actions/github-script@v7`
   run on the Node 20 action runtime. Check a recent `deploy.yml` run for deprecation annotations. Not a
   blocker — `deploy.yml` uses two of the three and works.

---

## Top three

1. The `work-log` and `major-update` labels did not exist, so the job's `if:` was false and it was
   skipped on every issue. This is the cause of the reported symptom.
2. `.github/allowlist.json` has `null` for all five usernames, so every post is now rejected with a
   comment.
3. Four latent bugs are waiting behind those two; the one that matters first is the concurrency group
   cancelling queued posts when several people post close together.
