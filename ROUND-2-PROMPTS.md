# Round 2 — Prompt Pack for Claude Code
### Group 27 Capstone design-log site · `Mechatronics-Capstone-2027-group-27.github.io`

---

## 0. How to use this file

This file holds **seven prompts** meant to be run **in order**, one at a time, in Claude Code, from the
repo root with a feature branch checked out. Each one is self-contained: copy the fenced block and paste it.

Do **not** paste the whole file at once. Prompt 1 is an investigation whose findings change what Prompt 2
should do, and several prompts depend on a settings change you make on github.com in between.

Save this file into the repo root as `ROUND-2-PROMPTS.md` and commit it, so your teammates can see the plan.

> **Standing rule, unchanged:** Claude Code never runs `git add`, `commit`, `push`, `branch`, `checkout -b`,
> `merge` or `rebase`. You do all git yourself. Read-only git is fine.

### Order of operations — read this before anything else

The order matters, because two of these things cannot be tested until the others are done.

| # | Who | What | Why this order |
|---|---|---|---|
| 1 | **You, on github.com** | Part A below — ✅ **done as of 2026-10-06**, see the notes in each item | Prompt 1's investigation needs to know these, and nothing can be tested until they're right |
| 2 | — | ✅ The 5 GitHub usernames are confirmed and recorded in A6; Prompt 2 writes them in | The posting system rejects everyone until these are real |
| 3 | Claude Code | Prompt 1 — investigate, write a report, change nothing | You want the diagnosis before the fix |
| 4 | **You** | Read the report, confirm or correct it | It may find something this file didn't anticipate |
| 5 | Claude Code | Prompts 2 → 6 | The code changes |
| 6 | Claude Code | Prompt 7 — verification and handoff | |
| 7 | **You** | Commit, push, open a PR | First PR is when the new CI check appears |
| 8 | **You** | Merge to `main` | Issue-triggered workflows only run from the default branch |
| 9 | **You** | Part C — the live posting test | This is the *only* real test of the posting system |
| 10 | **You** | *Optionally* add branch protection — **read Part D first** | Branch protection and the posting bot conflict; don't do this blind |

---

## PART A — GitHub settings you must change (do this first)

Claude Code cannot do any of this: it has no git write access and no GitHub API access. All of it is in the
browser.

### A1. Workflow permissions — ✅ RULED OUT, skip this

The repo-level control is greyed out because an organization (or enterprise) policy sets it, and it is
locked to "Read repository contents and packages permissions".

**This is not the problem.** A `deploy.yml` run's log shows:

```
GITHUB_TOKEN Permissions
  Contents: read
  Metadata: read
  Pages: write
```

`deploy.yml` declares `permissions: contents: read, pages: write`, and `Pages: write` — which is *not* part
of the read-only default — was granted. That proves a workflow's own `permissions:` block elevates past the
restricted org default. `post-entry.yml` declares `contents: write`, so it gets it.

Fix the org setting eventually if you find who controls it (note: repo admin ≠ org owner; greyed out for
two people suggests an enterprise policy above the org). You'd want "Allow GitHub Actions to create and
approve pull requests" available if you ever go the auto-merge-PR route in Part D. Not a blocker today.

### A2. Create the two labels — ✅ DONE 2026-10-06

**Issues → Labels → New label**, create exactly these two, lowercase, spelled exactly:

- `work-log`
- `major-update`

**This is very likely the reason nothing happens when you file an issue.** GitHub Issue Forms apply the
labels listed in their `labels:` field **only if those labels already exist in the repository**. They are
not created automatically. If `work-log` doesn't exist, your issue is created with no labels at all, and the
posting workflow's condition —

```yaml
if: contains(github.event.issue.labels.*.name, 'work-log') || ...
```

— evaluates false, so the job is **skipped silently**. No comment, no error, nothing in the issue. Exactly
the symptom you reported.

Prompt 2 will also make the workflow stop *depending* on labels, so this can't bite again. Create them
anyway — they're useful for filtering.

### A3. Confirm Actions are enabled

**Settings → Actions → General → Actions permissions** → "Allow all actions and reusable workflows".

### A4. Pages source — ✅ ALREADY SET

**Settings → Pages → Source** is already **GitHub Actions**. Nothing to do.

### A5. Branch protection — ✅ CHECKED, nothing is blocking

One ruleset exists, "Main push", targeting `main`, with **Enforcement status: Disabled**. It is inert, so
it is not rejecting the bot's push.

