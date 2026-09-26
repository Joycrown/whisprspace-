# WhisprSpace Stories: Implementation Plan

**Spec:** `whisprspace-stories-spec.md` (v1.0)
**Status:** Phases 1–3 built. Phase 4 (editorial pickup) is documented only; its consent data is captured from day one.
**Infra constraints:** Vercel Hobby and Supabase Free. Database connections and Vercel ISR/edge quotas are the real limits. Every design choice below starts from them.

---

## 1. Decisions that change the spec

| Area | Spec says | Built as | Why |
|---|---|---|---|
| Family names | Lived / Written | **True Story** / **Fiction & Poetry** | Plain language. Avoids "Live" colliding with the Live Stories category and the live marker |
| Writing-screen framing | "Goes public… No name. No trace." style | *"Shared anonymously. Readers can relate, reply, and join the conversation."* | Makes going public sound like the point, not a warning |
| Social-feature consent | Captured on the confirmation screen | A **consent step at the moment of submission** (after writing, when the user taps Share my story): "WhisprSpace may share this on her socials", with **I agree & share my story** as the main button and **Share without featuring** as a text link. Either choice submits the story | One moment. An active choice satisfies §10 and data-protection law without the friction of a separate screen |
| Baseline moderation (§9.1) | Blocklist before publishing, non-negotiable | **No automated text checks on stories.** No blocklist, no personal-details scan, no "sensitive themes" toggle and no "this really happened to me" confirmation for writers. Admins can still mark a story sensitive, which adds a content-warning screen. Readers can report (including "shares someone's personal details"); 3 reports auto-hide a story for admin review | Product decision: keep telling friction-free and rely on reader reports plus the admin review queue |
| Blocklist on replies | Client-side only today | Enforced **server-side** on every story reply | Replies are where people talk to each other |
| Account model (§6.2, §8) | Anonymous session for Live Stories, episodic stories, replying | **Full account** for Live Stories, any episodic story, replying and following. One-shot Regrets, Bad Experiences, Poetry and Fiction need nothing | Authors can't lose their story. Followers are reachable by email. Every reply is a sign-up moment |
| Episodic discussion (§8) | Undecided | **One continuing thread per story** | Small early audiences stay in one place, with one URL and one thing to follow |
| Author badge | n/a | **None.** Storyteller replies look like everyone else's. The thread "creator" pill and "Owner" label never appear in story threads | Anonymity |
| Front door (§13) | Undecided | **Stories is the front door.** `app.whisprspace.com/` shows the Stories feed. `whisprspace.com/` leads with a live Stories strip and a "Read stories" button | Closes the Ongea cold-visitor gap |
| "Live Stories" category | Live Stories | Renamed **Everyday Events** (internal key stays `live_story`). Always episodic, no toggle | Clearer name; the category only makes sense as something you keep adding to |
| Ongoing episodic stories | Unlimited | **Free accounts: 2 ongoing episodic stories** (Everyday Events + episodic Fiction). Premium: unlimited. Finishing one frees a slot; reopening a finished story counts again. One-off stories are unlimited. Enforced server-side on create and reopen; the composer shows the limit with links to the ongoing stories and a Go Premium button | Monetisation lever and keeps serials meaningful |
| Team stories | n/a | Team members may post **their own** true experiences through the normal flow with real accounts, flagged internally `is_team` | Honest cold start. Never composites, never seed accounts, never fake engagement |

## 2. Domains and front door

One repo, two Vercel deployments (`next.config.ts`):

- **app.whisprspace.com** (`DEPLOYMENT_TARGET=app`): `/` renders the Stories feed. The old redirect to `/auth` applies only when `NEXT_PUBLIC_STORIES_FRONT_DOOR=off`, which is the instant rollback switch.
- **whisprspace.com** (marketing): `/` leads with the headline, a strip of the latest 6 stories (cached) and a **Read stories** button. The existing marketing content sits below it.
- Every story's canonical URL is on `app.whisprspace.com`, where sign-in, replies and follows live.
- Signed-in users on `/` are no longer pushed to `/threads`. The navigation gains **Stories** as its first item.

