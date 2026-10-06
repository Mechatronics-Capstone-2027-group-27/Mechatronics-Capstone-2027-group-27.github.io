# Group 27 Capstone — design log site

Project progress log for University of Waterloo MTE 481/482 (Mechatronics Engineering Capstone Design), Team 27:
*Balloon Lifted High-Altitude Gliding Rocket Launch System*.

**Live site:** https://mechatronics-capstone-2027-group-27.github.io/

> **Posting an entry?** That is in [CONTRIBUTING.md](CONTRIBUTING.md). This file is for maintaining the site itself.

## Run it locally

Requires Node 22.18 or newer.

```sh
npm install
npm run dev          # dev server at http://localhost:4321, reloads as you edit
npm run build        # production build to dist/ — this is also the test suite
npm run preview      # serve the built dist/ exactly as GitHub Pages will
npm run test:post    # offline test of the issue-form posting bot
npm run sync:allowlist   # after changing MEMBERS — regenerates the posting allowlist
```

`npm run build` checks every log entry. If it fails, the message names the file; see
[If the build fails](CONTRIBUTING.md#if-the-build-fails).

## Where things are

| To change… | Edit |
|---|---|
| Team members, project text, contact addresses, links, section order, switches | `src/config/site.ts` |
| A work-log entry | `src/content/work-log/<member>/` (see [CONTRIBUTING.md](CONTRIBUTING.md)) |
| A major update | `src/content/updates/` |
| Timeline milestones | `src/data/timeline.json` |
| Colours, fonts, spacing | `src/styles/tokens.css` |
| Site photos (hero, portraits, diagram) | `src/assets/img/` — see [Site photos](#site-photos) |
| Sponsor logos | `public/img/sponsors/` + `SPONSORS` in `src/config/site.ts` |
| Course deliverables (PDFs) | `public/docs/` + `DOCUMENTS` in `src/config/site.ts` |

## What lives in `src/config/site.ts`

Everything that is repeated or that a non-programmer might need to change. Nothing in this list may be typed
anywhere else in the code.

| Setting | What it is |
|---|---|
| `TEAM_NUMBER`, `COURSE` | Team number, course code, institution, terms |
| `PROJECT` | `name`, `subtitle`, `shortName` (nav brand), `tagline` (hero and link previews), `summary` and `objectives` (About section) |
| `SITE` | Site URL, repo URL, and `contact`: `person` (the member who answers enquiries), `general` and `sponsorship` addresses |
| `MEMBERS` | One line per person: `slug`, `name`, `github`, `email`/`showEmail`, `linkedin`, `role`, `photo` |
| `SECTION_ORDER` | Order of the front-page sections |
| `FEATURES` | On/off switch for each section |
| `IMAGES` | Which site photos are real yet (see below) |
| `SPONSORS` | Sponsor logos for the Reach Out section |
| `NAV` | Navigation links |
| `DOCUMENTS` | Course deliverables listed in the Documentation section |
| `TIMELINE` | Term start and end dates |

A value left as `'TODO'` counts as "not filled in yet". The site never prints it: the line, link or section that
needs it is left out until you fill it in. `grep -rn "TODO(Ethan)" src` lists what is still missing.

After changing anyone's `github` username, or adding or removing a member, run `npm run sync:allowlist` and
commit the files it rewrites. CI fails if you forget.

## Sections that are hidden until they have real content

A visitor should never see a placeholder. A front-page section appears only when its switch in `FEATURES` is on
**and** it has something real to show. Its link in the navigation appears and disappears with it.

| Section | Switch | Also needs | To bring it back |
|---|---|---|---|
| About the project | `about` | `PROJECT.summary` or `PROJECT.objectives` | Write the summary (2–3 sentences) and 3–5 objectives, then set `about: true` |
| Major updates | `majorUpdates` | at least one update | Post a major update — it appears by itself |
| Reach out | `reachOut` | `SITE.contact.general` | Already on |
| Development timeline | `timeline` | at least one event in `src/data/timeline.json` | Add the real milestones, then `timeline: true` |
| The team | `team` | — | |
| Documentation | `documentation` | at least one `DOCUMENTS` entry with an `href` | Add a document (below) — it appears by itself |

### The monday.com board is not on the site

This is deliberate (decided 2026-10-06): the board is the team's working tool and we do not want it public. The
site used to embed it in a "Project board" section; that section, its switch and its styles have been removed.
Do not add it back without the team agreeing to.

The embed URL is kept, commented out, as `mondayEmbedUrl` in `SITE` in `src/config/site.ts`, because it is not
easy to find again. If we change our minds:

1. Uncomment `mondayEmbedUrl` in `src/config/site.ts`.
2. Find the commit that removed it: `git log --diff-filter=D --oneline -- src/components/sections/Monday.astro`.
   Call its hash `<removal>`. Restore the component from just before it:
   `git restore --source=<removal>^ -- src/components/sections/Monday.astro`
3. Restore its styles: copy the "Monday embed" block out of `git show <removal>^:src/styles/components.css`
   back into `src/styles/components.css`.
4. In `src/config/site.ts`, add `'monday'` to `SECTION_ORDER` and `mondayEmbed: true` to `FEATURES`.
5. In `src/lib/sections.ts`, add `monday: FEATURES.mondayEmbed` to the list.
6. In `src/pages/index.astro`, import `Monday` and render it for `'monday'`, like the other sections.
7. `npm run build`.

Anyone with the embed link can view the board without signing in, so treat the URL itself as not-for-sharing.

### Contact, and the "Coming soon" cards

The Reach Out section names one person: `SITE.contact.person` is a member's slug, and their name (and role, once
set) is printed next to the address. Change the slug to change who it is. Email addresses are never written into
the page as text: `ContactLink.astro` stores them encoded and the browser decodes them, so do not type an address
into a component.

Two of the three cards (Sponsors, Teams & Collaborators) are marked **Coming soon** and have no link. To make one
live, set its `live: true` in `src/components/sections/ReachOut.astro`.

`FEATURES.showSampleContent` is for development only. When it is `true`, entries marked `draft: true` are shown
with a SAMPLE badge; when `false` (the setting for the live site) they are not published at all.

### Timeline events

`src/data/timeline.json` is a list. One milestone looks like this:

```json
{
  "uid": "pdr-2026",
  "title": "Preliminary design review",
  "start": "2026-10-30",
  "end": "2026-10-30",
  "allDay": true,
  "category": "review",
  "status": "upcoming",
  "description": "Optional one-line note."
}
```

`uid` is any unique name. `status` is `complete`, `active` or `upcoming`. `category` is `milestone`, `review` or
`deliverable`. Dates are `YYYY-MM-DD`. Events are sorted by `start`, and the "Today" marker is placed automatically.

## Site photos

The files in `src/assets/img/` started as grey generated placeholders with their own name and size printed on
them. The site leaves a placeholder out rather than show it. For each one: **replace the file, keeping the same
file name, then switch it on.** Astro resizes and compresses them, so upload a large, good original.

| Image | File | Size (ratio) | Switch on with |
|---|---|---|---|
| Hero, desktop | `hero.jpg` | 2560 × 1440 (16:9) | `IMAGES.hero: true` — replace both hero files first |
| Hero, phone | `hero-mobile.jpg` | 1080 × 1350 (4:5) | (same switch) |
| About | `about.jpg` | 1800 × 1200 (3:2) | `IMAGES.about: true` |
| Band under About | `band-1.jpg` | 2560 × 1097 (21:9) | `IMAGES.band: true` |
| System diagram | `system-diagram.svg` | about 4:3, SVG | `IMAGES.systemDiagram: true` |
| Link-preview card | `og.jpg` | 1200 × 630 | `IMAGES.og: true` |
| Portraits | `team/<slug>.jpg` | 800 × 800 (square) | that member's `photo: 'team/<slug>.jpg'` in `MEMBERS` |
| Favicon | `favicon.svg`, `favicon-512.png`, `apple-touch-icon.png` | 64, 512, 180 px square | always on |

Until the hero photo is real, the hero uses the site's gradient. Until a portrait is real, that person's card
shows their initials.

### Sponsor logos

Put the logo in `public/img/sponsors/` (SVG or PNG, about 2:1, e.g. 400 × 200) and add a line to `SPONSORS` in
`src/config/site.ts`:

```ts
export const SPONSORS = [
  { name: 'Company name', logo: '/img/sponsors/company.svg', href: 'https://example.com' },
];
```

The "Supported by" row appears once the list has at least one entry. Only list a sponsor who has agreed to it.

### Photos inside log entries

These are different: they live in `public/img/work-log/` and `public/img/updates/` and are named in the entry's
frontmatter. The issue form puts them there for you. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Adding a document to the Documentation section

1. Put the PDF in `public/docs/`, e.g. `public/docs/project-proposal.pdf`.
2. In `DOCUMENTS` in `src/config/site.ts`, set that line's `href` to `/docs/project-proposal.pdf`.
   Add a new line for a deliverable that isn't listed.

Only deliverables with an `href` are listed. The Documentation section, and nothing about it, appears on the
site until the first one has a file.

## The posting bot

Team members post through GitHub issue forms; `.github/workflows/post-entry.yml` turns the issue into a Markdown
file and commits it. Things a maintainer needs to know:

- **Who can post** is `.github/allowlist.json`, generated from `MEMBERS`. Never edit it by hand.
- **Every run explains itself.** Actions → Post log entry → open the run: the summary at the top says what kind
  of entry it found, who posted, whether they are on the allowlist, and what happened.
- **To re-run an issue** without editing it: Actions → Post log entry → Run workflow → type the issue number.
- **Before changing** `.github/scripts/post-entry.cjs` or an issue form, run `npm run test:post`.
- **Do not switch on the `main` ruleset** without reading `docs/POSTING-INVESTIGATION.md`: the bot pushes straight
  to `main`, and "require a pull request" or a required status check blocks it.

## Deploying

Every push to `main` builds and publishes the site (`.github/workflows/deploy.yml`). Every pull request to `main`
is built and tested first (`.github/workflows/ci.yml`, shown on the PR as "CI / build").

Built with [Astro](https://astro.build). Guidance for AI coding assistants working in this repo is in `CLAUDE.md`.