⚠️ **For later:** that ruleset has "Require a pull request before merging" and "Block force pushes" ticked,
and its bypass list contains **only the Claude app — not `github-actions`**. If anyone enables it, every
post will start failing. If you ever flip enforcement on, add `github-actions` as a bypass actor in the
same sitting. See Part D.

### A6. The five GitHub usernames — ✅ CONFIRMED 2026-10-06

```
ethan-catz      → MystyM
ian-macpherson  → IanJinzoTakeda
david-makarczyk → DavidM2004
matthew-zelenka → MatthewZelenka
nitya-singh     → sky1515
```

These go into `MEMBERS` in `src/config/site.ts`, followed by `npm run sync:allowlist`. Prompt 2 does it.

---

## PROMPT 1 — Investigate the posting pipeline (read-only)

> Run this first. It changes no files.

```
Read CLAUDE.md first and obey its rules — in particular, never run any git write command.

TASK: Investigate why the GitHub issue-to-markdown posting system does not work, and
write a findings report. Change no source files in this prompt. The only file you may
create is the report itself at docs/POSTING-INVESTIGATION.md.

SYMPTOM AS REPORTED BY THE TEAM: team members open issues using the issue forms. The
issues are created successfully. Then nothing happens at all — no bot comment, no commit,
no file, and the issue is not closed. Every work-log entry currently on the site was added
by hand-writing a markdown file and merging a branch.

Read at minimum:
  .github/workflows/post-entry.yml
  .github/workflows/deploy.yml
  .github/workflows/check-allowlist.yml
  .github/scripts/post-entry.cjs
  .github/allowlist.json
  .github/ISSUE_TEMPLATE/work-log-entry.yml
  .github/ISSUE_TEMPLATE/major-update.yml
  .github/ISSUE_TEMPLATE/config.yml
  scripts/sync-allowlist.mjs
  src/config/site.ts
  package.json
and run `git log --oneline -20` and `git branch -a` (read-only git is allowed).

Investigate in three passes and cross-examine them against each other:

PASS 1 — GitHub platform causes, independent of our code. For each, state what it would
look like from the outside, and how I (Ethan) can confirm or rule it out in the GitHub UI
or Actions tab. Cover at least:
  - Issue Forms only apply `labels:` that ALREADY EXIST in the repo; a missing label means
    the issue is unlabeled and any label-gated `if:` silently skips the job
  - `on: issues:` workflows only run from the DEFAULT branch — check whether
    post-entry.yml is actually on main, using git log, not assumption
  - Settings → Actions → General → Workflow permissions set to read-only, so GITHUB_TOKEN
    cannot push
  - branch protection or a ruleset on main rejecting a push by github-actions[bot]
  - Actions disabled for the repo, or an org policy restricting which actions may run
  - the `types:` list on the issues trigger not covering how the issue actually changed
    (e.g. a label added after creation fires `labeled`, which is not in the list)
  - GITHUB_TOKEN pushes deliberately not triggering other workflows (loop prevention)
  - Actions minutes exhausted or billing issues
  - whether a skipped job even produces a visible run in the Actions tab

PASS 2 — Causes in our own code and config. Read the actual files, do not assume. Check at
minimum:
  - what `.github/allowlist.json` currently contains for each member's `github` field, and
    exactly what post-entry.cjs does when that value is null or 'TODO'
  - whether the job-level `if:` can ever be true given the issue templates as written
  - whether `parseForm()`'s expected `### <Label>` headings match the issue form labels
    character for character, including "Time committed" and "Content of progress"
  - the `git add src/content public/img` step: what happens if either path has nothing
    staged, or does not exist
  - whether `gh workflow run deploy.yml` can succeed (does deploy.yml declare
    workflow_dispatch; is GH_TOKEN set; is `actions: write` granted)
  - the image download path: does it authenticate correctly for
    https://github.com/user-attachments/assets/... URLs, and does that differ for a private
    versus public repo
  - any failure mode where the script exits without setting an output, so every downstream
    `if: steps.entry.outputs.result == ...` is false and the job ends green having done
    nothing

PASS 3 — Cross-examination. Several of these can be true at once. Build an ordered list of
candidate root causes ranked by how well each explains the EXACT symptom (issue created,
absolutely nothing else happens, no comment). Explicitly separate:
  (a) causes that would produce a visible failed run in the Actions tab
  (b) causes that would produce a skipped or grey run
  (c) causes that would produce no run at all
  (d) causes that would produce a green run that did nothing
