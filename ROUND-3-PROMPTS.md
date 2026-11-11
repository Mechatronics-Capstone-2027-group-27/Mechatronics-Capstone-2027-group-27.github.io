# Round 3 — Prompt Pack for Claude Code
### Group 27 Capstone design-log site · per-person contributions, hours, and templated output

---

## How to use this

Save this file in the repo root. Run the prompts **in order, one at a time**:

```
Read ROUND-3-PROMPTS.md and execute PROMPT N exactly as written. Only Prompt N.
```

Step 0 is a five-minute manual test you do yourself. Its result changes what Prompt 1 has to
defend against, so don't skip it.

**Standing rules (unchanged):** Claude Code never runs `git add`, `commit`, `push`, `branch`,
`checkout -b`, `merge` or `rebase`. Read-only git is fine. No new runtime dependencies without
justification. Nothing that belongs in `src/config/site.ts` is hardcoded anywhere else. The content
schema in `src/content.config.ts` is strict — an unknown frontmatter key fails the build.

### Decisions already made

- **Checkboxes are replaced by per-person boxes.** Filling in someone's contribution box is what
  makes them a participant. You cannot list someone without describing what they did.
- **Hours are per person**, collected alongside each contribution and written to `hoursByMember`.
- **`timeCommitted` does not change meaning.** It stays "hours per participant" so the twelve
  existing entries keep theirs.

---

## STEP 0 — Settle the existing field first (you, ~5 minutes)

The current single "Your contribution" field has never been confirmed working in a real post.
Evidence it may be broken: David's 2026-11-02 field-trip entry had three collaborators and no
contributions line, and no bot-posted entry in the repo has one.

Two very different causes:

- **Nobody filled the field in** → the parser is fine and Prompt 1 inherits working code.
- **The parser is dropping it** → the same bug will silently eat all five new boxes, and Prompt 1
  has to fix the cause rather than build on top of it.

**Do this:** open a work-log issue, put something obvious like `CONTRIBUTION FIELD TEST` in
**"Your contribution"**, submit, and open the committed markdown file.

- Line present in frontmatter → the field works. Tell Claude Code so in Prompt 1.
- Line missing → open the issue, `⋯` → Edit, and copy the **raw** body. Paste it into Prompt 1.
  The exact `### heading` text GitHub produced is the evidence needed.

Delete the test entry afterwards.

---

## PROMPT 1 — Per-person contributions and hours, from an editable template

