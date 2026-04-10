
-- Add parent_block_id to blocks for recursive nesting
ALTER TABLE public.blocks
ADD COLUMN parent_block_id uuid REFERENCES public.blocks(id) ON DELETE CASCADE;

CREATE INDEX idx_blocks_parent_block_id ON public.blocks(parent_block_id);

-- Create block_chats table
CREATE TABLE public.block_chats (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  block_id uuid NOT NULL REFERENCES public.blocks(id) ON DELETE CASCADE,
  sender_name text NOT NULL DEFAULT 'Anonymous',
  message text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.block_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read block_chats" ON public.block_chats FOR SELECT USING (true);
CREATE POLICY "Anyone can create block_chats" ON public.block_chats FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete block_chats" ON public.block_chats FOR DELETE USING (true);

CREATE INDEX idx_block_chats_block_id ON public.block_chats(block_id);