The reported symptom has no bot comment, which is strong evidence — reason about what that
rules in and out, since a rejected-by-allowlist path WOULD have commented.

EVIDENCE I ALREADY GATHERED — factor all of this in, and do not re-litigate it:
  - A deploy.yml run's log shows "GITHUB_TOKEN Permissions: Contents: read, Metadata: read,
    Pages: write". deploy.yml declares contents: read + pages: write, and pages: write WAS
    granted. So workflow-level `permissions:` blocks DO elevate past the org's read-only
    default. Read-only workflow permissions are RULED OUT as a cause.
  - The repo-level workflow-permissions control is greyed out by an org/enterprise policy,
    locked to read-only. This is cosmetic given the point above.
  - One ruleset exists ("Main push", targeting main) with Enforcement status = DISABLED.
    Nothing is rejecting a push today. Its bypass list contains only the Claude app, not
    github-actions, which matters only if it is ever enabled.
  - Settings → Pages → Source is already "GitHub Actions".
  - The `work-log` and `major-update` labels DID NOT EXIST until 2026-10-06. Every issue
    filed before that date was created unlabeled. Reason carefully about what that means
    for the job-level `if:` and for whether any run appeared in the Actions tab at all.
  - The repo is PUBLIC.
  - Confirmed GitHub usernames, not yet in site.ts:
      ethan-catz → MystyM, ian-macpherson → IanJinzoTakeda,
      david-makarczyk → DavidM2004, matthew-zelenka → MatthewZelenka,
      nitya-singh → sky1515

DELIVERABLE: docs/POSTING-INVESTIGATION.md containing:
  1. A ranked list of root causes, each with: the evidence from the files, what I would see
     in the Actions tab if it were true, and the exact fix.
  2. A short "confirm this in 5 minutes" checklist of things only I can check in the browser,
     written as click-by-click steps.
  3. A recommendation on whether to keep gating on labels at all.
  4. Anything you found that this prompt did not anticipate.

Do not fix anything yet. End by telling me the top three causes in one paragraph.
```

**What I expect it to find** (verify, don't assume — I could not see your live GitHub state):

1. **`.github/allowlist.json` has `"github": null` for all five members.** All five entries in
   `src/config/site.ts` still say `github: 'TODO'`, and the sync script turns that into `null`.
   `post-entry.cjs` does `allow.members.find(m => m.github && ...)` — so **every poster, including you, is
   rejected.** This is fatal on its own.
2. **The `work-log` / `major-update` labels did not exist** until 2026-10-06, so every issue filed before
   then was unlabeled, the job's `if:` never matched, and the job was skipped with no comment. This is the
   cause that best matches "absolutely nothing happens."

Both are independent — fixing one without the other still leaves you broken, which is probably why this has
been confusing. Workflow permissions were investigated and **ruled out** (see A1).

---

## PROMPT 2 — Fix the posting pipeline

> Run after you've read the report and done Part A.

```
Read CLAUDE.md and docs/POSTING-INVESTIGATION.md first. Never run any git write command.

TASK: Make the issue-to-markdown posting system actually work, and make it fail loudly
instead of silently when it doesn't.

Use your investigation's ranked causes as the guide. Where my instructions below conflict
with something you found, follow your finding and tell me why in your summary.

REQUIRED CHANGES:

0. Fill in the GitHub usernames FIRST — nothing else can be tested without them. In
   src/config/site.ts, set each member's `github` field to these confirmed values:
       ethan-catz      → MystyM
       ian-macpherson  → IanJinzoTakeda
       david-makarczyk → DavidM2004
       matthew-zelenka → MatthewZelenka
       nitya-singh     → sky1515
   Then run `npm run sync:allowlist` and show me the regenerated .github/allowlist.json.
   Every member's "github" value must be a real string — if any is still null, stop and
   tell me why, because the sync script is then broken too.

1. Stop depending on labels to decide whether to run.
   - Remove the job-level `if:` that gates on label names. A skipped job leaves no useful
     trace, which is why this was invisible.
   - Instead, ALWAYS run the job for any issue event, and determine the entry kind inside
     post-entry.cjs using a fallback chain, in this order:
       a. an HTML-comment marker embedded in each issue template body, e.g.
          <!-- g27:kind=work-log --> (add this to both templates as a hidden markdown block)
       b. the issue labels, if present
       c. the issue title prefix, "[Work log]" or "[Major update]"
     If none match, set result=skip and exit cleanly.
   - Keep `labels:` in the issue templates — they're still useful for filtering — but
     nothing may now depend on them existing.

