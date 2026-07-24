/**
 * assemble-whs-refill.js
 *
 * One-off assembler for the 2026 seed refill. Reads whs_all_raw.json (80 raw
 * generated threads harvested from the generation workflow journal), repairs
 * each into the exact playbook structure, dedupes vs the old dataset, validates,
 * and writes whs_final.json.
 *
 * Structure enforced per thread:
 *   - exactly 10 distinct personas, each appearing exactly 5 times (50 replies)
 *   - creatorPersona is index 9 -> its round-4 message is sequenceOrder 50 (OP re-engages last)
 *   - interleaved sequenceOrder: persona0 -> 1,11,21,31,41 ; persona1 -> 2,12,...
 *   - unique reply content within each thread
 *
 * FILLER lines are in-character short lines used ONLY to top a persona up to 5
 * (when the generator gave <5) or to voice a borrowed 10th persona (9->10 case).
 */
const fs = require('fs');

const threads = require('../whs_all_raw.json');
const old = require('../whs_dataset.backup.json');

const PERSONAS = ['deep_thinker','funny_one','skeptic','storyteller','advisor','creative','researcher','peacemaker','provocateur','contrarian','tech_enthusiast','wellness_advocate','realist','optimist','unfiltered','curious_one','night_owl','wise_beyond_years','debater','poet'];
const VALID = new Set(PERSONAS);

const FILLER = {
  deep_thinker: ['the truth you are avoiding is the one you already wrote here.','silence is just a decision you keep postponing.','you know the answer. you just want company for it.','every secret is a debt that collects interest.','the hardest person to be honest with is the one in the mirror.'],
  funny_one: ['Oh honey, breathe. You are not the villain you think you are.','Darling, this too shall pass, probably after therapy.','Sweetheart, give yourself the grace you hand out for free.','Oh love, even saints have group chats they mute.','Honey, you are human, not a headline.'],
  skeptic: ['What is the actual evidence here, not the fear?','Are we sure this is as final as it feels?','Have you tested that assumption or just believed it?','What would change if you were wrong about this?','Is this a fact or a mood dressed as one?'],
  storyteller: ['bruh I have been exactly here. it passes, no cap.','lol we all narrate our worst days like a movie fr.','ngl this hit close. a friend lived this too.','real talk, time did the heavy lifting for me.','been there, survived it. so will you honestly.'],
  advisor: ['Name the fear, then take one small concrete step today.','Separate what you can control from what you cannot.','Start with the smallest honest conversation you can have.','Write it down; clarity comes from the page, not the head.','Do the next right thing, not the whole thing.'],
  creative: ['I have felt this exact ache. It softens, slowly.','There is a version of you on the other side of this.','I painted my way out of a season like this once.','You are more than the worst thing you are hiding.','This chapter is heavy, but it is not the whole book.'],
  researcher: ['Studies say naming a feeling reduces its grip. Try it.','What do the actual numbers of your situation say?','Curious: what changed right before this started?','Data over dread. Map the facts first.','Have you looked at how others resolved this exact thing?'],
  peacemaker: ['You are allowed to be a work in progress.','No one here is judging you as hard as you are.','Take the pressure down a notch. You showed up.','Both things can be true; you are trying and struggling.','Be gentle. Admitting it is the brave part.'],
  provocateur: ['Say the quiet part out loud and watch it lose power.','Everyone is faking something. You just admitted yours.','Comfort is the enemy here. Move.','Stop asking permission to live your own life.','The scary option is usually the honest one.'],
  contrarian: ['Maybe the problem is the story you keep telling.','What if the opposite of your plan is the answer?','Honesty is good; timing is better.','Not every truth needs an audience today.','Consider that you might be the unreliable narrator.'],
  tech_enthusiast: ['Treat it like a system: isolate the failing part.','This is a solo mission until you choose otherwise.','Iterate. You do not have to solve it in one release.','Debug the feeling before you ship a decision.','Small commits beat one giant risky merge.'],
  wellness_advocate: ['Take a breath. Your nervous system is not the enemy.','Rest is not a reward, it is maintenance.','Set one boundary this week and keep it.','Your body has been carrying this. Put it down.','Self-honesty is the first form of self-care.'],
  realist: ['I did a version of this. Plain truth: it resolves slower than you want.','Nothing changes until you say it to a real person.','Money and time fix more of this than you expect.','Be practical. What is the very next step, today?','Hope is nice; a plan is better.'],
  optimist: ['This is hard, but you are clearly self-aware. That is huge.','Brighter days are closer than they feel right now.','You caught this early. That counts for a lot.','You are already halfway by being this honest.','There is a good ending in here somewhere.'],
  unfiltered: ['You already know what to do. Do it.','Stop performing and start being honest. Today.','Comfort is quietly ruining you. Move.','No one is coming to save you from this. Good news: you can.','Rip the bandaid. The waiting is the worst part.'],
  curious_one: ['What does your heart actually want here?','How long have you been carrying this alone?','What are you most afraid will happen if you speak?','When did you last feel okay? Start there.','What would you tell a friend who said this?'],
  night_owl: ['3am thoughts hit different but they still count lol.','tell them you joined a silent monastery, works every time.','the internet is awake with you. you are not alone.','late night confession club, we get it fr.','lol just fake a bad network for a week.'],
  wise_beyond_years: ['Every generation thinks its shame is unique. It is not.','Time will make this smaller than it feels tonight.','The elders had a word for this: it passes.','You are learning a lesson most people dodge for decades.','What feels like the end is usually a doorway.'],
  debater: ['If you stay silent, then the cost only grows. Speak.','Premise: you are honest here. Conclusion: you can be honest there too.','Weigh the long-term cost against the short-term relief.','If the secret is unsustainable, then the plan must change.','Consider the counterfactual: what if you had already told them?'],
  poet: ['You are a seed still learning the shape of your own soil.','Even the longest night is just the earth turning away.','Your ache is a language; learn to read it kindly.','The tide that pulls you out will also bring you back.','You are not lost, only between two maps.'],
};

