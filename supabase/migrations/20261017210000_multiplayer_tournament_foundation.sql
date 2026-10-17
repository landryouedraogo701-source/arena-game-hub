-- Multiplayer tournament foundation.
-- Additive only: this migration is intentionally NOT applied to Supabase production.
-- Game capabilities must be explicitly configured; do not assume every game supports every format.

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS supported_match_formats text[] NOT NULL DEFAULT ARRAY['1v1']::text[];

ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS match_format text NOT NULL DEFAULT '1v1',
  ADD COLUMN IF NOT EXISTS progression_mode text NOT NULL DEFAULT 'single_elimination';

ALTER TABLE public.tournament_matches
  ADD COLUMN IF NOT EXISTS winning_team text,
  ADD COLUMN IF NOT EXISTS result_payload jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Normalized participants for tournament rounds: supports FFA matches and team rosters
-- without overloading player1_id/player2_id. Existing 1v1 fields remain for compatibility.
CREATE TABLE IF NOT EXISTS public.tournament_match_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_match_id uuid NOT NULL REFERENCES public.tournament_matches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_code text,
  placement integer,
  outcome text NOT NULL DEFAULT 'active'
    CHECK (outcome IN ('active','qualified','eliminated','withdrawn')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_match_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tournament_match_participants_match
  ON public.tournament_match_participants(tournament_match_id);
CREATE INDEX IF NOT EXISTS idx_tournament_match_participants_user
  ON public.tournament_match_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_tournament_match_participants_outcome
  ON public.tournament_match_participants(tournament_match_id, outcome);

ALTER TABLE public.tournament_match_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tournament match participants visible to participants and officials"
  ON public.tournament_match_participants;
CREATE POLICY "Tournament match participants visible to participants and officials"
ON public.tournament_match_participants
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.tournament_matches tm
    JOIN public.tournaments t ON t.id = tm.tournament_id
    WHERE tm.id = tournament_match_id
      AND (
        EXISTS (
          SELECT 1 FROM public.tournament_participants tp
          WHERE tp.tournament_id = t.id AND tp.user_id = auth.uid()
        )
        OR t.organizer_id = auth.uid()
        OR public.has_role('referee'::public.app_role)
        OR public.has_role('moderator'::public.app_role)
        OR public.has_role('admin'::public.app_role)
      )
  )
);

-- Mutations must go through security-definer tournament RPCs; no direct client writes.
REVOKE INSERT, UPDATE, DELETE ON public.tournament_match_participants FROM anon, authenticated;
GRANT SELECT ON public.tournament_match_participants TO authenticated;

-- Friendly matches can be ended by participants, but competitive matches must
-- finish only through referee-reviewed result validation.
CREATE OR REPLACE FUNCTION public.finish_match(p_match_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_match public.matches%rowtype;
  v_is_player boolean;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Utilisateur non connecté'; END IF;

  SELECT * INTO v_match
  FROM public.matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Match introuvable'; END IF;

  IF v_match.match_type = 'tournament' THEN
    RAISE EXCEPTION 'Un match de compétition doit être terminé par la validation officielle du résultat';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.match_players
    WHERE match_id = p_match_id AND user_id = v_user_id
  ) INTO v_is_player;

  IF NOT v_is_player THEN RAISE EXCEPTION 'Tu ne participes pas à ce match'; END IF;

  IF v_match.status <> 'live' THEN
    RETURN json_build_object('success',false,'status',v_match.status,'message','Le match n’est pas en cours');
  END IF;

  UPDATE public.matches
  SET status = 'finished',
      finished_at = COALESCE(finished_at, now()),
      updated_at = now()
  WHERE id = p_match_id;

  RETURN json_build_object('success',true,'status','finished','message','Le match amical est terminé');
END;
$function$;

