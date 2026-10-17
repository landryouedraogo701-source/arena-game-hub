-- Designate one Live host deterministically for each tournament match.
-- The earliest joined participant is the host; user_id breaks timestamp ties.
-- This migration is committed to the feature branch and should be applied only to the
-- development Supabase project after review, not directly to production.

CREATE OR REPLACE FUNCTION public.start_match_stream(p_match_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_match_type text;
  v_status text;
  v_host_id uuid;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Utilisateur non connecté'; END IF;

  SELECT match_type, status INTO v_match_type, v_status
  FROM public.matches WHERE id = p_match_id FOR UPDATE;

  IF v_match_type IS NULL THEN RAISE EXCEPTION 'Match introuvable'; END IF;
  IF v_match_type <> 'tournament' THEN
    RAISE EXCEPTION 'Le LIVE compétitif est réservé aux matchs de tournoi';
  END IF;

  SELECT user_id INTO v_host_id
  FROM public.match_players
  WHERE match_id = p_match_id
  ORDER BY joined_at ASC, user_id ASC
  LIMIT 1;

  IF v_host_id IS NULL THEN RAISE EXCEPTION 'Aucun joueur inscrit à ce match'; END IF;
  IF v_user_id <> v_host_id THEN
    RAISE EXCEPTION 'Seul l’hôte désigné par Arena peut préparer le LIVE';
  END IF;

  IF v_status <> 'capture' THEN
    RETURN json_build_object('success',false,'status',v_status,'message','La capture n’est pas prête');
  END IF;

  UPDATE public.matches SET status='stream_connecting', updated_at=now()
  WHERE id=p_match_id;

  RETURN json_build_object('success',true,'status','stream_connecting','host_id',v_host_id,'message','Connexion du LIVE en cours');
END;
$function$;

CREATE OR REPLACE FUNCTION public.prepare_match_live_session(p_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_match public.matches%rowtype;
  v_session public.live_sessions%rowtype;
  v_host_id uuid;
  v_room_name text := 'arena-match-' || p_match_id::text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Utilisateur non connecté'; END IF;

  SELECT * INTO v_match FROM public.matches WHERE id=p_match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Match introuvable'; END IF;
  IF v_match.match_type <> 'tournament' THEN RAISE EXCEPTION 'Le LIVE compétitif est réservé aux matchs de tournoi'; END IF;
  IF v_match.status <> 'stream_connecting' THEN RAISE EXCEPTION 'Le match n’est pas prêt pour le LIVE'; END IF;

  SELECT user_id INTO v_host_id
  FROM public.match_players
  WHERE match_id=p_match_id
  ORDER BY joined_at ASC, user_id ASC
  LIMIT 1;

  IF v_host_id IS NULL THEN RAISE EXCEPTION 'Aucun joueur inscrit à ce match'; END IF;
  IF v_user <> v_host_id THEN RAISE EXCEPTION 'Seul l’hôte désigné par Arena peut démarrer le LIVE'; END IF;

  SELECT * INTO v_session
  FROM public.live_sessions
  WHERE match_id=p_match_id AND status IN ('waiting','live')
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND AND v_session.host_id <> v_host_id THEN
    RAISE EXCEPTION 'La session existante appartient à un hôte différent; intervention de l’arbitre requise';
  END IF;

  IF NOT FOUND THEN
    INSERT INTO public.live_sessions (
      host_id, game_id, match_format, title, description,
      status, visibility, viewer_count, match_id,
      provider, room_name, stream_state, last_provider_event_at
    )
    VALUES (
      v_host_id, v_match.game_id, 'tournament',
      'LIVE — ' || coalesce(v_match.room_code,'Match Arena'),
      'Diffusion en direct du match de tournoi.',
      'waiting', 'public', 0, p_match_id,
      'livekit', v_room_name, 'connecting', now()
    )
    RETURNING * INTO v_session;
  ELSE
    UPDATE public.live_sessions
    SET room_name=coalesce(room_name,v_room_name),
        stream_state=CASE WHEN status='live' THEN 'live' ELSE 'connecting' END,
        last_provider_event_at=now(),
        updated_at=now()
    WHERE id=v_session.id
    RETURNING * INTO v_session;
  END IF;

  RETURN jsonb_build_object(
    'success',true,
    'live_session_id',v_session.id,
    'match_id',p_match_id,
    'host_id',v_session.host_id,
    'status',v_session.status,
    'room_name',coalesce(v_session.room_name,v_room_name),
    'provider',v_session.provider
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.stop_match_live_session(
  p_match_id uuid,
  p_live_session_id uuid,
  p_reason text DEFAULT 'host_stopped'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_host uuid;
  v_status text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Utilisateur non connecté'; END IF;

  SELECT host_id, status INTO v_host, v_status
  FROM public.live_sessions
  WHERE id=p_live_session_id AND match_id=p_match_id
  FOR UPDATE;

  IF v_host IS NULL THEN RAISE EXCEPTION 'Session LIVE introuvable'; END IF;
  IF v_host <> v_user THEN RAISE EXCEPTION 'Seul l’hôte désigné peut terminer le LIVE'; END IF;
  IF v_status = 'ended' OR v_status = 'cancelled' THEN
    RETURN jsonb_build_object('success',true,'status',v_status,'message','Le LIVE est déjà terminé');
  END IF;

  UPDATE public.live_sessions
  SET status='ended',
      stream_state='ended',
      ended_at=now(),
      ended_reason=coalesce(nullif(p_reason,''),'host_stopped'),
      last_provider_event_at=now(),
      updated_at=now()
  WHERE id=p_live_session_id;

  RETURN jsonb_build_object('success',true,'status','ended','message','Le LIVE a été terminé');
END;
$function$;

REVOKE ALL ON FUNCTION public.start_match_stream(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.prepare_match_live_session(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.stop_match_live_session(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_match_stream(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_match_live_session(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stop_match_live_session(uuid, uuid, text) TO authenticated;
