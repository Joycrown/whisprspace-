# WhisprSpace — Stories
## Feature Specification v1.0

**Status:** Approved for build
**Depends on:** Thread system (live), Reply-Publicly / public feed mechanics (live), Export Pipeline (live), existing notification system (in-app, web push, email — live), anonymous sign-in (live)
**Note on this document:** data modeling (tables, fields, relationships) is intentionally left to engineering, working against the existing structure. This document specifies required behavior and constraints, not implementation.

---

## 1. Summary

Every public discussion on WhisprSpace today depends on a creator in the middle — someone curating anonymous input for their own audience. Stories removes that dependency for a specific case: a person can tell WhisprSpace their story directly, it becomes a real public discussion natively, and WhisprSpace's own channels can feature it. WhisprSpace becomes its own publisher, not just a tool creators use to publish.

This does not compete with the creator economy — it feeds it. A story that resonates in the Stories feed is the natural moment to invite its author to become a creator in their own right. It also closes a real structural gap identified in the Ongea competitive research: a cold, first-time visitor with no personal link from a friend currently has nothing to do on WhisprSpace. A browsable public story feed gives them something.

This spec also introduces **Episodic Mode** — the ability for a story to be told in installments over time, with a follow/notify mechanic, which is the single strongest retention lever proposed for this feature.

---

## 2. Goals

1. Let anyone tell WhisprSpace a story directly, with no creator intermediary required, and have it become a real discussion.
2. Give a cold, unauthenticated visitor something to browse and engage with immediately — closing the gap identified in the Ongea research.
3. Give WhisprSpace's own external channels (TikTok, Instagram, X) a native, honest, always-on supply of real content, without fabricating anything.
4. Introduce a serialized storytelling mode with real appointment-viewing behavior, without introducing a social graph or persistent identity system that contradicts the platform's anonymity-first design.
5. Preserve absolute clarity between real, lived content and created/written content — the trust cost of blurring that line is higher than the content value gained.
6. Make export flexible both ways: the author who told the story can export and share it on their own personal pages, independent of and requiring no permission tied to whether WhisprSpace itself ever features it. WhisprSpace's own publishing role (§9.2, §10) is a complement to self-export, not a gate in front of it — it exists to give reach to stories whose authors don't have their own audience to post to, not to control whether an author can share their own story.

## 3. Non-Goals

- This is not a replacement for creator-driven threads or the existing Prompt/export workflow — both continue unchanged.
- No persistent pseudonymous identity, visible follower counts, or person-to-person following. Following applies to individual stories only (§7.4).
- No AI-generated or AI-summarized story content.
- No system-enforced release schedules (§7.3) — cadence is author-stated framing, not a commitment the platform polices.
- No data modeling decisions in this document — behavior and constraints only.

---

## 4. Content Families: Lived vs. Written

Two families, never visually or structurally blended:

- **Lived** — real, personal experience, submitted as fact.
- **Written** — created work: fiction, poetry.

Every story card, in every context (feed, story page, export, notification), carries a persistent, glanceable tag identifying its family. This is not cosmetic: blurring the line between "this happened" and "this was written" undermines trust in *every* piece of real content on the platform, not just the blended piece. A reader who can't tell whether a "bad experience" post is real can no longer fully trust any of them.

## 5. Categories

**Lived:**
- **Live Stories** — an ongoing account, updatable over time; supports Episodic Mode (§7).
- **Regrets** — covers both "had I known" and "big regret" framings under one category.
- **Bad Experiences**

**Written:**
- **Fiction** — supports Episodic Mode (§7).
- **Poetry**

This is a distinct category taxonomy from existing Thread categories and existing Prompt Library categories — different content type, different browsing intent. It should not be merged into either existing enum.

---

## 6. Submission & Identity Requirements

### 6.1 No-authentication, one-shot categories

**Regrets, Bad Experiences, Poetry, and standalone (non-episodic) Fiction** require no account to submit — consistent with the existing one-off inbox message pattern. The existing sender-token cookie and IP-hash rate limiting from the Inbox Loop spec apply unchanged; this is reused infrastructure, not new engineering.

### 6.2 Anonymous-session categories

**Live Stories, and any story submitted in Episodic Mode (§7),** require the existing lightweight anonymous sign-in — not full registration, no email required. This is the minimum needed to give the author a way to return and add to their own story. A no-auth, sessionless submission has no path back for the author to continue it; a saved "secret link" approach was considered and rejected in favor of the existing anonymous session, since saved links get lost and a session doesn't.

### 6.3 Submission Confirmation — the one guaranteed moment of contact

