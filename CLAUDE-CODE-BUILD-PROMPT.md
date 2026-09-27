# Build Prompt — Group 27 Capstone Progress Log Website (Round 1 Prototype)

> **How to use this:** paste this entire document into Claude Code as a single message, in the
> `Mechatronics-Capstone-2027-group-27.github.io` repo with the `New-Website-Design` branch checked out.
> Everything Claude Code needs is in here. Where it needs a real file from me (photos, logos), it must
> stop and ask using the exact list in §12, and ship a labelled placeholder in the meantime.

---

## 0. Role and objective

You are a senior full-stack web developer. Build and prepare for publishing an **early-stage prototype**
of a project progress-log website for a University of Waterloo Mechatronics Engineering capstone team.

This is a **prototype, not a v1.0**. Bias toward: working end to end, obvious to edit, easy to extend.
Do not gold-plate. Do not add dependencies that aren't earning their place. Every decision should be
reversible by editing one file.

Two audiences, in priority order:

1. **The course instructor / TA who grades the design log** (see §2 — this is a graded deliverable).
2. **Sponsors, professors, other teams, and later, recruiters and grad-school admissions committees**
   who will judge the project by this site. The site should make the engineering rigor legible, not just
   the marketing.

---

## 1. Context you must load before writing code

### 1.1 The repo

- **Repo:** `Mechatronics-Capstone-2027-group-27.github.io`
- **Local path:** `C:\Users\Ethan Catz\Documents\GitHub\Mechatronics-Capstone-2027-group-27.github.io`
- **Branch to work on:** `New-Website-Design` (already checked out — stay on it)
- **Hosting:** GitHub Pages, user/org-style repo, so it serves at
  `https://mechatronics-capstone-2027-group-27.github.io/` from the root. **Base path is `/`, not a subpath.**

### 1.2 Current state of the repo

```
/
├── .git/
├── CLAUDE.md        (1.4 KB)
└── index.html       (1.6 KB)
```

That's it. `index.html` is a single hand-written static page with **no CSS and no JS** — browser default
styling only. Its `<main>` contains `<section>` blocks: **About, Project, Team, Documentation, Monday**.
Most hold placeholder text; the team list still says "Team Member 1–4".

**Read both files before you touch anything.**

### 1.3 The monday.com embed — do not lose it

The existing `Monday` section embeds a monday.com board view via `<iframe>` (`view.monday.com/embed/...`).
The team actively tracks work there. **Carry that iframe forward into the new site verbatim**, wrapped in a
responsive 16:9 container, and put its URL in the global config (§5) as `MONDAY_EMBED_URL`.

### 1.4 Existing rules in `CLAUDE.md` — and a contradiction you must resolve

Current rules:

1. `Never run git commit, push, or create branches. I handle all git myself.` — **Absolute. Obey it.**
   You may create and edit files, including `.github/workflows/*.yml`. You may run `git status`,
   `git diff`, `git log`. You may **not** run `git add`, `git commit`, `git push`, `git branch`,
   `git checkout -b`, `git merge`, or `git rebase`. When you're done, tell Ethan exactly what to commit.
2. `Run the site locally with: npm run dev`
3. `Keep styling in /css, no inline styles.`

**The contradiction:** the repo has no `package.json`, so `npm run dev` cannot currently work, and rule 3
describes a plain-HTML layout (`/css/`) that conflicts with the framework layout this build needs.

**Resolution:** rule 2 tells us a Node build step was always intended. Adopt it. Then **rewrite `CLAUDE.md`
as part of this work** so it describes reality: the new stack, the new folder layout, where styles live,
how to add a log entry, how to deploy. Keep rule 1 verbatim and at the top. Show Ethan the CLAUDE.md diff
explicitly in your summary — he needs to know it changed.

### 1.5 Do not invent project content

You know the project name and subtitle (§5) and nothing else about the engineering. **Do not write
fictional technical content** — no invented altitudes, mass budgets, subsystem names, test results,
sponsor names, or fake log entries presented as real. Where body copy is needed, write clearly-marked
placeholder prose (`Lorem`-style is fine, or a bracketed `[TODO: …]` line that says what belongs there).
Seed content must be obviously fake: `sample-entry-*.md` with `draft: true` and a visible "SAMPLE" badge.

---

## 2. The graded rubric — hard constraints

This website is a graded MTE 481 (Fall 2026) deliverable called the **Design Log Website**, worth 6 marks
across three criteria. Full marks require all of the following, so treat them as acceptance criteria, not
nice-to-haves:

| Criterion | Marks | What full marks requires | What the build must guarantee |
|---|---|---|---|
| **Accessibility** | 1 | "Easily accessible to the course instructors" | Public URL, **no login required to read anything**, no broken deploy, works on mobile and on a locked-down campus browser. Nothing behind auth except the posting UI. |
| **Quality** | 2.5 | Sufficient detail on progress; **dates and names of members on all entries**; **individual contributions of each member clearly described** | Every entry renders a visible date, a visible author name, and visible collaborator names. The schema makes author and date **required fields** — a build must fail if they're missing. |
| **Frequency** | 2.5 | Entries logged **regularly**; penalizes gaps *and* bursts | Cadence must be visible at a glance so the team can self-correct — see the "cadence strip" in §9.3. |

Two consequences for the design:

- **Never gate reading.** No "sign in to view". The grader will not make an account.
- **Author, date, collaborators and time-committed must be visually prominent on the card itself**, not
  buried on a detail page. A grader skimming a grid should be able to score Quality without clicking in.

---

## 3. Scope of this round

**In scope (build it):**

