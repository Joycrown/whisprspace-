# WhisprSpace — Prompts & Export Pipeline
## Feature Specification v1.1

**Status:** Approved for build
**Depends on:** Inbox Loop (live), Thread system (live), existing Thread Summary / share-card pipeline (live)
**Priority:** P1 — this is the creator-retention layer. It does not block ignition, but it is the next major build after ignition's core loop is proven.
**Note on this revision:** data modeling (tables, fields, schema) is intentionally left to engineering, working against the existing codebase structure. This document specifies required behavior and constraints, not implementation.

---

## 1. Summary

WhisprSpace currently lets a creator receive anonymous messages and convert one into a public or invite-only thread. That solves distribution — a message can become a bigger conversation. It does not solve **production**: the actual work a creator does to turn anonymous input into something postable on the platforms where their audience lives (Instagram, TikTok, X, WhatsApp). Today that work still happens outside the app — screenshotting, manual design, manual re-typing into a thread.

This spec closes that gap with two systems that are designed as one loop:

1. **Prompts** — a themed, time-boxed collection tool that replaces the empty "send me anything" inbox with a specific question, so creators generate rich anonymous input on demand instead of waiting for it.
2. **Export Pipeline** — an upgraded Thread/Prompt Recap Card plus a new Carousel Export, so a creator can turn curated anonymous replies into platform-native, branded, shareable content in one tap, with zero screenshotting.

**The loop these two form:** creator publishes a Prompt → senders answer → creator curates the best answers → creator exports as a carousel or opens the floor as a public thread → creator posts the export to their actual audience, carrying the WhisprSpace link → that link recruits new senders → next Prompt. Every step happens inside WhisprSpace. This loop, run weekly, is what turns a feature into a workflow a creator can't easily abandon.

---

## 2. Goals

1. Give creators a way to generate anonymous input on demand (Prompts) instead of depending on an empty inbox.
2. Let creators turn curated anonymous replies into finished, platform-native content (Export Pipeline) without leaving the app.
3. Make every exported asset carry the WhisprSpace link, so creator content is also a sender-acquisition surface.
4. Create a weekly, low-effort mechanism (Prompt of the Week) that makes a small seed base of creators feel like part of one shared moment, without requiring WhisprSpace to produce original content beyond one prompt a week.
5. Do all of the above without creating a new safety surface that outpaces our moderation — public-facing anonymous content (open-mode Prompts, exports) gets the stricter moderation posture, not the lighter one used for private inbox messages.

## 3. Non-Goals

- No AI-generated or AI-paraphrased content anywhere in this feature. Anonymous replies are shown as submitted (moderation-filtered), never rewritten.
- No prompts about named third parties — this is not a gossip/rating mechanic (see §6).
- No animated video export in v1 (flagged for later, not built now).
- No direct posting to external platforms via API (Meta/X integration) — exports are downloaded/shared via the OS share sheet, not auto-posted.
- No changes to existing Thread creation, privacy levels, or the core Inbox Loop — this spec extends those systems, it doesn't modify their existing behavior.
- **No data modeling decisions.** Tables, fields, relationships, and storage approach are engineering's call, made against the existing structure. This document specifies behavior and constraints only.

---

## 4. Detailed Requirements — Prompts

### 4.1 The Core Distinction: Prompt vs. Thread

A **Prompt is a private collection tool** — responses go only to the creator by default. A **Thread is public discussion** — anyone with access can read it. This distinction must be structurally enforced, not just a UI convention: a Prompt's responses must never be readable by anyone other than its owning creator, until and unless the creator explicitly converts the Prompt into a thread (§4.6). How that enforcement is implemented at the data layer is engineering's decision; the requirement that it hold is not negotiable.

The one exception is **Open mode** (§4.1.1), where responses become visible to *other senders on that same prompt* under strict conditions — but never to the general public, and never outside the reciprocity-unlock flow.

**4.1.1 Mode: Private vs. Open**

