# Round 2 handoff

Written 2026-10-06, on branch `Oct-06-major-update-part-2`, with Prompts 3, 5 and 6 done and Prompts 5 and 6
not yet committed. Every result below was observed in a real run on this machine; where something could not be
run here, it says so.

**State in one line:** the build passes, all 35 posting tests pass, every check in the list passed, and two small
defects the checks turned up were fixed along the way (section 2, "Found and fixed").

Several front-page sections are hidden on purpose because their content does not exist yet: About, Major
updates, Timeline and Documentation. That is the intended state, not a fault. What each one needs is in section 6.

---

## 1. What changed this round

### 1. Posting from an issue did nothing
- The job was gated on labels that did not exist, so it was skipped silently. The gate is gone: the job runs for
  every issue and `post-entry.cjs` works out the kind itself (body marker, the form's **Entry type** field, label,
  title prefix).
- The allowlist was empty. The five GitHub usernames are in `MEMBERS`; an empty allowlist now fails loudly.
- The first live run then failed because `actions/github-script` overwrites an output named `result`. The script
  reports through `entry_result`, and the build step fails on the spot if no result comes back.
- Every run ends with a summary of what happened. An issue can be replayed from Actions → Post log entry → Run
  workflow. Pushes rebase and retry; a branch-protection rejection is explained on the issue.
- **Entry type** is optional, because GitHub sometimes shows "None" for it.
- Full history: `docs/POSTING-INVESTIGATION.md`.

### 2. One entry, many members
- An entry belongs to its author **and** every collaborator. It appears on each participant's tab and has one
  page, at `/work-log/<author>/<entry>/`.
- On a collaborator's tab the card says **Collaborated** and **Logged by** the author.
- New optional frontmatter: `contributions` (what each person did, rendered as Markdown) and `hoursByMember`
  (for people whose hours differ). `timeCommitted` means hours per participant. The team total is labelled
  **Person-hours**.
- The posting form has an optional **Your contribution** field.
- Seven duplicate entries became two: the five 2026-09-29 entries are one entry with each person's original text
  in `contributions`, and the two 2026-10-01 Devaud entries are one.

### 3. No build check before merge
- `.github/workflows/ci.yml` ("CI / build") runs the allowlist check, `npm ci`, `npm run build` and
  `npm run test:post` on every pull request to `main` and every push to it.
- The content schemas are strict: an unknown frontmatter key, or an image path with no matching file (matched
  case-sensitively), fails the build and names the file.

### 4. Scaffolding was visible to visitors
- Nothing addressed to the team reaches the page any more: no TODO text, no "your logo here", no sample
  entries, no placeholder photos, no how-to notes. That guidance is in `README.md` and `CONTRIBUTING.md`.
- A section shows only when its switch is on and it has real content (`src/lib/sections.ts`); nav links follow.
- Placeholder photos are left out until replaced: the hero uses the gradient, member cards show initials, and no
  link-preview image is sent.

### 5. Navigation order
- `NAV` is Overview, Work Log, Updates, Timeline, Team, Contact. Today the page shows **Work Log, Team,
  Contact**, because the other three point at hidden sections.

### 6. Contact and work-in-progress cards
- Reach Out names a person: "Questions about the project, or want to work with us? Ethan Catz is your point of
  contact." The address is in `SITE.contact`, encoded in the page, and decoded by the page script.
- With JavaScript off, the address is shown spelled out: `eslemudc [at] uwaterloo [dot] ca`.
- Sponsors and Teams & Collaborators carry a quiet **Coming soon** badge and have no link. Faculty & Advisors is
  live.

---

## 2. Verification results

Tools: Node 24.19.0, Astro 7.3.5, headless Chrome driven over the DevTools protocol against `npm run preview`
(the production build), Lighthouse 13.5.0.

