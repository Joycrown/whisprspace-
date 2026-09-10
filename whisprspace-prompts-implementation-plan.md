# Prompts & Export Pipeline — Implementation Plan

Companion to `whisprspace-prompts-export-pipeline-spec.md`. The spec defines behavior;
this defines the build. Written against the existing codebase.

**Sequencing decision (agreed):** Open mode ships as **Phase 1b**, after Private mode.
The §9 decision gate (prompt-specific CTA vs. generic CTA conversion) is measurable with
Private mode alone, so the §6.2/6.3/6.4 safety surface is not built before there is usage
to justify it.

---

## 0. What this reuses

Almost nothing here is new infrastructure. The mapping:

| Need | Existing asset |
|---|---|
| Anonymous no-account send + rate limit | `app/api/inbox/send/route.ts`, `inbox_send_log`, `whs_sit` cookie |
| Moderation | `lib/moderation/blocklist.ts` (`containsBlockedContent`, synchronous) |
| Landing page + OG | `app/message/[handle]/page.tsx`, `app/message/[handle]/og/route.tsx` |
| Image export | `html-to-image` (`ThreadSummaryCard.tsx`, `lib/hooks/useInboxShare.ts`) |
| Anonymized content → thread | `app/api/threads/import-inbox-messages/route.ts` (`ANON_SYSTEM_INBOX`) |
| Expiry + cleanup | pg_cron pattern, `CRON_SECRET` header on `/api/cron/*` |
| Server auth | `lib/security/request-auth.ts` (`resolveUserFromRequest`) |
| Input hygiene | `lib/security/input-sanitization.ts`, `lib/security/crypto.ts` (`sha256Hex`) |

---

## 1. Data model

Two tables. Rationale for the boundaries is in §1.4.

### 1.1 `prompts`

```sql
CREATE TYPE prompt_mode AS ENUM ('private', 'open');

CREATE TABLE prompts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  question            TEXT NOT NULL CHECK (char_length(question) BETWEEN 3 AND 280),
  mode                prompt_mode NOT NULL DEFAULT 'private',
  category            TEXT NOT NULL DEFAULT 'general',
  library_key         TEXT,           -- set when adopted from the static library
  source_prompt_id    UUID REFERENCES prompts(id) ON DELETE SET NULL,  -- §8 traceability
  response_count      INTEGER NOT NULL DEFAULT 0,
  expires_at          TIMESTAMPTZ NOT NULL,
  converted_thread_id UUID REFERENCES threads(id) ON DELETE SET NULL,
  archived_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at          TIMESTAMPTZ
);
```

Indexes:
```sql
CREATE INDEX idx_prompts_creator     ON prompts(creator_id, created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_prompts_expiry      ON prompts(expires_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_prompts_source      ON prompts(source_prompt_id) WHERE source_prompt_id IS NOT NULL;
```

`source_prompt_id` is the entire Prompt-of-the-Week (§8) traceability mechanism — one
nullable self-reference, costing nothing now, making the Sunday recap a single query
later. Included in Phase 1 precisely because adding it retroactively means a backfill.

### 1.2 `prompt_responses`

```sql
CREATE TYPE moderation_status AS ENUM ('passed', 'blocked');

CREATE TABLE prompt_responses (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id         UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  content           TEXT NOT NULL CHECK (char_length(content) <= 500),
  moderation_status moderation_status NOT NULL DEFAULT 'passed',
  is_starred        BOOLEAN NOT NULL DEFAULT FALSE,
  sender_token_hash TEXT,      -- sha256(whs_sit); rate limit + Phase 1b unlock ONLY
  ip_hash           TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prompt_responses_prompt
  ON prompt_responses(prompt_id, created_at DESC)
  WHERE moderation_status = 'passed';

CREATE INDEX idx_prompt_responses_starred
  ON prompt_responses(prompt_id) WHERE is_starred = TRUE;

CREATE INDEX idx_prompt_responses_rate_limit
  ON prompt_responses(prompt_id, created_at DESC);
```

**No `sender_id` column, by design.** §6.4 forbids persistent pseudonymous identity for
prompt respondents. Storing only a *hashed* token means there is no join path that
correlates a sender across responses, and no foreign key to a user. This is the schema
enforcing the constraint rather than a convention that a future PR can quietly break.

### 1.3 RLS

```sql
ALTER TABLE prompts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_responses  ENABLE ROW LEVEL SECURITY;

-- Creator manages own prompts
CREATE POLICY "creator_reads_own_prompts"   ON prompts FOR SELECT USING (auth.uid() = creator_id);
CREATE POLICY "creator_updates_own_prompts" ON prompts FOR UPDATE
  USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);

-- §4.1, non-negotiable: responses are readable ONLY by the owning creator.
CREATE POLICY "creator_reads_own_prompt_responses"
  ON prompt_responses FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM prompts p
    WHERE p.id = prompt_responses.prompt_id AND p.creator_id = auth.uid()
  ));

CREATE POLICY "creator_stars_own_prompt_responses"
  ON prompt_responses FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM prompts p
    WHERE p.id = prompt_responses.prompt_id AND p.creator_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM prompts p
    WHERE p.id = prompt_responses.prompt_id AND p.creator_id = auth.uid()
  ));
```

