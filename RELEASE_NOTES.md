# Release Notes

This file tracks production releases for `prod`.
Keep entries concise: `Feature Highlights` + `Major DB Changes` only.

## Release Template

- Date (UTC): YYYY-MM-DD
- Version/Tag: vX.Y.Z
- PR: #<number>

### Feature Highlights
- 

### Major DB Changes
- None

### Notes (optional)
- 

---

## 2026-03-03
- Date (UTC): 2026-03-03
- Version/Tag: pending
- PR: pending

### Feature Highlights
- Release note tracking initialized.

### Major DB Changes
- None

---

## 2026-03-04
- Date (UTC): 2026-03-04
- Version/Tag: pending
- PR: pending (`dev -> prod`)

### Feature Highlights
- Flutterwave is now the only active payment provider.
- SEO launch updates added for indexing and crawler discovery.
- Thread/profile UX improvements finalized for release.
- Security hardening added for auth/webhook/payment surfaces.

### Major DB Changes
- `20260303091500_add_webhook_event_receipts.sql`: adds webhook event receipt tracking for idempotency/replay protection.
- `20260303103000_harden_financial_rls.sql`: tightens financial table RLS/grants to `service_role` for writes.
- `20260118000000_storage_setup.sql`: migration compatibility adjustment for hosted Supabase ownership constraints.

### Notes (optional)
- PostHog remains the active analytics platform.