| # | Check | Result |
|---|---|---|
| 1 | `npm install && npm run build` | **Pass.** 0 errors, 13 pages, 1 warning (below) |
| 2 | `npm run test:post` | **Pass.** 35 of 35 (listed below) |
| 3 | Six break tests | **Pass.** All six failed the build and named the file; all restored |
| 4 | Hand-written entry with two collaborators | **Pass.** On all three tabs, one detail URL, hours correct; removed |
| 5 | Crawl of the built site | **Pass.** 13 pages, 220 internal links (94 with an anchor), 0 broken |
| 6 | Literal "TODO" in `dist/` | **Pass.** 0 of 48 files, in any letter case |
| 7 | Contact address in `dist/` | **Pass.** Not present as text or as a `mailto:` link (detail below) |
| 8 | 360 / 768 / 1280 / 1920 px | **Pass.** No horizontal scroll on 24 page-and-width combinations |
| 9 | Keyboard and reduced motion | **Pass**, with one thing that could not be tested (below) |
| 10 | Lighthouse | 98 / 100 / 100 / 100 on both pages |
| 11 | `TODO(Ethan)` in `src` | 9 hits (listed below) |
| + | JavaScript disabled | **Pass** after one fix (below) |
| + | Merged 2026-09-29 entry page | **Pass.** Real headings and lists, no raw Markdown |

### 1. Build
One warning remains:

```
[WARN] [glob-loader] No files found matching "**/*.md" in directory "src\content\updates"
```

It means there are no major updates yet. It goes away when the first one is posted. The short-body warning did
not fire: no current entry is under 200 characters.

`npm install` also reports 3 high-severity advisories, all in build tooling pulled in by Astro
(`http-cache-semantics`, `sharp`, `source-map-js`). None of that code is shipped to visitors — the site is static
files. `npm audit fix` is available; it was not run, because it changes `package-lock.json`. See section 5.

### 2. Posting tests (35)
Workflow plumbing: the output the workflow gates on survives github-script · the script logs entry and exit · a
script that returns no result fails the build step.
Posting: valid work-log entry · valid major update · unknown author rejected and told who is on the allowlist ·
empty allowlist fails loudly · missing label but correct title prefix · Entry type field alone is enough · issue
filed before the Entry type field existed · Entry type on None, blank or missing · Entry type is not required ·
Your contribution becomes the poster's line.
Validation: future date · malformed hours · "2.5 hrs" and "3h" accepted · empty content · several problems
reported at once.
Images and parsing: two images · image that cannot be downloaded · `### ` headings kept inside an entry ·
ticking yourself as collaborator ignored.
Skips and safety: unrelated issue skipped visibly · closed issue skipped, manual replay posts · same issue not
posted twice · a crash still sets a result.
Reporting: posted and pushed · push rejected by branch protection · commit step died · deploy cannot start ·
invalid commented once only · no result at all · hand-written kind marker wins.
Repo checks: the real issue forms match the parser · the real allowlist has a username in it.

These run the workflow's real script blocks the way `actions/github-script` does. They imitate the action; they
do not run it.

### 3. Break tests
| Broken on purpose | Build said |
|---|---|
| Missing date | `date: date is required and must be YYYY-MM-DD` |
| Unknown author | `author "someone-else" is not a team member. Valid slugs: …` |
| Entry in the wrong member folder | `author "ethan-catz" does not match its folder "ian-macpherson". Move the file or fix the author.` |
| Collaborator who is not a member | `collaborators.0: collaborator "not-a-member" is not a team member.` |
| Contribution for someone not on the entry | `contributions names "nitya-singh", who is not the author or a collaborator of this entry.` |
| Image with no alt text | `images.0.alt: every image needs alt text` |

Each message named `…/2026-10-05-zz-verify.md`. No test file remains in the working tree.

### 4. Temporary collaborative entry
Author Ethan, collaborators Ian and Nitya, 1.5 h each, with a contributions block.