Every submission, regardless of category or auth status, ends on a confirmation screen — reusing the existing post-send screen pattern already live elsewhere in the product. This screen is not just a courtesy; it is a structural requirement, for a reason specific to the no-auth categories (§6.1): **a sessionless, no-auth poster can never be reached again after they leave this screen.** There is no account, no profile, no later. Whatever isn't captured here is lost permanently.

Accordingly, this screen must offer, in the same moment:

1. **Export it yourself, now** — a one-tap option to generate and save the Recap Card / Carousel Export of what was just submitted (§12.1). For no-auth categories, this is the *only* opportunity the teller will ever have to do this themselves.
2. **A consent choice for WhisprSpace's own external pickup** (§10) — presented as an active choice, defaulting to **not granted** (opt-in required, never opt-out — see §10 for why).

For **anonymous-session categories** (Live Stories, Episodic Mode), both of these remain adjustable afterward via the story's own page, since a persistent session exists to return to. For **no-auth, one-shot categories**, the choices made on this one screen are final — there is no settings page to revisit, because there is no account to attach a setting to. This is an honest, named tradeoff of the no-auth path (§6.1), not an oversight: zero friction to submit is bought at the cost of zero ability to manage the story afterward, except in this one moment.

### 6.4 Consent to appear on the internal feed — framing, not a gate

Separately from external pickup (§10, which does need an explicit toggle), **appearing in WhisprSpace's own internal Stories feed does not need a blocking consent modal.** Anonymity removes the identity-exposure risk, but it does not remove a different risk: someone submitting without having clearly understood that their words become a public, permanent, discussable post rather than something more private. A checkbox modal doesn't actually fix that — people click through consent modals without reading them — and it adds exactly the kind of legalistic friction this product avoids everywhere else.

The real fix is in the entry point's own copy, not a separate screen: the "Share your story" / "Tell us your experience" CTA and the writing screen itself must state plainly, before submission, that this goes public and anonymous, and that others will read and discuss it — the same honest-framing approach already used on the inbox landing page ("No name. No trace."). Once that's unambiguous, the submit action itself is the consent; no additional gate is needed. This applies identically to no-auth and anonymous-session categories — neither involves collecting real identity data, and in neither case does that fact resolve the actual question, which is about the poster's understanding, not their exposure.

---

## 7. Episodic Mode

### 7.1 Scope

Episodic Mode is available to **Live Stories and Fiction only.** These are the two categories where an ongoing narrative genuinely makes sense; Regrets, Bad Experiences, and Poetry remain single-shot by design.

### 7.2 Author flow

When starting a Live Story or Fiction piece, the author may opt into Episodic Mode. Once opted in:

- The story lives on the author's (anonymous-session) profile as a growing collection of episodes.
- The author can return at any time to add a new episode.
- Each new episode is a distinct, dated addition to the same story — readers see the full sequence, not just the latest entry.

### 7.3 Release cadence — a label, not a commitment

The author may optionally state an intended cadence (e.g., "new episodes on Fridays"), shown on the story's page as framing for readers ("usually posts Fridays"). **This is not a system-enforced schedule.** The platform does not track, police, or message the author about a missed date. Notifications (§7.4) fire only when an episode is actually published. This avoids turning an anonymous, unpaid, voluntary act of storytelling into something that carries schedule pressure — which would work against the platform's core tone.

### 7.4 Following a story, and notifications

A reader can follow an individual story to be notified when a new episode publishes. This is **a follow on the story, not on the author** — no visible identity, no follower count exposed to the author beyond an aggregate number if that's ever surfaced, no persistent relationship between reader and author outside this one story. This preserves the anonymity-first design boundary while still enabling the appointment-viewing mechanic.

Notification delivery reuses the existing notification system (in-app feed, web push, email) as a new trigger type alongside the existing set (likes, replies, DMs, invites, poll ending, thread expiring) — no new notification infrastructure required.

### 7.5 Abandoned series

Some episodic stories will stop mid-way with no explanation — this is an expected, acceptable outcome, not a failure state to prevent. The story page should show "Last episode: [date]" plainly, so readers understand the state without the platform attempting to force completion, hide stalled series, or message the author about it.

---

## 8. Discussion Mechanics

Stories do not introduce a new comment system. Each story auto-generates its own thread, reusing the existing Reply-Publicly / "open the floor" mechanic already live in the product. Tapping into a story from the feed lands the reader directly in that thread.

- **Reading** a story's discussion is open to any visitor, authenticated or not — consistent with how the public feed already works today.
- **Participating** (posting a reply) requires at minimum the existing anonymous session — this is not a new restriction, it's the existing thread-participation rule applying here as it already does everywhere else.

For Episodic Mode specifically: each episode may carry its own discussion, or all episodes may share one continuing thread — this is a product decision to be settled during design, not resolved in this spec (see §11).

---

## 9. Moderation & Editorial — Two Distinct Gates

