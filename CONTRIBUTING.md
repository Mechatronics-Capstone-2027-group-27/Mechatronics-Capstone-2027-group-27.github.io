# Posting to the design log

The design log is graded on three things: entries are **easy to find**, entries have **enough detail** (date, who,
what each person did), and entries are **regular**, with no long gaps and no last-minute bursts. The
site handles the first. You handle the other two.

**Our cadence:** [TODO(Ethan): agree on this as a team, e.g. "at least one entry per person per week" or "one entry per work session".]

Every post is also recorded in git with a real timestamp, so backdated entries are visible. Post when you do the work.

---

## Option 1 — the issue form (easiest, works from a phone)

1. Use the **Post an update** link in the site footer, or go to the repo's **Issues → New issue → Work log entry**.
2. Fill in the form:
   - **Title**: what you did.
   - **Date**: leave it blank for today.
   - **Collaborators**: tick everyone who worked on it with you.
   - **Time committed**: in hours. Decimals are fine.
   - **Content**: write in Markdown, and say what you did, what you found, and what's next.
   - **Images**: drag photos into the box. Put a short description inside the `[ ]`, because it becomes the alt text.
3. Submit. Within a minute a bot adds the entry to the site, comments with the link and closes the issue.
   If something's wrong, such as a bad date, the bot comments with what to fix and leaves the issue open.
   Edit the issue and it tries again.

Your name comes from your GitHub account. Only the five GitHub usernames in `src/config/site.ts` can post.
Anyone else's issue is closed automatically.

For a team-wide milestone, use **Major update** instead. It needs at least one image and appears on the front page.

## Option 2 — add a Markdown file yourself

Create `src/content/work-log/<your-slug>/YYYY-MM-DD-short-title.md`. Your slug is your name in lowercase with
hyphens, e.g. `nitya-singh`. Then commit and push to `main`.

```markdown
---
title: "Characterized servo deflection under load"   # required, 5–120 characters
date: 2026-09-28                                     # required, YYYY-MM-DD, not in the future
author: nitya-singh                                  # required, your slug, must match the folder name
collaborators: [ethan-catz, matthew-zelenka]         # optional, other members' slugs, don't include yourself
timeCommitted: 3.5                                   # required, hours, more than 0 and at most 24
images:                                              # optional
  - src: /img/work-log/2026-09-28-nitya-singh-1.jpg  # put the file in public/img/work-log/
    alt: "Servo test rig on the bench"               # required for every image
    caption: "Deflection rig, first assembly"        # optional
tags: [mechanical, testing]                          # optional
draft: false                                         # optional, true hides it from the public site
---

What you did, what you found, and what's next. Markdown works: **bold**, lists, links, `code`, headings.
Aim for at least a solid paragraph. Entries under ~200 characters get a build warning.
```

Major updates go in `src/content/updates/YYYY-MM-DD-short-title.md`. They use the same fields minus `author`,
`collaborators` and `tags`. At least one image is required, and you can add `featured: true` to pin the update.

### If the build fails

`npm run build` (and the deploy on GitHub) refuses entries with a missing date, an unknown author, a
collaborator who isn't on the team, a date in the future, or an image without alt text. The error message
names the file. Fix the file and push again.

## Adding or changing a team member

1. Edit `MEMBERS` in `src/config/site.ts`.
2. Run `npm run sync:allowlist`. It regenerates `.github/allowlist.json` and the issue form's collaborator list.
3. If you changed a slug, rename that member's folder under `src/content/work-log/` and update any
   `collaborators:` lists that mention the old slug.
4. Commit everything together. CI fails if step 2 was skipped.
