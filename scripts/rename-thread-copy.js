/**
 * rename-thread-copy.js
 *
 * Renames user-facing "thread" copy to "discussion" across the UI.
 *
 * Only display strings change. Code identifiers (threadId, useThreadStore,
 * ThreadData), routes (/threads), API paths and database columns are left
 * alone — renaming those is a large refactor with real breakage risk and no
 * user-visible benefit.
 *
 * Usage:
 *   node scripts/rename-thread-copy.js            # dry run
 *   node scripts/rename-thread-copy.js --apply
 */

const fs = require('fs');
const path = require('path');

const APPLY = process.argv.includes('--apply');
const ROOTS = ['app', 'components'];
const EXTS = new Set(['.tsx', '.ts']);

// Strings that contain "thread" but must not be touched.
const PROTECTED = [
  'Share on Threads',   // Meta's Threads app
  'Paste it in Threads',
  'threads.net',
  'thread-service',
  'threadStore',
  'threadHelpers',
  'ThreadData',
  'threadId',
  'thread_id',
  '/threads',
  'useThread',
];

function protect(line) {
  return PROTECTED.some((p) => line.includes(p));
}

// Case-preserving word replacements, longest first.
const REPLACEMENTS = [
  [/\bThreads\b/g, 'Discussions'],
  [/\bthreads\b/g, 'discussions'],
  [/\bTHREADS\b/g, 'DISCUSSIONS'],
  [/\bThread\b/g, 'Discussion'],
  [/\bthread\b/g, 'discussion'],
  [/\bTHREAD\b/g, 'DISCUSSION'],
];

// A user-facing string is JSX text, or a quoted value for a display attribute.
const JSX_TEXT = />([^<>{}]*\b[Tt]hreads?\b[^<>{}]*)</g;
const DISPLAY_ATTR = /\b(placeholder|title|aria-label|alt|label|description|subtitle|heading|emptyText|tooltip)=("([^"]*\b[Tt]hreads?\b[^"]*)")/g;

// Toast/dialog copy: `title: 'Thread created'`, `message: "..."`.
const DISPLAY_PROP = /\b(title|message|description|subtitle|label|placeholder|body|text):\s*(['"])([^'"]*\b[Tt]hreads?\b[^'"]*)\2/g;

// Standalone prose in ternaries, template literals and props:
//   ? 'Open thread' : 'Join thread'
//   `Are you sure you want to remove ${x} from this thread?`
// Only strings that read as a sentence or label — anything that looks like a
// path, identifier or single bare word is skipped.
const QUOTED_PROSE = /(['"`])([^'"`\n]*\b[Tt]hreads?\b[^'"`\n]*)\1/g;

function isProse(value) {
  if (!value.includes(' ')) return false;          // 'thread', '/my-threads'
  if (value.includes('/')) return false;           // routes
  if (/^[a-z0-9_-]+$/.test(value)) return false;   // identifiers
  return /[A-Za-z]{3}/.test(value);
}

// Replaces words in display text while leaving ${...} interpolations untouched.
// Rewriting inside an interpolation renames the variable and breaks at runtime.
function replaceOutsideInterpolations(value) {
  return value
    .split(/(\$\{[^}]*\})/g)
    .map((part) => (part.startsWith('${') ? part : replaceWords(part)))
    .join('');
}

function replaceWords(text) {
  let out = text;
  for (const [pattern, replacement] of REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

function processFile(file) {
  const original = fs.readFileSync(file, 'utf8');
  const lines = original.split('\n');
  const changes = [];

  const updated = lines.map((line, i) => {
    if (protect(line)) return line;
    if (!/[Tt]hreads?\b/.test(line)) return line;

    let next = line;

    next = next.replace(JSX_TEXT, (match, inner) => {
      // Skip if the visible text is only an expression or has no letters.
      if (!/[A-Za-z]/.test(inner)) return match;
      return `>${replaceWords(inner)}<`;
    });

    next = next.replace(DISPLAY_ATTR, (match, attr, _quoted, inner) =>
      `${attr}="${replaceWords(inner)}"`);

    next = next.replace(DISPLAY_PROP, (match, prop, quote, inner) =>
      `${prop}: ${quote}${replaceWords(inner)}${quote}`);

    // Logs and errors are for developers and should keep matching the schema.
    const isDiagnostic = /console\.(log|warn|error|info|debug)\s*\(/.test(line);

    if (!isDiagnostic) {
      next = next.replace(QUOTED_PROSE, (match, quote, inner) => {
        if (!isProse(inner)) return match;
        return `${quote}${replaceOutsideInterpolations(inner)}${quote}`;
      });
    }

    if (next !== line) {
      changes.push({ line: i + 1, before: line.trim(), after: next.trim() });
    }
    return next;
  });

  if (changes.length === 0) return null;

  if (APPLY) {
    fs.writeFileSync(file, updated.join('\n'), 'utf8');
  }
  return changes;
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (EXTS.has(path.extname(entry.name))) out.push(full);
  }
  return out;
}

function main() {
  console.log(APPLY ? 'Mode: APPLY\n' : 'Mode: DRY RUN (use --apply to write)\n');

  let fileCount = 0;
  let changeCount = 0;

  for (const root of ROOTS) {
    if (!fs.existsSync(root)) continue;
    for (const file of walk(root)) {
      const changes = processFile(file);
      if (!changes) continue;
      fileCount++;
      changeCount += changes.length;
      console.log(path.relative('.', file));
      changes.forEach((c) => {
        console.log(`  ${c.line}: ${c.before}`);
        console.log(`   -> ${c.after}`);
      });
      console.log('');
    }
  }

  console.log('─'.repeat(52));
  console.log(`${changeCount} change(s) across ${fileCount} file(s)`);
  if (!APPLY) console.log('Re-run with --apply to write.');
}

main();
