{{!-- ═══════════════════════════════════════════════════════════════════════════
    MAJOR-UPDATE TEMPLATE
    The posting bot fills this in to write src/content/updates/<date>-<title>.md from a
    "Major update" issue. Edit it to change what that file looks like.

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
      - Every frontmatter key must exist in the updates schema in
        src/content.schemas.ts. An unknown key fails the site build, naming the file.
      - Keep the "# Posted from issue" line: it is how the bot recognises an issue it
        has already posted, so it never posts the same issue twice.
      - A major update has no author or collaborators: {{author}}, {{collaborators}},
        {{contributions}} and {{hoursByMember}} have no value here and must not be used.
    ═══════════════════════════════════════════════════════════════════════════ --}}
---
{{! Required. The issue form's Title (5–120 characters), as a quoted string. }}
title: {{title}}
{{! Required. YYYY-MM-DD. The form's Date, or today in Waterloo time if it was blank. }}
date: {{date}}
{{! Required. Total team-hours from the form's "Time committed". }}
timeCommitted: {{timeCommitted}}
{{! Required in practice: the form will not post without at least one photo. Saved into
    public/img/updates/. The first one is the update's cover image. }}
images: {{images}}
{{! Required. Do not remove: see "Keep the # Posted from issue line" above. }}
# Posted from issue #{{issue}} by @{{login}}
draft: false
---

{{! Required. The form's "Content", exactly as written. }}
{{content}}