| | Before | With the entry |
|---|---|---|
| Entries (All) | 4 | 5 |
| Person-hours | 12.5 | 17 (+3 × 1.5) |
| Ethan | 1 entry · 2 h | 2 entries · 3.5 h |
| Ian | 1 entry · 2 h | 2 entries · 3.5 h |
| Nitya | 1 entry · 2 h | 2 entries · 3.5 h |
| David, Matthew | 3 entries each | unchanged |

It appeared on all three tabs, marked Collaborated and "Logged by Ethan Catz" on Ian's and Nitya's. Exactly one
detail page was built, `/work-log/ethan-catz/2026-10-05-zz-verify/`. Removed afterwards; totals returned to 4
entries and 12.5 person-hours.

### 7. Contact address
Searched every file in `dist/`: the full address 0 files; `uwaterloo.ca` 0 files; `href="mailto:` 0 files;
`mailto:` followed by any address character 0 files. The spelled-out fallback is in 1 file, the home page.

The bare word `mailto:` does appear on every page, inside the script that decodes the address
(``e.href=`mailto:${t}` ``). There is no address next to it. A grep for `mailto:` alone will hit this; it is how
the obfuscation works.

In a real browser with JavaScript on, the main button reads `eslemudc@uwaterloo.ca` and both email buttons
become working mail links.

### 8. Widths
Pages checked at each width: `/`, `/work-log/`, `/work-log/ian-macpherson/`, the merged entry page, `/updates/`
and the 404 page. Page width equalled viewport width in all 24 cases.

- **Nav order:** at 1280 and 1920 the header shows Work Log, Team, Contact. At 360 and 768 the menu button opens
  the same three in the same order.
- **Coming soon badges:** 11.5 px, contrast 7.97:1 against the background, on one line, inside the card, at all
  four widths. The de-emphasised card headings and body text are also 7.97:1. Neither "soon" card contains a link.

### 9. Keyboard and reduced motion
- **Home:** 20 tab stops, starting with "Skip to content". Every stop had a visible 2 px focus ring. The skip link
  moves focus to the main content.
- **Work log:** 22 tab stops, same result. One entry card was still fading in when it received focus and was fully
  visible within a second.
- **Mobile menu (360 px):** opened with Enter, focus stayed inside the menu while tabbing, Esc closed it and
  returned focus to the menu button.
- **Reduced motion:** with the setting on, all 13 reveal elements on the home page (4 on the work log) are visible
  immediately, 0 animations run, and the hero's scroll cue does not animate. With it off, those elements start
  hidden and fade in on scroll, as designed.
- **Not tested:** on the home page, focus enters the embedded monday.com board and the test stopped there. Tabbing
  on through the board to the footer was not verified.

### 10. Lighthouse
Production build served locally, Lighthouse's default mobile profile.

| Page | Performance | Accessibility | Best practices | SEO |
|---|---|---|---|---|
| `/` | 98 | 100 | 100 | 100 |
| `/work-log/` | 98 | 100 | 100 | 100 |

Home: first contentful paint 2.0 s, largest contentful paint 2.0 s, blocking time 0 ms, layout shift 0.002.
Work log: 1.8 s, 2.0 s, 0 ms, 0. The only items flagged were render-blocking CSS and, on the work log, 52 KiB
that could be saved on entry photos. These numbers are from a local server; GitHub Pages will differ.

### 11. `TODO(Ethan)` remaining in `src`
```
src/components/sections/ReachOut.astro:21   live: false — needs a sponsorship package PDF in public/docs/
src/config/site.ts:7      (the comment explaining the convention)
src/config/site.ts:25     PROJECT.shortName
src/config/site.ts:27     PROJECT.tagline
src/config/site.ts:29     PROJECT.summary
src/config/site.ts:31     PROJECT.objectives
src/config/site.ts:65     roles, LinkedIn URLs, portraits
src/config/site.ts:92     FEATURES.about
src/config/site.ts:95     FEATURES.timeline
```
None of these reaches the built site.