## 3. Data model

Migration: `supabase/migrations/20260924100000_stories.sql`

| Object | Purpose |
|---|---|
| `stories` | title, category, `family` (generated from category, so it can never be mislabelled), is_episodic, cadence_label, status (`ongoing`/`finished`), is_sensitive, moderation_status (`visible`/`hidden`/`removed`), feature_consent and when it was given, is_team, **server-only** author_user_id / sender_token_hash / ip_hash, thread_id, excerpt, and stored counts: episode_count, reply_count, follower_count, report_count, last_episode_at |
| `story_episodes` | story_id, episode_number, body, published_at. A one-shot story is episode 1 |
| `story_follows` | (story_id, user_id) |
| `story_reports` | One report per story per reporter (a user id or a hashed sender token). 3 reports hide the story |
| `threads.story_id` | Links the discussion thread. `/threads/[id]` redirects to the story page, so every existing notification link lands on the story |
| System user | `ANON_SYSTEM_STORIES` owns every story thread, so authors are never linked to a thread |

Story threads have `expires_at = NULL` and `is_saved = false`. They are therefore permanent and never picked up by the expiry or purge jobs, which all require a non-null expiry.

All tables have RLS on with **no client policies**. Every read and write goes through server code with the service role.

## 4. Performance and scaling design

The goal is to keep Supabase connections and Vercel quotas flat as traffic grows.

**Database**
- **One round trip per screen**, through purpose-built database functions:
  - `get_story_feed` returns a feed page.
  - `get_story_page` returns a story with all its episodes as JSON.
  - `get_story_replies` returns one page of the discussion.
- **Keyset (position-based) pagination** everywhere, never `OFFSET`. Each sort order has a matching partial index restricted to `moderation_status='visible' AND deleted_at IS NULL`.
- **Stored counts.** `reply_count`, `follower_count` and `episode_count` are kept up to date by triggers, so listing stories never counts rows or joins. The feed reads only a stored 280-character `excerpt`, never full story bodies.
- **Sender anonymity in the database.** Replies return a per-thread avatar seed (`md5(thread_id || sender_id)`), never `sender_id`.
- **Rate-limit checks use indexed columns** (`ip_hash, created_at`, `author_user_id, created_at`). Hashes are hex-validated before they reach a filter string.
- **Notification fan-out** for a new episode is a single `INSERT … SELECT` to all followers. Since the app-wide performance pass (`20260924130000_performance_pass.sql`), push is triggered once per insert statement rather than once per row, and the sweeper claims work atomically. A story with 2,000 followers therefore makes one serverless call, not 2,000.

**Caching (Vercel)**
- The feed (`/`, `/stories`) is regenerated at most every 60 seconds, plus instantly when a story publishes, gets an episode or has its moderation status changed (tag-based `revalidateTag`).
- Story pages are regenerated at most every 10 minutes, plus instantly when they change. Pages never read cookies, headers or search params, which would force a fresh build per visitor.
- Public data endpoints live under `/api/public/*` with `Cache-Control: s-maxage` and `stale-while-revalidate`, so filtered feed pages and discussion pages are served from Vercel's edge cache. `next.config.ts` excludes `/api/public/*` from the blanket `no-store` rule.
- Anything per viewer (am I following, am I the author) comes from one small authenticated call, made only for signed-in users.

**Frontend**
- Story text is server-rendered with no client JavaScript. The only interactive parts are the actions bar, the discussion and the feed filters.
- The discussion loads **only when the reader scrolls near it** (IntersectionObserver), so readers who never scroll cost no request.
- Story card links use `prefetch={false}`. Otherwise a feed of 20 cards spends 20 cached-page reads per visitor who opens nothing.
- Cards use `content-visibility: auto` and are memoized. The feed has no animation library.
- Filter and sort changes fetch cached public pages. Previously loaded pages are kept in memory so switching back costs nothing.
- Signed-out visitors open no live-update (realtime) connections. The 2-minute `seed-trigger` background call is skipped for signed-out visitors on Stories pages.