REVOKE ALL ON FUNCTION public.finish_match(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.finish_match(uuid) TO authenticated;


-- Generalized result review. A tournament match advances only after a referee
-- confirms a claimed winner who is a registered participant of that match.
-- Existing 1v1 bracket slots remain populated for backward compatibility.
CREATE OR REPLACE FUNCTION public.review_match_result(p_result_id uuid, p_decision text)
RETURNS public.match_results
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_result public.match_results%rowtype;
  v_tm public.tournament_matches%rowtype;
  v_next public.tournament_matches%rowtype;
  v_winner uuid;
  v_next_match_id uuid;
  v_game_id uuid;
  v_organizer_id uuid;
  v_player_count integer;
  v_winner_team text;
  v_next_round integer;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT (
    public.has_role('referee'::public.app_role)
    OR public.has_role('moderator'::public.app_role)
    OR public.has_role('admin'::public.app_role)
  ) THEN RAISE EXCEPTION 'NOT_AUTHORIZED'; END IF;
  IF p_decision NOT IN ('confirmed','rejected') THEN RAISE EXCEPTION 'INVALID_DECISION'; END IF;

  SELECT * INTO v_result FROM public.match_results WHERE id=p_result_id FOR UPDATE;
  IF v_result.id IS NULL THEN RAISE EXCEPTION 'RESULT_NOT_FOUND'; END IF;
  IF v_result.status NOT IN ('pending','disputed') THEN RAISE EXCEPTION 'RESULT_ALREADY_REVIEWED'; END IF;

  IF p_decision='confirmed' THEN
    SELECT tm.* INTO v_tm
    FROM public.tournament_matches tm
    WHERE tm.match_id=v_result.match_id
    FOR UPDATE;

    IF v_tm.id IS NOT NULL THEN
      IF v_tm.status IN ('completed','finished') THEN
        RAISE EXCEPTION 'TOURNAMENT_MATCH_ALREADY_COMPLETED';
      END IF;

      v_winner := v_result.claimed_winner_id;
      IF v_winner IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.match_players mp
        WHERE mp.match_id=v_result.match_id AND mp.user_id=v_winner
      ) THEN
        RAISE EXCEPTION 'CLAIMED_WINNER_NOT_IN_MATCH';
      END IF;

      SELECT count(*) INTO v_player_count
      FROM public.match_players mp
      WHERE mp.match_id=v_result.match_id;

      -- Team tournaments advance the winning team as a unit. Until a dedicated
      -- team-result UI submits a team, refuse to guess which team won.
      IF coalesce((SELECT t.match_format FROM public.tournaments t WHERE t.id=v_tm.tournament_id),'1v1')='2v2' THEN
        SELECT team INTO v_winner_team
        FROM public.match_players WHERE match_id=v_result.match_id AND user_id=v_winner;
        IF v_winner_team IS NULL THEN
          RAISE EXCEPTION 'TEAM_RESULT_REQUIRED: winner must belong to a team';
        END IF;
        UPDATE public.tournament_matches
        SET winner_id=v_winner, winning_team=v_winner_team,
            result_payload=jsonb_build_object('mode','team','winning_team',v_winner_team,'winner_id',v_winner),
            status='completed', updated_at=now()
        WHERE id=v_tm.id;
        UPDATE public.tournament_match_participants
        SET outcome=CASE WHEN team_code=v_winner_team THEN 'qualified' ELSE 'eliminated' END,
            placement=CASE WHEN team_code=v_winner_team THEN 1 ELSE 2 END,
            updated_at=now()
        WHERE tournament_match_id=v_tm.id;
      ELSIF v_player_count > 2 THEN
        UPDATE public.tournament_matches
        SET winner_id=v_winner,
            result_payload=jsonb_build_object('mode','ffa','winner_id',v_winner,'participant_count',v_player_count),
            status='completed', updated_at=now()
        WHERE id=v_tm.id;
        UPDATE public.tournament_match_participants
        SET outcome=CASE WHEN user_id=v_winner THEN 'qualified' ELSE 'eliminated' END,
            placement=CASE WHEN user_id=v_winner THEN 1 ELSE 2 END,
            updated_at=now()
        WHERE tournament_match_id=v_tm.id;
      ELSE
        IF v_winner NOT IN (v_tm.player1_id,v_tm.player2_id) THEN
          RAISE EXCEPTION 'CLAIMED_WINNER_NOT_IN_TOURNAMENT_MATCH';
        END IF;
        UPDATE public.tournament_matches
        SET winner_id=v_winner, status='completed', updated_at=now()
        WHERE id=v_tm.id;
        UPDATE public.tournament_participants
        SET status=CASE WHEN user_id=v_winner THEN 'qualified' ELSE 'eliminated' END,
            updated_at=now()
        WHERE tournament_id=v_tm.tournament_id
          AND user_id IN (v_tm.player1_id,v_tm.player2_id);
        UPDATE public.tournament_match_participants
        SET outcome=CASE WHEN user_id=v_winner THEN 'qualified' ELSE 'eliminated' END,
            placement=CASE WHEN user_id=v_winner THEN 1 ELSE 2 END,
            updated_at=now()
        WHERE tournament_match_id=v_tm.id;
      END IF;

      UPDATE public.matches
      SET winner_id=v_winner,status='finished',
          finished_at=coalesce(finished_at,now()),updated_at=now()
      WHERE id=v_result.match_id;

      -- Advance only an individual winner for single-player/FFA formats.
      -- For team mode, preserve the team result and require the team-aware bracket
      -- generator to populate the next match; never silently advance one teammate.
      IF coalesce((SELECT t.match_format FROM public.tournaments t WHERE t.id=v_tm.tournament_id),'1v1')='2v2' THEN
        RAISE EXCEPTION 'TEAM_BRACKET_ADVANCEMENT_REQUIRED';
      END IF;

      SELECT t.game_id,t.organizer_id INTO v_game_id,v_organizer_id
      FROM public.tournaments t WHERE t.id=v_tm.tournament_id;

      IF v_tm.next_tournament_match_id IS NOT NULL THEN
        SELECT * INTO v_next FROM public.tournament_matches
        WHERE id=v_tm.next_tournament_match_id FOR UPDATE;

        IF mod(v_tm.bracket_position,2)=1 THEN
          IF v_next.player1_id IS NOT NULL AND v_next.player1_id<>v_winner THEN
            RAISE EXCEPTION 'NEXT_ROUND_SLOT_ALREADY_OCCUPIED';
          END IF;
          UPDATE public.tournament_matches SET player1_id=v_winner,updated_at=now() WHERE id=v_next.id;
        ELSE
          IF v_next.player2_id IS NOT NULL AND v_next.player2_id<>v_winner THEN
            RAISE EXCEPTION 'NEXT_ROUND_SLOT_ALREADY_OCCUPIED';
          END IF;
          UPDATE public.tournament_matches SET player2_id=v_winner,updated_at=now() WHERE id=v_next.id;
        END IF;

        IF v_next.match_id IS NULL THEN
          SELECT * INTO v_next FROM public.tournament_matches WHERE id=v_next.id FOR UPDATE;
          IF v_next.player1_id IS NOT NULL AND v_next.player2_id IS NOT NULL THEN
            INSERT INTO public.matches(match_type,game_id,created_by,status,format)
            VALUES('tournament',v_game_id,v_organizer_id,'waiting','1v1')
            RETURNING id INTO v_next_match_id;
            INSERT INTO public.match_players(match_id,user_id,status)
            VALUES(v_next_match_id,v_next.player1_id,'invited'),
                  (v_next_match_id,v_next.player2_id,'invited');
            INSERT INTO public.tournament_match_participants(tournament_match_id,user_id,outcome)
            VALUES(v_next.id,v_next.player1_id,'active'),(v_next.id,v_next.player2_id,'active')
            ON CONFLICT(tournament_match_id,user_id) DO NOTHING;
            UPDATE public.tournament_matches
            SET match_id=v_next_match_id,status='pending',updated_at=now()
            WHERE id=v_next.id;
          END IF;
        END IF;
        UPDATE public.tournament_rounds SET status='active'
        WHERE id=v_next.round_id AND status='pending';
      ELSE
        UPDATE public.tournaments SET status='finished',updated_at=now()
        WHERE id=v_tm.tournament_id;
        UPDATE public.tournament_rounds SET status='completed' WHERE id=v_tm.round_id;
      END IF;

      UPDATE public.tournament_rounds tr
      SET status='completed'
      WHERE tr.id=v_tm.round_id
        AND NOT EXISTS (
          SELECT 1 FROM public.tournament_matches other
          WHERE other.round_id=tr.id
            AND other.status NOT IN ('completed','finished','bye','cancelled')
        );
    END IF;
  END IF;

  UPDATE public.match_results
  SET status=p_decision,reviewed_by=v_actor,reviewed_at=now()
  WHERE id=p_result_id
  RETURNING * INTO v_result;
  RETURN v_result;
