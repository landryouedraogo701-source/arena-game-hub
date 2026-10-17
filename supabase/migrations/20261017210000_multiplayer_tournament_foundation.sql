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
