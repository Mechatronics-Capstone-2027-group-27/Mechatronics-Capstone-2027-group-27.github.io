# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Rules
- Never run git commit, push, or create branches. I handle all git myself.
  (Read-only git — `status`, `diff`, `log` — is fine. No `add`, `commit`, `push`, `branch`, `checkout -b`, `merge`, `rebase`.)
- Run the site locally with: `npm run dev`
- Styles live in `src/styles/` (`tokens.css`, `base.css`, `components.css`). No inline `style=` attributes.
- Nothing that belongs in `src/config/site.ts` (member names, team number, project name, emails, URLs) may be hardcoded anywhere else.
- Do not invent project content (specs, results, sponsors, log entries). Use a bracketed `[TODO: …]` placeholder.
- No third-party analytics, trackers, CDN fonts or scripts. Don't add dependencies without saying why.

## What this is

The Group 27 MTE 481/482 capstone design-log site — a graded deliverable. It's served by GitHub Pages at
https://mechatronics-capstone-2027-group-27.github.io/ (org site, base path `/`). Graders need: every entry
shows a date, author, collaborators and hours on the card itself; nothing is behind a login; posting cadence is
visible (the cadence strip on `/work-log/`).

## Stack and commands

Astro 7 + TypeScript + plain CSS custom properties. Node ≥ 22.18 (CI uses 24).

- `npm run dev` — dev server
- `npm run build` — static build to `dist/`. **This is the test suite:** content schema errors fail the build and name the file.
- `npm run preview` — serve `dist/`
- `npm run sync:allowlist` — regenerate `.github/allowlist.json` and the issue form's member checkboxes from `MEMBERS`. Run after any change to `MEMBERS`.
- `npm run check:allowlist` — CI check that those generated files aren't stale
- `npm run test:post` — offline dry run of the posting pipeline (`scripts/test-post-entry.mjs`). Run after touching `.github/scripts/post-entry.cjs` or the issue forms.

## Architecture

- `src/config/site.ts` — single source of truth: team, project text, URLs, `SECTION_ORDER`, `FEATURES` kill switches, `NAV`, `DOCUMENTS`, timeline term boundaries. Unknowns are `TODO(Ethan)`; `isSet()` treats `'TODO…'` as unset.
- `src/content.config.ts` — Zod schemas for the `work-log` and `updates` collections. Astro 7 requires this location; the legacy `src/content/config.ts` is a hard error. The glob loader's `generateId` enforces that a work-log file's folder is a member slug and matches `author`.
- `src/content/work-log/<member-slug>/YYYY-MM-DD-title.md` and `src/content/updates/YYYY-MM-DD-title.md` — the entries.
- `src/lib/entries.ts` — always load entries through here (`getWorkLog`, `getUpdates`, …). It applies draft filtering (`draft: true` only shows, with a SAMPLE badge, while `FEATURES.showSampleContent` is on), sorting, the short-body build warning, stats and cadence buckets.
- **An entry belongs to its author and every collaborator.** It is written once, shows on each participant's tab, and has one page at `/work-log/<author>/<entry>/`. Never test `e.data.author === slug` to ask whose entry it is, and never sum `timeCommitted` directly: use `participants()`, `isParticipant()`, `hoursFor()`, `personHours()`, `memberStats()` and `hoursDisplay()` from `src/lib/entries.ts`. `timeCommitted` is hours per participant; `hoursByMember` overrides it; team totals are person-hours and are labelled so.
- `@astrojs/markdown-satteri` (used by `src/lib/markdown.ts` to render `contributions`) is pinned to exactly the version `astro` pins, and the two must be bumped together on any Astro upgrade — otherwise npm installs two copies and contributions render with a different engine than entry bodies.
- **Nothing addressed to the team reaches the page.** No `TODO`, placeholder or how-to text is rendered; that guidance lives in `README.md` (maintenance) and `CONTRIBUTING.md` (posting). An unset config value (`isSet()` false) means the line, link or section that needs it is left out.
- `src/lib/sections.ts` — `visibleSections()` and `visibleNav()`. A front-page section renders only when its `FEATURES` switch is on **and** it has real content; the nav, footer and hero links ask the same functions, so nothing links to a hidden section. Don't read `NAV` or `FEATURES` directly in a component to decide what to show.
- `src/lib/timeline.ts` — `getTimelineEvents()`. Reads `src/data/timeline.json` today; phase 2 fills in `parseIcs()` for `src/data/timeline.ics`.
- `src/pages/` — `/`, `/work-log/` (All + stats + cadence), `/work-log/[member]/`, `/work-log/[member]/[entry]/`, `/updates/`, `/updates/[slug]/`, `404`.
- `src/components/` — `sections/*` are the front-page sections; `index.astro` renders them in `SECTION_ORDER`. Icons are a Lucide sprite (`icons.ts` + `IconSprite.astro`), no icon dependency.
- `src/scripts/site.ts` — the only client JS: nav solidify, mobile menu focus trap, scroll reveal, email decode.

