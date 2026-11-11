// Content collections (§6).
//
// Astro 7 requires this file at src/content.config.ts — the legacy
// src/content/config.ts location is a hard build error. The Markdown itself
// still lives in src/content/work-log/<member-slug>/ and src/content/updates/.
//
// The frontmatter rules themselves are in src/content.schemas.ts, so the posting
// bot's tests can check generated files against exactly the same schema. Anything
// that fails makes `npm run build` fail with the file path in the message.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { MEMBERS, MEMBER_SLUGS } from './config/site';
import { updateSchema, workLogSchema } from './content.schemas';

const VALID = MEMBER_SLUGS.join(', ');

/**
 * Work-log IDs are "<folder>/<file>". The folder must be a member slug and must
 * match `author` — checked here because this is the only hook that sees the path.
 */
function workLogId({ entry, data }: { entry: string; data: Record<string, unknown> }) {
  const parts = entry.replace(/\\/g, '/').split('/');
  const folder = parts.length > 1 ? parts[0] : '';
  const where = `src/content/work-log/${entry}`;
  if (!MEMBERS.some(m => m.slug === folder)) {
    throw new Error(
      `${where}: work-log entries must live in a member folder. "${folder || '(root)'}" is not one of: ${VALID}`,
    );
  }
  if (typeof data.author === 'string' && !MEMBERS.some(m => m.slug === data.author)) {
    throw new Error(`${where}: author "${data.author}" is not a team member. Valid slugs: ${VALID}`);
  }
  if (typeof data.author === 'string' && data.author !== folder) {
    throw new Error(
      `${where}: author "${data.author}" does not match its folder "${folder}". Move the file or fix the author.`,
    );
  }
  return entry.replace(/\.(md|mdx)$/, '');
}

const workLog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/work-log', generateId: workLogId }),
  schema: workLogSchema(MEMBERS),
});

const updates = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/updates' }),
  schema: updateSchema(),
});

export const collections = { 'work-log': workLog, updates };