### JavaScript disabled
- The spelled-out address `eslemudc [at] uwaterloo [dot] ca` is visible under both email buttons, at 1280 and 360.
- No text is invisible on the home page, the work log, or the merged entry page; all 4 work-log cards show.
- At 1280 the header links work. At 360 there are no header links; the footer has them on every page.
- The email buttons themselves do nothing without JavaScript; the spelled-out address is the way through.

### Merged 2026-09-29 entry
Outline: h1 title → h2 "Who did what" → h3 for each of the five people → h4 for their own headings. Each person
has their "What I worked on", "Results" and "Next steps" as headings. Lists: Ethan 3 lists / 6 items, Nitya 3 / 5,
Matthew 3 / 5, Ian 3 / 3, David 2 / 6 (his "What I worked on" is a sentence, as he wrote it). Bullets are shown.
No literal `##` appears anywhere in the rendered text. Ian's `-Like this` bullets render as list items.

### Found and fixed during verification
1. **Missing space in the contact line.** In the browser it read "…work with us?Ethan Catz". Fixed in
   `ReachOut.astro`.
2. **Dead menu button without JavaScript.** At phone width the menu button was shown but did nothing. It is now
   hidden when JavaScript is off (`components.css`); the footer links remain.

Both were re-checked in the browser after the fix.

---

## 3. What you must do by hand, in order

### A. Bring the branch up to date and commit
`origin/main` has one commit this branch does not: `ae86962`, David's entry posted through the bot from issue #16
(`david-makarczyk/2026-10-06-preliminary-analytical-analysis.md`). It touches no file this branch changes.

```sh
git status                      # review: ~36 changed paths, all from Prompts 5, 6 and 7
git add -A
git commit -m "Hide scaffolding, add contact and Coming soon states, round-2 handoff"
git fetch origin
git merge origin/main           # brings in David's entry; expect no conflicts
npm run build                   # must pass — it now includes David's entry
npm run test:post               # must say 35 of 35
git push -u origin Oct-06-major-update-part-2
```

Then open a pull request to `main`. Wait for **CI / build** to go green. Merge. The merge starts **Deploy site**.

This combination has been tried: David's entry was copied in from `origin/main` (without merging), the site
built with it — 14 pages, his entry page included — and it was removed again. So the merge is expected to build.

### B. GitHub settings
Nothing needs changing. Two things to leave alone:
- **Settings → Rules → Rulesets → "Main push"**: keep it **Disabled**. Enabling it blocks the posting bot.
- **Settings → Pages → Source**: stays **GitHub Actions**.

### C. After the deploy finishes
1. Open the live site. Check the hero (gradient, no photo), the Reach Out section, and that the header reads
   Work Log, Team, Contact.
2. Click the email button. It should open your mail program addressed to you.
3. Open **Issues → New issue → Work log entry**. Confirm the new **Your contribution** field is there.

### D. Live posting test
The posting form changed in Prompt 3 and that change has never run on GitHub.
1. File a throwaway work-log issue. Tick one collaborator. Fill in **Your contribution**. Attach a photo.
2. Watch **Actions → Post log entry**. Expect two runs: the first says **POSTED**, the second a short
   **SKIPPED** or **ALREADY POSTED**.
3. On the site: the entry is on your tab and the collaborator's tab, marked Collaborated on theirs, with your
   contribution line under "Who did what".
4. Delete the test entry's Markdown file and its photo in a normal commit.

### E. Tell the team
- One entry per shared event, with collaborators ticked — not one each. See `CONTRIBUTING.md`.
- Matthew: add a `contributions` line to the Devaud entry if your part differed from David's.
- Five old entry URLs no longer exist (section 4).

---

## 4. What cannot be verified locally

Stated plainly: none of the following has been observed working.

1. **This branch on GitHub at all.** CI has not run on it, and it has not been deployed.
2. **The "Your contribution" form field** on GitHub's form renderer, and the bot writing a `contributions` line
   from a real issue.
