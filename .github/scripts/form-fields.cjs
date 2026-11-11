// The issue forms' field labels, in one place.
//
// GitHub turns a submitted issue form into "### <label>\n\n<value>" blocks, and
// post-entry.cjs finds each field by that heading. So the labels the form shows and
// the labels the parser looks for must be the same text. This module is the single
// source for both:
//
//   - scripts/sync-allowlist.mjs writes the per-person blocks of
//     .github/ISSUE_TEMPLATE/work-log-entry.yml from MEMBERS with memberFormYaml();
//   - post-entry.cjs builds its expected-heading list with fieldsFor(), from
//     .github/allowlist.json, which the same sync run writes from the same MEMBERS.
//
// `npm run check:allowlist` (CI) fails if the form or the allowlist is stale, and
// `npm run test:post` checks the hand-written labels below against the real forms.
// No dependencies: this runs inside the posting Action, which does not `npm ci`.

/** Hand-written fields, as labelled in .github/ISSUE_TEMPLATE/*.yml. */
const LABELS = {
  kind: 'Entry type',
  title: 'Title',
  date: 'Date',
  hours: 'Time committed', // major update (team-hours); also the old work-log form
  content: 'Content of progress', // work log
  updateContent: 'Content', // major update
  images: 'Images',
  // Old work-log form (before per-person boxes). Kept so an issue filed from a stale
  // copy of the form, or replayed from Actions, still posts as it used to.
  collaborators: 'Collaborators',
  yourContribution: 'Your contribution',
};

/** The two per-person fields for one member. */
const memberLabels = member => ({
  contribution: `${member.name} — contribution`,
  hours: `${member.name} — hours`,
});

/**
 * Fields in the order a form emits them. `key` is how post-entry.cjs refers to a
 * field; `slug` is set on per-person fields.
 *   layout: 'work-log' | 'work-log-legacy' | 'major-update'
 */
function fieldsFor(layout, members = []) {
  const f = (key, label, extra = {}) => ({ key, label, ...extra });
  const head = [f('kind', LABELS.kind), f('title', LABELS.title), f('date', LABELS.date)];
  if (layout === 'major-update') {
    return [...head, f('hours', LABELS.hours), f('content', LABELS.updateContent), f('images', LABELS.images)];
  }
  if (layout === 'work-log-legacy') {
    return [
      ...head,
      f('collaborators', LABELS.collaborators),
      f('hours', LABELS.hours),
      f('content', LABELS.content),
      f('yourContribution', LABELS.yourContribution),
      f('images', LABELS.images),
    ];
  }
  if (layout !== 'work-log') throw new Error(`Unknown form layout "${layout}"`);
  const people = members.flatMap(m => {
    const l = memberLabels(m);
    return [f(`contribution:${m.slug}`, l.contribution, { slug: m.slug }), f(`hours:${m.slug}`, l.hours, { slug: m.slug })];
  });
  return [...head, f('content', LABELS.content), ...people, f('images', LABELS.images)];
}

/**
 * Heading text reduced to what matters, so GitHub (or a browser, or a copy-paste)
 * changing case, spacing, dashes or trailing punctuation cannot make a field vanish:
 *   "Ethan Catz — hours", "ethan catz - Hours:", "Ethan Catz – hours" → "ethan catz - hours"
 */
function normalizeLabel(text) {
  return String(text)
    .normalize('NFKC') // folds non-breaking and other odd spaces into plain spaces
    .replace(/[­​-‍﻿]/g, '') // soft hyphen, zero-width characters
    .replace(/\s*[-‐-―−﹘﹣－]+\s*/g, ' - ') // any dash, any spacing
    .replace(/\s+/g, ' ')
    .replace(/[\s.:;,!?…*_]+$/, '') // trailing punctuation
    .replace(/^[\s*_]+/, '')
    .trim()
    .toLowerCase();
}

/** One person's block of the work-log form: a heading, what they did, their hours. */
function memberFormYaml(member, indent = '  ') {
  const l = memberLabels(member);
  const q = JSON.stringify; // a JSON string is a valid YAML scalar, whatever the name contains
  const lines = [
    '- type: markdown',
    '  attributes:',
    `    value: ${q(`### ${member.name}`)}`,
    '- type: textarea',
    `  id: contribution-${member.slug}`,
    '  attributes:',
    `    label: ${q(l.contribution)}`,
    `    description: ${q(`What ${member.name} did. Leave blank if they weren't involved. Markdown is fine.`)}`,
    '  validations:',
    '    required: false',
    '- type: input',
    `  id: hours-${member.slug}`,
    '  attributes:',
    `    label: ${q(l.hours)}`,
    `    description: ${q(`Hours ${member.name} spent, decimals OK. Blank if they weren't involved.`)}`,
    '    placeholder: "2.5"',
    '  validations:',
    '    required: false',
  ];
  return lines.map(line => `${indent}${line}\n`).join('');
}

module.exports = { LABELS, memberLabels, fieldsFor, normalizeLabel, memberFormYaml };
