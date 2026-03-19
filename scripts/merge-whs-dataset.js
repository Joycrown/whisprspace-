/**
 * merge-whs-dataset.js
 *
 * Merges whs_1.json – whs_17.json into a single whs_dataset.json
 * and transforms the schema to match PlaybookThread / PlaybookReply.
 *
 * Field mapping:
 *   threadId      → (dropped — not needed)
 *   creatorId     → creatorPersona  (User_01 → deep_thinker, etc.)
 *   userId        → personaTag
 *   order         → sequenceOrder
 *   type          → defaults to 'text' if missing
 *
 * Usage:
 *   node scripts/merge-whs-dataset.js
 * Output: whs_dataset.json (at project root)
 */

const fs   = require('fs');
const path = require('path');

// Matches seed-personas.ts SEED_USERS order exactly
const PERSONA_MAP = {
  User_01: 'deep_thinker',
  User_02: 'funny_one',
  User_03: 'skeptic',
  User_04: 'storyteller',
  User_05: 'advisor',
  User_06: 'creative',
  User_07: 'researcher',
  User_08: 'peacemaker',
  User_09: 'provocateur',
  User_10: 'contrarian',
  User_11: 'tech_enthusiast',
  User_12: 'wellness_advocate',
  User_13: 'realist',
  User_14: 'optimist',
  User_15: 'unfiltered',
  User_16: 'curious_one',
  User_17: 'night_owl',
  User_18: 'wise_beyond_years',
  User_19: 'debater',
  User_20: 'poet',
};

const SOURCE_FILES = [
  'whs_1.json','whs_2.json','whs_3.json','whs_4.json','whs_5.json',
  'whs_6.json','whs_7.json','whs_8.json','whs_9.json','whs_10.json',
  'whs_11.json','whs_12.json','whs_13.json','whs_14.json','whs_15.json',
  'whs_16.json','whs17.json',
];

const ROOT = path.resolve(__dirname, '..');

let merged = [];
let warnings = 0;

for (const file of SOURCE_FILES) {
  const filePath = path.join(ROOT, file);
  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️  Not found, skipping: ${file}`);
    continue;
  }

  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const threads = Array.isArray(raw) ? raw : [raw];

  for (const t of threads) {
    const creatorPersona = PERSONA_MAP[t.creatorId];
    if (!creatorPersona) {
      console.warn(`⚠️  Unknown creatorId "${t.creatorId}" in ${file} — skipping thread "${t.title}"`);
      warnings++;
      continue;
    }

    const replies = (t.replies || []).map((r, idx) => {
      const personaTag = PERSONA_MAP[r.userId];
      if (!personaTag) {
        console.warn(`⚠️  Unknown userId "${r.userId}" in reply ${r.order} of "${t.title}"`);
        warnings++;
      }
      return {
        personaTag: personaTag || r.userId,
        content: r.content,
        sequenceOrder: r.order ?? (idx + 1),
      };
    });

    merged.push({
      title:         t.title,
      content:       t.content,
      category:      t.category,
      type:          t.type || 'text',
      creatorPersona,
      replies,
    });
  }
}

// Deduplicate by title — keep first occurrence
const seen = new Set();
const deduped = merged.filter(t => {
  if (seen.has(t.title)) return false;
  seen.add(t.title);
  return true;
});

const dropped = merged.length - deduped.length;

const outPath = path.join(ROOT, 'whs_dataset.json');
fs.writeFileSync(outPath, JSON.stringify(deduped, null, 2), 'utf8');

console.log('─── Merge complete ──────────────────────────────');
console.log(`Files processed:  ${SOURCE_FILES.length}`);
console.log(`Threads merged:   ${merged.length}`);
console.log(`Duplicates dropped: ${dropped}`);
console.log(`Warnings:         ${warnings}`);
console.log(`Output:           whs_dataset.json  (${deduped.length} threads)`);
