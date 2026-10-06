// Renders a short Markdown string that is NOT an entry body — today, a person's
// `contributions` text. Entry bodies go through astro:content's render(); this uses
// the same processor Astro uses for them (@astrojs/markdown-satteri, which Astro
// already installs), so both read the same.
import { createSatteriMarkdownProcessor } from '@astrojs/markdown-satteri';

let processor: ReturnType<typeof createSatteriMarkdownProcessor> | undefined;

/**
 * Markdown → HTML for embedding under an existing heading.
 *
 * The stored text is never changed; two things are adjusted for display only:
 * - Headings are demoted so the shallowest one lands on `topLevel` and the rest
 *   keep their relative depth (capped at h6). Their ids are dropped, because the
 *   same heading ("What I worked on") repeats for every person on the page.
 * - A line typed as "-Like this" (no space after the dash) is read as a bullet.
 *   Only a dash followed by a letter counts, so "-5 °C" stays text.
 */
export async function renderEmbeddedMarkdown(text: string, topLevel = 4): Promise<string> {
  processor ??= createSatteriMarkdownProcessor();
  const source = text.replace(/^([ \t]*)-(?=\p{L})/gmu, '$1- ');
  const { code } = await (await processor).render(source);

  const levels = [...code.matchAll(/<h([1-6])[\s>]/g)].map(m => Number(m[1]));
  const shift = levels.length ? topLevel - Math.min(...levels) : 0;
  return code.replace(/<(\/?)h([1-6])(?:\s[^>]*)?>/g, (_, slash, n) => `<${slash}h${Math.min(6, Math.max(1, Number(n) + shift))}>`);
}
