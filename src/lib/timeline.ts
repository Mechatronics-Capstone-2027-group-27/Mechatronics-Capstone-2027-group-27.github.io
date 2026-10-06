// Development timeline loader (§10).
//
// Today the source is src/data/timeline.json, shaped like parsed ICS output
// (README.md shows one event). It is empty until the real schedule is entered,
// and the Timeline section stays off the page while it is.
// Phase 2: `npm i node-ical`, then fill in parseIcs() below. Everything else —
// the component, the fallback, the sorting — stays the same.
import fs from 'node:fs';
import path from 'node:path';
import { TIMELINE } from '../config/site';
import fromJson from '../data/timeline.json';

export type TimelineStatus = 'complete' | 'active' | 'upcoming';

/** Field names mirror ICS: UID, SUMMARY, DTSTART, DTEND, DESCRIPTION, CATEGORIES, STATUS. */
export interface TimelineEvent {
  uid: string;
  title: string;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
  allDay: boolean;
  category: string;
  status: TimelineStatus;
  description?: string;
}

function parseIcs(_icsText: string): TimelineEvent[] | null {
  // Phase 2: parse with node-ical and map VEVENTs onto TimelineEvent.
  // Returning null makes the loader fall back to the JSON file.
  return null;
}

export function getTimelineEvents(): TimelineEvent[] {
  const icsFile = path.resolve(process.cwd(), TIMELINE.icsPath);
  let events: TimelineEvent[] | null = null;
  if (fs.existsSync(icsFile)) {
    events = parseIcs(fs.readFileSync(icsFile, 'utf8'));
  }
  events ??= fromJson as TimelineEvent[];
  return [...events].sort((a, b) => a.start.localeCompare(b.start));
}