```
Read CLAUDE.md first. Never run any git write command.

TASK: Three changes to the posting pipeline, done together because they touch the same
files and the same code path.

─────────────────────────────────────────────────────────────────────────────
CHANGE A — Per-person contribution fields, replacing the collaborator checkboxes
─────────────────────────────────────────────────────────────────────────────

GitHub Issue Forms cannot show or hide fields conditionally, so this is five
always-visible optional boxes rather than boxes that appear when someone is selected.

In .github/ISSUE_TEMPLATE/work-log-entry.yml:
  - REMOVE the `collaborators` checkboxes block entirely.
  - REMOVE the single "Your contribution" field.
  - ADD one optional textarea per member, generated from MEMBERS by
    npm run sync:allowlist, placed between "Content of progress" and "Images".
  - Include the author's own box. "Content of progress" describes the task; a person's
    box describes their individual part. On a group session those are different things.
  - Add description text making the rule explicit: fill in a box for everyone who
    worked on this, including yourself; a blank box means that person wasn't involved.
    For someone who only attended, a short line such as "Attended, no specific
    deliverable" is fine.

In .github/scripts/post-entry.cjs:
  - Each non-empty box becomes contributions[<slug>].
  - participants = the author plus every slug with a non-empty contribution.
  - collaborators = participants minus the author, written to frontmatter as now.
  - The author is always a participant whether or not their own box is filled.
  - Trim whitespace; treat a box containing only "_No response_" as empty.

─────────────────────────────────────────────────────────────────────────────
CHANGE A2 — Per-person hours
─────────────────────────────────────────────────────────────────────────────

  - Alongside each contribution box, add an hours input for that member, generated from
    MEMBERS the same way. Group each person visually with a markdown heading, so the
    form reads as five blocks of (name → what they did → hours) rather than ten loose
    fields.
  - REMOVE the standalone "Time committed" field. The author's own hours box replaces
    it; otherwise the same number is asked twice.
  - Each person's hours goes to hoursByMember[<slug>].
  - timeCommitted is set to the AUTHOR'S hours. Do NOT change what timeCommitted means.
    It stays "hours per participant" so the twelve existing entries keep their meaning —
    the merged 2026-09-29 entry says 2.0 with five participants and must keep rendering
    as 10 person-hours. With hoursByMember complete, timeCommitted is never consulted
    for new entries anyway.
  - Accept the same hour formats the current field accepts (2, 2.5, "2.5 h", "2.5 hrs",
    "2.5 hours"); check what is already supported and keep it.
  - INVALID, comment on the issue and leave it open for edit-and-retry:
      · a filled contribution with blank or zero hours — name the person. The schema
        requires positive hours, and a described contribution with no time recorded is
        almost always an oversight that undercounts us.
      · hours filled with a blank contribution — participation is defined by the
        contribution, so hours alone are ambiguous.
  - Nothing in the rendering layer should need to change: hoursFor() already resolves
    hoursByMember[slug] ?? timeCommitted, and team totals are already person-hours. If
    something does need to change, say why before changing it.

─────────────────────────────────────────────────────────────────────────────
ROBUSTNESS — the part that matters most
─────────────────────────────────────────────────────────────────────────────

The parser maps GitHub's `### <label>` headings to fields by label text, and that is the
most likely reason a field silently vanishes (see Step 0). We are about to depend on ten
such mappings instead of one, so:

  - Match headings case-insensitively, with collapsed internal whitespace, tolerant of
    trailing punctuation, non-breaking spaces and em dashes.
  - Build the expected-heading list from the SAME source that generates the form, so the
    two cannot drift apart.
  - List every `### heading` found in the issue body in the run's step summary, and flag
    any that matched no known field.

A dropped field must be visible in the summary, never silent. That defect class already
cost us five weeks; it must not be possible to repeat it quietly.

─────────────────────────────────────────────────────────────────────────────
CHANGE B — Generate the markdown from an editable template
─────────────────────────────────────────────────────────────────────────────

post-entry.cjs currently builds frontmatter by string concatenation. Replace that with
templates I can edit without touching JavaScript:

  .github/templates/work-log-entry.md
  .github/templates/major-update.md

Requirements:
  - Placeholders are TYPED, not raw text substitution. Keep a map in the script declaring
    each placeholder's serializer: quoted string, bare date, bare number, list of slugs,
    block-scalar map for contributions, numeric map for hoursByMember, image list.
  - A placeholder present in a template but missing from that map must FAIL the run with
    a message naming it. Templates must not be able to drift silently.
  - YAML safety is the whole risk here. A title containing a colon, a double quote, a
    leading dash, a `#`, a newline or an emoji must not be able to break the generated
    file. Serialize by type; never interpolate a raw string into YAML.
  - Optional fields that are absent leave no empty key and no stray blank line.
  - Apart from the new contributions and hoursByMember, output for an entry with the same
    inputs must match what the current script produces. Show me a before/after for one
    real existing entry to prove it.
  - Comment the templates so each placeholder's purpose and whether it is required are
    obvious. These templates are the thing I will be editing, so they should read well.

CONSTRAINTS
  - src/content.config.ts is the authority. contributions and hoursByMember already exist
    from Round 2 — change the schema only if genuinely needed, and say why. A template
    field not in the schema must fail the build naming the file.
  - No templating library. The handful of constructs needed is small enough to write, and
    a dependency here is not worth the API-drift risk.
  - Run npm run sync:allowlist afterwards and confirm npm run check:allowlist passes.

