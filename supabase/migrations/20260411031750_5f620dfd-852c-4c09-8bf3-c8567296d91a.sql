
-- Add is_files_block column
ALTER TABLE public.blocks ADD COLUMN IF NOT EXISTS is_files_block boolean NOT NULL DEFAULT false;

-- Create trigger function to auto-create files blocks
CREATE OR REPLACE FUNCTION public.auto_create_files_block()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only create a files block for non-files blocks
  IF NEW.is_files_block = false THEN
    INSERT INTO public.blocks (title, parent_block_id, goal_id, created_by, status, is_files_block)
    VALUES (NEW.title || ' Files', NEW.id, NEW.goal_id, NEW.created_by, 'active', true);
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS on_block_created_files ON public.blocks;
CREATE TRIGGER on_block_created_files
  AFTER INSERT ON public.blocks
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_files_block();

-- Retroactively create files blocks for existing blocks that don't have one
INSERT INTO public.blocks (title, parent_block_id, goal_id, created_by, status, is_files_block)
SELECT 
  b.title || ' Files',
  b.id,
  b.goal_id,
  b.created_by,
  'active',
  true
FROM public.blocks b
WHERE b.is_files_block = false
  AND b.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.blocks fb 
    WHERE fb.parent_block_id = b.id 
      AND fb.is_files_block = true
  );
