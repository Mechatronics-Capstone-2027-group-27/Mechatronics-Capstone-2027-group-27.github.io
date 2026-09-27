// Display formatting. Dates from frontmatter are calendar dates parsed as UTC
// midnight, so every formatter here works in UTC to avoid off-by-one days.

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** `28 SEP 2026` */
export function formatDate(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** `2026-09-28` — for <time datetime> and comparisons. */
export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** `3.5 h` */
export function formatHours(h: number): string {
  return `${Number.isInteger(h) ? h : h.toFixed(1).replace(/\.0$/, '')} h`;
}

/** Oxford-free list: `A`, `A and B`, `A, B and C`. */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** Plain-text excerpt from a Markdown body. */
export function excerpt(markdown: string | undefined, max = 240): string {
  if (!markdown) return '';
  const text = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_`>~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max).replace(/\s+\S*$/, '')}…` : text;
}

/** Parse a `YYYY-MM-DD` string as UTC midnight. */
export function parseDay(s: string): Date {
  return new Date(`${s}T00:00:00Z`);
}
