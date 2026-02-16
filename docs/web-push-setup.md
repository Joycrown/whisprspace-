# Native Web Push Setup (No OneSignal)

## 1) Generate VAPID keys
Run:

```bash
npm run generate:vapid
```

Add output values to your env:

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (example: `mailto:support@whisprspace.com`)

## 2) Ensure server secrets exist
Required for push dispatch API and cron route:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET` (recommended)
- `PUSH_DISPATCH_SECRET` (for webhook-secured instant dispatch)

## 3) Run database migration
Apply the migration that adds:

- `public.push_subscriptions`
- `notifications.push_sent_at`
- `thread_message` notifications for thread participants
- `direct_message` notifications for DM recipients

Migration file:

- `supabase/migrations/20260216190000_add_web_push_notifications.sql`
- `supabase/migrations/20260216213000_add_thread_participant_message_notifications.sql`
- `supabase/migrations/20260216224500_add_direct_message_notifications.sql`

## 4) Deploy
`vercel.json` includes minute cron dispatch:

- `GET /api/cron/push-dispatch`

This dispatches push messages for new notification rows.

Optional for instant dispatch (recommended):

- Configure a Supabase Database Webhook on `public.notifications` INSERT
- Target: `POST /api/push/dispatch`
- Set header: `x-push-dispatch-secret: <PUSH_DISPATCH_SECRET>`

Use the SQL-side auto-dispatch migration (hands-off):

- `supabase/migrations/20260216193000_auto_dispatch_push_webhook.sql`
- `supabase/migrations/20260216200000_push_dispatch_config_fallback.sql`

Then set config once per environment (table fallback, works on hosted Supabase):

```sql
INSERT INTO public.app_runtime_config(key, value)
VALUES ('push_dispatch_url', 'https://your-domain.com/api/push/dispatch')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, updated_at = NOW();

INSERT INTO public.app_runtime_config(key, value)
VALUES ('push_dispatch_secret', 'your-shared-secret')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value, updated_at = NOW();
```

Use the same secret value as app env `PUSH_DISPATCH_SECRET`.

If your role allows DB settings, you can still use:

```sql
ALTER DATABASE postgres SET app.settings.push_dispatch_url = 'https://your-domain.com/api/push/dispatch';
ALTER DATABASE postgres SET app.settings.push_dispatch_secret = 'your-shared-secret';
```

## 5) User enablement flow
Users enable push in:

- Profile -> Notification Preferences -> Manage Push Notification Settings

They can also send a test push from the same modal.

## 6) Push coverage
Push dispatch is notification-row driven. Current notification sources include:

- `thread_like`
- `message_reply`
- `mention`
- `group_invite`
- `thread_invite`
- `achievement_unlocked`
- `poll_ending_soon`
- `thread_expiring_soon`
- `thread_message` (new messages for users in `thread_participants`)
- `direct_message` (new messages for users in `conversation_participants`)

`mention` supports tagging by `@username` and `@ANON_12345678`.