No INSERT policy on `prompt_responses` — writes are service-role only, exactly as
`inbox_send_log` and `thread_summaries` already do. The landing page is unauthenticated,
so the API route is the only writer.

The landing page needs `question`, `response_count`, `expires_at` for a prompt it cannot
read under the policies above. Rather than loosen prompt SELECT to `anon`, the landing
page is **server-rendered** and reads via the service-role client, returning only those
three fields. This keeps the public read surface an explicit allowlist in one file
instead of an RLS policy that future columns silently join.

### 1.4 Why not reuse `conversations` / `direct_messages`

Tempting, since the inbox loop already does anonymous one-off delivery. Rejected because
`direct_messages` carries `sender_id`, read receipts, DM retention cron, realtime
subscriptions, and a DM RLS policy surface that has been revised at least six times
(see migrations `2026-02-12`, `2026-07-26`, `2026-07-31`, `2026-09-05`, `2026-09-06`).
Prompt responses need none of it and must satisfy a stricter invariant. Overloading that
table would mean every future DM policy change carries prompt-response leak risk.
A narrow table makes §4.1 one reviewable policy.

### 1.5 Triggers & cleanup

`response_count` is denormalized (mirroring `threads.message_count`) because the landing
page counter is the highest-traffic *unauthenticated* query in the app, and DB concurrency
— not storage — is the Supabase Free bottleneck.

```sql
CREATE FUNCTION bump_prompt_response_count() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.moderation_status = 'passed' THEN
    UPDATE prompts SET response_count = response_count + 1 WHERE id = NEW.prompt_id;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
```

**Cleanup — scheduled in the same migration as the function, not a follow-up.** (Recurring
past failure: cleanup written, never scheduled.)

- Blocked responses purged after 30 days (audit window, then gone).
- Responses of soft-deleted prompts purged after 30 days.
- `cron.schedule('prompt-responses-cleanup', '30 3 * * *', ...)` guarded by the same
  `IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron')` block used elsewhere.

---

## 2. Phase 1 — Prompt core (Private mode)

### 2.1 Migration
`supabase/migrations/<ts>_prompts_core.sql` — everything in §1 as one unit.

### 2.2 Prompt library (static, no DB)
`lib/prompts/library.ts` — a typed constant array, 50–75 entries, `{ key, question,
category, personas[] }`. §4.3 calls library expansion a content task, not an engineering
one; a TS constant ships with the app, needs no query, no migration, and no cache. The
`library_key` column records which entry a prompt came from, for §9 analytics.

### 2.3 API routes

**`POST /api/prompts`** (auth: `resolveUserFromRequest`)
Creates a prompt. Sanitize `question` via `sanitizeSingleLineInput`, `category`/`mode`
via `sanitizeEnumValue`. Duration is a fixed enum (24h/48h/7d, §4.2) mapped server-side to
`expires_at` — never accept a client-supplied timestamp. Run `containsBlockedContent` on
the question (§6.1). Cap active prompts per creator (suggest 10) to bound abuse.

**`GET /api/prompts`** — creator's own prompts, for the inbox grouping (§4.6).

**`POST /api/prompts/[id]/responses`** — **the one high-traffic public route.**
Modeled directly on `app/api/inbox/send/route.ts`:
1. Load prompt via service role; 404 if missing/deleted, 410 if `expires_at` passed.
2. Trim, length-check (≤500).
3. `containsBlockedContent` → on hit, **store with `moderation_status='blocked'`** and
   return the same neutral success shape. Storing rather than discarding preserves the
   §6.1 tuning signal; the creator never sees it (§4.6) and the count never includes it.
4. Rate limit: reuse the `whs_sit` cookie and `sha256Hex(ip)`. Query
   `prompt_responses` on `(prompt_id, created_at)` — 3/hour per prompt per token-or-IP.
   Fail open on DB error, matching the inbox route's existing posture.
5. Insert via service role; trigger bumps the count.

**`PATCH /api/prompts/[id]/responses/[responseId]`** — toggle `is_starred` (Phase 2).

### 2.4 Landing page — `app/prompts/[id]/page.tsx`
Server component, mirroring `app/message/[handle]/page.tsx` including its `robots`
posture and OG-version bump convention. Renders question as headline (§4.4), response box,
countdown, and the counter **only when `response_count >= 5`** (§4.4 floor).

`app/prompts/[id]/og/route.tsx` — reuses the Node-runtime + explicit `Content-Length`
pattern from `app/message/[handle]/og/route.tsx`. That is a hard-won WhatsApp fix; it must
not be re-solved as an `opengraph-image.tsx` convention file.

### 2.5 Post-send screen
`components/features/prompts/PromptDrop.tsx`, adapted from `MessageDrop.tsx`.
Locked line "Sent. They'll never know it was you." reused verbatim; CTA replaced with
**"Ask your people the same question"** (§7), routing to
`/auth?force=1&view=signup&reason=prompt`.

