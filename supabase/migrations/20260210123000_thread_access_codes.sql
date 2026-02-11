-- ============================================
-- Premium Thread Partner Access Codes
-- Two permanent codes per premium thread
-- ============================================

-- 1) Table to store access codes
CREATE TABLE IF NOT EXISTS public.thread_access_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID REFERENCES public.threads(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  max_uses INTEGER NOT NULL DEFAULT 1,
  current_uses INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_thread_access_codes_thread
  ON public.thread_access_codes(thread_id);

CREATE INDEX IF NOT EXISTS idx_thread_access_codes_active
  ON public.thread_access_codes(thread_id, is_active);

ALTER TABLE public.thread_access_codes ENABLE ROW LEVEL SECURITY;

-- 2) Policies: creators can view/manage their codes
CREATE POLICY "Creators can view access codes"
ON public.thread_access_codes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.threads t
    WHERE t.id = thread_access_codes.thread_id
      AND t.creator_id = auth.uid()
  )
);

CREATE POLICY "Creators can insert access codes"
ON public.thread_access_codes FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.threads t
    WHERE t.id = thread_access_codes.thread_id
      AND t.creator_id = auth.uid()
  )
);

CREATE POLICY "Creators can update access codes"
ON public.thread_access_codes FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.threads t
    WHERE t.id = thread_access_codes.thread_id
      AND t.creator_id = auth.uid()
  )
);

-- 3) Create access code (limit 2 active codes)
CREATE OR REPLACE FUNCTION public.create_thread_access_code(p_thread_id UUID)
RETURNS TABLE (
  code TEXT,
  max_uses INTEGER,
  current_uses INTEGER,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator_id UUID;
  v_is_premium BOOLEAN;
  v_active_count INTEGER;
  v_code TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT creator_id, is_premium
  INTO v_creator_id, v_is_premium
  FROM public.threads
  WHERE id = p_thread_id;

  IF v_creator_id IS NULL THEN
    RAISE EXCEPTION 'Thread not found';
  END IF;

  IF v_creator_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only the thread creator can generate access codes';
  END IF;

  IF COALESCE(v_is_premium, FALSE) = FALSE THEN
    RAISE EXCEPTION 'Access codes are only available for premium threads';
  END IF;

  SELECT COUNT(*)
  INTO v_active_count
  FROM public.thread_access_codes
  WHERE thread_id = p_thread_id
    AND is_active = TRUE
    AND current_uses < max_uses;

  IF v_active_count >= 2 THEN
    RAISE EXCEPTION 'Access code limit reached';
  END IF;

  v_code := UPPER('PARTNER' || TO_CHAR(NOW(), 'YYYY') ||
           SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 6));

  INSERT INTO public.thread_access_codes (
    thread_id,
    code,
    max_uses,
    current_uses,
    is_active,
    created_by
  ) VALUES (
    p_thread_id,
    v_code,
    1,
    0,
    TRUE,
    auth.uid()
  )
  RETURNING thread_access_codes.code,
            thread_access_codes.max_uses,
            thread_access_codes.current_uses,
            thread_access_codes.is_active,
            thread_access_codes.created_at
  INTO code, max_uses, current_uses, is_active, created_at;

  RETURN NEXT;
END;
$$;

-- 4) Revoke access code (creator only)
CREATE OR REPLACE FUNCTION public.revoke_thread_access_code(
  p_thread_id UUID,
  p_code TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT creator_id INTO v_creator_id
  FROM public.threads
  WHERE id = p_thread_id;

  IF v_creator_id IS NULL THEN
    RAISE EXCEPTION 'Thread not found';
  END IF;

  IF v_creator_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only the thread creator can revoke access codes';
  END IF;

  UPDATE public.thread_access_codes
  SET is_active = FALSE
  WHERE thread_id = p_thread_id
    AND code = UPPER(p_code);

  RETURN TRUE;
END;
$$;

-- 5) Redeem access code (grant free access)
CREATE OR REPLACE FUNCTION public.redeem_thread_access_code(
  p_thread_id UUID,
  p_code TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code_record public.thread_access_codes%ROWTYPE;
  v_inserted INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF public.is_thread_banned(p_thread_id, auth.uid()) THEN
    RAISE EXCEPTION 'You are banned from this thread';
  END IF;

  SELECT *
  INTO v_code_record
  FROM public.thread_access_codes
  WHERE thread_id = p_thread_id
    AND code = UPPER(p_code)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid access code';
  END IF;

  IF v_code_record.is_active = FALSE OR v_code_record.current_uses >= v_code_record.max_uses THEN
    RAISE EXCEPTION 'Access code has been fully used';
  END IF;

  INSERT INTO public.thread_purchases (thread_id, user_id, amount)
  VALUES (p_thread_id, auth.uid(), 0)
  ON CONFLICT (thread_id, user_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF v_inserted > 0 THEN
    UPDATE public.thread_access_codes
    SET current_uses = current_uses + 1,
        is_active = CASE
          WHEN current_uses + 1 >= max_uses THEN FALSE
          ELSE TRUE
        END
    WHERE id = v_code_record.id;
  END IF;

  RETURN TRUE;
END;
$$;