2. Widen the trigger: `types: [opened, edited, labeled, reopened]`.

3. Add a manual replay path. Give post-entry.yml a `workflow_dispatch` input
   `issue_number`, so I can re-run a failed issue from the Actions tab without editing it.
   When dispatched, fetch that issue via the API and run the same code path.

4. Make every outcome visible.
   - The script must ALWAYS set the `result` output — never return without setting it.
   - Add a step that runs on every path and writes a one-line summary of what happened to
     $GITHUB_STEP_SUMMARY: the detected kind, the issue author, whether the author matched
     the allowlist, validation errors, and the file written. This must be readable without
     expanding any log group.
   - If the author is not on the allowlist, the comment it posts must say which usernames
     ARE on the allowlist, so the cause is obvious.
   - If the allowlist contains no usable usernames at all (all null/TODO), do NOT silently
     reject. Fail the job with an explicit message saying the allowlist has not been filled
     in and `npm run sync:allowlist` needs to run after editing src/config/site.ts.

5. Harden the commit step.
   - `git add` must not fail when one of the paths has nothing to stage.
   - Before pushing, `git pull --rebase` (or fetch + rebase) so a concurrent push doesn't
     lose the commit, and retry the push once on failure.
   - If the push is rejected because the branch is protected, catch it and comment on the
     issue explaining that branch protection is blocking the bot, rather than failing with
     a bare 403.

5b. Fix the concurrency group — it silently drops posts.
   The current workflow-level `concurrency: post-entry` with `cancel-in-progress: false`
   allows one running plus one pending run; a third queued run CANCELS the pending one.
   Because the group is workflow-level, even skipped or irrelevant issue events occupy it.
   If three of us post within a few minutes of each other, someone's entry vanishes with no
   comment and a grey "cancelled" run. Change the group to be per-issue
   (e.g. `post-entry-${{ github.event.issue.number }}`) so two different people's posts
   never contend, and rely on the rebase-and-retry from item 5 to handle the push race
   instead of relying on serialization. Explain your choice in the summary.

5c. Fix `parseForm()` — a markdown heading in the body destroys the entry.
   It splits the issue body on EVERY `^### ` line, so a member who writes "### Next steps"
   inside "Content of progress" loses everything after that heading, and can even overwrite
   a later field such as Images. The run goes green and the data is silently lost. Parse
   only the known field headings — the exact label set from each issue form — and treat
   everything else as body text. Add a dry-run case for an entry whose body contains
   `### Next steps` and `#### Notes`, and assert the full body survives intact.

5d. Fix the step order.
   "Start deploy" currently runs BEFORE "Comment with link and close". If `gh workflow run`
   fails, the entry is pushed but the issue stays open with no comment — and editing that
   issue then writes a duplicate `-2` file. Comment and close FIRST, then dispatch the
   deploy, and make a failed dispatch non-fatal with a warning in the step summary.

5e. Accept the hours people actually type.
   The current regex strips `h`, `hour` and `hours` but not `hrs`, so "2.5 hrs" is rejected.
   Accept h / hr / hrs / hour / hours, singular or plural, with or without a space, and
   ignore surrounding whitespace.

5f. Make stranded issues recoverable.
   Issues filed before the labels existed, and issues the bot already closed as rejected,
   do not replay on their own: `labeled` and `reopened` are not triggers, and closed issues
   are skipped. The `workflow_dispatch` replay from item 3 must work on a CLOSED issue too,
   reopening it if needed. In your summary, tell me exactly what to do with the issues
   already sitting in the repo — replay them, or close and refile.

6. Verify the deploy trigger. Confirm `gh workflow run deploy.yml` will actually work given
   deploy.yml's triggers and the granted permissions. If there's a more reliable mechanism,
   use it and explain the change.

