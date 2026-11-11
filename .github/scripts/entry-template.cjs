// Renders .github/templates/*.md into an entry's Markdown file.
//
// The templates are plain text with {{placeholders}}. Every placeholder has a TYPE,
// declared in PLACEHOLDERS below, and its value is written by that type's serializer.
// Nothing is ever pasted into YAML as raw text: a title with a colon, a quote, a `#`,
// a leading dash, a newline or an emoji comes out as a quoted YAML string, a date is
// checked to be a date, a slug is checked to be a slug, and so on.
//
// Template rules (also written at the top of each template):
//   {{name}}         a placeholder. It must be listed in PLACEHOLDERS, or the run fails
//                    and names it — a template cannot drift from the script silently.
//   {{! comment }}   removed, and may span lines. A line left empty by it is removed.
//   {{!-- … --}}     the same, but may itself mention {{placeholders}}.
//   optional + empty if an optional placeholder has no value, its whole line is removed,
//                    so an absent field leaves no empty key and no blank line.
//   block types      (lists and maps written over several lines) must sit alone as the
//                    value of a top-level key:  `images: {{images}}`
//   body             only below the frontmatter's closing `---`.
//
// No dependencies and no templating library: this runs in the posting Action, which
// does not install node_modules, and the handful of constructs needed is small.

const fs = require('node:fs');

class TemplateError extends Error {}

// ── Serializers ─────────────────────────────────────────────────────────
// Each returns the text that replaces the placeholder. `block` serializers return
// text starting with a newline, written under the key at two-space indentation.

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Characters YAML forbids (or reads as line breaks) inside a scalar. */
const UNSAFE = new RegExp(`[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f${String.fromCharCode(0x2028, 0x2029, 0xfeff)}]`, 'g');