- Global config module driving all repeated values.
- Front page, scrollable, multi-section (§8).
- Work Log page with 5 member tabs, card grid per member (§9).
- Content model for member entries + major/team updates (§6).
- Posting workflow restricted to the 5 team members (§7).
- Placeholder Development Timeline component with a JSON data source shaped for later ICS ingest (§10).
- Design system + tokens (§11).
- Placeholder assets + a written asset request list for Ethan (§12).
- Rewritten `CLAUDE.md`, plus a `CONTRIBUTING.md` that explains posting in plain language.

**Explicitly out of scope this round** (mention in your summary, don't build):

- Real ICS parsing (data arrives later).
- Real auth provider / member-only rendered UI (see §7.4).
- Search, tags/filtering, RSS, comments, analytics, i18n.
- Any real project content, images, or sponsor logos.

---

## 4. Stack decision

Use **Astro** (latest stable) + **TypeScript** + plain CSS with custom properties.

**Why Astro, specifically:**

- Ships zero JS by default — the site stays fast and the graded content is static HTML, which is the most
  robust possible answer to the Accessibility criterion.
- **Content Collections** give schema-validated Markdown with typed frontmatter. That is exactly the
  "build fails if `author` or `date` is missing" guarantee §2 needs, for free.
- It matches precedent: a current UWaterloo Mechatronics capstone design-log site
  (`github.com/uwgoats/uwgoats.github.io`) is Astro + Tailwind on GitHub Pages with frontmatter-driven
  tagged log entries. Known-good pattern for this exact assignment.
- `npm run dev` works, satisfying the existing CLAUDE.md rule.

**Do not use Tailwind.** Hand-written CSS with custom properties is a better fit here: the design language
(§11) is token-driven and typography-heavy, the team is five mechatronics students who will edit this
occasionally, and semantic class names are far easier for them to modify than utility soup. Keep styles in
`src/styles/`, one file per concern, imported from a layout. No inline `style=` attributes (carry the
spirit of the existing rule forward).

**Deployment change — flag this to Ethan before finishing.** The repo currently serves `main` directly.
Astro needs a build. Add `.github/workflows/deploy.yml` using `actions/configure-pages`,
`actions/upload-pages-artifact` and `actions/deploy-pages`, building on push to `main`. Ethan must then
switch the repo's Pages source from "Deploy from a branch" to **"GitHub Actions"** in repo Settings → Pages.
**Call this out as a required manual step in your final summary** — the site will 404 until he does it.

**If Ethan rejects the build step**, the fallback is: keep a no-build static site, hand-write `index.html`
and `work-log.html`, and have a GitHub Action generate `content/index.json` from the markdown files, which
vanilla JS fetches and renders client-side. Note this fallback exists; don't build it unless asked.

Set `site: 'https://mechatronics-capstone-2027-group-27.github.io'` and `base: '/'` in `astro.config.mjs`.
Add a `.nojekyll` file to `public/`.

---

## 5. Global configuration — build this file first

Everything that repeats or might change lives in **one typed module**: `src/config/site.ts`.
No component may hardcode a team member's name, the team number, the project name, an email, or a URL.

Create it with exactly this shape and these current values:

```ts
// src/config/site.ts

export const TEAM_NUMBER = 27;

export const COURSE = {
  code: 'MTE 481 / MTE 482',
  name: 'Mechatronics Engineering Capstone Design',
  institution: 'University of Waterloo',
  department: 'Mechanical & Mechatronics Engineering',
  gradYear: 2027,
  terms: ['Fall 2026', 'Winter 2027'],
} as const;

export const PROJECT = {
  name: 'Group 27 Capstone',
  subtitle: 'Balloon Lifted High-Altitude Gliding Rocket Launch System',
  // TODO(Ethan): short name / acronym used in the nav, favicon and <title>. Suggestion: 'BLHAG'.
  shortName: 'TODO',
  // TODO(Ethan): one sentence, plain language, for the hero and the OG description.
  tagline: 'TODO — one-sentence description of what the system does.',
  // TODO(Ethan): 2–3 sentence overview for the About section.
  summary: 'TODO',
} as const;

export const SITE = {
  url: 'https://mechatronics-capstone-2027-group-27.github.io',
  repo: 'https://github.com/<org>/Mechatronics-Capstone-2027-group-27.github.io', // TODO(Ethan): confirm org
  defaultBranch: 'main',
  // Carried over from the original index.html — do not drop this.
  mondayEmbedUrl: 'TODO — copy from the existing index.html iframe src',
  // Contact routing. Rendered obfuscated (§7.5), never as a raw mailto in the HTML source.
  contact: {
    general: 'TODO',
    sponsorship: 'TODO',
  },
} as const;

/**
 * The single source of truth for the team.
 * `slug` drives URLs (/work-log/<slug>), content folder names, and the `author`
 * field in entry frontmatter. Changing a slug is a breaking change — rename the
 * content folder and any `collaborators` references at the same time.
 * `github` is the GitHub username, used by the posting Action's allowlist (§7).
 */
export const MEMBERS = [
  { slug: 'ethan-catz',      name: 'Ethan Catz',      github: 'TODO', email: 'TODO', role: 'TODO', photo: '/img/team/ethan-catz.jpg' },
  { slug: 'ian-macpherson',  name: 'Ian Macpherson',  github: 'TODO', email: 'TODO', role: 'TODO', photo: '/img/team/ian-macpherson.jpg' },
  { slug: 'david-makarczyk', name: 'David Makarczyk', github: 'TODO', email: 'TODO', role: 'TODO', photo: '/img/team/david-makarczyk.jpg' },
  { slug: 'nitya-singh',     name: 'Nitya Singh',     github: 'TODO', email: 'TODO', role: 'TODO', photo: '/img/team/nitya-singh.jpg' },
  { slug: 'matthew-zelenka', name: 'Matthew Zelenka', github: 'TODO', email: 'TODO', role: 'TODO', photo: '/img/team/matthew-zelenka.jpg' },
] as const;

/** Front-page section order. Reorder this array to reorder the page. */
export const SECTION_ORDER = [
  'hero',
  'about',
  'major-updates',
  'reach-out',
  'timeline',
  'team',
  'documentation',
  'monday',
] as const;

/** Kill switches for sections that aren't ready to show publicly yet. */
export const FEATURES = {
  majorUpdates: true,
  reachOut: true,
  timeline: true,
  team: true,
  documentation: true,
  mondayEmbed: true,
  workLog: true,
  /** When true, entries with `draft: true` render with a SAMPLE badge instead of being hidden. */
  showSampleContent: true,
} as const;

export const NAV = [
  { label: 'Overview',  href: '/#about' },
  { label: 'Updates',   href: '/#major-updates' },
  { label: 'Timeline',  href: '/#timeline' },
  { label: 'Work Log',  href: '/work-log/' },
  { label: 'Team',      href: '/#team' },
  { label: 'Contact',   href: '/#reach-out' },
] as const;

export const TIMELINE = {
  /** Phase 2: replace with a parsed .ics. Until then this JSON is the source. */
  source: 'src/data/timeline.json',
  icsPath: 'src/data/timeline.ics', // not present yet
  termBoundaries: [
    { label: 'F26', start: '2026-09-07', end: '2026-12-20' },
    { label: 'W27', start: '2027-01-04', end: '2027-04-20' },
  ],
} as const;

// Derived helpers — use these instead of re-deriving in components.
export const memberBySlug = (slug: string) => MEMBERS.find(m => m.slug === slug);
export const memberName   = (slug: string) => memberBySlug(slug)?.name ?? slug;
export const otherMembers = (slug: string) => MEMBERS.filter(m => m.slug !== slug);
export const SITE_TITLE   = `${PROJECT.name} — Team ${TEAM_NUMBER}`;
```

Add a `TODO(Ethan)` grep target for every unknown. In your final summary, list every `TODO(Ethan)` you left.

---

## 6. Content model

### 6.1 Folder structure

```
src/content/
├── config.ts                       # Astro content collection schemas (Zod)
├── work-log/
│   ├── ethan-catz/
│   │   └── 2026-09-28-sample-entry.md
│   ├── ian-macpherson/
│   ├── david-makarczyk/
│   ├── nitya-singh/
│   └── matthew-zelenka/
└── updates/                        # team / major updates → front page
    └── 2026-09-28-sample-major-update.md
```

Filename convention: `YYYY-MM-DD-kebab-title.md`. The folder name under `work-log/` **must** equal a
`MEMBERS[].slug`. Enforce that in the schema loader — throw a clear build error naming the offending path
if it doesn't match.

### 6.2 Work-log entry schema

```yaml
---
title: "Characterized servo deflection under load"     # required, string, 5–120 chars
date: 2026-09-28                                       # required, YYYY-MM-DD, must be a real date, not in the future
author: ethan-catz                                     # required, must be a MEMBERS slug. Also derivable from folder — validate they agree.
collaborators: [nitya-singh, matthew-zelenka]          # optional, array of MEMBERS slugs, must not contain `author`, no duplicates
timeCommitted: 3.5                                     # required, number, hours, > 0, <= 24
images:                                                # optional
  - src: /img/work-log/2026-09-28-servo-rig.jpg
    alt: "Servo test rig on the bench"                 # required whenever `src` is present
    caption: "Deflection rig, first assembly"          # optional
tags: [mechanical, testing]                            # optional, free-form, reserved for phase 2 filtering
draft: false                                           # optional, default false
---

Formatted paragraph body in Markdown. Headings, **bold**, lists, links and code all render.
This is the "Content of progress" field.
```

Validation rules to implement in `src/content/config.ts` with Zod:

- `author` must exist in `MEMBERS`. Error message must list the valid slugs.
- Every entry in `collaborators` must exist in `MEMBERS`, must not equal `author`, must be unique.
- `date` must parse and must not be in the future (a future date is almost always a typo).
- `timeCommitted` must be a positive number. Store hours as a decimal; render as `3.5 h`.
- `alt` is **required** on every image — accessibility, and it's cheap to enforce at the schema level.
- Body must be non-empty and at least ~200 characters. The Quality rubric line penalizes vague entries;
  make the build nag about it. Emit a **warning**, not an error, below the threshold.

### 6.3 Major / team update schema

```yaml
---
title: "Preliminary design review passed"     # required
date: 2026-10-15                              # required
timeCommitted: 22                             # required, number, team-hours
images:                                       # required, at least one
  - src: /img/updates/2026-10-15-pdr.jpg
    alt: "Team presenting at PDR"
    caption: "PDR, E7 design studio"
featured: true                                # optional, pins to the top of the front-page feed
draft: false
---

Formatted paragraph body in Markdown.
```

Note the deliberate differences from a work-log entry: **no `author`, no `collaborators`** (it's the whole
team), and **at least one image is required** (these are the front-page cards; a card with no image looks
broken in this design language).

---

## 7. Posting workflow and access control

**The requirement:** only the five team members can post; the posting UI should not be exposed to the public.

**The constraint:** GitHub Pages is a static host. There is no server, no session, no database. Anything
rendered client-side is visible to anyone who opens devtools.

**Say this plainly to Ethan in your summary:** hiding a form in static HTML is not security. Real
enforcement has to happen where the write happens — in GitHub. So we enforce at the write, and merely
de-emphasize in the UI.

### 7.1 Primary posting path — GitHub Issue Form → Action → committed Markdown

This is the recommended path. It needs no external service, no OAuth proxy, no secrets, and it works from a
phone.

1. **`.github/ISSUE_TEMPLATE/work-log-entry.yml`** — a GitHub Issue Form with fields mapping 1:1 to §6.2:
   - `title` — input, required
   - `date` — input, required, placeholder `YYYY-MM-DD`, description says "leave blank for today"
   - *(no author field — it's taken from the issue author, per the requirement that Name is pulled
     automatically from whoever is posting)*
   - `collaborators` — **checkboxes**, one per team member, all five listed; the Action removes the author
     from the list if self-checked. Checkboxes are used because GitHub issue forms have no true multiselect
     that allows N-of-M with labels; a `dropdown` with `multiple: true` is the alternative — use checkboxes,
     they're clearer on mobile.
   - `timeCommitted` — input, required, description "hours, decimals OK (e.g. 2.5)"
   - `content` — textarea, required, description "Markdown supported"
   - `images` — textarea, optional, description "drag images into this box to upload them to GitHub, then
     leave the generated markdown here"
2. **`.github/ISSUE_TEMPLATE/major-update.yml`** — same idea for §6.3, no collaborators field, image field
   marked required.
3. **`.github/workflows/post-entry.yml`** — triggered on `issues: [opened, edited]`, filtered by the
   `work-log` / `major-update` label the template applies.
   - **Step 1, the allowlist gate.** Compare `github.event.issue.user.login` against the GitHub usernames
     in the config. If it doesn't match, post a polite comment, close the issue, and exit 0. Keep the
     allowlist in **one place** — generate `.github/allowlist.json` from `src/config/site.ts` (a tiny
     `scripts/sync-allowlist.mjs` run via `npm run sync:allowlist`), so adding a member is still a
     one-file edit. Document that the script must be re-run when `MEMBERS` changes; also add a CI check
     that fails if the generated file is stale.
   - **Step 2**, parse the issue body, map author → slug, build the frontmatter, download any uploaded
     images into `public/img/work-log/` (rename to `YYYY-MM-DD-<slug>-<n>.<ext>`), write the Markdown file
     to the right member folder.
   - **Step 3**, commit to `main` with `github-actions[bot]`, then comment back with a link to the built
     page and close the issue.
   - Permissions: `contents: write`, `issues: write`. Use the default `GITHUB_TOKEN`. **No PATs, no secrets
     in the repo.**
   - Handle failure loudly: on parse error, comment on the issue with what was wrong and leave it open.

This also has a nice side effect for §2: every post is attributable in git history with a real timestamp,
which independently corroborates the dates. Backfilling is visible. Tell the team that.

### 7.2 Secondary path — commit the Markdown directly

Document in `CONTRIBUTING.md` that a member can just add a file at
`src/content/work-log/<their-slug>/YYYY-MM-DD-title.md` and push. Include a copy-pasteable template with
every field and a comment explaining each. Some members will prefer this; it must stay first-class.

### 7.3 The "Post an update" UI

- A single **"Post an update"** button, in the footer and at the bottom of the Work Log page — **not** in
  the main nav. It deep-links to the pre-filled GitHub issue form
  (`.../issues/new?template=work-log-entry.yml`).
- Style it as a quiet, secondary, low-contrast link — it's crew equipment, not a public call to action.
- Do **not** attempt to hide it with client-side member detection, localStorage flags, or a password
  prompt. That's theater, it adds code, and it breaks nothing for an attacker. The Action's allowlist is
  the control.

### 7.4 If true member-only UI is required later (phase 2 — don't build now)

Note these options in `CLAUDE.md` for future reference: Cloudflare Access in front of a `/crew` route;
Netlify Identity if the site moves off Pages; Decap CMS or Sveltia CMS at `/admin` with GitHub OAuth (both
need a small OAuth proxy, which is the only reason they're not the round-1 recommendation).

### 7.5 Email handling

Do not put raw `mailto:` addresses in the HTML source — they get scraped. Render addresses from the config
via a tiny JS decode at runtime, or route everything through a single role address. Personal student emails
should not go on the public team page at all unless each member explicitly opts in; default the team cards
to LinkedIn/GitHub links and a single shared contact address.

---

## 8. Front page specification

Single scrollable page at `/`. **Not** a fixed one-screen layout. Sections render in `SECTION_ORDER` (§5),
each as `<section id="...">` so nav anchors and deep links work. Default order below.

### 8.1 `hero`

- Full-bleed background image (spec in §12), `min-height: 100svh` — but **it must be obvious the page
  scrolls**: a scroll cue at the bottom, and the next section's top edge should just barely peek in on a
  standard laptop viewport.
- Dark gradient scrim over the image (top and bottom) so text is legible over any photo — 4.5:1 minimum
  against the scrimmed area, not against the raw photo.
- Content, in order: small uppercase eyebrow `TEAM {TEAM_NUMBER} · {COURSE.institution}` in mono;
  `PROJECT.name` as H1; `PROJECT.subtitle` as a large subordinate line; `PROJECT.tagline` as one line of
  body; two buttons — primary "View the work log" → `/work-log/`, ghost "Latest updates" → `#major-updates`.
- Transparent fixed nav over the hero that gains a `backdrop-filter: blur()` + solid background after
  ~80px of scroll. Mobile: hamburger → full-screen overlay menu.

### 8.2 `about`

Merges the old About + Project sections. Two-column on desktop (text left, supporting image right),
stacked on mobile. Renders `PROJECT.summary` plus a placeholder "Key objectives" list of 3–4 bullets.
Leave a clearly marked slot for a system diagram — that's the single highest-value image on the whole site
and Ethan will supply it later.

### 8.3 `major-updates`

- Section heading + one-line deck.
- Grid of the **4 most recent** `updates` entries (featured pinned first), each a card: image (3:2), date
  (mono), title, 2-line clamped excerpt, `timeCommitted` as a small mono stat, arrow affordance.
- "View all updates" link → `/updates/`.
- Build `/updates/` (full list) and `/updates/<slug>/` (detail page with full body and image gallery).
- Empty state: if there are no non-draft updates, render a tasteful "First update coming soon" panel
  rather than an empty grid.

### 8.4 `reach-out`

Placeholder now, real links later. Three cards side by side, each with an icon, heading, 1–2 line blurb,
and a CTA:

| Card | Heading | Intent | CTA (placeholder) |
|---|---|---|---|
| 1 | Sponsors | Funding, parts, manufacturing time, testing facilities | "Sponsorship package" → `#` |
| 2 | Teams & Collaborators | Other capstone teams, clubs, student design teams | "Get in touch" → contact |
| 3 | Faculty & Advisors | Professors, technical advisors, reviewers | "Contact the team" → contact |

Below the cards: a **sponsor logo wall** — a single centered row of 4–6 greyscale logo slots at 20% opacity
that go full-colour on hover, with a "Your logo here" placeholder. Mark every placeholder CTA with
`data-todo="link"` so they're greppable.

Do not fabricate sponsor names or logos.

### 8.5 `timeline`

See §10.

### 8.6 `team`

Five cards from `MEMBERS`. Square portrait, name, role, and small GitHub/LinkedIn icon links. Replaces the
"Team Member 1–4" placeholder text — and note there are **five** members, so the old markup was wrong.

### 8.7 `documentation`

Keep as a section. A simple list of links to deliverables as they're produced (proposal, PDR, FDR, final
report). For now, a placeholder list with `data-todo` and a note that files go in `public/docs/`.

### 8.8 `monday`

The existing monday.com iframe, URL from `SITE.mondayEmbedUrl`, in a responsive 16:9 wrapper with
`loading="lazy"`, `title="Group 27 project board"`, and a visible fallback link ("Open the board on
monday.com") in case the embed is blocked by a browser or a campus network.

### 8.9 `footer`

Team number, project name, course + institution, nav repeat, GitHub repo link, the quiet "Post an update"
link (§7.3), a "Last updated" timestamp derived at build time from the newest entry date, and a line noting
this is a student project site not affiliated with any sponsor.

---

## 9. Work Log page specification

### 9.1 Routing

- `/work-log/` — redirects to, or renders, the first member's tab. Prefer rendering an **"All"** view here
  (see §9.3) and having the five member tabs beside it.
- `/work-log/<member-slug>/` — that member's card grid. **Real routes, not client-side tab state.** Each
  tab must be its own URL so it's linkable, shareable, back-button-correct, and — importantly for grading —
  directly reachable. Generate them with `getStaticPaths()` from `MEMBERS`.
- `/work-log/<member-slug>/<entry-slug>/` — entry detail page: full body, all images at full size with
  captions, full metadata block, prev/next within that member's entries.

### 9.2 Tab bar

Horizontal tab bar, one per member, current tab visually active and `aria-current="page"`. On mobile it
scrolls horizontally with a fade edge — do not collapse it into a `<select>`, the names need to stay
visible. Show each member's entry count as a small superscript number in the tab.

### 9.3 The "All" view and cadence strip (recommended — it directly serves the Frequency criterion)

On `/work-log/`, before the tabs:

- A small stat row: total entries, total hours logged, entries in the last 14 days, date of most recent
  entry.
- A **cadence strip**: a compact horizontal band of one cell per week of the term, coloured by number of
  entries that week, with five rows (one per member). It makes gaps and bursts instantly visible — to the
  team *and* to the grader. This is a ~60-line component and it's the single highest-leverage thing on the
  page for the rubric. Build it if time allows; if not, at minimum build the stat row.
- Use a sequential single-hue ramp for cell intensity, and never encode the only meaning in colour — put
  the count in a `title`/`aria-label` on each cell.

### 9.4 Entry card (the core component)

Card grid: 3 columns desktop, 2 tablet, 1 mobile. Each card shows, in this order:

1. Thumbnail (first image, 4:3) — or, when the entry has no image, a generated fallback panel using the
   accent gradient with the date in large mono type. Never a broken image.
2. **Date** in mono, uppercase, e.g. `28 SEP 2026`.
3. **Title** (H3, 2-line clamp).
4. **Author name** — always rendered even inside a single-member tab. Redundant there, essential for
   grading and for the All view.
5. **Collaborators** — `with Nitya Singh, Matthew Zelenka`, names resolved from slugs via `memberName()`.
   Render nothing (not "with none") when empty.
6. **Time committed** — `3.5 h` in mono, with a clock icon.
7. Excerpt, 3-line clamp.
8. Whole card is one link to the detail page. One `<a>` wrapping the card, not nested interactive elements.

Sort newest-first within each member. `draft: true` entries are excluded from production builds unless
`FEATURES.showSampleContent` is on, in which case they render with a `SAMPLE` badge.

---

## 10. Development timeline

The real source will be an **`.ics` file**, supplied later once goals are set. Build the visual now against
a JSON placeholder shaped like parsed ICS output, so the swap is one loader function.

`src/data/timeline.json`:

```json
[
  {
    "uid": "placeholder-001",
    "title": "Project proposal submitted",
    "start": "2026-10-03",
    "end": "2026-10-03",
    "allDay": true,
    "category": "milestone",
    "status": "complete",
    "description": "Placeholder milestone — replace when the real schedule is set."
  }
]
```

Fields map directly to ICS `UID`, `DTSTART`, `DTEND`, `SUMMARY`, `DESCRIPTION`, `CATEGORIES`, `STATUS`.
Keep the loader behind `src/lib/timeline.ts` exporting `getTimelineEvents(): TimelineEvent[]`, so phase 2
is: install `node-ical`, parse `TIMELINE.icsPath` if it exists, fall back to the JSON if it doesn't. Write
that fallback logic **now** — it costs 10 lines and makes the handoff trivial.

**Visual:** a horizontal milestone rail on desktop (a thin hairline axis with nodes, labels alternating
above/below, horizontally scrollable, term dividers for F26 / W27 from `TIMELINE.termBoundaries`) and a
vertical stacked timeline on mobile. Include a "today" marker. Three visual states: `complete` (filled
node, dimmed label), `active` (accent ring, brightest), `upcoming` (hollow node, dim). Seed with 6–8
obviously-placeholder milestones covering both terms.

---

## 11. Design system

### 11.1 Direction

Synthesize three references:

- **Previous capstone design-log sites** — the functional substrate: frontmatter-driven entries, dark mode,
  clean card grids, clear date/author metadata, no clutter.
- **SpaceX** — structural discipline. Near-black canvas, full-bleed edge-to-edge imagery, huge
  wide-tracked uppercase headlines, hairline rules, generous negative space, flat outline buttons with
  small uppercase labels, almost no colour, zero drop shadows, transparent nav.
- **Virgin Galactic** — atmosphere. Soft gradient washes suggesting altitude and horizon, a violet-to-warm
  spectrum, slower and more elegant transitions, more rounded and more human than SpaceX's hard edges.

The blend for a balloon-lifted, high-altitude launch system: **the black of near-space as the base, a
horizon gradient as the only real colour event, and telemetry-style monospaced metadata.** Restraint is the
whole aesthetic — if a section looks busy, delete something.

### 11.2 Tokens — `src/styles/tokens.css`

```css
:root {
  /* Surfaces — near-black with a cold blue cast, not pure #000 */
  --bg:            #05070A;
  --surface:       #0C1017;
  --surface-2:     #141A24;
  --line:          rgba(255, 255, 255, 0.10);
  --line-strong:   rgba(255, 255, 255, 0.22);

  /* Type */
  --text:          #F2F5F7;
  --text-dim:      #98A4B3;   /* ≥4.5:1 on --bg — verify before changing */
  --text-faint:    #5E6B7A;   /* decorative only, never body copy */

  /* Accent — "stratosphere blue". Swap this one value to re-skin the site. */
  --accent:        #5B8DEF;
  --accent-hot:    #FF6B35;   /* ignition orange, used sparingly: active states, today marker */

  /* The horizon gradient — the site's one colour event */
  --grad-horizon:  linear-gradient(180deg, #05070A 0%, #131A3D 45%, #4B2E83 75%, #FF7A45 100%);
  --grad-scrim:    linear-gradient(180deg, rgba(5,7,10,.85) 0%, rgba(5,7,10,.15) 40%, rgba(5,7,10,.92) 100%);

  /* Type scale — fluid, clamp()-based */
  --font-display: 'Saira', 'Archivo', system-ui, sans-serif;  /* uppercase, wide tracking */
  --font-body:    'Inter', system-ui, sans-serif;
  --font-mono:    'JetBrains Mono', ui-monospace, monospace;  /* dates, hours, all metadata */

  --step--1: clamp(0.83rem, 0.79rem + 0.18vw, 0.94rem);
  --step-0:  clamp(1.00rem, 0.95rem + 0.25vw, 1.13rem);
  --step-1:  clamp(1.25rem, 1.15rem + 0.50vw, 1.60rem);
  --step-2:  clamp(1.56rem, 1.36rem + 1.00vw, 2.44rem);
  --step-3:  clamp(1.95rem, 1.58rem + 1.85vw, 3.66rem);
  --step-4:  clamp(2.44rem, 1.78rem + 3.30vw, 5.61rem);

  --tracking-display: 0.08em;
  --tracking-eyebrow: 0.18em;

  /* Spacing — 8px base */
  --s-1: 4px;  --s-2: 8px;  --s-3: 16px; --s-4: 24px;
  --s-5: 40px; --s-6: 64px; --s-7: 96px; --s-8: 160px;
  --section-y: clamp(64px, 10vh, 160px);
  --measure: 68ch;
  --container: 1280px;
  --radius: 2px;   /* near-square. SpaceX-flat, not bubbly. */
}
```

Notes for implementation:

- **Dark is the default and only theme this round.** Don't build a light mode; if you write the tokens
  carefully it can be added later. Do respect `prefers-color-scheme` only to the extent of setting
  `color-scheme: dark` so form controls and scrollbars match.
- Fonts: self-host via `@fontsource/saira`, `@fontsource/inter`, `@fontsource-variable/jetbrains-mono`.
  **No Google Fonts CDN** — it's an extra origin, a privacy consideration, and a render-blocking request.
  Subset to latin. If Saira feels wrong under the real hero image, Archivo and Barlow Condensed are the
  alternates; changing it should be a one-token edit.
- If Ethan wants a Waterloo tie-in, `--accent: #FFC72C` (UW gold) is a drop-in swap. Offer it, don't assume it.

### 11.3 Components to build

`Nav`, `Hero`, `Section` (wrapper handling id/heading/spacing), `Button` (primary/ghost), `Eyebrow`,
`Card` (base), `UpdateCard`, `WorkLogCard`, `MetaRow` (date · author · collaborators · hours),
`TabBar`, `TimelineRail`, `CadenceStrip`, `StatRow`, `ImageFigure`, `Gallery`, `EmptyState`, `Footer`,
`Icon` (inline SVG sprite).

### 11.4 Motion

- Scroll-reveal: `opacity 0→1` + `translateY(12px→0)`, 500ms `cubic-bezier(.22,.61,.36,1)`, staggered 60ms
  across a grid. IntersectionObserver, `rootMargin: '0px 0px -10% 0px'`, unobserve after firing.
- Nav solidifies on scroll past 80px.
- Hover: 150ms. Card hover lifts the image `scale(1.03)` inside `overflow:hidden` and brightens the border.
  **No box-shadows.**
- **`@media (prefers-reduced-motion: reduce)` must disable all of it** — set everything visible and
  `transition: none`. Non-negotiable.
- Total JS for the whole site should be small — well under 20 KB gzipped. If a piece of motion needs a
  library, don't build that piece.

---

## 12. Assets — what to build as placeholders, and what to ask Ethan for

**Placeholder strategy:** generate every missing asset as a flat `--surface-2` panel with a centred mono
label showing its purpose and exact pixel dimensions (`HERO · 2560×1440`), a 1px `--line` border, and a
subtle diagonal hatch. Put them at the **exact final paths and filenames** listed below, so swapping in a
real asset is a file replace with no code change. Generate them as SVG where possible (tiny, crisp, no
build dependency).

Then **stop and ask Ethan for this exact list**, with these specs:

| # | Asset | Path | Aspect | Resolution (@2x) | Format | Notes |
|---|---|---|---|---|---|---|
| 1 | Hero background | `public/img/hero.jpg` | 16:9 | 2560×1440 | WebP + JPG fallback, ≤400 KB | Dark or dim subject; text sits over the upper-left third. Balloon/sky/hardware. |
| 2 | Hero background, mobile crop | `public/img/hero-mobile.jpg` | 4:5 | 1080×1350 | WebP, ≤200 KB | Same image, recomposed — not a naive centre crop. |
| 3 | System / architecture diagram | `public/img/system-diagram.svg` | ~4:3 | vector | **SVG preferred** | Highest-value image on the site. If raster: 2400×1800 PNG on a transparent or dark background. |
| 4 | About section supporting image | `public/img/about.jpg` | 3:2 | 1800×1200 | WebP, ≤250 KB | CAD render, test rig, or team at work. |
| 5 | Section band image (optional) | `public/img/band-1.jpg` | 21:9 | 2560×1097 | WebP, ≤300 KB | Full-bleed divider between sections. |
| 6 | Team portraits ×5 | `public/img/team/<slug>.jpg` | 1:1 | 800×800 | WebP/JPG, ≤120 KB ea. | Square, face centred, consistent lighting and background across all five. Shoot them together. |
| 7 | Major update card images | `public/img/updates/<date>-<slug>.jpg` | 3:2 | 1800×1200 | WebP, ≤250 KB | One required per major update. |
| 8 | Work-log entry photos | `public/img/work-log/<date>-<slug>-<n>.jpg` | any | ≥1600 px on the long edge | WebP/JPG | Phone photos are fine. Uploaded via the issue form. |
| 9 | Team logo / wordmark | `public/img/logo.svg` | ~4:1 horizontal | vector | **SVG** | Plus `logo-mark.svg` (1:1, for favicon/nav) and a pure-white monochrome variant. |
| 10 | Favicon set | `public/favicon.svg`, `public/favicon-512.png`, `public/apple-touch-icon.png` | 1:1 | 512×512, 180×180 | SVG + PNG | Derived from the logo mark. |
| 11 | Open Graph / social card | `public/img/og.jpg` | 1.91:1 | 1200×630 | JPG, ≤300 KB | Project name + subtitle over the hero image. |
| 12 | Sponsor logos | `public/img/sponsors/<name>.svg` | ~2:1 bounding box | vector | **SVG**, else transparent PNG 800×400 | None yet — build 5 "Your logo here" slots. |

Also flag to Ethan, in your questions:

- **University of Waterloo logos and wordmarks have brand-usage rules.** Do not add the UW crest, the
  Engineering wordmark, or department branding unless he confirms the team is permitted to use them.
  Build the site so it looks complete without any institutional mark.
- **Photo consent** for the team portraits — trivial but worth one sentence.

### 12.1 Icons

Use **Lucide** icons (MIT licensed), inlined as SVG into a single sprite component — **not** an icon font,
**not** a CDN script, **not** a runtime dependency. Needed set: `calendar`, `clock`, `users`, `camera`,
`arrow-right`, `arrow-up-right`, `external-link`, `menu`, `x`, `chevron-left`, `chevron-right`,
`chevron-down`, `github`, `linkedin`, `mail`, `file-text`, `rocket`, `handshake`, `graduation-cap`.

You can generate all of those yourself — **do not ask Ethan for them.** Only ask him for #9, #10 and #12
above (the logo, the favicon derived from it, and sponsor marks), since those encode identity you can't
invent. If the team has no logo yet, say so and ship a clean typographic lockup built from `PROJECT.shortName`
in the display font as the interim mark, and tell him it's a placeholder.

---

## 13. Accessibility and performance

Non-negotiable, and cheap if done from the start:

- Semantic landmarks (`header`/`nav`/`main`/`section`/`footer`), one `<h1>` per page, no skipped heading levels.
- All interactive elements keyboard-reachable with a **visible** focus ring (`:focus-visible`, 2px `--accent`
  outline with offset). Never `outline: none` without a replacement.
- Colour contrast ≥4.5:1 for body text, ≥3:1 for large text and UI borders. Check `--text-dim` and any text
  over imagery (against the scrimmed value, not the raw photo).
- `alt` on every image (schema-enforced per §6.2); decorative images get `alt=""`.
- `prefers-reduced-motion` respected everywhere (§11.4).
- Skip-to-content link as the first focusable element.
- Tab bar uses real links with `aria-current`, not ARIA tab widgets — simpler and more robust.
- Lazy-load below-the-fold images; eager + `fetchpriority="high"` for the hero only.
- Use Astro's `<Image />` for local assets so sizes and formats are generated at build time.
- Targets: Lighthouse ≥95 across the board on a production build; LCP <2.0s on a throttled 4G profile;
  total JS <20 KB gzipped.

---

## 14. Target file tree

```
/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   ├── work-log-entry.yml
│   │   └── major-update.yml
│   ├── workflows/
│   │   ├── deploy.yml
│   │   ├── post-entry.yml
│   │   └── check-allowlist.yml
│   └── allowlist.json            # generated from src/config/site.ts
├── public/
│   ├── .nojekyll
│   ├── favicon.svg
│   ├── docs/
│   └── img/{hero,about,team,updates,work-log,sponsors,placeholders}/
├── scripts/
│   └── sync-allowlist.mjs
├── src/
│   ├── components/
│   ├── config/site.ts            # §5 — the single source of truth
│   ├── content/
│   │   ├── config.ts             # §6 Zod schemas
│   │   ├── work-log/<member-slug>/*.md
│   │   └── updates/*.md
│   ├── data/timeline.json
│   ├── layouts/BaseLayout.astro
│   ├── lib/{timeline.ts,entries.ts,format.ts}
│   ├── pages/
│   │   ├── index.astro
│   │   ├── work-log/index.astro
│   │   ├── work-log/[member].astro
│   │   ├── work-log/[member]/[entry].astro
│   │   ├── updates/index.astro
│   │   ├── updates/[slug].astro
│   │   └── 404.astro
│   └── styles/{tokens.css,base.css,components.css}
├── astro.config.mjs
├── package.json
├── tsconfig.json
├── CLAUDE.md                     # rewritten — see §1.4
├── CONTRIBUTING.md               # how to post an update, in plain language
└── README.md
```

Delete the old root `index.html` **only after** carrying over the monday.com iframe URL and any content
worth keeping — and since you can't run git, just tell Ethan it's now superseded and he should remove it
in his commit.

---

## 15. Guardrails

1. **No git write operations.** Ever. (§1.4 rule 1.) End with a summary of what to commit and in what order.
2. **No invented project content.** (§1.5.)
3. **No secrets, tokens, API keys, or `.env` files** committed. The posting Action uses the built-in
   `GITHUB_TOKEN` only.
4. **No reading gated behind auth.** (§2.)
5. **Don't publish personal emails** without opt-in. (§7.5.)
6. **Keep the monday.com embed.** (§1.3.)
7. **No inline `style=` attributes.** Styles live in `src/styles/`.
8. **Nothing hardcoded that belongs in `src/config/site.ts`.** If you type "Ethan Catz" or "27" outside
   that file, you've made a mistake.
9. **No third-party analytics, trackers, fonts-by-CDN, or chat widgets.**
10. **Don't add a dependency without saying why** in your summary. Target: Astro, the three fontsource
    packages, and nothing else in round 1.

---

## 16. Verify before you report done

Run through this yourself and report the results — don't just claim success:

- [ ] `npm install && npm run build` completes with no errors and no warnings you haven't explained.
- [ ] `npm run dev` serves the site; every nav link and anchor resolves; no 404s.
- [ ] Zero console errors or warnings in the browser on `/` and `/work-log/`.
- [ ] Deliberately break a sample entry (remove `date`, then set `author: not-a-member`) and confirm the
      build **fails with a clear, human-readable message naming the file**. Restore it after.
- [ ] Add a brand-new sample `.md` under a member folder and confirm it appears on that member's tab with
      **no code changes**. This is the "practical to update" requirement — prove it.
- [ ] A work-log card visibly shows: date, author name, collaborator names, hours. Screenshot it.
- [ ] Every one of the five member tabs has its own working URL and renders.
- [ ] Renders correctly at 360 px, 768 px, 1280 px and 1920 px wide. No horizontal scroll at 360 px.
- [ ] Full keyboard pass on both pages: focus is always visible, tab order is sane, the mobile menu traps
      and releases focus correctly.
- [ ] Toggle OS "reduce motion" and confirm all animation stops and nothing is left invisible.
- [ ] Lighthouse on the production build: report all four scores.
- [ ] Every placeholder asset is at its final path with the correct aspect ratio, so a swap needs no code change.
- [ ] `grep -r "TODO(Ethan)"` — list every hit in your summary.

---

## 17. What to ask Ethan — ask these together, at the end, in one message

1. The asset list in §12 (items 1–12), with the specs quoted.
2. Every `TODO(Ethan)` from `src/config/site.ts`: project short name/acronym, tagline, summary,
   the five GitHub usernames, the five roles, contact addresses, the GitHub org name, and the
   monday.com embed URL if you couldn't recover it from the old `index.html`.
3. **Confirmation of the Pages deployment switch** (§4) — he must change repo Settings → Pages source to
   "GitHub Actions" or the site will 404 after the first build.
4. Whether to use stratosphere blue `#5B8DEF` or UW gold `#FFC72C` as `--accent`.
5. Whether the team has a logo, or wants the typographic placeholder for now.
6. Whether personal emails go on the team page, or just a single shared address.
7. Confirmation that UW/Engineering branding may or may not be used (§12).
8. Posting cadence the team wants to commit to (weekly? per work session?) — it belongs in
   `CONTRIBUTING.md` and it's what the Frequency mark actually measures.

Ask all of it at once. Don't trickle questions.

---

## 18. Final summary format

End your run with:

1. **What was built** — one short paragraph, not a file-by-file recital.
2. **Verification results** — the §16 checklist with real outcomes, including Lighthouse numbers.
3. **What Ethan must do manually** — git commit order, the Pages settings change, the old `index.html`
   deletion.
4. **The CLAUDE.md diff** — called out explicitly.
5. **The §17 question list.**
6. **Known gaps / phase 2** — ICS parsing, real auth, filtering, anything you punted on and why.