7. Images. Confirm the download path works for GitHub's current attachment URLs
   (https://github.com/user-attachments/assets/<uuid>). Note in your summary whether this
   repo is public or private, since that changes whether auth is required, and say plainly
   that this path is still untested against a real attachment.

8. Write a local dry-run harness at scripts/test-post-entry.mjs that feeds post-entry.cjs a
   set of fake issue payloads and asserts the outcomes, including at minimum: a valid
   work-log entry; a valid major update; an unknown author; an empty allowlist; a missing
   label but a correct title prefix; a future date; a malformed hours value; a missing
   required field; and an entry with two images. Add it to package.json as
   `npm run test:post`. It must run offline — stub the image fetch. Run it and report the
   results.

CONSTRAINTS:
  - No new runtime dependencies. A dev-only dependency is acceptable only if you justify it.
  - Keep using the built-in GITHUB_TOKEN. No PATs, no repository secrets.
  - Do not weaken the allowlist check — it is the only real access control on the site.

DELIVERABLE: the code changes, the passing dry-run output, a plain-language description of
what was broken and what you changed, and an updated docs/POSTING-INVESTIGATION.md with a
"resolved / still unverifiable" split. List anything that can only be confirmed by a live
test on main.
```

---

## PROMPT 3 — One entry, many members (the collaborator model)

> This is the change with the most knock-on effects. Run it on its own.

```
Read CLAUDE.md first. Never run any git write command.

CONTEXT / THE PROBLEM: Right now a work-log entry appears only on its author's tab. So when
four of us attend the same meeting, we each write a near-duplicate entry — look at
src/content/work-log/david-makarczyk/2026-10-01-prof-devaud.md and
src/content/work-log/matthew-zelenka/2026-10-01-prof-devaud.md, which are the same meeting
logged twice. That is wasteful and it makes the work log read as padded.

GOAL: one entry is written once, by one author, listing collaborators — and it appears on
the tab of every participant, author and collaborators alike.

REQUIRED BEHAVIOUR:

1. Membership. An entry belongs to its `author` and to every slug in `collaborators`.
   `getMemberEntries(slug)` must return entries where slug is the author OR a collaborator.
   Update countsByMember() and cadenceRow() the same way, and audit every other place in
   src/lib/entries.ts and src/pages/ that assumes `e.data.author === slug`.

2. One canonical page per entry. Do NOT generate a copy of the entry page under each
   collaborator. The detail page stays at /work-log/<author>/<entry>/ and every tab links
   to that same URL. Make sure getStaticPaths cannot emit duplicate routes.

3. The card must make authorship unambiguous. On a collaborator's tab, the card shows a
   quiet "Collaborated" marker and names the author ("Logged by David Makarczyk"). On the
   author's own tab it looks as it does now. A grader must never be able to mistake a
   collaborated entry for one the member wrote.

4. Per-person contributions — this is a rubric requirement, not a nicety. The marking scheme
   awards marks for "individual contributions of each member are clearly described," and a
   shared entry saying "we had a meeting" fails that. Add an OPTIONAL frontmatter field:

       contributions:
         david-makarczyk: "Ran the agenda and took the notes below."
         matthew-zelenka: "Prepared the thermal questions for Prof. Devaud."

   Validation: every key must be the author or a listed collaborator; unknown slugs fail
   the build naming the file. When present, render each person's line on the entry page and
   show the viewing member's own contribution line on their card. When absent, render
   nothing extra — do not invent text, do not print a placeholder.

5. Hours. Decide and implement these semantics, and document them in CONTRIBUTING.md:
   - `timeCommitted` is the time EACH listed participant spent, because a two-hour meeting
     cost each attendee two hours.
   - Add an optional `hoursByMember: { <slug>: <number> }` override for when people spent
     different amounts; any slug not listed falls back to `timeCommitted`.
   - A member's "hours" stat = the sum over entries they participated in, using their own
     figure.
   - The all-team total on /work-log/ must be the sum of per-person hours — i.e. a 2h
     meeting with 4 people is 8 person-hours — and the stat must be LABELLED clearly enough
     that nobody reads it as 2. Label it "person-hours" if that is what it is.
   - Never silently double-count. If you find a place where a number could be read two ways,
     label it rather than leaving it ambiguous.

6. The cadence strip must count an entry for every participant, so a member who attends
   meetings but writes few entries of their own does not show as a false gap.

7. Posting form. Update the issue form and post-entry.cjs so this is reachable from a post:
   collaborators already exist as checkboxes; add an optional free-text field for the
   poster's own contribution line, which becomes their entry in `contributions`. Keep it
   optional. Re-run `npm run sync:allowlist` if the template's generated block changes.

8. Migrate the existing duplicates. The two 2026-10-01 Prof. Devaud entries are the same
   meeting. Merge them into ONE entry, preserving BOTH authors' wording — put the text each
   person wrote into their own `contributions` line rather than discarding either. Pick the
   earlier-created file as the survivor. Tell me in your summary exactly which file you
   removed and show me the merged result before I commit it. Check whether
   matthew-zelenka/2026-09-29-group_meeting.md and the other 2026-09-29 entries are also the
   same event; if they look like it, LIST them for me to decide and do not merge them
   without my say-so. Do not alter the substance of anyone's writing.

CONSTRAINTS:
  - All member data still comes from src/config/site.ts. No names hardcoded anywhere.
  - Schema changes go in src/content.config.ts with errors that name the offending file.
  - Existing entries without the new fields must keep building unchanged.

DELIVERABLE: the changes, a `npm run build` that passes, a before/after of the two merged
entries for my approval, and a short note in CONTRIBUTING.md explaining when to log a
collaborative entry versus a major team update.
```

---

## PROMPT 4 — Build check on every pull request

```
Read CLAUDE.md first. Never run any git write command.

TASK: Add a CI workflow that builds the site on every pull request to main, so a malformed
entry from any of the five of us is caught before it reaches the live site.

Create .github/workflows/ci.yml:
  - triggers: pull_request targeting main, and push to main
  - ubuntu-latest, actions/checkout@v4, actions/setup-node@v4 with node-version 24 and
    cache: npm
  - steps: npm ci, then npm run build, then npm run test:post (from Prompt 2)
  - permissions: contents: read only
  - a concurrency group keyed on the ref with cancel-in-progress: true, so pushing twice to
    a PR doesn't run two builds
  - name the job exactly "build" and give the workflow the name "CI", because I will later
    select that name as a required status check

Also:
  - Make the build fail on content errors rather than warn, where that is safe. Tell me
    which warnings you considered promoting to errors and which you left alone, with
    reasoning. The short-body warning should stay a warning — it is advisory, not a defect.
  - Check whether check-allowlist.yml overlaps with this and whether it should be folded in
    as a step instead of a separate workflow. Recommend, don't assume.
  - Confirm check-allowlist.yml actually works: it runs `npm run check:allowlist` without an
    `npm ci` step. If that script needs dependencies, it is currently broken — fix it.

In your summary, tell me in order:
  1. what I commit and push,
  2. what I will see on the first PR,
  3. the exact clicks to make "CI / build" a required status check afterwards, and why it
     cannot be done before the check has run once,
  4. whether making it required will break the posting bot's push to main, and what to do
     about that.
```

**Why the ordering matters:** a status check can't be marked "required" until GitHub has seen it run at
least once — it doesn't appear in the dropdown otherwise. So: add the workflow → push → open a PR → let it
run → *then* configure protection. And read Part D before you configure anything.

---

## PROMPT 5 — Move the public scaffolding talk into the docs

```
Read CLAUDE.md first. Never run any git write command.

TASK: The live site currently shows a lot of scaffolding addressed to us rather than to a
reader — placeholder copy, TODO text, instructional notes about how to post, SAMPLE badges,
"your logo here" slots, and similar. A visitor (a professor, a sponsor, a grader) should
see a finished-looking site. We still need all that guidance, just in the repo instead.

STEP 1 — INVENTORY FIRST, delete nothing yet.
Walk every page and component and list every piece of visible text that is addressed to the
team rather than to a reader. Include: literal "TODO" strings that reach the DOM, bracketed
[TODO: ...] placeholders, instructions on how to post an update, SAMPLE badges and sample
entries, empty-state copy that explains our internal process, "Your logo here" placeholders,
and any helper text that only makes sense to us. For each: the file, the line, the exact
text, and where it is rendered. Show me this list.

STEP 2 — DOCUMENT BEFORE REMOVING. This order is mandatory.
For every removed instruction, make sure the equivalent guidance exists in README.md or
CONTRIBUTING.md first. If it does not exist, WRITE IT before removing anything. By the end,
between the two files, a teammate who has never seen the repo must be able to:
  - post a work-log entry through the issue form, step by step, including how to attach
    photos and how collaborators work
  - post a major team update
  - add an entry by hand as a markdown file, with a complete commented frontmatter template
    covering every field including the new contributions and hoursByMember
  - understand the collaborator and hours semantics from Prompt 3
  - run the site locally, build it, and preview it
  - know what to do when the build fails on a content error
  - add a document to the Documentation section
  - swap a placeholder image, with the aspect ratios and sizes
  - know which settings live in src/config/site.ts
README.md is the backend/maintenance home; CONTRIBUTING.md is the how-to-post home. Put a
link to each at the top of the other.

STEP 3 — REMOVE from the rendered site.
  - Any TODO placeholder that is currently visible must either be filled with real content
    I have supplied, or the containing element must be hidden gracefully — never render the
    literal string "TODO" or an empty heading. Use the existing isSet() helper.
  - Delete the sample/draft work-log entries and sample major updates entirely, and set
    FEATURES.showSampleContent to false. We have real entries now; fabricated ones on a
    graded log are a liability.
  - Keep the "Post an update" link. It is the one piece of team-facing UI that must stay,
    and per CLAUDE.md it stays visible and unprotected.
  - Keep source-code comments. Only the rendered page is being cleaned.
  - Do not invent project content to fill a gap. If a section would be empty, hide it with
    the FEATURES switch and tell me which ones you hid and what I need to write.

DELIVERABLE: the inventory from step 1, the updated README.md and CONTRIBUTING.md, the
cleaned pages, a list of sections now hidden and what content they need from me, and a
build that passes.
```

---

## PROMPT 6 — Navigation, contact, and WIP states

```
Read CLAUDE.md first. Never run any git write command.
All of these are small. Do them together and show me the result.

1. NAV ORDER. In src/config/site.ts, reorder NAV so Work Log comes directly after Overview,
   with the rest keeping their current relative order:
     Overview, Work Log, Updates, Timeline, Team, Contact
   Check that nothing else depends on NAV's order, and that SECTION_ORDER (which controls
   the front page) is left alone unless it needs to match.

