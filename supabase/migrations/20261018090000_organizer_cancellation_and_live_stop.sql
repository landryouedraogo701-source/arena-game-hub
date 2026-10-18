-- Arena: organizer cancellation and independent Live shutdown.
-- Apply this migration in Supabase before using these controls.

CREATE OR REPLACE FUNCTION public.cancel_own_tournament(p_tournament_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_tournament public.tournaments;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  SELECT * INTO v_tournament
  FROM public.tournaments
  WHERE id = p_tournament_id
  FOR UPDATE;

  IF v_tournament.id IS NULL THEN
    RAISE EXCEPTION 'TOURNAMENT_NOT_FOUND';
  END IF;

  IF v_tournament.organizer_id <> v_user_id
     AND NOT public.has_role('admin'::public.app_role) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  IF v_tournament.status NOT IN ('draft', 'registration') THEN
    RAISE EXCEPTION 'TOURNAMENT_ALREADY_STARTED';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.tournament_matches tm
    WHERE tm.tournament_id = p_tournament_id
  ) THEN
    RAISE EXCEPTION 'TOURNAMENT_HAS_MATCHES';
  END IF;

  UPDATE public.tournaments
  SET status = 'cancelled', updated_at = now()
  WHERE id = p_tournament_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.cancel_own_tournament(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_own_tournament(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.stop_match_live_session(
  p_match_id uuid,
  p_live_session_id uuid,
  p_reason text DEFAULT 'host_stopped'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_session public.live_sessions;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  SELECT * INTO v_session
  FROM public.live_sessions
  WHERE id = p_live_session_id
    AND match_id = p_match_id
  FOR UPDATE;

  IF v_session.id IS NULL THEN
    RAISE EXCEPTION 'LIVE_SESSION_NOT_FOUND';
  END IF;

  IF v_session.host_id <> v_user_id
     AND NOT public.has_role('admin'::public.app_role) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED';
  END IF;

  IF v_session.status = 'ended' THEN
    RETURN;
  END IF;

  UPDATE public.live_sessions
  SET status = 'ended',
      stream_state = 'ended',
      ended_at = now(),
      ended_reason = COALESCE(NULLIF(p_reason, ''), 'host_stopped'),
      updated_at = now()
  WHERE id = p_live_session_id;

  -- Intentionally do not change public.matches.status: ending a Live must not end a match.
END;
$function$;

REVOKE ALL ON FUNCTION public.stop_match_live_session(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stop_match_live_session(uuid, uuid, text) TO authenticated;