These are separate mechanisms serving separate purposes, and must not be conflated:

**9.1 Baseline moderation (automatic, applies to every episode/story, non-negotiable)**
Every story and every episode passes through the existing blocklist and moderation pipeline before it becomes visible to any reader — the same pre-publish standard already established for other public-facing anonymous content (Open-mode Prompts, public threads). This is a safety gate, not a curation choice, and it cannot be skipped regardless of category, including Fiction — a fictional story depicting self-harm reads identically to a vulnerable reader as a true one, and gets the same distress-interstitial handling where relevant.

**9.2 Editorial pickup (separate, applies only to external content-sharing)**
Whether a specific story or episode gets featured on WhisprSpace's own external channels (TikTok, Instagram, X) is a distinct decision, made by the team, independent of and downstream from baseline moderation. Passing moderation makes a story visible on the platform; it does not automatically make it eligible for external publication. This is where the editorial-risk concern from earlier discussion is addressed — WhisprSpace's own brand is attached to what it actively chooses to amplify, and that choice deserves its own deliberate step.

---

## 10. Consent for WhisprSpace's Own External Publication

This section governs one specific thing: WhisprSpace featuring a story on **WhisprSpace's own** external channels. It has no bearing on an author exporting and sharing their own story on their own pages — that path is self-service and covered separately in §12.1.

Being visible in the internal Stories feed and being featured on WhisprSpace's own external social channels are two different levels of exposure, and require two different levels of consent:

- Submitting a story to the internal feed implies the existing level of public visibility already understood for public threads.
- A **separate, explicit choice** — "WhisprSpace may feature this on our own channels" — is required before any story or episode can be considered for external pickup by WhisprSpace itself (§9.2, §12.2).

**This choice is captured on the submission confirmation screen (§6.3), not as a settings-page toggle checked later** — the earlier version of this spec assumed a standing account setting, which silently breaks for the no-auth, one-shot categories (§6.1) that have no account to hold a setting on. Capturing it at submission is the only approach that works uniformly across every category.

**Default is not granted — this must be opt-in, never opt-out.** Given how personal Regrets and Bad Experiences can be, silently assuming permission unless someone finds a way to withdraw it would be a dark pattern this product has rejected everywhere else. Someone must actively say yes.

**If consent is not given:** the story is simply never eligible for WhisprSpace's own external pickup. It still goes live in the internal feed (assuming it passes moderation, §9.1), still gets its own discussion thread, and the teller can still export it themselves via §12.1 if they choose to at that same moment. Declining this one thing does not affect anything else.

**For anonymous-session categories**, this choice can be revisited later via the story's own page — grant or revoke at any time, and revocation is respected for any future pickup even if earlier episodes were already shared. **For no-auth, one-shot categories**, the choice made on the confirmation screen is final, per §6.3 — there is no account to return to and change it.

---

## 11. Feed Display

- Every card shows its Lived/Written tag and category, visible without tapping in — not a detail discovered after opening the story.
- Live, ongoing stories (episodic or not) carry a distinct visual marker reusing the existing pulsing live-indicator and gradient countdown language from the design system, so an in-progress story reads differently from a finished one at a glance.
- Sort and filter by family and category.
- Card visual treatment reuses the existing thread-card pattern rather than introducing a new card type.

---

## 12. Export Pipeline Integration — Two Paths, Both Flexible

Both Lived and Written families, and every category, support export. This works two ways, and the two must not be confused with each other.

**One honest limit worth stating before either path:** restricting export to the teller does not, and cannot, prevent someone from screenshotting a public story — that's a universal limitation of anything rendered on a screen, not something specific to this product. What restricting export does is remove the *convenient, one-tap, professionally-branded* redistribution tool from anyone who isn't the teller, the same way the whole export pipeline made screenshotting unnecessary for creators without ever claiming to make it impossible.

### 12.1 Author self-export (default, low-friction, no special consent)

Any author — telling a real experience or writing fiction, episodic or not — can export their own story or episode using the existing Recap Card and Carousel Export tools, exactly as a creator already exports their own thread content today. This requires no consent step beyond the story already having passed baseline moderation (§9.1) — it is the author's own content, being shared by the author, to the author's own audience. The existing free/premium tier rules and branding requirements from the export pipeline apply unchanged.

**Where this actually happens depends on category (§6.3):** for anonymous-session categories, self-export is available anytime via the story's own page. For no-auth, one-shot categories, the only opportunity is the submission confirmation screen (§6.3) — there is no account to return to and export from later, so this must be offered in that same moment or it's lost.

This is the default, always-available path for the teller, and it should not be gated behind, or confused with, WhisprSpace's own editorial pickup (§12.2). An author does not need to opt into anything WhisprSpace-related in order to export and post their own story to their own personal pages.

