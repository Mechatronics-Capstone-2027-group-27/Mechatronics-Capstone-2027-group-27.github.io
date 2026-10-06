# Posting to the design log

The design log is graded on three things: entries are **easy to find**, entries have **enough detail** (date, who,
what each person did), and entries are **regular**, with no long gaps and no last-minute bursts. The
site handles the first. You handle the other two.

**Our cadence:** [TODO(Ethan): agree on this as a team, e.g. "at least one entry per person per week" or "one entry per work session".]

Every post is also recorded in git with a real timestamp, so backdated entries are visible. Post when you do the work.

> **Maintaining the site** (settings, photos, hidden sections, the posting bot)? That is in [README.md](README.md).

---

## Option 1 — the issue form (easiest, works from a phone)

1. Use the **Post an update** link in the site footer, or go to the repo's **Issues → New issue → Work log entry**.
2. Fill in the form:
   - **Entry type**: leave it as it is. If it shows "None", that is fine too.
   - **Title**: what you did. Keep the `[Work log]` at the start of the issue title.
   - **Date**: leave it blank for today.
   - **Collaborators**: tick everyone who worked on it with you.
   - **Time committed**: in hours. Decimals are fine.
   - **Content**: write in Markdown, and say what you did, what you found, and what's next.
   - **Your contribution** (optional): one line on what *you* did. Worth filling in whenever you ticked collaborators.
   - **Images**: see "Attaching photos" below.
3. Submit. Within a minute or two a bot adds the entry to the site, comments with the link and closes the issue.
   If something's wrong, such as a bad date, the bot comments with what to fix and leaves the issue open.
   Edit the issue and it tries again.

Your name comes from your GitHub account. Only the five GitHub usernames in `src/config/site.ts` can post.
Anyone else's issue is closed automatically. If the bot says *you* are not on the list, your username is
missing or misspelled there — tell whoever maintains the site.

### Attaching photos

1. Drag the photos into the **Images** box (or paste them). GitHub uploads each one and inserts a line like
   `![Image](https://github.com/user-attachments/assets/…)` or an `<img …>` tag. Wait until "Uploading…" is gone.
2. Replace the word `Image` inside the `[ ]` (or the `alt="…"`) with a short description of the photo. That
   becomes the alt text, which screen readers read out.
3. Leave the rest of the line alone. The bot downloads each photo into the site, so it does not disappear if
   the issue is later deleted.

Put photos in the **Images** box, not in the Content box. A photo pasted into Content is not copied to the site.
The first photo is the one shown on the entry's card.

### Posting a major team update

A major update is a team-wide milestone that shows on the front page. It has no author or collaborators.

1. Go to the repo's **Issues → New issue → Major update**, or use **Post a major update** at the bottom of the
   site's Updates page.
2. Fill in **Title**, **Date** (blank for today), **Time committed** (total team-hours) and **Content**.
3. Attach **at least one photo** in the Images box — the form will not post without one.
4. Submit. The same bot posts it and closes the issue. The Major updates section appears on the front page as
   soon as the first update exists.

## Working together: one entry, not one each

When several of us do the same thing together — a meeting, a work session, a test day — **one person writes
one entry and lists everyone else as collaborators.** Do not each write your own copy.

- The entry appears on **every participant's tab**. On the author's tab it looks normal. On a collaborator's
  tab it is marked **Collaborated** and says **Logged by** the author, so nobody can mistake it for something
  that member wrote.
- The entry has one page, under the author: `/work-log/<author>/<entry>/`. Every tab links to that page.
- It counts toward every participant's entry count, hours and weekly cadence.

**Say what each person did.** The marking scheme asks that "individual contributions of each member are clearly
described", and "we had a meeting" does not do that. Add a `contributions` line for each person:

```yaml
contributions:
  david-makarczyk: "Ran the agenda and took the notes below."
  matthew-zelenka: "Prepared the thermal questions for Prof. Devaud."
```

Each person's line is shown under their name on the entry page, and on their own tab's card. It is optional;
if you leave it out, nothing extra is shown. The issue form's **Your contribution** field fills in the
poster's line. To add yours to an entry someone else posted, edit that entry's Markdown file and add a line
under your slug. Only the author and listed collaborators can have a line — anyone else fails the build.
For more than one line, use a YAML block (`david-makarczyk: |` followed by indented lines). It is rendered as
Markdown, so headings, lists and links work; headings are shown smaller so they sit under your name.

