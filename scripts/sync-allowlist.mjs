// Generates everything outside src/ that needs the team list, from MEMBERS in
// src/config/site.ts, so nothing is edited by hand:
//   - .github/allowlist.json                       (the posting Action's allowlist)
//   - the collaborator checkboxes in .github/ISSUE_TEMPLATE/work-log-entry.yml
//
//   npm run sync:allowlist    — rewrite both
//   npm run check:allowlist   — exit 1 if either is stale (used in CI)
//
// Requires Node >= 22.18, which imports .ts files directly (type stripping).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { MEMBERS } = await import(new URL('../src/config/site.ts', import.meta.url).href);

const isSet = v => typeof v === 'string' && v.length > 0 && !v.startsWith('TODO');
const members = MEMBERS.map(m => ({ slug: m.slug, name: m.name, github: isSet(m.github) ? m.github : null }));

const read = f => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n') : '');

// 1 — allowlist.json
const allowlistPath = path.join(root, '.github', 'allowlist.json');
const allowlist = `${JSON.stringify(
  { _generated: 'DO NOT EDIT — generated from src/config/site.ts by `npm run sync:allowlist`.', members },
  null,
  2,
)}\n`;

// 2 — issue form checkboxes, between the BEGIN/END markers
const formPath = path.join(root, '.github', 'ISSUE_TEMPLATE', 'work-log-entry.yml');
const formCurrent = read(formPath);
const block = /( *# BEGIN members[^\n]*\n)[\s\S]*?( *# END members)/;
if (!block.test(formCurrent)) {
  console.error(`${path.relative(root, formPath)}: missing "# BEGIN members" / "# END members" markers.`);
  process.exit(1);
}
const form = formCurrent.replace(block, (_, begin, end) => {
  const indent = begin.match(/^ */)[0];
  return begin + members.map(m => `${indent}- label: ${m.name}\n`).join('') + end;
});

const outputs = [
  [allowlistPath, allowlist, read(allowlistPath)],
  [formPath, form, formCurrent],
];

if (process.argv.includes('--check')) {
  const stale = outputs.filter(([, want, have]) => want !== have).map(([f]) => path.relative(root, f));
  if (stale.length) {
    console.error(`Out of date with src/config/site.ts: ${stale.join(', ')}. Run \`npm run sync:allowlist\` and commit the result.`);
    process.exit(1);
  }
  console.log('Allowlist and issue form are up to date.');
} else {
  for (const [file, want] of outputs) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, want);
    console.log(`Wrote ${path.relative(root, file)}`);
  }
}

const missing = members.filter(m => !m.github).map(m => m.slug);
if (missing.length) {
  console.warn(`Note: no GitHub username set for ${missing.join(', ')} — they cannot post via the issue form yet.`);
}