─────────────────────────────────────────────────────────────────────────────
TESTS — extend scripts/test-post-entry.mjs
─────────────────────────────────────────────────────────────────────────────

  - All five contribution boxes filled; two filled; none filled (author only).
  - A box containing only whitespace, and one containing "_No response_".
  - Five people with five different hour values.
  - A filled contribution with blank hours, and one with 0 — both must be INVALID and
    name the person.
  - Hours filled with a blank contribution — INVALID.
  - "2.5", "2.5 h", "2.5 hrs", "2.5 hours".
  - Adversarial titles: a colon, a double quote, a leading dash, a `#`, an emoji, 200
    characters, and a title that is only digits.
  - A contribution containing markdown headings, bullet lists and a blank line.
  - A `### heading` in the body matching no field — assert it is reported, not dropped.
  - Team total equals the sum of hoursByMember, not timeCommitted × participants.
  - Every generated file must parse as YAML and satisfy the content schema.

─────────────────────────────────────────────────────────────────────────────
DELIVERABLE
─────────────────────────────────────────────────────────────────────────────

The changes; passing tests with the count; the before/after for one real entry; both
templates printed in full; the new issue form printed in full; and a plain-language
description of what I edit when I want to change the output format.

Also tell me what happens to the two existing entries that have collaborators but no
contributions (David's 2026-11-02, and Matthew on the Devaud entry) — they should stay
valid, but confirm it and say whether you recommend backfilling them.

Do not commit anything.
```

### Before approving Prompt 1

- **Read both templates in full.** They are the artifact you asked for. If they don't read well
  to you, say so before anything is built on them.
- **Check the before/after.** For an existing-shaped entry the only differences should be the
  contributions and hours blocks.
- **Count the form fields.** Ten per-person inputs plus title, date, content and images is a long
  form. Look at it rendered before the team sees it; if it's unwieldy, that's easier to fix now.

---

## PROMPT 2 — How an entry renders on the site

Run only after Prompt 1 is approved and you have read the templates.

```
Read CLAUDE.md first. Never run any git write command.

TASK: Now that contributions and hours are per-person and the markdown comes from a
template, rework how a work-log entry displays. This is a design pass — I will judge it
in a browser, so build it and then show me where to look.

Three surfaces:

1. The entry detail page (/work-log/<author>/<entry>/).
   Today a "Who did what" list sits below the body. With most entries now carrying
   several contributions and per-person hours, that becomes the main content of the page
   rather than a footnote. Reconsider the hierarchy: what should a reader see first, the
   shared account or who did what? Propose a layout and say why.

2. The card on a member's tab.
   It currently previews that member's own contribution, clamped, and their own hours.
   Check that still reads well now that every entry has one, and that the
   "Collaborated / Logged by" marker stays unambiguous.

3. The All view.
   An entry with four contributions cannot show all of them here. Work out the right
   summary form.

Requirements:
  - Contributions render as Markdown (headings, lists), as they do now.
  - A grader skimming must still see date, author, participants and hours without
    clicking in. That is the graded criterion and it does not move.
  - Per-person hours should be visible where they are useful and not noisy where they
    are not — your call, but say what you decided.
  - Existing tokens and styles only. No inline styles, no new dependencies.
  - Nothing invented: an entry with no contributions renders nothing extra.

Before building, show me two or three options for the detail page with a short
description of each, and let me pick. After building, start the dev server and give me
the URLs to open — I will review in a browser, not from a summary.
```

---

## Not in scope this session

Carried over, all still open, none blocking:

- **Content:** `PROJECT.summary` and `objectives` (About stays hidden without them), timeline
  milestones, a first major update, a first PDF in `public/docs/`, `shortName`, `tagline`, roles
  and LinkedIn URLs, four team portraits and the hero image.
- **Cadence:** Ian and Nitya have zero authored entries across the term. Twelve entries in six
  weeks across five people, with a twelve-day gap in October. No code change affects this one.
- **Housekeeping:** ten merged branches to delete, `deploy.yml` still on the old action versions,
  `npm audit` at 5 high (all build-time), Matthew's Devaud contribution line.
- **Untested:** Safari, Firefox, a real phone, screen readers, two people posting simultaneously.