2. CONTACT. The Contact / Reach Out section must present a named human, not a bare address:
     Ethan Catz — eslemudc@uwaterloo.ca
   Write it so a reader understands he is the person to contact about the project, in one
   short friendly line of our own voice — something in the spirit of "Questions about the
   project, or want to work with us? Ethan Catz is your point of contact." Write the final
   wording yourself; keep it brief and don't overdo the warmth.
   - Put the address in src/config/site.ts as the general contact, not inline in a component.
   - Route it through the existing ContactLink.astro so it stays encoded and never appears
     as a raw mailto: in the HTML source.
   - Show the name and, if it reads well, his role; use the existing member data rather than
     duplicating his name as a string.
   - Set sponsorship contact to the same address unless there's a reason not to.

3. WIP STATES. The "Sponsors" and "Teams & Collaborators" cards in the Reach Out section are
   not real yet. Mark them as work-in-progress tastefully:
   - a small, quiet badge reading "In progress" or "Coming soon" — pick one and use it
     consistently; styled with existing tokens, not a loud ribbon
   - the card itself stays visible and legible, slightly de-emphasised
   - their CTAs must not look like live links. Either render them as plain non-interactive
     text, or disable them properly (not a link to "#"). Nothing should 404 or dead-click.
   - the Faculty & Advisors card, which routes to the real contact, stays fully active
   - add the badge as a reusable component if it will be used more than once
   Keep it restrained — this is a dark, SpaceX-ish design language; a WIP badge should
   whisper.

