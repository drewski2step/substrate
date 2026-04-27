CREATE TABLE IF NOT EXISTS public.block_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id uuid NOT NULL REFERENCES public.blocks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vote smallint NOT NULL CHECK (vote IN (1, -1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (block_id, user_id)
);

ALTER TABLE public.block_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public vote read"
  ON public.block_votes FOR SELECT USING (true);

CREATE POLICY "Users insert own vote"
  ON public.block_votes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own vote"
  ON public.block_votes FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users delete own vote"
  ON public.block_votes FOR DELETE TO authenticated
  USING (user_id = auth.uid());
