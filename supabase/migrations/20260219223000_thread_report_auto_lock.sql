-- Thread reporting hardening:
-- 1) Persist report count on threads
-- 2) Auto-lock a thread when reports reach 80% of participants
-- 3) Expose RPC for thread reporting compatible with auth.uid()
-- 4) Block write activities on locked threads

ALTER TABLE public.threads
  ADD COLUMN IF NOT EXISTS report_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.threads
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_content_reports_unique_thread_reporter
  ON public.content_reports (reporter_id, content_id)
  WHERE content_type = 'thread' AND reporter_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.refresh_thread_report_state(p_thread_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_report_count INTEGER := 0;
  v_participant_count INTEGER := 0;
  v_threshold INTEGER := 1;
  v_should_lock BOOLEAN := FALSE;
BEGIN
  IF p_thread_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COUNT(DISTINCT reporter_id)
  INTO v_report_count
  FROM public.content_reports
  WHERE content_type = 'thread'
    AND content_id = p_thread_id
    AND reporter_id IS NOT NULL;

  SELECT COALESCE(t.participant_count, 0)
  INTO v_participant_count
  FROM public.threads t
  WHERE t.id = p_thread_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_threshold := GREATEST(1, CEIL((v_participant_count::NUMERIC) * 0.8)::INTEGER);
  v_should_lock := v_report_count >= v_threshold;

  UPDATE public.threads
  SET
    report_count = v_report_count,
    -- Keep locked once threshold is crossed.
    is_locked = CASE WHEN v_should_lock THEN TRUE ELSE is_locked END
  WHERE id = p_thread_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.on_content_report_changed_refresh_thread_state()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_thread_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.content_type <> 'thread' THEN
      RETURN OLD;
    END IF;
    v_thread_id := OLD.content_id;
  ELSE
    IF NEW.content_type <> 'thread' THEN
      RETURN NEW;
    END IF;
    v_thread_id := NEW.content_id;
  END IF;

  PERFORM public.refresh_thread_report_state(v_thread_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS thread_report_state_on_content_reports ON public.content_reports;
CREATE TRIGGER thread_report_state_on_content_reports
AFTER INSERT OR DELETE OR UPDATE OF content_type, content_id
ON public.content_reports
FOR EACH ROW
EXECUTE FUNCTION public.on_content_report_changed_refresh_thread_state();

CREATE OR REPLACE FUNCTION public.on_thread_participant_count_changed_refresh_report_state()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.participant_count IS DISTINCT FROM OLD.participant_count THEN
    PERFORM public.refresh_thread_report_state(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS thread_report_state_on_participant_count ON public.threads;
CREATE TRIGGER thread_report_state_on_participant_count
AFTER UPDATE OF participant_count
ON public.threads
FOR EACH ROW
EXECUTE FUNCTION public.on_thread_participant_count_changed_refresh_report_state();

CREATE OR REPLACE FUNCTION public.report_thread(
  p_thread_id UUID,
  p_reason public.report_reason,
  p_description TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator_id UUID;
  v_inserted_rows INTEGER := 0;
  v_report_count INTEGER := 0;
  v_participant_count INTEGER := 0;
  v_is_locked BOOLEAN := FALSE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', FALSE, 'error', 'Not authenticated');
  END IF;

  SELECT t.creator_id
  INTO v_creator_id
  FROM public.threads t
  WHERE t.id = p_thread_id;

  IF v_creator_id IS NULL THEN
    RETURN json_build_object('success', FALSE, 'error', 'Thread not found');
  END IF;

  IF NOT public.has_thread_access(p_thread_id, auth.uid()) THEN
    RETURN json_build_object('success', FALSE, 'error', 'Access denied');
  END IF;

  INSERT INTO public.content_reports (
    reporter_id,
    reported_user_id,
    content_type,
    content_id,
    reason,
    description
  )
  VALUES (
    auth.uid(),
    v_creator_id,
    'thread',
    p_thread_id,
    p_reason,
    NULLIF(TRIM(COALESCE(p_description, '')), '')
  )
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_inserted_rows = ROW_COUNT;

  PERFORM public.refresh_thread_report_state(p_thread_id);

  SELECT t.report_count, t.participant_count, t.is_locked
  INTO v_report_count, v_participant_count, v_is_locked
  FROM public.threads t
  WHERE t.id = p_thread_id;

  RETURN json_build_object(
    'success', TRUE,
    'already_reported', v_inserted_rows = 0,
    'report_count', COALESCE(v_report_count, 0),
    'participant_count', COALESCE(v_participant_count, 0),
    'is_locked', COALESCE(v_is_locked, FALSE)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_thread_is_not_locked(p_thread_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_locked BOOLEAN := FALSE;
BEGIN
  IF p_thread_id IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(t.is_locked, FALSE)
  INTO v_locked
  FROM public.threads t
  WHERE t.id = p_thread_id;

  IF v_locked THEN
    RAISE EXCEPTION 'Thread is locked due to community reports';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_locked_thread_message_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.ensure_thread_is_not_locked(NEW.thread_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_locked_thread_message_insert ON public.messages;
CREATE TRIGGER prevent_locked_thread_message_insert
BEFORE INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.prevent_locked_thread_message_insert();

CREATE OR REPLACE FUNCTION public.prevent_locked_thread_message_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.ensure_thread_is_not_locked(NEW.thread_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_locked_thread_message_update ON public.messages;
CREATE TRIGGER prevent_locked_thread_message_update
BEFORE UPDATE OF content, attachments, type, parent_message_id ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.prevent_locked_thread_message_update();

CREATE OR REPLACE FUNCTION public.prevent_locked_thread_like_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.ensure_thread_is_not_locked(NEW.thread_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_locked_thread_like_insert ON public.thread_likes;
CREATE TRIGGER prevent_locked_thread_like_insert
BEFORE INSERT ON public.thread_likes
FOR EACH ROW
EXECUTE FUNCTION public.prevent_locked_thread_like_insert();

CREATE OR REPLACE FUNCTION public.prevent_locked_thread_participant_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.ensure_thread_is_not_locked(NEW.thread_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_locked_thread_participant_insert ON public.thread_participants;
CREATE TRIGGER prevent_locked_thread_participant_insert
BEFORE INSERT ON public.thread_participants
FOR EACH ROW
EXECUTE FUNCTION public.prevent_locked_thread_participant_insert();

CREATE OR REPLACE FUNCTION public.prevent_locked_message_like_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_thread_id UUID;
BEGIN
  SELECT m.thread_id INTO v_thread_id
  FROM public.messages m
  WHERE m.id = NEW.message_id;

  PERFORM public.ensure_thread_is_not_locked(v_thread_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_locked_message_like_insert ON public.message_likes;
CREATE TRIGGER prevent_locked_message_like_insert
BEFORE INSERT ON public.message_likes
FOR EACH ROW
EXECUTE FUNCTION public.prevent_locked_message_like_insert();

CREATE OR REPLACE FUNCTION public.prevent_locked_message_reaction_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_thread_id UUID;
BEGIN
  SELECT m.thread_id INTO v_thread_id
  FROM public.messages m
  WHERE m.id = NEW.message_id;

  PERFORM public.ensure_thread_is_not_locked(v_thread_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_locked_message_reaction_insert ON public.message_reactions;
CREATE TRIGGER prevent_locked_message_reaction_insert
BEFORE INSERT ON public.message_reactions
FOR EACH ROW
EXECUTE FUNCTION public.prevent_locked_message_reaction_insert();

CREATE OR REPLACE FUNCTION public.prevent_locked_poll_vote_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_thread_id UUID;
BEGIN
  SELECT p.thread_id INTO v_thread_id
  FROM public.polls p
  WHERE p.id = NEW.poll_id;

  PERFORM public.ensure_thread_is_not_locked(v_thread_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_locked_poll_vote_insert ON public.poll_votes;
CREATE TRIGGER prevent_locked_poll_vote_insert
BEFORE INSERT ON public.poll_votes
FOR EACH ROW
EXECUTE FUNCTION public.prevent_locked_poll_vote_insert();

DO $$
DECLARE
  v_thread RECORD;
BEGIN
  FOR v_thread IN SELECT id FROM public.threads LOOP
    PERFORM public.refresh_thread_report_state(v_thread.id);
  END LOOP;
END
$$;