3. **The built site on GitHub Pages**: real URLs, real caching, real load times. Lighthouse ran against a local
   server.
4. **Email buttons in a real mail client.** The test confirmed the link becomes `mailto:` with the right address,
   not that a mail program opens.
5. **Keyboard access past the monday.com board** on the home page.
6. **Screen readers.** Lighthouse's accessibility score is automated; nobody has listened to the page.
7. **Other browsers.** Everything was checked in Chrome only. Safari, Firefox and a real phone were not.
8. **Branch protection.** The bot's "push was rejected" message cannot be exercised while the ruleset is disabled.
9. **Two people posting at the same moment.**
10. **The five removed URLs** now return 404. No redirects were added, by your decision:
    - `/work-log/david-makarczyk/2026-09-29-proposal-update/`
    - `/work-log/ian-macpherson/2026-09-29-IDidAThing/`
    - `/work-log/matthew-zelenka/2026-09-29-group_meeting/`
    - `/work-log/nitya-singh/2026-09-29-presentation/`
    - `/work-log/matthew-zelenka/2026-10-01-prof-devaud/`

---

## 5. Questions

1. **Run `npm audit fix`?** Three high-severity advisories in build tooling. Visitors are not exposed. It changes
   the lockfile, so it should be its own commit with a build and test run after it.
2. **The spelled-out address appears twice** with JavaScript off (under the main button and under "Contact the
   team"). Keep both, or only the first?
3. **Should "Updates" in the nav go to `/updates/`** while there are no major updates? Today the link is hidden
   and the Updates page is reachable only by typing its address.
4. **Ian and Nitya have no entry they authored.** Their one card says Collaborated, with their own text under
   their name. Is that acceptable to the graders, or should they each post something soon?

---

## 6. Outstanding for round 3

**Content only you can write** (each brings a hidden section back — steps are in `README.md`):
- `PROJECT.summary` and `PROJECT.objectives` → About, and the "Overview" nav link.
- Real milestones in `src/data/timeline.json` → Timeline.
- A first major update → Major updates.
- A first PDF in `public/docs/` → Documentation.
- `PROJECT.shortName`, `PROJECT.tagline`, every member's `role` and `linkedin`.

**Photos:** hero (two files), About, band, system diagram, link-preview card, five portraits. Sizes are in
`README.md`. Each needs its flag switched on after the file is replaced.

**Reach Out:** a sponsorship package PDF, then set the Sponsors card to `live: true`; decide when Teams &
Collaborators goes live.

**Engineering:**
- `actions/github-script` is on v8 on purpose; v9 changes how `require` works. `deploy.yml` is still on the older
  action versions and shows a Node 20 warning.
- `@astrojs/markdown-satteri` must be bumped together with `astro`.
- Bot commits never run CI; a posted entry is first built by the deploy.
- Images pasted into an entry's Content box are not copied into the site.
- The placeholder image files are still in the repo and are copied into the build under hashed names, unlinked.
- Still not built: search, tag filtering, RSS, the ICS timeline import.

---

## The three things most likely to still be wrong

1. **The "Your contribution" field in a real post.** It is the only posting change this round that has never run
   on GitHub. The last time the harness passed and the live run failed, the cause was something the harness did
   not model. If GitHub renders or labels the field differently from what the parser expects, the line is
   silently dropped — the entry still posts, just without it.
2. **The site in a browser other than Chrome, or on a real phone.** Every visual check used one browser engine
   in emulation. The contact block, the "Who did what" list and the initials avatars are all new layout this
   round and have never been seen in Safari or Firefox.
3. **Someone replaces a photo and nothing changes.** Until this round, swapping a site photo meant replacing the
   file. It now also needs a flag: `IMAGES.<name>: true`, or the member's `photo: 'team/<slug>.jpg'`. That is
   written down in `README.md` and in `src/config/site.ts`, but it is a second step that did not exist before,
   and the first teammate to add their portrait will probably miss it. The build will not complain; the site
   will just keep showing initials.
