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

  -- Live is a separate lifecycle: never change matches.status here.
  RETURN json_build_object('success',true,'status',v_status,'host_id',v_host_id,'message','Le LIVE peut être préparé indépendamment du match');
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
  IF v_match.status NOT IN ('capture','stream_connecting','live') THEN
    RAISE EXCEPTION 'Le match doit être en phase de capture ou en cours pour préparer le LIVE';
  END IF;

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

-- Starting the stream must not start or advance the match.
CREATE OR REPLACE FUNCTION public.start_live_session(p_match_id uuid, p_live_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_host uuid;
  v_session_status text;
  v_match_status text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Utilisateur non connecté'; END IF;

  SELECT status INTO v_match_status FROM public.matches WHERE id=p_match_id FOR UPDATE;
  IF v_match_status IS NULL THEN RAISE EXCEPTION 'Match introuvable'; END IF;
  IF v_match_status NOT IN ('capture','stream_connecting','live') THEN
    RAISE EXCEPTION 'Le match doit être en phase de capture ou en cours pour démarrer le LIVE';
  END IF;

  SELECT host_id,status INTO v_host,v_session_status
  FROM public.live_sessions
  WHERE id=p_live_session_id AND match_id=p_match_id FOR UPDATE;

  IF v_host IS NULL THEN RAISE EXCEPTION 'Session LIVE introuvable'; END IF;
  IF v_host <> v_user THEN RAISE EXCEPTION 'Seul l’hôte peut démarrer ce LIVE'; END IF;
  IF v_session_status NOT IN ('waiting','live') THEN RAISE EXCEPTION 'La session LIVE n’est plus disponible'; END IF;

  UPDATE public.live_sessions
  SET status='live',
      stream_state='live',
      started_at=coalesce(started_at,now()),
      stream_started_at=coalesce(stream_started_at,now()),
      publisher_connected_at=coalesce(publisher_connected_at,now()),
      last_heartbeat_at=now(),
      last_provider_event_at=now(),
      interruption_started_at=null,
      failure_code=null,
      failure_message=null,
      updated_at=now()
  WHERE id=p_live_session_id;

  RETURN jsonb_build_object('success',true,'status','live','live_session_id',p_live_session_id,'match_id',p_match_id);
END;
$function$;

-- Backward-compatible RPC: confirms Live readiness but never mutates match state.
CREATE OR REPLACE FUNCTION public.activate_match_live(p_match_id uuid, p_live_session_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_session_status text;
  v_host uuid;
  v_match_status text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Utilisateur non connecté'; END IF;

  SELECT status INTO v_match_status FROM public.matches WHERE id=p_match_id FOR UPDATE;
  IF v_match_status IS NULL THEN RAISE EXCEPTION 'Match introuvable'; END IF;

  SELECT status,host_id INTO v_session_status,v_host
  FROM public.live_sessions
  WHERE id=p_live_session_id AND match_id=p_match_id FOR UPDATE;
  IF v_session_status IS NULL THEN RAISE EXCEPTION 'Session LIVE introuvable pour ce match'; END IF;
  IF v_host <> v_user THEN RAISE EXCEPTION 'Seul l’hôte du LIVE peut confirmer la diffusion'; END IF;
  IF v_session_status <> 'live' THEN
    RETURN json_build_object('success',false,'status',v_match_status,'message','Le flux LIVE n’est pas encore actif');
  END IF;

  RETURN json_build_object('success',true,'status',v_match_status,'message','Le LIVE est actif; l’état du match reste indépendant');
END;
$function$;

REVOKE ALL ON FUNCTION public.start_live_session(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.activate_match_live(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_live_session(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_match_live(uuid, uuid) TO authenticated;


-- Match capacity is derived from the selected format, with legacy formats staying 1v1.
-- This prevents the database RPCs from silently limiting every match to two players.
CREATE OR REPLACE FUNCTION public.join_match(p_match_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_match public.matches%rowtype;
  v_capacity integer := 2;
  v_player_count integer;
  v_team text;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Utilisateur non connecté'; END IF;

  SELECT * INTO v_match
  FROM public.matches
  WHERE id=p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Match introuvable'; END IF;
  IF v_match.status <> 'waiting' THEN RAISE EXCEPTION 'Ce match n’accepte plus de joueur'; END IF;

  IF upper(coalesce(v_match.format,'')) = '2V2' THEN
    v_capacity := 4;
  ELSIF upper(coalesce(v_match.format,'')) ~ '^FFA-[0-9]+$' THEN
    v_capacity := split_part(upper(v_match.format), '-', 2)::integer;
    IF v_capacity < 2 OR v_capacity > 16 THEN
      RAISE EXCEPTION 'Capacité de match non valide';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.match_players
    WHERE match_id=p_match_id AND user_id=v_user_id
  ) THEN
    RETURN json_build_object('success',true,'message','Tu participes déjà à ce match');
  END IF;

  SELECT count(*) INTO v_player_count
  FROM public.match_players WHERE match_id=p_match_id;

  IF v_player_count >= v_capacity THEN
    RAISE EXCEPTION 'Ce match est déjà complet';
  END IF;

  IF upper(coalesce(v_match.format,'')) = '2V2' THEN
    -- Alternate teams as players join; creator is assigned to team A below as first participant.
    v_team := CASE WHEN v_player_count % 2 = 0 THEN 'A' ELSE 'B' END;
  ELSE
    v_team := NULL;
  END IF;

  INSERT INTO public.match_players(match_id,user_id,team,status)
  VALUES(p_match_id,v_user_id,v_team,'joined');

  IF v_player_count + 1 >= v_capacity THEN
    UPDATE public.matches SET status='ready', updated_at=now()
    WHERE id=p_match_id;
  END IF;

  RETURN json_build_object(
    'success',true,
    'message','Tu as rejoint le match',
    'players',v_player_count+1,
    'capacity',v_capacity
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_match_ready(p_match_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_match public.matches%rowtype;
  v_capacity integer := 2;
  v_player_count integer;
  v_ready_count integer;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Utilisateur non connecté'; END IF;

  SELECT * INTO v_match FROM public.matches WHERE id=p_match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Match introuvable'; END IF;
  IF v_match.status NOT IN ('ready','preparing') THEN
    RAISE EXCEPTION 'Le match n’est pas prêt pour cette étape';
  END IF;

  IF upper(coalesce(v_match.format,'')) = '2V2' THEN
    v_capacity := 4;
  ELSIF upper(coalesce(v_match.format,'')) ~ '^FFA-[0-9]+$' THEN
    v_capacity := split_part(upper(v_match.format), '-', 2)::integer;
    IF v_capacity < 2 OR v_capacity > 16 THEN RAISE EXCEPTION 'Capacité de match non valide'; END IF;
  END IF;

  UPDATE public.match_players SET status='ready'
  WHERE match_id=p_match_id AND user_id=v_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tu ne participes pas à ce match'; END IF;

  SELECT count(*), count(*) FILTER (WHERE status='ready')
  INTO v_player_count,v_ready_count
  FROM public.match_players WHERE match_id=p_match_id;

  IF v_player_count < v_capacity THEN
    RETURN json_build_object('success',true,'status','ready','message','En attente des joueurs requis');
  END IF;

  IF v_ready_count >= v_capacity THEN
    UPDATE public.matches
    SET status='preparing',
        preparation_started_at=coalesce(preparation_started_at,now()),
        updated_at=now()
    WHERE id=p_match_id;
    RETURN json_build_object('success',true,'status','preparing','message','Tous les joueurs sont prêts');
  END IF;

  RETURN json_build_object('success',true,'status','ready','message','Tu es prêt. En attente des autres joueurs.');
END;
$function$;

REVOKE ALL ON FUNCTION public.join_match(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_match_ready(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.join_match(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_match_ready(uuid) TO authenticated;
