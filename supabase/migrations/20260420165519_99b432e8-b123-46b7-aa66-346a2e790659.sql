ALTER TABLE public.blocks
  ADD COLUMN IF NOT EXISTS brick_color text,
  ADD COLUMN IF NOT EXISTS completed_by uuid,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_blocks_completed_at ON public.blocks(completed_at);