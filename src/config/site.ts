// src/config/site.ts
//
// The single source of truth for every repeated value on the site.
// No component may hardcode a member name, the team number, the project name,
// an email or a URL — import it from here instead.
//
// Unknowns are marked `TODO(Ethan)` — `grep -rn "TODO(Ethan)" src` lists them.
// A value of 'TODO' is treated as "not set" by the helpers at the bottom.

export const TEAM_NUMBER = 27;

export const COURSE = {
  code: 'MTE 481 / MTE 482',
  name: 'Mechatronics Engineering Capstone Design',
  institution: 'University of Waterloo',
  department: 'Mechanical & Mechatronics Engineering',
  gradYear: 2027,
  terms: ['Fall 2026', 'Winter 2027'],
} as const;

export const PROJECT = {
  name: 'Group 27 Capstone',
  subtitle: 'Balloon Lifted High-Altitude Gliding Rocket Launch System',
  // TODO(Ethan): short name / acronym used in the nav, favicon and <title>. Suggestion: 'BLHAG'.
  shortName: 'TODO',
  // TODO(Ethan): one sentence, plain language, for the hero and the OG description.
  tagline: 'TODO — one-sentence description of what the system does.',
  // TODO(Ethan): 2–3 sentence overview for the About section.
  summary: 'TODO',
} as const;

export const SITE = {
  url: 'https://mechatronics-capstone-2027-group-27.github.io',
  // Org confirmed from the git remote.
  repo: 'https://github.com/Mechatronics-Capstone-2027-group-27/Mechatronics-Capstone-2027-group-27.github.io',
  defaultBranch: 'main',
  // Carried over from the original index.html — do not drop this.
  mondayEmbedUrl: 'https://view.monday.com/embed/18430865192-ed103e6932e15b93aa887683ad4e9fef?r=use1',
  // Contact routing. Rendered obfuscated (§7.5), never as a raw mailto in the HTML source.
  contact: {
    general: 'TODO', // TODO(Ethan): shared team address
    sponsorship: 'TODO', // TODO(Ethan): sponsorship address (can be the same as general)
  },
} as const;

/**
 * The single source of truth for the team.
 * `slug` drives URLs (/work-log/<slug>), content folder names, and the `author`
 * field in entry frontmatter. Changing a slug is a breaking change — rename the
 * content folder and any `collaborators` references at the same time.
 * `github` is the GitHub username, used by the posting Action's allowlist (§7).
 * After editing `github`, run `npm run sync:allowlist`.
 * `photo` is relative to src/assets/img/ — replace the file to swap the portrait.
 * `email` is never rendered publicly unless `showEmail` is true (opt-in, §7.5).
 */
// TODO(Ethan): roles, LinkedIn URLs (and emails only if members opt in).
export const MEMBERS = [
  { slug: 'ethan-catz',      name: 'Ethan Catz',      github: 'MystyM', email: 'TODO', showEmail: false, linkedin: 'TODO', role: 'TODO', photo: 'team/ethan-catz.jpg' },
  { slug: 'ian-macpherson',  name: 'Ian Macpherson',  github: 'IanJinzoTakeda', email: 'TODO', showEmail: false, linkedin: 'TODO', role: 'TODO', photo: 'team/ian-macpherson.jpg' },
  { slug: 'david-makarczyk', name: 'David Makarczyk', github: 'DavidM2004', email: 'TODO', showEmail: false, linkedin: 'TODO', role: 'TODO', photo: 'team/david-makarczyk.jpg' },
  { slug: 'nitya-singh',     name: 'Nitya Singh',     github: 'sky1515', email: 'TODO', showEmail: false, linkedin: 'TODO', role: 'TODO', photo: 'team/nitya-singh.jpg' },
  { slug: 'matthew-zelenka', name: 'Matthew Zelenka', github: 'MatthewZelenka', email: 'TODO', showEmail: false, linkedin: 'TODO', role: 'TODO', photo: 'team/matthew-zelenka.jpg' },
] as const;

/** Front-page section order. Reorder this array to reorder the page. */
export const SECTION_ORDER = [
  'hero',
  'about',
  'major-updates',
  'reach-out',
  'timeline',
  'team',
  'documentation',
  'monday',
] as const;

/** Kill switches for sections that aren't ready to show publicly yet. */
export const FEATURES = {
  majorUpdates: true,
  reachOut: true,
  timeline: true,
  team: true,
  documentation: true,
  mondayEmbed: true,
  workLog: true,
  /**
   * When true, entries with `draft: true` render with a SAMPLE badge instead of being hidden.
   * TODO(Ethan): set to false before the instructor sees the site.
   */
  showSampleContent: true,
} as const;

export const NAV = [
  { label: 'Overview',  href: '/#about' },
  { label: 'Updates',   href: '/#major-updates' },
  { label: 'Timeline',  href: '/#timeline' },
  { label: 'Work Log',  href: '/work-log/' },
  { label: 'Team',      href: '/#team' },
  { label: 'Contact',   href: '/#reach-out' },
] as const;

/** Deliverables listed in the Documentation section. Put files in public/docs/ and set `href`. */
export const DOCUMENTS = [
  { label: 'Project proposal', href: '' },
  { label: 'Preliminary design review (PDR)', href: '' },
  { label: 'Final design review (FDR)', href: '' },
  { label: 'Final report', href: '' },
] as const;

export const TIMELINE = {
  /** Phase 2: replace with a parsed .ics. Until then this JSON is the source. */
  source: 'src/data/timeline.json',
  icsPath: 'src/data/timeline.ics', // not present yet
  termBoundaries: [
    { label: 'F26', start: '2026-09-07', end: '2026-12-20' },
    { label: 'W27', start: '2027-01-04', end: '2027-04-20' },
  ],
} as const;

// Derived helpers — use these instead of re-deriving in components.
export type Member = (typeof MEMBERS)[number];
export type MemberSlug = Member['slug'];
export const MEMBER_SLUGS = MEMBERS.map(m => m.slug) as unknown as [MemberSlug, ...MemberSlug[]];
export const memberBySlug = (slug: string) => MEMBERS.find(m => m.slug === slug);
export const memberName   = (slug: string) => memberBySlug(slug)?.name ?? slug;
export const otherMembers = (slug: string) => MEMBERS.filter(m => m.slug !== slug);
export const SITE_TITLE   = `${PROJECT.name} — Team ${TEAM_NUMBER}`;

/** True when a config value has been filled in (not empty, not a 'TODO' placeholder). */
export const isSet = (v: string | undefined | null): v is string => !!v && !v.startsWith('TODO');
/** Name shown in the nav and interim logo until `PROJECT.shortName` is set. */
export const BRAND = isSet(PROJECT.shortName) ? PROJECT.shortName : `Team ${TEAM_NUMBER}`;
export const POST_ENTRY_URL  = `${SITE.repo}/issues/new?template=work-log-entry.yml`;
export const POST_UPDATE_URL = `${SITE.repo}/issues/new?template=major-update.yml`;