DELIVERABLE: the changes, a screenshot or description of how the Reach Out section now
reads, and confirmation that no raw email address appears in the built HTML
(grep dist/ for the address after building).
```

---

## PROMPT 7 — Verify and hand off

```
Read CLAUDE.md first. Never run any git write command.

TASK: Verify everything from prompts 2 through 6 together, then write the handoff.

VERIFY, with real runs and real output — do not claim a pass you did not observe:
  1. npm install && npm run build — zero errors; explain every warning that remains
  2. npm run test:post — all cases pass; list them
  3. Break tests, restoring each file afterwards: missing date; unknown author; entry in the
     wrong member folder; a collaborator slug that isn't a member; a contributions key that
     is neither author nor collaborator; an image with no alt text. Each must fail the build
     with a message naming the file.
  4. Add a new markdown entry by hand with two collaborators and a contributions block;
     confirm it appears on all three members' tabs, that the detail page exists at exactly
     one URL, and that the hours land correctly in each member's stats and in the team
     total. Then remove it.
  5. Crawl the built site: every internal link and anchor resolves; no route 404s.
  6. Confirm the literal string "TODO" appears nowhere in dist/.
  7. Confirm the contact email does not appear in dist/ as a raw mailto: or as plain text.
  8. Render at 360, 768, 1280 and 1920 px: no horizontal scroll, nav order correct, WIP
     badges legible.
  9. Keyboard pass and reduced-motion pass on / and /work-log/.
 10. Lighthouse on a production build of / and /work-log/ — report all four scores.
 11. grep -rn "TODO(Ethan)" src — list every remaining hit.

