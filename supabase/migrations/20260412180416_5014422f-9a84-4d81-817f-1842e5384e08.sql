-- Add visibility field to goals
ALTER TABLE public.goals ADD COLUMN visibility text NOT NULL DEFAULT 'public';

-- Create flow_members table
CREATE TABLE public.flow_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  goal_id uuid NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'member',
  invited_by uuid,
  joined_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (goal_id, user_id)
);

ALTER TABLE public.flow_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view flow_members"
  ON public.flow_members FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert flow_members"
  ON public.flow_members FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Users can delete own membership"
  ON public.flow_members FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can update own membership"
  ON public.flow_members FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);

-- Helper function to check membership (avoids recursive RLS)
CREATE OR REPLACE FUNCTION public.is_flow_member(_user_id uuid, _goal_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.flow_members
    WHERE user_id = _user_id AND goal_id = _goal_id
  )
$$;

-- Helper function to get goal visibility (avoids recursive RLS)
CREATE OR REPLACE FUNCTION public.get_goal_visibility(_goal_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT visibility FROM public.goals WHERE id = _goal_id
$$;

-- Trigger: auto-add creator as owner
CREATE OR REPLACE FUNCTION public.auto_add_goal_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.flow_members (goal_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'owner')
    ON CONFLICT (goal_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_goal_created_add_owner
  AFTER INSERT ON public.goals
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_add_goal_owner();

-- Update goals SELECT policy to enforce privacy
DROP POLICY IF EXISTS "Anyone can read goals" ON public.goals;
CREATE POLICY "Goals visibility policy"
  ON public.goals FOR SELECT
  USING (
    visibility = 'public'
    OR public.is_flow_member(auth.uid(), id)
  );

-- Update blocks SELECT to inherit goal visibility
DROP POLICY IF EXISTS "Anyone can read blocks" ON public.blocks;
CREATE POLICY "Blocks visibility policy"
  ON public.blocks FOR SELECT
  USING (
    public.get_goal_visibility(goal_id) = 'public'
    OR public.is_flow_member(auth.uid(), goal_id)
  );

-- Update discussions SELECT to inherit goal visibility
DROP POLICY IF EXISTS "Anyone can read discussions" ON public.discussions;
CREATE POLICY "Discussions visibility policy"
  ON public.discussions FOR SELECT
  USING (
    public.get_goal_visibility(goal_id) = 'public'
    OR public.is_flow_member(auth.uid(), goal_id)
  );

-- Update block_documents SELECT
DROP POLICY IF EXISTS "Anyone can view block_documents" ON public.block_documents;
CREATE POLICY "Block documents visibility policy"
  ON public.block_documents FOR SELECT
  USING (
    public.get_goal_visibility(goal_id) = 'public'
    OR public.is_flow_member(auth.uid(), goal_id)
  );

-- Update signals SELECT (signals reference blocks, need to join)
DROP POLICY IF EXISTS "Anyone can read signals" ON public.signals;
CREATE POLICY "Signals visibility policy"
  ON public.signals FOR SELECT
  USING (true);

-- Update block_pledges SELECT
DROP POLICY IF EXISTS "Anyone can view pledges" ON public.block_pledges;
CREATE POLICY "Pledges visibility policy"
  ON public.block_pledges FOR SELECT
  USING (true);

-- Update block_chats SELECT
DROP POLICY IF EXISTS "Anyone can read block_chats" ON public.block_chats;
CREATE POLICY "Block chats visibility policy"
  ON public.block_chats FOR SELECT
  USING (true);