function repair(t) {
  if (!t || !t.title || !t.content || !t.category || !t.creatorPersona) return null;
  if (!VALID.has(t.creatorPersona)) return null;
  const replies = (t.replies || []).filter(r => r && r.content && VALID.has(r.personaTag));
  if (replies.length < 20) return null;

  const byP = {};
  for (const r of replies) (byP[r.personaTag] ||= []).push(r.content);

  let personas = Object.keys(byP).sort((a, b) => byP[b].length - byP[a].length);
  let chosen = personas.filter(p => p !== t.creatorPersona).slice(0, 9);
  if (chosen.length < 9) {
    for (const p of PERSONAS) {
      if (p === t.creatorPersona || chosen.includes(p)) continue;
      chosen.push(p);
      if (chosen.length >= 9) break;
    }
  }
  chosen = chosen.slice(0, 9);
  chosen.push(t.creatorPersona); // index 9 -> seq 50, OP re-engages last

  const lines = {};
  for (const p of chosen) {
    const real = (byP[p] || []).slice();
    const used = new Set(real.map(s => s.trim()));
    const fill = (FILLER[p] || []).filter(s => !used.has(s.trim()));
    let arr = real.concat(fill).slice(0, 5);
    let fi = 0;
    while (arr.length < 5) {
      const pool = FILLER[p] || ['...'];
      arr.push(pool[fi % pool.length]);
      fi++;
    }
    lines[p] = arr;
  }

  const out = [];
  for (let round = 0; round < 5; round++) {
    for (let pi = 0; pi < 10; pi++) {
      out.push({ personaTag: chosen[pi], content: lines[chosen[pi]][round], sequenceOrder: round * 10 + pi + 1 });
    }
  }
  return { title: t.title.trim(), content: t.content.trim(), category: t.category.trim(), type: 'text', creatorPersona: t.creatorPersona, replies: out };
}

let repaired = threads.map(repair).filter(Boolean);

// dedup titles within new batch
const seen = new Set();
repaired = repaired.filter(t => { const k = t.title.toLowerCase().trim(); if (seen.has(k)) return false; seen.add(k); return true; });

// dedup vs old dataset
const oldT = new Set(old.map(t => t.title.toLowerCase().trim()));
repaired = repaired.filter(t => !oldT.has(t.title.toLowerCase().trim()));

// strict validation
const bad = [];
for (const t of repaired) {
  const ps = new Set(t.replies.map(r => r.personaTag));
  const seq = t.replies.map(r => r.sequenceOrder);
  const issues = [];
  if (t.replies.length !== 50) issues.push('len' + t.replies.length);
  if (ps.size !== 10) issues.push('personas' + ps.size);
  if (new Set(seq).size !== 50 || Math.min(...seq) !== 1 || Math.max(...seq) !== 50) issues.push('seq');
  if (t.replies[49].personaTag !== t.creatorPersona) issues.push('oplast');
  const cnt = {};
  for (const r of t.replies) cnt[r.personaTag] = (cnt[r.personaTag] || 0) + 1;
  if (Object.values(cnt).some(c => c !== 5)) issues.push('uneven');
  if (new Set(t.replies.map(r => r.content.trim())).size !== 50) issues.push('dupcontent');
  if (issues.length) bad.push({ title: t.title.slice(0, 40), issues });
}

console.log('FINAL threads:', repaired.length);
console.log('Structural violations:', bad.length);
if (bad.length) console.log(JSON.stringify(bad.slice(0, 10), null, 1));
const tally = {};
for (const t of repaired) tally[t.category] = (tally[t.category] || 0) + 1;
console.log('Category tally:', JSON.stringify(tally));
let lens = [];
for (const t of repaired) for (const r of t.replies) lens.push(r.content.length);
lens.sort((a, b) => a - b);
console.log('reply len min/median/max:', lens[0], lens[Math.floor(lens.length / 2)], lens[lens.length - 1]);

fs.writeFileSync('whs_final.json', JSON.stringify(repaired));
console.log('wrote whs_final.json');
