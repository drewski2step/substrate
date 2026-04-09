
CREATE TABLE public.block_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id UUID NOT NULL REFERENCES public.blocks(id) ON DELETE CASCADE,
  depends_on_id UUID NOT NULL REFERENCES public.blocks(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (block_id, depends_on_id)
);

ALTER TABLE public.block_dependencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read block_dependencies" ON public.block_dependencies FOR SELECT USING (true);
CREATE POLICY "Anyone can create block_dependencies" ON public.block_dependencies FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete block_dependencies" ON public.block_dependencies FOR DELETE USING (true);
