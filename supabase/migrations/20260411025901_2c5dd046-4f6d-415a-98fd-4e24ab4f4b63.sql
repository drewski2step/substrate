
-- Create edit_history table
CREATE TABLE public.edit_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  field_changed text NOT NULL,
  old_value text,
  new_value text,
  changed_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.edit_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view edit history"
  ON public.edit_history FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create edit history"
  ON public.edit_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = changed_by);

-- Add soft-delete columns
ALTER TABLE public.goals ADD COLUMN deleted_at timestamp with time zone DEFAULT NULL;
ALTER TABLE public.blocks ADD COLUMN deleted_at timestamp with time zone DEFAULT NULL;
