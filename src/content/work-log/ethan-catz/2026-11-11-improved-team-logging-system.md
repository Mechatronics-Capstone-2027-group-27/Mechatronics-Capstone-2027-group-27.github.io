---
title: "Improved Team Logging System"
date: 2026-11-11
author: ethan-catz
collaborators: [david-makarczyk, matthew-zelenka]
contributions:
  ethan-catz: |-
    ### Submission form

    Replaced the collaborator checkboxes and the single “Your contribution” field with one block per team member: name, what they did, and hours. The blocks are generated from the member list in the site config, so the form can’t drift from the team roster.
    Removed the separate “Time committed” field. The author’s own hours box replaces it, so the same number is no longer asked twice.
    A blank block now means that person wasn’t involved. “Attended, no specific deliverable” is a valid entry for someone who only sat in.

    ### Validation

    An entry is rejected with a comment on the issue, left open for edit and retry, if someone has a contribution but no hours, or hours but no contribution. The comment names the person.
    Hours accept the usual formats (2, 2.5, “2.5 h”, “2.5 hrs”, “2.5 hours”).
    Field headings are matched tolerantly (case, spacing, punctuation). Every heading found in an issue is listed in the run summary, and any unmatched heading is flagged. A dropped field can no longer vanish silently, which is the defect class that cost us five weeks earlier in the term.

    ### Output templates

    Entry Markdown is now generated from two editable, commented templates (work log entry and major update) instead of string concatenation in the script.
    Every placeholder has a declared type, so titles containing colons, quotes, #, leading dashes or emoji can’t break the generated file. A placeholder with no declared type fails the run by name.
    Output for existing entries is unchanged apart from the new per-person fields.

    ### Compatibility

    Existing entries keep their meaning. “Time committed” still means hours per participant, so older group entries still total correctly in person-hours. Team totals for new entries are the sum of each person’s hours.
    Extended the test suite to cover per-person combinations, invalid hour/contribution pairs, adversarial titles, multi-line contributions and unmatched headings.
  david-makarczyk: |-
    Submitted postings for testing
  matthew-zelenka: |-
    Submitted postings for testing
timeCommitted: 3.5
hoursByMember:
  ethan-catz: 3.5
  david-makarczyk: 0.2
  matthew-zelenka: 0.2
images:
  - src: /img/work-log/2026-11-11-ethan-catz-i31-1.png
    alt: "screencapture-github-Mechatronics-Capstone-2027-group-27-Mechatronics-Capstone-2027-group-27-github-io-issues-new-2026-11-11-23_09_52"
# Posted from issue #31 by @MystyM
draft: false
---

Reworked how work log entries are submitted and generated so that each entry records who did what and for how long, in line with the MTE 481 Design Log Website rubric (Quality: date, author, collaborators and hours shown on every card; Frequency: gaps visible in the cadence strip).
