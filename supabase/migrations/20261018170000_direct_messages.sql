-- Arena private direct messages. Additive and protected by participant-only RLS.
CREATE TABLE IF NOT EXISTS public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL CHECK (char_length(btrim(message)) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz,
  CONSTRAINT direct_messages_no_self CHECK (sender_id <> recipient_id)
);
CREATE INDEX IF NOT EXISTS direct_messages_pair_created_idx
  ON public.direct_messages (sender_id, recipient_id, created_at);
CREATE INDEX IF NOT EXISTS direct_messages_recipient_created_idx
  ON public.direct_messages (recipient_id, created_at DESC);
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read their own direct messages" ON public.direct_messages;
CREATE POLICY "Users can read their own direct messages"
  ON public.direct_messages FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
DROP POLICY IF EXISTS "Users can send direct messages as themselves" ON public.direct_messages;
CREATE POLICY "Users can send direct messages as themselves"
  ON public.direct_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND recipient_id <> auth.uid());
DROP POLICY IF EXISTS "Recipients can mark their messages read" ON public.direct_messages;
CREATE POLICY "Recipients can mark their messages read"
  ON public.direct_messages FOR UPDATE TO authenticated
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);
REVOKE ALL ON public.direct_messages FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.direct_messages TO authenticated;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'direct_messages'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
  END IF;
END $$;
