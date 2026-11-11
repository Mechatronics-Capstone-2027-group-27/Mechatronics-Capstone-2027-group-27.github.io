// Frontmatter schemas for the work-log and updates collections (§6).
//
// These are the rules every entry must satisfy; src/content.config.ts applies them to
// the collections. They live here, apart from the collection definitions, so that
// `npm run test:post` can check the files the posting bot writes against the very same
// rules the build uses. That is also why this file imports nothing from Astro except
// `astro/zod` and is written as plain, type-strippable TypeScript: Node runs it directly.
//
// Anything here that fails makes `npm run build` fail with the file path in the
// message. That is the §2 "dates and names on all entries" guarantee.
//
// The objects are strict: a frontmatter key the schema doesn't know (a typo such as
// `colaborators`) is an error, not something silently dropped.
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'astro/zod';

type Member = { readonly slug: string };

/** A calendar date that isn't in the future. One day of slack absorbs timezone differences. */
const pastDate = z.coerce
  .date({ error: 'date is required and must be YYYY-MM-DD' })
  .refine(d => d.getTime() <= Date.now() + 24 * 60 * 60 * 1000, {
    error: 'date is in the future — almost always a typo',
  });

/**
 * Frontmatter images are string paths into public/ (see CLAUDE.md → Images), so nothing
 * else checks them. The name is compared exactly: GitHub Pages is case-sensitive even
 * when the laptop that wrote the entry is not.
 */
const isExternal = (src: string) => /^https?:\/\//.test(src);
function publicFileExists(publicDir: string, src: string) {
  const file = path.join(publicDir, src);
  try {
    return fs.readdirSync(path.dirname(file)).includes(path.basename(file));
  } catch {
    return false;
  }
}

function imageSchema(publicDir: string) {
  const src = z
    .string()
    .min(1)
    .refine(s => s.startsWith('/') || isExternal(s), {
      error: issue => `image src "${String(issue.input)}" must be a path from the site root, e.g. /img/work-log/photo.jpg`,
    })
    .refine(s => !s.startsWith('/') || publicFileExists(publicDir, s), {
      error: issue =>
        `image file not found: public${String(issue.input)} — check the spelling and the upper/lower case of the file name`,
    });
  return z.strictObject({
    src,
    alt: z.string({ error: 'every image needs alt text' }).min(1, { error: 'every image needs alt text' }),
    caption: z.string().optional(),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
  });
}

/** The work-log entry schema for a given team. `publicDir` is where image paths are looked up. */
export function workLogSchema(members: readonly Member[], publicDir = path.join(process.cwd(), 'public')) {
  const valid = members.map(m => m.slug).join(', ');
  const memberSlug = (field: string) =>
    z.string().refine(v => members.some(m => m.slug === v), {
      error: issue => `${field} "${String(issue.input)}" is not a team member. Valid slugs: ${valid}`,
    });

  return z
    .strictObject({
      title: z.string({ error: 'title is required' }).min(5).max(120),
      date: pastDate,
      author: memberSlug('author'),
      collaborators: z.array(memberSlug('collaborator')).default([]),
      // Hours EACH participant spent. Anyone missing from hoursByMember is counted at this.
      timeCommitted: z
        .number({ error: 'timeCommitted is required (hours, e.g. 2.5)' })
        .positive()
        .max(24),
      // What each participant did, keyed by member slug. Optional; shown as written.
      contributions: z.record(z.string(), z.string().trim().min(1, { error: 'a contribution cannot be empty' })).default({}),
      // Each participant's own hours, where known. Overrides timeCommitted for that person.
      hoursByMember: z
        .record(z.string(), z.number({ error: 'hours must be a number, e.g. 1.5' }).positive().max(24))
        .default({}),
      images: z.array(imageSchema(publicDir)).default([]),
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
      // Per-person fields may only name people who are on this entry.
      const onEntry = [e.author, ...e.collaborators];
      for (const field of ['contributions', 'hoursByMember'] as const) {
        for (const slug of Object.keys(e[field])) {
          if (onEntry.includes(slug)) continue;
          const message = members.some(m => m.slug === slug)
            ? `${field} names "${slug}", who is not the author or a collaborator of this entry. Add them to collaborators or remove the line.`
            : `${field} names "${slug}", who is not a team member. Valid slugs: ${valid}`;
          ctx.addIssue({ code: 'custom', path: [field, slug], message });
        }
      }
    });
}

/** The major-update schema. `publicDir` is where image paths are looked up. */
export function updateSchema(publicDir = path.join(process.cwd(), 'public')) {
  return z.strictObject({
    title: z.string({ error: 'title is required' }).min(5).max(120),
    date: pastDate,
    timeCommitted: z.number({ error: 'timeCommitted is required (team-hours)' }).positive(),
    images: z.array(imageSchema(publicDir)).min(1, { error: 'major updates need at least one image' }),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
  });
}
