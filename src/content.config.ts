// Content collection schemas (§6).
//
// Astro 7 requires this file at src/content.config.ts — the legacy
// src/content/config.ts location is a hard build error. The Markdown itself
// still lives in src/content/work-log/<member-slug>/ and src/content/updates/.
//
// Anything here that fails makes `npm run build` fail with the file path in the
// message. That is the §2 "dates and names on all entries" guarantee.
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { MEMBERS, MEMBER_SLUGS } from './config/site';

const VALID = MEMBER_SLUGS.join(', ');

const memberSlug = (field: string) =>
  z.string().refine(v => MEMBERS.some(m => m.slug === v), {
    error: issue => `${field} "${String(issue.input)}" is not a team member. Valid slugs: ${VALID}`,
  });

/** A calendar date that isn't in the future. One day of slack absorbs timezone differences. */
const pastDate = z.coerce
  .date({ error: 'date is required and must be YYYY-MM-DD' })
  .refine(d => d.getTime() <= Date.now() + 24 * 60 * 60 * 1000, {
    error: 'date is in the future — almost always a typo',
  });

const image = z.object({
  src: z.string().min(1),
  alt: z.string({ error: 'every image needs alt text' }).min(1, { error: 'every image needs alt text' }),
  caption: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});

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
  schema: z
    .object({
      title: z.string({ error: 'title is required' }).min(5).max(120),
      date: pastDate,
      author: memberSlug('author'),
      collaborators: z.array(memberSlug('collaborator')).default([]),
      timeCommitted: z
        .number({ error: 'timeCommitted is required (hours, e.g. 2.5)' })
        .positive()
        .max(24),
      images: z.array(image).default([]),
      tags: z.array(z.string()).default([]),
      draft: z.boolean().default(false),
    })
    .superRefine((e, ctx) => {
      if (e.collaborators.includes(e.author)) {
        ctx.addIssue({ code: 'custom', path: ['collaborators'], message: 'collaborators must not include the author' });
      }
      if (new Set(e.collaborators).size !== e.collaborators.length) {
        ctx.addIssue({ code: 'custom', path: ['collaborators'], message: 'collaborators contains duplicates' });
      }
    }),
});

const updates = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/updates' }),
  schema: z.object({
    title: z.string({ error: 'title is required' }).min(5).max(120),
    date: pastDate,
    timeCommitted: z.number({ error: 'timeCommitted is required (team-hours)' }).positive(),
    images: z.array(image).min(1, { error: 'major updates need at least one image' }),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

export const collections = { 'work-log': workLog, updates };