### 12.2 WhisprSpace editorial pickup (separate, gated, complementary)

Independent of whether an author self-exports, WhisprSpace's own team may separately choose to feature a story on WhisprSpace's own channels, subject to the consent captured at submission (§10) and editorial judgment (§9.2). This path exists specifically for stories that deserve reach but whose author either doesn't have an audience of their own to post to, or simply doesn't export it themselves — it is a complement that extends reach where self-export wouldn't otherwise happen, not a control point in front of the author's own right to share their own story.

One addition worth calling out for this path specifically: a consistent **weekly episode-release cadence gives WhisprSpace's own external content calendar a natural, honest anchor** ("new episode Friday") — real, non-fabricated material generated by the feature itself, addressing the earlier problem of WhisprSpace's own channels having nothing authentic to post absent creator cooperation.

No new rendering infrastructure is required for either path — both reuse the existing export pipeline unchanged.

---

## 13. Open Positioning Question: Is Stories the Front Door?

Not resolved in this spec, flagged explicitly so it's a deliberate decision rather than something the app's navigation drifts into by accident: given that Stories directly addresses the "nothing for a cold visitor to do" gap identified in the Ongea research, there's a real case for making it the first thing an unauthenticated visitor sees, rather than a section reached a few taps into navigation. This is a positioning call for product/founder judgment, not something to settle here.

---

## 14. Build Phases

**Phase 1 — Core Stories**
- Lived/Written family structure, five categories, submission flow
- No-auth one-shot submission (§6.1)
- Anonymous-session submission for Live Stories (§6.2)
- **Submission confirmation screen (§6.3)** — must ship in Phase 1, not later: it's the only guaranteed contact point for no-auth posters, so it has to exist from day one to capture both self-export access and WhisprSpace-pickup consent at the moment of submission, even though the pickup workflow itself (Phase 4) doesn't exist yet. Consent captured here is simply stored until Phase 4 gives it something to be used for.
- Baseline moderation gate (§9.1) — launch-blocking, not deferrable
- Feed display with family/category tagging (§11)
- Discussion via existing thread/Reply-Publicly mechanics (§8)
- **Author self-export (§12.1)** — belongs in Phase 1, not bundled with editorial work later: it needs nothing beyond a story having passed moderation and the existing export pipeline hooked up to story content.

**Phase 2 — Episodic Mode**
- Opt-in episodic structure for Live Stories and Fiction
- Author's story page / profile view showing episode history
- Cadence label (non-enforced) display

**Phase 3 — Follow & Notify**
- Story-level follow mechanic
- New notification trigger type, reusing existing notification infrastructure

**Phase 4 — WhisprSpace Editorial Pickup**
- Internal editorial pickup workflow (§9.2), reading the consent already captured back in Phase 1 (§10) — no new consent UI needed at this stage, since it was never deferred
- Editorial-pickup path of the export integration (§12.2) — the self-export path is already live from Phase 1

Phase 1 alone already closes the Ongea front-door gap, gives WhisprSpace real internal content, and lets every author share their own story on their own pages. Phases 2–4 add serialization, retention, and WhisprSpace's own publishing reach on top of that foundation.

---

## 15. Risks & Open Questions

| Risk / Question | Note |
|---|---|
| Episodic stories sharing one thread vs. per-episode threads (§8) | Needs a product decision during design; both are technically supportable, this spec doesn't prescribe which |
| Abandoned episodic series accumulate in the feed indefinitely | Not necessarily a problem, but worth monitoring feed composition over time — may need a "still active" filter if stalled series crowd out live ones |
| Fiction submitted as if it were Lived content (mislabeling) | Baseline moderation doesn't verify truthfulness — the Lived/Written split relies on honest self-labeling at submission; consider a lightweight confirmation step at submission for Lived categories specifically |
| Editorial pickup criteria are undefined | §9.2 establishes that the gate exists; the actual judgment criteria for what's "good enough to feature externally" needs to be written as a separate, short internal guideline before Phase 4 |
| Follow/notify volume at scale | Not a v1 concern given expected early volume, but worth flagging for later: a popular episodic story could generate meaningful notification load — standard existing infrastructure should absorb this, confirm with engineering before Phase 3 |

## 16. Explicitly Out of Scope for v1

- Person-level following or any visible social graph.
- System-enforced release schedules or any pressure/reminder mechanic directed at authors.
- AI-generated or AI-summarized content in any part of this feature.
- Monetization of Stories specifically (no premium Stories tier proposed here — if this becomes worth pursuing, it deserves its own review against the existing premium thread model rather than being bolted on here).
- Cross-posting automation to external platforms via API — external publication remains a manual, team-curated action (§9.2), not automated posting.
