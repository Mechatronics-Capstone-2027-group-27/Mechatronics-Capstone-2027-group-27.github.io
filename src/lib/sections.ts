// Which front-page sections actually render. A section needs its FEATURES switch
// on AND something real to show, so the site never prints an empty heading or a
// placeholder. The nav, the hero and the front page all ask here, so a link can
// never point at a section that isn't on the page.
import { DOCUMENTS, FEATURES, NAV, PROJECT, SECTION_ORDER, SITE, isSet } from '../config/site';
import { getUpdates } from './entries';
import { getTimelineEvents } from './timeline';

export type SectionId = (typeof SECTION_ORDER)[number];

/** Section ids in page order, hidden ones removed. */
export async function visibleSections(): Promise<SectionId[]> {
  const show: Record<SectionId, boolean> = {
    hero: true,
    about: FEATURES.about && (isSet(PROJECT.summary) || PROJECT.objectives.length > 0),
    'major-updates': FEATURES.majorUpdates && (await getUpdates()).length > 0,
    'reach-out': FEATURES.reachOut && isSet(SITE.contact.general),
    timeline: FEATURES.timeline && getTimelineEvents().length > 0,
    team: FEATURES.team,
    documentation: FEATURES.documentation && DOCUMENTS.some(d => d.href),
  };
  return SECTION_ORDER.filter(s => show[s]);
}

/** NAV without links to sections that are hidden. */
export async function visibleNav() {
  const shown = new Set<string>(await visibleSections());
  return NAV.filter(item => {
    const anchor = item.href.match(/^\/#(.+)$/)?.[1];
    if (anchor) return shown.has(anchor);
    if (item.href.startsWith('/work-log')) return FEATURES.workLog;
    return true;
  });
}