/** A double-quoted YAML string. JSON's escaping is valid YAML; a few extra characters are escaped too. */
function quoted(value) {
  const s = String(value).toWellFormed(); // a lone surrogate would make the file unreadable
  return JSON.stringify(s).replace(UNSAFE, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

function slug(value, name) {
  if (typeof value !== 'string' || !SLUG.test(value)) throw new TemplateError(`{{${name}}}: "${value}" is not a member slug`);
  return value;
}

function number(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new TemplateError(`{{${name}}}: ${value} is not a number`);
  return String(value);
}

/**
 * A literal block scalar (`|-`), indented under its key. Markdown keeps its headings,
 * lists and blank lines exactly. An indentation indicator is added when the text
 * itself starts with a space, which YAML would otherwise misread as indentation.
 */
function blockScalar(text, indent) {
  const lines = String(text).toWellFormed().replace(/\r\n?/g, '\n').replace(UNSAFE, '').split('\n');
  const first = lines.find(l => l.trim() !== '') ?? '';
  const header = first.startsWith(' ') ? '|2-' : '|-';
  const pad = ' '.repeat(indent + 2);
  return `${header}\n${lines.map(l => (l.trim() === '' ? '' : pad + l)).join('\n')}`;
}

const SERIALIZERS = {
  /** Any text, as a quoted string. */
  string: { serialize: v => quoted(v) },
  /** YYYY-MM-DD, bare, so YAML reads it as a date. */
  date: {
    serialize: (v, name) => {
      if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new TemplateError(`{{${name}}}: "${v}" is not a YYYY-MM-DD date`);
      return v;
    },
  },
  /** A number, bare. */
  number: { serialize: number },
  /** A whole number, bare (the issue number). */
  integer: {
    serialize: (v, name) => {
      if (!Number.isInteger(v)) throw new TemplateError(`{{${name}}}: ${v} is not a whole number`);
      return String(v);
    },
  },
  /** One member slug, bare. */
  slug: { serialize: slug },
  /** A GitHub username, for the "Posted from" comment line. */
  login: {
    serialize: (v, name) => {
      if (typeof v !== 'string' || !/^[A-Za-z0-9_.\-[\]]+$/.test(v)) throw new TemplateError(`{{${name}}}: "${v}" is not a GitHub username`);
      return v;
    },
  },
  /** A flow list of slugs: [a, b]. An empty list is written as []. */
  slugList: {
    serialize: (v, name) => {
      if (!Array.isArray(v)) throw new TemplateError(`{{${name}}}: expected a list of slugs`);
      return `[${v.map(s => slug(s, name)).join(', ')}]`;
    },
  },
  /** slug → Markdown text, each value a block scalar. Empty map = absent. */
  textMap: {
    block: true,
    empty: v => Object.keys(v).length === 0,
    serialize: (v, name) =>
      Object.entries(v)
        .map(([k, text]) => `\n  ${slug(k, name)}: ${blockScalar(text, 2)}`)
        .join(''),
  },
  /** slug → number. Empty map = absent. */
  numberMap: {
    block: true,
    empty: v => Object.keys(v).length === 0,
    serialize: (v, name) =>
      Object.entries(v)
        .map(([k, n]) => `\n  ${slug(k, name)}: ${number(n, name)}`)
        .join(''),
  },
  /** [{ src, alt, caption? }]. Empty list = absent. */
  imageList: {
    block: true,
    empty: v => v.length === 0,
    serialize: (v, name) =>
      v
        .map(img => {
          // A path the script built itself is written bare, as before; anything else is quoted.
          const src = /^\/[\w./-]+$/.test(img.src) ? img.src : quoted(img.src);
          if (!img.alt) throw new TemplateError(`{{${name}}}: image ${img.src} has no alt text`);
          return `\n  - src: ${src}\n    alt: ${quoted(img.alt)}${img.caption ? `\n    caption: ${quoted(img.caption)}` : ''}`;
        })
        .join(''),
  },
  /** The entry's Markdown body, as written. Only allowed below the frontmatter. */
  body: { body: true, serialize: v => String(v).replace(/\r\n?/g, '\n') },
};

/**
 * Every placeholder a template may use, with its type and whether it must have a
 * value. A placeholder in a template that is not listed here fails the run.
 */
const PLACEHOLDERS = {
  title: { type: 'string', required: true },
  date: { type: 'date', required: true },
  author: { type: 'slug', required: true },
  collaborators: { type: 'slugList', required: true },
  contributions: { type: 'textMap', required: false },
  hoursByMember: { type: 'numberMap', required: false },
  timeCommitted: { type: 'number', required: true },
  images: { type: 'imageList', required: false },
  issue: { type: 'integer', required: true },
  login: { type: 'login', required: true },
  content: { type: 'body', required: true },
};

// ── Template parsing ────────────────────────────────────────────────────

const TOKEN = /\{\{\s*([A-Za-z_][\w]*)\s*\}\}/g;

/**
 * Checks a template and returns render(values). Every structural problem — an
 * unknown placeholder, a stray `{{`, a block type in the wrong place, a missing
 * frontmatter — is found here, before anything is downloaded or written.
 */
function compile(text, name = 'template') {
  const fail = msg => {
    throw new TemplateError(`${name}: ${msg}`);
  };
  // Remove {{! comments }}, then any line that held nothing else.
  const COMMENT_LINE = '\u0000comment\u0000';
  let src = String(text).replace(/\r\n?/g, '\n');
  // Every line a comment touches gets a marker (blank lines inside it too), so the
  // comment's lines can be told apart from the template's own blank lines.
  // {{!-- … --}} may contain "}}" (handy for notes that mention placeholders); {{! … }} may not.
  const blank = m => m.split('\n').map(() => COMMENT_LINE).join('\n');
  src = src.replace(/\{\{!--[\s\S]*?--\}\}/g, blank).replace(/\{\{![\s\S]*?\}\}/g, blank);
  const lines = src
    .split('\n')
    .filter(l => !(l.includes(COMMENT_LINE) && l.split(COMMENT_LINE).join('').trim() === ''))
    .map(l => (l.includes(COMMENT_LINE) ? l.split(COMMENT_LINE).join('').replace(/\s+$/, '') : l));
  while (lines.length && lines[0].trim() === '') lines.shift();

  if (lines[0] !== '---') fail('must start with a "---" line (the frontmatter), after any {{! comments }}');
  const close = lines.indexOf('---', 1);
  if (close === -1) fail('the frontmatter has no closing "---" line');

  const parsed = lines.map((line, i) => {
    const where = `line "${line.trim()}"`;
    const inFrontmatter = i > 0 && i < close;
    const stray = line.replace(TOKEN, '');
    if (stray.includes('{{') || stray.includes('}}')) fail(`${where}: "{{" or "}}" that is not a placeholder. Placeholders look like {{title}}.`);
    const tokens = [...line.matchAll(TOKEN)].map(m => m[1]);
    for (const t of tokens) {
      const spec = PLACEHOLDERS[t];
      if (!spec) fail(`unknown placeholder {{${t}}}. Known placeholders: ${Object.keys(PLACEHOLDERS).join(', ')}. Add it to PLACEHOLDERS in .github/scripts/entry-template.cjs, with a type, before using it.`);
      const type = SERIALIZERS[spec.type];
      if (type.body && inFrontmatter) fail(`{{${t}}} is the entry body and cannot go inside the frontmatter`);
      if (!type.body && !inFrontmatter) fail(`{{${t}}} is a frontmatter value and must go between the two "---" lines`);
      if (type.block && !new RegExp(`^[A-Za-z][\\w]*: \\{\\{\\s*${t}\\s*\\}\\}$`).test(line)) {
        fail(`{{${t}}} is written over several lines, so it must be alone as the value of a top-level key, e.g. "${t}: {{${t}}}"`);
      }
    }
    return { line, tokens };
  });

  return function render(values) {
    const out = [];
    for (const { line, tokens } of parsed) {
      let drop = false;
      for (const t of tokens) {
        const v = values[t];
        const spec = PLACEHOLDERS[t];
        const type = SERIALIZERS[spec.type];
        const absent = v === undefined || v === null || v === '' || (type.empty && type.empty(v));
        if (absent && spec.required) throw new TemplateError(`${name}: required placeholder {{${t}}} has no value`);
        if (absent) drop = true;
      }
      if (drop) continue;
      // A block value starts on the next line, so the key keeps no trailing space ("images:").
      const BLOCK_TOKEN = / ?\{\{\s*([A-Za-z_][\w]*)\s*\}\}/g;
      out.push(
        line.replace(BLOCK_TOKEN, (all, t) => {
          const type = SERIALIZERS[PLACEHOLDERS[t].type];
          const text = type.serialize(values[t], t);
          return type.block ? text : all.startsWith(' ') ? ` ${text}` : text;
        }),
      );
    }
    return `${out.join('\n').replace(/\n+$/, '')}\n`;
  };
}

/** Reads and compiles a template file. */
function load(file, name = file) {
  return compile(fs.readFileSync(file, 'utf8'), name);
}

module.exports = { compile, load, PLACEHOLDERS, SERIALIZERS, TemplateError, quoted, blockScalar };
