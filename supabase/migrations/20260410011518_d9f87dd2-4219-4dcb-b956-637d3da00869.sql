
CREATE TABLE public.traces (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  block_id uuid NOT NULL REFERENCES public.blocks(id) ON DELETE CASCADE,
  parent_trace_id uuid REFERENCES public.traces(id) ON DELETE CASCADE,
  agent_name text NOT NULL DEFAULT 'System',
  action text NOT NULL DEFAULT 'note',
  content text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.traces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read traces" ON public.traces FOR SELECT USING (true);
CREATE POLICY "Anyone can create traces" ON public.traces FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update traces" ON public.traces FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete traces" ON public.traces FOR DELETE USING (true);

CREATE INDEX idx_traces_block_id ON public.traces(block_id);
CREATE INDEX idx_traces_parent_trace_id ON public.traces(parent_trace_id);
