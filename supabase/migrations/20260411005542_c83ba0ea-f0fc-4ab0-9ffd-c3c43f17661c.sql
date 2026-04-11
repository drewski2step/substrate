
-- Create discussions table
CREATE TABLE public.discussions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  block_id UUID REFERENCES public.blocks(id) ON DELETE CASCADE,
  goal_id UUID REFERENCES public.goals(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.discussions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'insight',
  title TEXT,
  content TEXT NOT NULL,
  upvotes INTEGER NOT NULL DEFAULT 0,
  scope TEXT NOT NULL DEFAULT 'block',
  resolved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.discussions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read discussions" ON public.discussions FOR SELECT USING (true);
CREATE POLICY "Anyone can create discussions" ON public.discussions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update discussions" ON public.discussions FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete discussions" ON public.discussions FOR DELETE USING (true);

-- Add heat columns to blocks
ALTER TABLE public.blocks
  ADD COLUMN IF NOT EXISTS heat INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS heat_updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();

-- Index for fast lookups
CREATE INDEX idx_discussions_block_id ON public.discussions(block_id);
CREATE INDEX idx_discussions_goal_id ON public.discussions(goal_id);
CREATE INDEX idx_discussions_parent_id ON public.discussions(parent_id);
CREATE INDEX idx_blocks_heat ON public.blocks(heat DESC);