- **Private:** responses visible only to the creator. She curates, then optionally exports or opens the floor. This is the default and the safer option — surfaced first in the creation flow.
- **Open:** a sender who submits a response can, immediately after, read other passed-moderation responses to the same prompt (see §4.5, Reciprocity Unlock). The creator still sees everything regardless of mode.

The creation screen must explain this distinction in plain language before the creator picks — this is the single most consequential setting on the screen.

### 4.2 Prompt Creation Flow

Entry point: a **"New prompt"** action on the creator's inbox (not the thread-creation flow — this is a collection tool, not a discussion).

Screen, in order:
1. **Question** — free text, or selected from the **Prompt Library** (§4.3).
2. **Mode** — Private / Open, radio choice, with the one-line explainer from §4.1.1 visible inline, not hidden behind a tooltip.
3. **Duration** — 24h / 48h / 7 days. Fixed options, not free text.
4. **Category** — drives library filtering and, critically, moderation sensitivity (§6.3).
5. **Publish** — generates:
   - the Prompt's own landing page (§4.4) at a stable URL,
   - a Prompt Card (question as headline, live countdown, creator's handle) generated via the existing html-to-image pipeline,
   - immediate access to the share sheet (reuse the Web Share API mechanism from the Inbox Loop's Card A share flow).

Total flow should take under a minute for a creator using the library; under two for a custom question.

### 4.3 Prompt Library

A curated, static content set for v1 — not AI-generated. Organized by:
- **Category** (work, money, love, family, campus, general)
- **Persona pack** — a light tagging layer so an HR creator sees workplace-relevant prompts surfaced first, a relationship-page creator sees relationship prompts first. This is a filter/sort preference, not a hard restriction — any creator can browse the full library.

Content requirement: every library prompt must comply with §6.1 (no named third parties) at the point of writing — this is easier to guarantee for a curated library than for free-text custom prompts, which is one more reason to make the library the default, easier path in the UI.

Estimated v1 library size: 50–75 prompts across 5–6 categories, written once, reused indefinitely. Expanding the library is a content task, not an engineering task, and can happen on an ongoing basis without a new release.

### 4.4 Prompt Landing Page (sender-facing)

Same performance discipline as the inbox landing page in the Inbox Loop spec — this is effectively a themed variant of that page, not a new heavyweight surface.

Content:
- The question, prominent — this is the headline, not a subtitle under a generic "send a message" header.
- Response box.
- Live counter: **"38 people have answered"** — real count only, never seeded or estimated. Below a small floor (suggest 5) this can be omitted the same way the likes-to-buyers signal hides below its floor — a "1 person has answered" counter undersells rather than helps.
- Countdown: **"closes in 31h"** — reuses the expiry-bar visual language from the design system (gradient home #4, live/ephemerality indicator).
- No account required to answer, same as one-off inbox messages.

### 4.5 Post-Send Screens — Mode-Specific

This is the highest-leverage screen in the whole feature, same reasoning as the Inbox Loop's post-send screen — it's the conversion moment, and it must not be generic.

**Private mode:**
- Confirmation: *"Sent. They'll never know it was you."* (reuse locked line — see Copy Rules, §7).
- Conversion line: **"Ask your people the same question."** — not the generic "Want people telling you the truth?" This is a direct, specific escalation of the existing Inbox Loop conversion screen, reusing its mechanics (one tap → anonymous signup or registration → own link/own Prompt ready to share) but with copy sharpened to the specific prompt just answered.

**Open mode:**
- Confirmation, same locked line.
- **Reveal:** other passed-moderation responses to the same prompt, shown immediately below the confirmation. This is the payoff that makes Open mode worth building — curiosity about others' answers is the retention hook.
- Same conversion CTA beneath the reveal.

Both variants must instrument this equivalently to the original post-send screen (Inbox Loop spec, Analytics section) so sender→owner conversion can be compared: prompt-specific CTA vs. generic CTA, private vs. open mode. This comparison is a primary success metric (§9).

### 4.6 Creator-Side: Response Collection & Highlight Picker

Responses to a Prompt are grouped under that Prompt in the creator's inbox — not mixed into the general message stream. Opening a Prompt shows:

- Every response as a card — only responses that have passed moderation are visible here, consistent with the existing blocklist behavior; a blocked response never reaches even the creator.
- A star/highlight action per response. This curation step is the creator's actual craft; the product must never auto-select "best" responses on her behalf.

From this screen, three exits:

1. **Export** → opens the Carousel Export flow (§5.3) pre-loaded with starred responses in the order starred.
2. **Open the floor** → converts the Prompt into a public (or invite-only, creator's choice) Thread. The new thread is seeded with the starred responses as its initial messages, so the discussion starts populated rather than empty — directly reusing the "preview shows a living thread" lesson from the first-buyer stack work.
3. **Save** → archives the prompt and its responses, tagged by the prompt's question/category, for later retrieval (a "last month's salary confessions" search for a follow-up post).

---

## 5. Detailed Requirements — Export Pipeline

### 5.1 Principle

The export pipeline's job is to get a creator from "I have curated anonymous content" to "I have a finished, platform-native, branded asset" in as close to one tap as possible. Every asset produced must carry the WhisprSpace link — exports are a distribution channel, not just a convenience.

### 5.2 Thread/Prompt Recap Card — Upgrade

**Current state:** the existing summary card shows only aggregate stats (participant count, reaction count, duration). Nobody posts a stat sheet to their audience — this upgrade is what makes the card worth sharing at all.

**Upgrade:** the creator can select 1–2 replies (from a thread or a prompt) to feature on the card alongside the existing stats. The card becomes a cover — a real quote, not just a number — and doubles as slide 1 of a Carousel Export (§5.3), so the two features share one design rather than duplicating effort.

### 5.3 Carousel Export

**Mechanic:** creator selects replies from a thread or prompt (reusing the same star/highlight mechanic as §4.6 where applicable). Selected replies are laid out 2–3 per slide, auto-arranged by text length so a slide never looks cramped or sparse. Slide 1 is always the upgraded Recap Card (§5.2) acting as the cover.

**Aspect ratios:** creator picks 1:1, 4:5, or 9:16 depending on where they're posting (feed, carousel, Story/TikTok still) — same lesson learned from our own aspect-ratio mistake with the explainer card template. Render each at the correct native ratio; don't crop one ratio to fit another.

**Branding:** WhisprSpace mark appears on every slide. The final slide always carries the prompt/thread link and a clear "Answer this / Join the discussion" line — this is non-negotiable regardless of tier, because it's the mechanism that turns every creator post into a sender-acquisition surface.

**Tier gating — value-based, not cost-based:**
- Free tier: cover + up to 3 content slides (roughly 6–9 replies depending on layout).
- Premium tier: up to 10 slides total, for longer-form content (a full confession "saga" in one carousel).
- **Do not justify this gate as a resource/bandwidth cost** — rendering through the existing html-to-image pipeline is computationally cheap, and creators will correctly sense a false justification. The honest framing is value: free covers a complete short story; premium covers a long one.
- Premium's brand mark may be visually subtler (smaller, corner-positioned) than free's, but it is never removed, and the final-slide link is identical across tiers. The mark is not a premium inconvenience to escape — it's the growth mechanism, and removing it would trade away distribution for a feature nobody actually asked for.

**Generation:** reuses the existing html-to-image pipeline (same infrastructure as Card A, Card B, and Thread Summaries) — no new rendering infrastructure required, only new templates per aspect ratio and a layout function that distributes selected replies across slides.

**Export formats beyond the image carousel** (lower engineering cost, high value for specific personas — build alongside or immediately after the core carousel):
- **Copy as X thread:** the same selected replies formatted as sequential numbered text, copy-ready, for a platform with no native carousel.
- **Podcast transcript export:** selected replies formatted as a clean, anonymized, numbered script — built for the podcast-persona creators specifically, zero design work, pure text formatting.
- **Caption + hashtag template:** auto-filled from the prompt/thread's title and stats into the existing caption structure, creator edits before posting. Template-based, not model-generated — anonymous confessions should never be paraphrased by an AI.

---

## 6. Safety & Moderation Requirements (launch-blocking for Open mode and any export, not a fast-follow)

### 6.1 Content boundary: no named third parties

Prompts — library and custom — must be about the sender's own experience, never framed as commentary on a named or identifiable third party ("Is [person] the worst..."). This is the gossip/rating model (see the Ongea competitive research), and it carries real defamation exposure that a personal-confession model does not. Enforcement:
- Library content is written to this standard from the start.
- Custom prompt text and all response text pass through the existing blocklist, extended to flag patterns indicating third-party accusation framing where feasible; this is a moderation tuning task, not a novel system.

### 6.2 Moderation gates visibility, not just delivery

For **Open mode** specifically, a response must pass moderation before it becomes visible to *any* other sender — this is pre-publish moderation, stricter than the private-inbox default, and it is the correct posture here because Open-mode responses are effectively public the moment they're unlocked. This mirrors the lesson from the Ongea research: public-facing content warrants pre-publish checks; private 1:1 content does not need that friction.

### 6.3 Sensitive categories

Categories touching health, mental health, or sexuality are either excluded from the Prompt Library at launch, or — if included — routed through the same distress-interstitial logic specified in the Inbox Loop spec's safety requirements. This applies with extra weight to **Open mode**, since a vulnerable disclosure being made visible to other senders (even anonymously) is a materially different risk than the same disclosure going only to a trusted creator in Private mode.

### 6.4 Anonymity in Open mode

Responses in Open mode display as **"Anonymous"** only — never a per-sender identifier, counter, or handle that could allow correlation across multiple responses from the same sender. No feature in this spec may create a persistent pseudonymous identity for Prompt respondents; that would be a meaningful scope change requiring its own review.

### 6.5 Export moderation inheritance

A response that failed moderation can never appear in an export — this should fall out naturally from the highlight picker only ever surfacing responses that have passed moderation, but it is worth an explicit test case (§11) given how much brand risk one leaked blocked message in a public export would carry.

---

## 7. Copy (brand-locked additions)

Follows the voice rules established in the design system and Inbox Loop spec: honest, plain, quietly bold, no hype words.

| Surface | Copy |
|---|---|
| Mode explainer (creation screen) | **Private:** only you see the answers, until you decide to share them. **Open:** people can read others' answers right after they send theirs. |
| Prompt landing counter | [N] people have answered |
| Prompt landing countdown | Closes in [X]h |
| Private-mode conversion CTA | Ask your people the same question |
| Open-mode reveal header | Here's what others said |
| Carousel final slide CTA | Answer this — [prompt link] / Join the discussion — [thread link] |
| Highlight picker empty state | No responses yet. Share your prompt to get things started. |

Anything deviating from this table, or from the existing locked lines ("Sent. They'll never know it was you," "No name. No trace."), goes through the same brand review as everything else in the design system.

---

## 8. Prompt of the Week

**Mechanic:** WhisprSpace (the platform account) publishes one prompt weekly — a prompt authored by the platform itself rather than by an individual creator, category and question chosen by the team. It surfaces at the top of every creator's Prompt Library as **"This week's prompt."**

**Adoption:** one tap creates the same question as a new Prompt owned by the adopting creator, running on their own link and inbox. The system needs to be able to trace which creator-adopted Prompts originated from a given platform-wide prompt of the week — that traceability is what makes the Sunday recap (below) possible. The specific mechanism for maintaining that link is an engineering decision.

**Why this matters more than its build cost suggests:** when many seed creators adopt the same question in the same week, their audiences — who don't know each other — see the same question echoed across multiple pages in the same few days. That repetition is what makes a small, deliberately-seeded creator base feel like a platform-wide moment rather than twenty disconnected posts. It is the cheapest possible mechanism for manufacturing that feeling: one prompt, written once, adopted by many.

**Sunday recap:** WhisprSpace's own account posts a cross-creator recap — the best responses across all adoptions of that week's prompt, anonymized, and only with the originating creator's permission where attribution to their specific prompt matters. This is the only original content the brand account needs to produce in a given week; the material is entirely creator-generated. Producing this recap requires pulling starred (creator-flagged-as-shareable) responses across every adoption of that week's platform prompt — the query/lookup approach to support that is engineering's call.

**Sequencing note:** do not build this until at least ten creators are actively running Prompts organically (see the Phase 5 gate in §10) — it needs real adopters to mean anything, and building it earlier is speculative work against an unproven mechanic.

---

## 9. Analytics & Success Criteria

Per Prompt, track: sends, unlock rate (Open mode only), exports generated, and — the metric that matters most — **sender→owner conversion rate off the prompt-specific post-send screen**, benchmarked against the existing generic Inbox Loop conversion rate.

**Decision gate:** if the prompt-specific CTA ("Ask your people the same question") converts meaningfully better than the generic Inbox Loop CTA, that's the signal to make Prompts the default entry point for new creators, not an optional add-on layered on top of the plain inbox. If it performs the same or worse, Prompts remain a creator power-tool rather than the primary funnel — still valuable, differently prioritized.

Per Export: generation count, tier split (free vs. premium), which aspect ratio gets used most (informs whether to deprioritize an underused ratio), and — where trackable — whether exported links drive measurable sends (via the same referrer-tagging approach already flagged for the outreach playbook).

---

## 10. Build Phases

**Phase 1 — Prompt core**
- Prompt creation (question, mode, duration, category)
- Prompt landing page + live counter/countdown
- Mode-specific post-send screens
- Basic Prompt Library (initial ~50 prompts, written to §6.1 standard)
- Moderation gate on Open-mode visibility (§6.2) — launch-blocking, not deferrable

**Phase 2 — Curation**
- Responses grouped under Prompt in creator inbox
- Highlight picker (star mechanic)
- Save/archive by prompt

**Phase 3 — Export pipeline**
- Recap Card upgrade (featured replies)
- Carousel Export: layout engine, aspect ratios, tier gating, branding rules
- Copy-as-X-thread and podcast transcript export formats (low cost, ship alongside or immediately after the image carousel)

**Phase 4 — Open the floor**
- Prompt → Thread conversion, seeded with starred responses

**Phase 5 — Prompt of the Week**
- Gate: only after ≥10 creators are running Prompts organically (see §8 sequencing note)
- Platform-prompt publishing mechanism, adoption flow, Sunday recap tooling

Phases 1–3 together constitute the complete "collect → curate → export" loop and are the priority; 4 and 5 are amplifiers that matter more once the core loop has real usage to amplify.

---

## 11. Risks & Open Questions

| Risk / Question | Note |
|---|---|
| Open mode becomes a vector for low-effort junk answers just to unlock others' responses | Mitigate with a minimum response length before unlock; monitor unlock-attempt-to-real-answer ratio as a health metric |
| Custom (non-library) prompts drift into third-party gossip framing despite §6.1 | Blocklist tuning is a starting point, not a complete solution; monitor reported custom prompts specifically in the first weeks post-launch |
| Carousel layout looks cramped or sparse depending on reply length variance | Layout function needs real testing across short and long replies before trusting it broadly; render and visually check a range of real content lengths, same discipline as the explainer-card template QA step |
| Prompt of the Week feels stale if the same team writes it every week indefinitely | Consider rotating input from active creators for future prompt ideas once the mechanic is proven, though not a v1 concern |
| Does "Open the floor" thread inherit the Prompt's category/privacy defaults, or does the creator reconfigure at conversion time? | Recommend creator reconfigures at conversion — defaults from a private collection tool shouldn't silently carry into public thread settings without a confirmation step |

## 12. Explicitly Out of Scope for v1

- Animated/video recap export (Reels/TikTok-native motion format) — real value, deferred until static exports prove demand.
- Direct API posting to external platforms.
- AI-generated or AI-paraphrased prompt questions or response summaries.
- Persistent pseudonymous identity for Prompt respondents.
- Dynamic or personalized (per-creator machine-generated) prompt libraries — v1 library is static and curated.