### Hours

- `timeCommitted` is the time **each** listed person spent. A two-hour meeting with four people is
  `timeCommitted: 2`, not 8 and not 0.5.
- If people spent different amounts, add `hoursByMember` for the ones who differ. Anyone not listed gets
  `timeCommitted`:

  ```yaml
  timeCommitted: 2
  hoursByMember:
    nitya-singh: 0.5   # joined for the last half hour
  ```

- A member's hours total is the sum of their own figure across every entry they are on.
- The team figure on the Work Log page is **person-hours**: everyone's hours added up. That two-hour meeting
  with four people adds 8.
- A card on the All tab shows `2 h each` when everyone spent the same, or the combined person-hours when they
  did not. A card on a member's tab shows that member's own hours.

### Collaborative entry or major update?

- **Collaborative work-log entry**: some of us did a piece of work together. It records who was there, what
  each person did and how long it took. This is most shared work: meetings, build sessions, tests.
- **Major update**: the *project* reached a milestone that a visitor should see on the front page — a design
  review passed, a first flight, a sponsor confirmed. It has no author or collaborators, and needs a photo.

A milestone usually needs both: a major update announcing it, and work-log entries for the work that got there.

## Option 2 — add a Markdown file yourself

Create `src/content/work-log/<your-slug>/YYYY-MM-DD-short-title.md`. Your slug is your name in lowercase with
hyphens, e.g. `nitya-singh`. Then commit and push to `main`.

```markdown
---
title: "Characterized servo deflection under load"   # required, 5–120 characters
date: 2026-09-28                                     # required, YYYY-MM-DD, not in the future
author: nitya-singh                                  # required, your slug, must match the folder name
collaborators: [ethan-catz, matthew-zelenka]         # optional, other members' slugs, don't include yourself
timeCommitted: 3.5                                   # required, hours EACH person spent, more than 0 and at most 24
hoursByMember:                                       # optional, only for people whose hours differ
  matthew-zelenka: 1                                 #   must be you or a listed collaborator
contributions:                                       # optional, what each person did
  nitya-singh: "Built the rig and ran the sweep."    #   must be you or a listed collaborator
  ethan-catz: "Wrote the logging script."
images:                                              # optional
  - src: /img/work-log/2026-09-28-nitya-singh-1.jpg  # put the file in public/img/work-log/
    alt: "Servo test rig on the bench"               # required for every image
    caption: "Deflection rig, first assembly"        # optional
tags: [mechanical, testing]                          # optional
draft: false                                         # optional, true keeps it off the public site
---

What you did, what you found, and what's next. Markdown works: **bold**, lists, links, `code`, headings.
Aim for at least a solid paragraph. Entries under ~200 characters get a build warning.
```

Before you push, check it: `npm install` once, then `npm run dev` to look at it at http://localhost:4321, and
`npm run build` to make sure it passes. Photos you name under `images:` must already be in `public/img/work-log/`,
spelled exactly the same, capitals included.

Major updates go in `src/content/updates/YYYY-MM-DD-short-title.md`, with photos in `public/img/updates/`:

```markdown
---
title: "Preliminary design review passed"            # required, 5–120 characters
date: 2026-10-30                                     # required, YYYY-MM-DD, not in the future
timeCommitted: 22                                    # required, total team-hours
images:                                              # required, at least one
  - src: /img/updates/2026-10-30-pdr-1.jpg
    alt: "The team presenting at the design review"  # required for every image
    caption: "Design review"                         # optional
featured: false                                      # optional, true pins it first
draft: false                                         # optional, true keeps it off the public site
---

What happened and why it matters.
```

### If the build fails

`npm run build` (and the deploy on GitHub) refuses entries with a missing date, an unknown author, a
collaborator who isn't on the team, a date in the future, or an image without alt text. It also refuses a
misspelled field name, an image path with no matching file, and a `contributions` or `hoursByMember` line for
someone who is not the author or a collaborator of that entry. The error message names the file. Fix the file
and push again.

## Adding or changing a team member

1. Edit `MEMBERS` in `src/config/site.ts`.
2. Run `npm run sync:allowlist`. It regenerates `.github/allowlist.json` and the issue form's collaborator list.
3. If you changed a slug, rename that member's folder under `src/content/work-log/` and update any
   `collaborators:`, `contributions:` and `hoursByMember:` entries that mention the old slug.
4. Commit everything together. CI fails if step 2 was skipped.
