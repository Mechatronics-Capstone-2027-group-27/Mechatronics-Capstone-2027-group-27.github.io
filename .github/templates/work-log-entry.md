{{!-- ═══════════════════════════════════════════════════════════════════════════
    WORK-LOG ENTRY TEMPLATE
    The posting bot fills this in to write src/content/work-log/<author>/<date>-<title>.md
    from a "Work log entry" issue. Edit it to change what that file looks like.

    How it works
      {{name}}        is replaced by a value from the issue. The bot formats each one by
                      its type, so quotes, colons and emoji in a title are always safe.
                      Never put quotes around a placeholder.
      {{! ... }}      is a note like this one. Notes are removed from the output.
      (optional)      if an optional placeholder has nothing to say, its whole line is
                      left out — no empty key, no blank line.

    Rules the bot enforces (the run fails, naming the problem, if one is broken)
      - Only the placeholders used below exist. A new one must first be added, with a
        type, to PLACEHOLDERS in .github/scripts/entry-template.cjs.
      - Every frontmatter key must exist in the work-log schema in
        src/content.schemas.ts. An unknown key fails the site build, naming the file.
      - Keep the "# Posted from issue" line: it is how the bot recognises an issue it
        has already posted, so it never posts the same issue twice.
      - {{contributions}}, {{hoursByMember}} and {{images}} are written over several
        lines, so each must stay alone after its key, as below.
    ═══════════════════════════════════════════════════════════════════════════ --}}
---
{{! Required. The issue form's Title (5–120 characters), as a quoted string. }}
title: {{title}}
{{! Required. YYYY-MM-DD. The form's Date, or today in Waterloo time if it was blank. }}
date: {{date}}
{{! Required. The slug of the member who filed the issue (from their GitHub account). }}
author: {{author}}
{{! Required. Everyone else whose box was filled in, e.g. [ian-macpherson, nitya-singh].
    Written as [] when the author worked alone. }}
collaborators: {{collaborators}}
{{! Optional. What each person did, keyed by slug, kept as the Markdown they wrote
    (headings, lists, blank lines). Left out when nobody wrote a line. }}
contributions: {{contributions}}
{{! Required. The author's own hours. Means "hours per participant": the site uses it
    for anyone missing from hoursByMember, which a new entry never is. }}
timeCommitted: {{timeCommitted}}
{{! Optional. Each participant's hours, keyed by slug. Team totals add these up. }}
hoursByMember: {{hoursByMember}}
{{! Optional. Photos from the form's Images box, saved into public/img/work-log/. }}
images: {{images}}
{{! Required. Do not remove: see "Keep the # Posted from issue line" above. }}
# Posted from issue #{{issue}} by @{{login}}
draft: false
---

{{! Required. The form's "Content of progress", exactly as written. }}
{{content}}
