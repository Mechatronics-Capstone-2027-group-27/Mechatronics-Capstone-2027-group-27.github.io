// src/config/site.ts
//
// The single source of truth for every repeated value on the site.
// No component may hardcode a member name, the team number, the project name,
// an email or a URL — import it from here instead.
//
// Unknowns are marked `TODO(Ethan)` — `grep -rn "TODO(Ethan)" src` lists them.
// A value of 'TODO' is treated as "not set" by the helpers at the bottom, and is
// never printed: whatever needs it is left off the page until it is filled in.

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
  // TODO(Ethan): 3–5 key objectives for the About section, one string each. Empty = no list.
  objectives: [] as readonly string[],
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
    // The member who answers enquiries: a slug from MEMBERS. Their name (and role, once
    // set) is shown beside the address, so it is never typed a second time.
    person: 'ethan-catz',
    general: 'eslemudc@uwaterloo.ca',
    sponsorship: 'eslemudc@uwaterloo.ca', // same person until there is a separate sponsorship contact
  },
} as const;

/**
 * The single source of truth for the team.
 * `slug` drives URLs (/work-log/<slug>), content folder names, and the `author`
 * field in entry frontmatter. Changing a slug is a breaking change — rename the
 * content folder and any `collaborators` references at the same time.
 * `github` is the GitHub username, used by the posting Action's allowlist (§7).
 * After editing `github`, run `npm run sync:allowlist`.
 * `photo` is relative to src/assets/img/. It stays 'TODO' while the file there is
 * still the grey placeholder, and the card shows the member's initials. Once the real
 * portrait replaces src/assets/img/team/<slug>.jpg, set it to 'team/<slug>.jpg'.
 * `role` and `linkedin` are left off the card while they are 'TODO'.
 * `email` is never rendered publicly unless `showEmail` is true (opt-in, §7.5).
 */
// TODO(Ethan): roles, LinkedIn URLs, portraits (and emails only if members opt in).
export const MEMBERS = [
  { slug: 'ethan-catz',      name: 'Ethan Catz',      github: 'MystyM', email: 'TODO', showEmail: false, linkedin: 'TODO', role: 'TODO', photo: 'TODO' },
  { slug: 'ian-macpherson',  name: 'Ian Macpherson',  github: 'IanJinzoTakeda', email: 'TODO', showEmail: false, linkedin: 'TODO', role: 'TODO', photo: 'TODO' },
  { slug: 'david-makarczyk', name: 'David Makarczyk', github: 'DavidM2004', email: 'TODO', showEmail: false, linkedin: 'TODO', role: 'TODO', photo: 'TODO' },
  { slug: 'nitya-singh',     name: 'Nitya Singh',     github: 'sky1515', email: 'TODO', showEmail: false, linkedin: 'TODO', role: 'TODO', photo: 'TODO' },
  { slug: 'matthew-zelenka', name: 'Matthew Zelenka', github: 'MatthewZelenka', email: 'TODO', showEmail: false, linkedin: 'TODO', role: 'TODO', photo: 'TODO' },
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

/**
 * Switches for sections that aren't ready to show publicly yet. A section appears
 * only when its switch is on AND it has real content (see src/lib/sections.ts), and
 * its NAV link comes and goes with it. README.md lists what each one needs.
 */
export const FEATURES = {
  about: false, // TODO(Ethan): needs PROJECT.summary and/or PROJECT.objectives
  majorUpdates: true, // shows itself once the first major update is posted
  reachOut: true, // also needs SITE.contact.general
  timeline: false, // TODO(Ethan): needs real milestones in src/data/timeline.json
  team: true,
  documentation: true, // shows itself once a DOCUMENTS entry has an href
  mondayEmbed: true,
  workLog: true,
  /**
   * Development only. When true, entries with `draft: true` render with a SAMPLE badge;
   * when false they are not published. Keep it false on the live site.
   */
  showSampleContent: false,
} as const;

/**
 * Site photos in src/assets/img/. Each is false while the file is still the grey
 * generated placeholder (it has its own name and size printed on it), and the page
 * leaves that image out. Replace the file — same name — then set its flag to true.
 * Sizes are in README.md. Portraits are per member: see `photo` in MEMBERS.
 */
export const IMAGES = {
  hero: false, // hero.jpg AND hero-mobile.jpg
  about: false, // about.jpg
  band: false, // band-1.jpg
  systemDiagram: false, // system-diagram.svg
  og: false, // og.jpg — the link-preview card
} as const;

/** Sponsor logos for the Reach Out section. Files go in public/img/sponsors/. Empty = no "Supported by" row. */
export const SPONSORS: readonly { name: string; logo: string; href?: string }[] = [];

/** Navigation, in display order. This order is independent of SECTION_ORDER (the front page). */
export const NAV = [
  { label: 'Overview',  href: '/#about' },
  { label: 'Work Log',  href: '/work-log/' },
  { label: 'Updates',   href: '/#major-updates' },
  { label: 'Timeline',  href: '/#timeline' },
  { label: 'Team',      href: '/#team' },
  { label: 'Contact',   href: '/#reach-out' },
] as const;

/**
 * Deliverables for the Documentation section. Put the file in public/docs/ and set
 * `href` (e.g. '/docs/project-proposal.pdf'). Only entries with an href are listed,
 * and the section stays off the page until there is at least one.
 */
export const DOCUMENTS: readonly { label: string; href: string }[] = [
  { label: 'Project proposal', href: '' },
  { label: 'Preliminary design review (PDR)', href: '' },
  { label: 'Final design review (FDR)', href: '' },
  { label: 'Final report', href: '' },
];

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
