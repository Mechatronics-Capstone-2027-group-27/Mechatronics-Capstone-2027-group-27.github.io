---
title: "Fixed the work log posting system and cleaned up the site"
date: 2026-10-06
author: ethan-catz
collaborators: []
timeCommitted: 5
images:
  - src: /img/work-log/2026-10-06-ethan-catz-i18-1.png
    alt: "Work log page showing entry counts, hours and a week-by-week cadence grid for all five members"
  - src: /img/work-log/2026-10-06-ethan-catz-i18-2.png
    alt: "A successful run's step summary on the Actions page showing a POSTED entry committed to main with the correct data table underneath"
# Posted from issue #18 by @MystyM
draft: false
---

## Problems

- Posting through the issue forms did nothing. Issues were created, but no entry
  ever appeared and no error was reported — the team had been hand-writing
  markdown files and merging branches instead, which isn't sustainable.
- Shared work was being logged once per person. Five near-identical entries for
  one presentation session, two for one advisor meeting, which padded the log and
  inflated our recorded hours fivefold.
- The public site was full of placeholder text and labelled placeholder images
  addressed to us rather than to a visitor.

## Fixes

- Posting works end to end. Submitting the form now produces a page on the site
  in about two minutes and closes the issue; a bad entry gets a comment
  explaining what to fix and retries when you edit the issue.
- Duplicate entries merged. The Sept 29 presentation session is one entry and the
  Oct 1 Devaud meeting is one entry, with every person's own account preserved
  word for word. Hours for that session corrected from 50 to 10.
- Placeholder content removed. Sections without real content are hidden rather
  than shown empty, and the guidance that used to be on the page now lives in
  README.md and CONTRIBUTING.md.

## What's new

- A shared task is logged once, lists collaborators, and appears on every
  participant's tab with each person's own contribution shown on their card.
- Hours are counted per participant and labelled as person-hours, so a shared
  session can't be double-counted.
- A build check runs on every pull request, and content errors now fail the build
  with the offending file named instead of passing silently.
- A contact section with a named point of contact, and a work log page showing
  entries, hours and a week-by-week cadence grid per member.
- The monday.com board embed was taken off the public site.

## Next steps

- Write the project summary and objectives so the About section can go live — the
  front page is currently three sections.
- Team portraits, hero image and system diagram.
- Everyone posts one entry a week through the form.
