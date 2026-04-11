
-- Feature 4: Add relevance_score to discussions
ALTER TABLE public.discussions ADD COLUMN IF NOT EXISTS relevance_score float DEFAULT 0;

-- Feature 5: Create block_pledges table
CREATE TABLE IF NOT EXISTS public.block_pledges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id uuid NOT NULL,
  user_id uuid NOT NULL,
  pledged_at timestamptz NOT NULL DEFAULT now(),
  unpledged_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  UNIQUE(block_id, user_id)
);

ALTER TABLE public.block_pledges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view pledges" ON public.block_pledges FOR SELECT USING (true);
CREATE POLICY "Authenticated users can pledge" ON public.block_pledges FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own pledges" ON public.block_pledges FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Enable realtime for key tables (Feature 7)
ALTER PUBLICATION supabase_realtime ADD TABLE public.discussions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.blocks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.block_pledges;