The `reason=prompt` param is what makes §9's decision gate measurable — it separates this
funnel from `reason=inbox` in existing analytics. PostHog events mirror the existing
naming: `prompt_created`, `prompt_response_sent`, `prompt_cta_clicked`.

### 2.6 Creation flow
`app/prompts/create/page.tsx` + `components/features/prompts/PromptComposer.tsx`.
Order per §4.2. Mode explainer rendered inline (§4.1.1 — explicitly not a tooltip).
In Phase 1 the Open radio is present but disabled with "Coming soon", so the screen's
information architecture doesn't churn when 1b lands.

---

## 3. Phase 2 — Curation

- Responses grouped under their prompt in the inbox, not mixed into the message stream
  (§4.6). New tab/section in `app/inbox/page.tsx` (already 635 lines — the prompt list
  goes in its own component to avoid growing it further).
- `components/features/prompts/ResponsePicker.tsx` — star toggle per response. Never
  auto-select (§4.6).
- Archive = set `archived_at`; retrieval filters on `category` / `question`.
- Empty state copy from §7: "No responses yet. Share your prompt to get things started."

---

## 4. Phase 1b — Open mode

Deferred; unchanged in scope. When built:
- `prompt_responses.unlocked_by` is **not** added — unlock is derived from
  "this `sender_token_hash` has a passed response to this prompt", requiring no new
  identity column and preserving §6.4.
- Minimum response length before unlock (§11 junk-answer mitigation) — suggest 80 chars.
- Reveal shows `moderation_status='passed'` rows only, labelled "Anonymous", with no
  per-sender identifier, counter, or ordering that could correlate (§6.4).
- Sensitive categories (§6.3) excluded from Open mode at the library level.

---

## 5. Phase 3 — Export pipeline

### 5.1 Layout engine — the only real algorithm here
`lib/prompts/carousel-layout.ts`:

```ts
distributeReplies(replies: string[], ratio: AspectRatio, maxSlides: number): Slide[]
```

Pure, no DOM, no React. Packs 2–3 replies per slide by a text-length budget per ratio
(9:16 tolerates more vertical text than 1:1), so a slide is never cramped or sparse (§5.3).

Being DOM-free is the point: it can be exercised against real content lengths from
`whs_dataset.json` before any rendering exists, turning §11's "render and visually check a
range" from manual eyeballing into a repeatable check. This is the piece most likely to
need iteration, so it must be cheap to iterate.

### 5.2 Rendering
`components/features/prompts/CarouselSlide.tsx` — one component, three ratio variants
(1:1, 4:5, 9:16), each rendered at native size, never cropped (§5.3).
Slide 1 is the upgraded Recap Card (§5.2), so cover and carousel share one design.

Export loops slides through `html-to-image` `toPng` at `pixelRatio: 2` (matching
`ThreadSummaryCard`), zipping or sequentially downloading. **This is client-side**, so
slide count costs no server budget — which independently confirms §5.3's instruction not
to justify tier gating on cost. Free: cover + 3 slides. Premium (`users.is_premium`): 10.

Brand mark on every slide; final slide always carries the link and CTA, identical across
tiers (§5.3).

### 5.3 Text exports
`lib/prompts/text-exports.ts` — pure string formatting, three functions: X thread
(numbered), podcast transcript, caption+hashtag template. Template-based, never
model-generated (§3, §5.3). Cheap; ship with the carousel.

---

## 6. Phase 4 — Open the floor

`POST /api/prompts/[id]/open-floor`. Near-verbatim reuse of
`app/api/threads/import-inbox-messages/route.ts`:
- Same `ANON_SYSTEM_INBOX` resolution + self-heal, so seeded messages are anonymized
  identically and the original responses' hashes never cross over.
- Same one-time-conversion guard, via `prompts.converted_thread_id`.
- Seeds starred responses in starred order (§4.6).
- Per §11, the creator **reconfigures privacy/category at conversion** — private-collection
  defaults must not silently carry into public thread settings.

---

## 7. Test cases worth writing

- §6.5: a `blocked` response can never reach the picker or an export. Explicit test —
  one leaked blocked message in a public export is disproportionate brand risk.
- §4.1: a second creator cannot read another's prompt responses (RLS).
- §4.4: counter hidden below 5, shown at ≥5.
- Expired prompt rejects new responses (410).
- Rate limit triggers at the 4th response within the hour from one token.
- `distributeReplies` across real length distributions from `whs_dataset.json`.

---

## 8. Open items for you

1. **Response max length** — assumed 500, matching inbox. Prompts may warrant longer
   answers (a "confession saga" is the premium carousel's stated use case), but longer text
   makes carousel layout harder. Confirm 500 or raise it.
2. **Prompt cap per creator** — assumed 10 active. Arbitrary; adjust.
3. **Library content** — 50–75 prompts written to the §6.1 standard is a content task.
   I can draft a first pass, or wire the structure and leave the copy to you.