### Images
- **Site chrome** (hero, hero-mobile, about, band, team portraits, logo, favicon, og) lives in `src/assets/img/` and goes through Astro `<Image>`/`getImage()`. The files there began as grey generated placeholders, and a placeholder is never shown: swap one by replacing the file with the same name, then set its flag in `IMAGES` (or the member's `photo` in `MEMBERS`) in `src/config/site.ts`. Until then the hero uses the gradient and a member card shows initials.
- **User-posted photos** live in `public/img/work-log/` and `public/img/updates/` and are referenced by string path in frontmatter. Render them with plain `<img>` + `width`/`height` + `loading="lazy"` + `decoding="async"`.

### Posting
- Members post through GitHub Issue Forms (`.github/ISSUE_TEMPLATE/`). `.github/workflows/post-entry.yml` runs `.github/scripts/post-entry.cjs`, which checks the issue author against `.github/allowlist.json`, writes the Markdown file and images, then commits as `github-actions[bot]`. It then dispatches `deploy.yml`, because pushes made with `GITHUB_TOKEN` don't trigger workflows.
- The job is deliberately not gated on labels (a skipped job is invisible). The script works out the entry kind itself, and every run ends by writing what happened to the run summary. An issue can be replayed from Actions → Post log entry → Run workflow.
- Never name a `github-script` step output `result`: the action overwrites it with the script block's return value. The posting script reports through `entry_result`. `npm run test:post` runs the workflow's real `script:` blocks the way the action does, so it catches this.
- The "Post an update" link is deliberately quiet and unprotected. The allowlist in the Action is the real access control; don't add client-side hiding.
- Emails are never in the HTML as raw `mailto:`. `ContactLink.astro` stores them encoded and `site.ts` decodes them at runtime. Personal emails only appear if a member's `showEmail` is true.

## Deploy

`.github/workflows/deploy.yml` builds and publishes to Pages on push to `main`. Repo Settings → Pages → Source must be **GitHub Actions**.

`.github/workflows/ci.yml` (workflow `CI`, job `build`) runs `npm run check:allowlist`, `npm ci`, `npm run build` and `npm run test:post` on every pull request to `main` and every push to it. Keep those two names — "CI / build" is the status check a ruleset would require. The content schemas are strict: an unknown frontmatter key, or a frontmatter image path with no matching file in `public/` (case-sensitive), fails the build.

## Phase 2 options (not built)

- Member-only UI: Cloudflare Access in front of a `/crew` route; Netlify Identity if the site moves off Pages; Decap CMS or Sveltia CMS at `/admin` with GitHub OAuth (needs a small OAuth proxy).
- ICS ingest: `npm i node-ical`, implement `parseIcs()` in `src/lib/timeline.ts`.
- Search, tag filtering, RSS.
