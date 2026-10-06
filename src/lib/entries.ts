// Loading, filtering and aggregating log entries. Pages call these instead of
// getCollection() directly so draft handling and sorting stay consistent.
import { getCollection, type CollectionEntry } from 'astro:content';
import { FEATURES, MEMBERS, TIMELINE, memberName } from '../config/site';
import { formatHours, isoDate, parseDay } from './format';

export type WorkLogEntry = CollectionEntry<'work-log'>;
export type UpdateEntry = CollectionEntry<'updates'>;

/** Bodies shorter than this get a build warning — the Quality rubric penalizes vague entries. */
const MIN_BODY_CHARS = 200;
const warned = new Set<string>();

function warnIfThin(entry: { filePath?: string; body?: string; id: string; data: { contributions?: Record<string, string> } }) {
  const key = entry.filePath ?? entry.id;
  // A collaborative entry may keep its detail in the per-person contributions.
  const contributed = Object.values(entry.data.contributions ?? {}).join('').length;
  const len = (entry.body ?? '').trim().length + contributed;
  if (len < MIN_BODY_CHARS && !warned.has(key)) {
    warned.add(key);
    console.warn(
      `[content] ${key}: body${contributed ? ' plus contributions' : ''} is ${len} characters (< ${MIN_BODY_CHARS}). ` +
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

// ── Who an entry belongs to, and how many hours it cost them ───────────
// An entry is written once, by its author, and belongs to the author AND every
// collaborator. Ask these helpers — never compare `author === slug` directly.

/** Author first, then collaborators. */
export const participants = (e: WorkLogEntry): string[] => [e.data.author, ...e.data.collaborators];
export const isParticipant = (e: WorkLogEntry, slug: string) => participants(e).includes(slug);

/**
 * Hours one participant spent on an entry. `timeCommitted` is the time EACH
 * participant spent (a two-hour meeting costs every attendee two hours);
 * `hoursByMember` overrides it for anyone who spent a different amount.
 */
export const hoursFor = (e: WorkLogEntry, slug: string): number => e.data.hoursByMember[slug] ?? e.data.timeCommitted;

/** Total across everyone on the entry — a 2 h meeting with 4 people is 8 person-hours. */
export const personHours = (e: WorkLogEntry): number => participants(e).reduce((sum, slug) => sum + hoursFor(e, slug), 0);

/** True when every participant has the same hours, so "N h each" is accurate. */
export const hoursAreUniform = (e: WorkLogEntry): boolean =>
  participants(e).every(slug => hoursFor(e, slug) === e.data.timeCommitted);

/**
 * The hours to print for an entry, with a label that says whose they are, so a
 * figure can never be read two ways. `viewer` is the member whose tab it is on.
 */
export function hoursDisplay(e: WorkLogEntry, viewer?: string): { text: string; label: string } {
  if (viewer && isParticipant(e, viewer)) {
    return { text: formatHours(hoursFor(e, viewer)), label: `Time committed by ${memberName(viewer)}` };
  }
  if (e.data.collaborators.length === 0) return { text: formatHours(e.data.timeCommitted), label: 'Time committed' };
  if (hoursAreUniform(e)) return { text: `${formatHours(e.data.timeCommitted)} each`, label: 'Time committed by each participant' };
  return { text: `${formatHours(personHours(e)).replace(/ h$/, '')} person-hours`, label: 'Time committed by all participants combined' };
}

/** Entries a member wrote or collaborated on — their tab. */
export async function getMemberEntries(slug: string): Promise<WorkLogEntry[]> {
  return (await getWorkLog()).filter(e => isParticipant(e, slug));
}

/**
 * One member's totals. `total` is entries they took part in (wrote or collaborated
 * on); `hours` uses their own figure for each.
 */
export function memberStats(entries: WorkLogEntry[], slug: string) {
  const mine = entries.filter(e => isParticipant(e, slug));
  return {
    total: mine.length,
    hours: mine.reduce((sum, e) => sum + hoursFor(e, slug), 0),
  };
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

/** Entries each member took part in. These overlap, so they add up to more than the entry count. */
export function countsByMember(entries: WorkLogEntry[]): Record<string, number> {
  const counts: Record<string, number> = Object.fromEntries(MEMBERS.map(m => [m.slug, 0]));
  for (const e of entries) for (const slug of participants(e)) counts[slug] = (counts[slug] ?? 0) + 1;
  return counts;
}

export function workLogStats(entries: WorkLogEntry[], now = new Date()) {
  const cutoff = now.getTime() - 14 * 24 * 60 * 60 * 1000;
  return {
    total: entries.length,
    /** Sum of every participant's hours — equals the sum of the members' own totals. */
    personHours: entries.reduce((sum, e) => sum + personHours(e), 0),
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

/** entries-per-week one member took part in (wrote or collaborated on), aligned to termWeeks(). */
export function cadenceRow(entries: WorkLogEntry[], slug: string, weeks: CadenceWeek[]): number[] {
  const WEEK = 7 * 24 * 60 * 60 * 1000;
  const starts = weeks.map(w => parseDay(w.start).getTime());
  const row = weeks.map(() => 0);
  for (const e of entries) {
    if (!isParticipant(e, slug)) continue;
    const t = e.data.date.getTime();
    const i = starts.findIndex(s => t >= s && t < s + WEEK);
    if (i !== -1) row[i]++;
  }
  return row;
}