Then write docs/ROUND-2-HANDOFF.md containing:
  - what changed, grouped by the six issues this round addressed
  - the verification results above, with real numbers
  - EXACTLY what I must do by hand, in order: the git commit sequence, the GitHub settings,
    and the live posting test
  - everything that CANNOT be verified locally and must be tested on main after merge,
    stated plainly
  - any questions you need answered
  - what is still outstanding for round 3

End with the three things most likely to still be wrong after this round, and why.
```

---

## PART C — The live posting test (after you merge to `main`)

The posting system genuinely cannot be tested before this point. Issue-triggered workflows only run from the
default branch.

1. Confirm `src/config/site.ts` has all five real GitHub usernames, that you ran
   `npm run sync:allowlist`, and that the regenerated `.github/allowlist.json` shows real strings rather
   than `null`. **If it still shows `null`, nothing else will work.**
2. Merge to `main`. Wait for the deploy to finish.
3. Open a work-log issue **yourself**, with a throwaway title, and **attach a photo** — the image path is
   the least-tested part of the whole system.
4. Go to the **Actions** tab immediately and watch the run. Do not just wait on the issue.
   - **No run at all** → the workflow isn't on `main`, or Actions are disabled.
   - **Grey / skipped** → the kind-detection fallback didn't match; check the hidden marker and the title.
   - **Red** → open the log; after Prompt 2 the step summary tells you the reason in one line.
   - **Green but no file** → the script returned without setting `result`; the step summary will say so.
5. When it works, confirm the entry is live, then delete the test entry's markdown file in a normal commit.
6. **Only now** tell your teammates posting works. Have each of them post one real entry the same day, so
   you find per-person problems (wrong username, different attachment behaviour) all at once rather than
   one a week.

---

## PART D — The conflict you haven't hit yet

**Branch protection on `main` and the posting bot are in direct tension.** If you add a rule requiring pull
requests on `main`, `github-actions[bot]` can no longer push directly, and every post will fail — probably
with an unhelpful 403.

Three ways out, pick one deliberately:

- **Leave `main` unprotected.** CI still runs on PRs and you still see failures; it just isn't *enforced*.
  For a five-person student project this is the pragmatic choice, and it's what I'd do for now.
- **Protect `main` with a bypass for the Action.** Use a Ruleset (not the older branch protection UI) and
  add `github-actions` as a bypass actor. Works, but is fiddly, and a misconfiguration silently breaks
  posting.
- **Make the bot open a PR instead of pushing**, with auto-merge enabled. Safest, and it means every
  posted entry gets a build check before going live — but it adds a step, needs "Allow GitHub Actions to
  create and approve pull requests" turned on, and auto-merge requires protection configured just so.

Decide before you turn protection on, not after. Prompt 4 asks Claude Code to flag this too.

---

## Quick reference — what each prompt touches

| Prompt | Files it will mostly touch | Needs from you first |
|---|---|---|
| 1 Investigate | writes only `docs/POSTING-INVESTIGATION.md` | Part A done, so findings are accurate |
| 2 Fix posting | `.github/workflows/post-entry.yml`, `.github/scripts/post-entry.cjs`, issue templates, `scripts/test-post-entry.mjs` | the 5 GitHub usernames |
| 3 Collaborators | `src/content.config.ts`, `src/lib/entries.ts`, `src/pages/work-log/**`, `WorkLogCard`, `MetaRow`, existing entries | your call on which entries are duplicates |
| 4 CI | `.github/workflows/ci.yml`, maybe `check-allowlist.yml` | nothing |
| 5 Clean-up | `README.md`, `CONTRIBUTING.md`, section components, `site.ts` | real text for any section you want kept |
| 6 Nav/contact/WIP | `site.ts`, `ReachOut.astro`, `components.css` | nothing |
| 7 Verify | `docs/ROUND-2-HANDOFF.md` | nothing |

**Still outstanding from round 1**, unrelated to this round's issues but worth filling in while you're here:
`PROJECT.shortName`, `tagline` and `summary` are still `TODO`, as are every member's `role` and `linkedin`.
Those are what a visitor reads first.
