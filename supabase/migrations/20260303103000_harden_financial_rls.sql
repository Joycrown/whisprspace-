-- Harden RLS and grants for payment/webhook security-critical tables.
-- This is intentionally scoped to high-risk tables to reduce migration blast radius.

BEGIN;

-- ============================================
-- PAYMENTS
-- ============================================
DROP POLICY IF EXISTS "System can create payments" ON public.payments;
DROP POLICY IF EXISTS "System can update payments" ON public.payments;

CREATE POLICY "Service role can create payments"
ON public.payments
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can update payments"
ON public.payments
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================
-- CREATOR EARNINGS
-- ============================================
DROP POLICY IF EXISTS "System can create earnings" ON public.creator_earnings;
DROP POLICY IF EXISTS "System can update earnings" ON public.creator_earnings;

CREATE POLICY "Service role can create earnings"
ON public.creator_earnings
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can update earnings"
ON public.creator_earnings
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================
-- POINT TRANSACTIONS
-- ============================================
DROP POLICY IF EXISTS "System can create point transactions" ON public.point_transactions;

CREATE POLICY "Service role can create point transactions"
ON public.point_transactions
FOR INSERT
TO service_role
WITH CHECK (true);

-- ============================================
-- USER ACHIEVEMENTS
-- ============================================
DROP POLICY IF EXISTS "System can award achievements" ON public.user_achievements;

CREATE POLICY "Service role can award achievements"
ON public.user_achievements
FOR INSERT
TO service_role
WITH CHECK (true);

-- ============================================
-- TRANSACTION LEDGER
-- ============================================
DROP POLICY IF EXISTS "System can create ledger" ON public.transaction_ledger;
DROP POLICY IF EXISTS "System can update ledger" ON public.transaction_ledger;

CREATE POLICY "Service role can create ledger"
ON public.transaction_ledger
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY "Service role can update ledger"
ON public.transaction_ledger
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================
-- WEBHOOK EVENT RECEIPTS
-- ============================================
DROP POLICY IF EXISTS "System can manage webhook event receipts" ON public.webhook_event_receipts;

CREATE POLICY "Service role can manage webhook event receipts"
ON public.webhook_event_receipts
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================================
-- TABLE PRIVILEGES
-- ============================================
-- Remove broad client-role write access from critical tables.
REVOKE ALL ON TABLE public.payments FROM anon, authenticated;
REVOKE ALL ON TABLE public.creator_earnings FROM anon, authenticated;
REVOKE ALL ON TABLE public.point_transactions FROM anon, authenticated;
REVOKE ALL ON TABLE public.user_achievements FROM anon, authenticated;
REVOKE ALL ON TABLE public.transaction_ledger FROM anon, authenticated;
REVOKE ALL ON TABLE public.webhook_event_receipts FROM anon, authenticated;

-- Allow authenticated reads where existing RLS policies already scope visibility.
GRANT SELECT ON TABLE public.payments TO authenticated;
GRANT SELECT ON TABLE public.creator_earnings TO authenticated;
GRANT SELECT ON TABLE public.point_transactions TO authenticated;
GRANT SELECT ON TABLE public.user_achievements TO authenticated;
GRANT SELECT ON TABLE public.transaction_ledger TO authenticated;

-- Ensure service_role retains full access for backend/webhook operations.
GRANT ALL ON TABLE public.payments TO service_role;
GRANT ALL ON TABLE public.creator_earnings TO service_role;
GRANT ALL ON TABLE public.point_transactions TO service_role;
GRANT ALL ON TABLE public.user_achievements TO service_role;
GRANT ALL ON TABLE public.transaction_ledger TO service_role;
GRANT ALL ON TABLE public.webhook_event_receipts TO service_role;

COMMIT;