END;
$function$;

REVOKE ALL ON FUNCTION public.review_match_result(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_match_result(uuid,text) TO authenticated;


-- Format-aware tournament creation. The requested format must be explicitly enabled
-- for the selected game; unsupported formats cannot be created accidentally.
CREATE OR REPLACE FUNCTION public.create_tournament_with_format(
  p_game_id uuid,
  p_name text,
  p_description text DEFAULT NULL,
  p_participant_limit integer DEFAULT 16,
  p_starts_at timestamptz DEFAULT NULL,
  p_match_format text DEFAULT '1v1'
)
RETURNS public.tournaments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_tournament public.tournaments;
  v_supported text[];
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT (public.has_role('organizer'::public.app_role) OR public.has_role('admin'::public.app_role)) THEN
    RAISE EXCEPTION 'ORGANIZER_ROLE_REQUIRED';
  END IF;
  IF p_game_id IS NULL THEN RAISE EXCEPTION 'GAME_REQUIRED'; END IF;
  SELECT supported_match_formats INTO v_supported FROM public.games WHERE id=p_game_id AND is_active=true;
  IF v_supported IS NULL THEN RAISE EXCEPTION 'GAME_NOT_ACTIVE'; END IF;
  IF NOT (p_match_format = ANY(v_supported)) THEN RAISE EXCEPTION 'FORMAT_NOT_SUPPORTED_FOR_GAME'; END IF;
  IF p_name IS NULL OR length(btrim(p_name)) < 3 OR length(btrim(p_name)) > 120 THEN
    RAISE EXCEPTION 'INVALID_TOURNAMENT_NAME';
  END IF;
  IF p_participant_limit < 2 OR p_participant_limit > 1024 THEN RAISE EXCEPTION 'INVALID_PARTICIPANT_LIMIT'; END IF;
  IF p_match_format !~ '^(1v1|2v2|FFA-[0-9]+)
  IF p_match_format LIKE 'FFA-%' AND split_part(p_match_format,'-',2)::integer > 16 THEN
    RAISE EXCEPTION 'INVALID_MATCH_FORMAT';
  END IF;

  INSERT INTO public.tournaments(
    game_id,organizer_id,name,description,status,participant_limit,starts_at,
    rules,scoring_rules,proof_requirements,live_requirements,match_format,progression_mode
  )
  VALUES(
    p_game_id,v_user_id,btrim(p_name),nullif(btrim(coalesce(p_description,'')), ''),
    'draft',p_participant_limit,p_starts_at,'{}'::jsonb,'{}'::jsonb,'{}'::jsonb,'{}'::jsonb,
    p_match_format,'single_elimination'
  )
  RETURNING * INTO v_tournament;
  RETURN v_tournament;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_tournament_with_format(uuid,text,text,integer,timestamptz,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_tournament_with_format(uuid,text,text,integer,timestamptz,text) TO authenticated;

-- Configure supported formats per game only after verifying game-specific capability.
-- Existing games remain 1v1 by default until an administrator explicitly enables more.
 THEN RAISE EXCEPTION 'INVALID_MATCH_FORMAT'; END IF;
  IF p_match_format LIKE 'FFA-%' AND split_part(p_match_format,'-',2)::integer > 16 THEN
    RAISE EXCEPTION 'INVALID_MATCH_FORMAT';
  END IF;

  INSERT INTO public.tournaments(
    game_id,organizer_id,name,description,status,participant_limit,starts_at,
    rules,scoring_rules,proof_requirements,live_requirements,match_format,progression_mode
  )
  VALUES(
    p_game_id,v_user_id,btrim(p_name),nullif(btrim(coalesce(p_description,'')), ''),
    'draft',p_participant_limit,p_starts_at,'{}'::jsonb,'{}'::jsonb,'{}'::jsonb,'{}'::jsonb,
    p_match_format,'single_elimination'
  )
  RETURNING * INTO v_tournament;
  RETURN v_tournament;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_tournament_with_format(uuid,text,text,integer,timestamptz,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_tournament_with_format(uuid,text,text,integer,timestamptz,text) TO authenticated;

-- Configure supported formats per game only after verifying game-specific capability.
-- Existing games remain 1v1 by default until an administrator explicitly enables more.
