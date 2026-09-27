// Loading, filtering and aggregating log entries. Pages call these instead of
// getCollection() directly so draft handling and sorting stay consistent.
import { getCollection, type CollectionEntry } from 'astro:content';
import { FEATURES, MEMBERS, TIMELINE } from '../config/site';
import { isoDate, parseDay } from './format';

export type WorkLogEntry = CollectionEntry<'work-log'>;
export type UpdateEntry = CollectionEntry<'updates'>;

/** Bodies shorter than this get a build warning — the Quality rubric penalizes vague entries. */
const MIN_BODY_CHARS = 200;
const warned = new Set<string>();

function warnIfThin(entry: { filePath?: string; body?: string; id: string }) {
  const key = entry.filePath ?? entry.id;
  const len = (entry.body ?? '').trim().length;
  if (len < MIN_BODY_CHARS && !warned.has(key)) {
    warned.add(key);
    console.warn(
      `[content] ${key}: body is ${len} characters (< ${MIN_BODY_CHARS}). ` +
        'Graders look for detail — describe what you did, what you found, and what is next.',
    );
  }
}

/** Drafts are hidden unless FEATURES.showSampleContent is on, in which case they render with a SAMPLE badge. */
const visible = (e: { data: { draft: boolean } }) => !e.data.draft || FEATURES.showSampleContent;
const newestFirst = (a: { data: { date: Date } }, b: { data: { date: Date } }) =>
  b.data.date.getTime() - a.data.date.getTime() || 0;

export async function getWorkLog(): Promise<WorkLogEntry[]> {
  const all = await getCollection('work-log');
  all.forEach(warnIfThin);
  return all.filter(visible).sort(newestFirst);
}

export async function getMemberEntries(slug: string): Promise<WorkLogEntry[]> {
  return (await getWorkLog()).filter(e => e.data.author === slug);
}

/** Featured first, then newest first. */
export async function getUpdates(): Promise<UpdateEntry[]> {
  const all = await getCollection('updates');
  all.forEach(warnIfThin);
  return all
    .filter(visible)
    .sort((a, b) => Number(b.data.featured) - Number(a.data.featured) || newestFirst(a, b));
}

/** "ethan-catz/2026-09-28-sample-entry" → "2026-09-28-sample-entry" */
export const entrySlug = (e: WorkLogEntry) => e.id.split('/').pop()!;
export const entryHref = (e: WorkLogEntry) => `/work-log/${e.data.author}/${entrySlug(e)}/`;
export const updateHref = (e: UpdateEntry) => `/updates/${e.id}/`;

export function countsByMember(entries: WorkLogEntry[]): Record<string, number> {
  const counts: Record<string, number> = Object.fromEntries(MEMBERS.map(m => [m.slug, 0]));
  for (const e of entries) counts[e.data.author] = (counts[e.data.author] ?? 0) + 1;
  return counts;
}

export function workLogStats(entries: WorkLogEntry[], now = new Date()) {
  const cutoff = now.getTime() - 14 * 24 * 60 * 60 * 1000;
  return {
    total: entries.length,
    hours: entries.reduce((sum, e) => sum + e.data.timeCommitted, 0),
    last14: entries.filter(e => e.data.date.getTime() >= cutoff).length,
    latest: entries[0]?.data.date,
  };
}

/** Newest date across all entries and updates — the footer's "Last updated". */
export async function lastUpdated(): Promise<Date | undefined> {
  const dates = [...(await getWorkLog()), ...(await getUpdates())].map(e => e.data.date.getTime());
  return dates.length ? new Date(Math.max(...dates)) : undefined;
}

export interface CadenceWeek {
  start: string; // ISO date of the Monday
  term: string;
  future: boolean;
}

/** One cell per week (Monday-start) across every term in TIMELINE.termBoundaries. */
export function termWeeks(now = new Date()): CadenceWeek[] {
  const weeks: CadenceWeek[] = [];
  for (const term of TIMELINE.termBoundaries) {
    const d = parseDay(term.start);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); // back up to Monday
    const end = parseDay(term.end);
    while (d <= end) {
      weeks.push({ start: isoDate(d), term: term.label, future: d.getTime() > now.getTime() });
      d.setUTCDate(d.getUTCDate() + 7);
    }
  }
  return weeks;
}

/** entries-per-week for one member, aligned to termWeeks(). */
export function cadenceRow(entries: WorkLogEntry[], slug: string, weeks: CadenceWeek[]): number[] {
  const WEEK = 7 * 24 * 60 * 60 * 1000;
  const starts = weeks.map(w => parseDay(w.start).getTime());
  const row = weeks.map(() => 0);
  for (const e of entries) {
    if (e.data.author !== slug) continue;
    const t = e.data.date.getTime();
    const i = starts.findIndex(s => t >= s && t < s + WEEK);
    if (i !== -1) row[i]++;
  }
  return row;
}