## 5. Routes

| Route | Access | Purpose |
|---|---|---|
| `/`, `/stories` | Public, regenerated every 60s | Feed |
| `/stories/new` | Public; account required for Live Stories and episodic stories | Category, then consent, then write, then confirmation |
| `/stories/[slug]` | Public, regenerated every 10 min | Story, episodes, discussion |
| `/stories/[slug]/manage` | Author only | Add episode, cadence, finished, consent, export |
| `/stories/[slug]/og` | Public | 1200×630 share card (Node route with Content-Length, so WhatsApp shows it) |
| `POST /api/stories` | Public / registered | Create a story |
| `GET /api/public/stories` | Edge-cached | Feed pages (filter, sort, cursor) |
| `GET /api/public/stories/[id]/replies` | Edge-cached | Discussion pages |
| `POST /api/stories/[id]/replies` | Registered | Reply (server-side blocklist, rate limit) |
| `GET /api/stories/[id]/viewer` | Signed-in | Viewer state for the current user |
| `POST/DELETE /api/stories/[id]/follow` | Registered | Follow or unfollow |
| `POST /api/stories/[id]/episodes` | Author | New episode, notifies followers |
| `PATCH /api/stories/[id]` | Author | Cadence, status, consent |
| `POST /api/stories/[id]/report` | Anyone | Report |
| `GET /api/admin/stories`, `POST /api/admin/stories/[id]` | Admin | Review queue: hide, restore, remove |

## 6. Notifications

- `story_episode`: sent to followers when an episode publishes. In-app and push (batched). Opens the story.
- `story_reply`: sent to the author when someone else replies to their story.
- Push and in-app routing both handle `story_id`. Anything still linking to `/threads/[id]` for a story thread redirects to the story page.

## 7. Export (§12.1)

- `StoryExport` and `StorySlide` use the existing html-to-image pipeline and slide design.
- Slide layout: a cover (title, family and category tags); the story body split across slides by a length-based text chunker; a call-to-action slide.
- The family tag is on **every** slide.
- No-auth submitters export from the confirmation screen, the only chance they get. Authors with accounts export any time from the manage page.
- Free tier: up to 6 body slides. Premium: up to 12.

## 8. Rollout

1. Apply the migration. Set `NEXT_PUBLIC_ENABLE_INDEXING` for the app deployment when you want search traffic.
2. The team posts its own Fiction & Poetry and true stories through the normal flow. An admin sets `is_team = true` on them in the database.
3. Stories is live at `/` on launch. `NEXT_PUBLIC_STORIES_FRONT_DOOR=off` reverts to the auth screen instantly.
4. Set Vercel usage alerts at 50% and 80%. Check the Usage tab weekly during launch. Move to Pro if Stories takes off; that also resolves Hobby's non-commercial clause.
5. Measure in PostHog: `story_submitted`, `story_opened`, `story_reply_posted`, `story_followed`, `story_signup_prompt_shown`, `story_export_generated`.

## 9. Phase 4 (not built): editorial pickup

- An admin queue filtered to `feature_consent = true AND moderation_status = 'visible'`. The admin Stories tab already shows the consent flag.
- A `story_pickups` log: story, episode, channel, admin, date. Consent is checked again when a story is picked up, so a revocation is always respected.
- Write the internal pickup criteria before building it (spec §15).

## 10. Known follow-ups outside Stories

- `app/api/inbox/send` trusts `senderUserId` from the request body. It should use the verified session instead (needs a client change to send the bearer token).
- `app/api/admin/health` is unauthenticated.
- Thread pages set their canonical URL on `whisprspace.com`, while prompts, inbox and stories use `app.whisprspace.com`.
- In-app notifications for `prompt_response` have no click-through route.
- App-wide query optimization pass (threads, inbox, DMs) as a separate piece of work.
