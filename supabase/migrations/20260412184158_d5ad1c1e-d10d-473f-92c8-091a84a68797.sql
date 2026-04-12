-- Fix UPDATE policy with explicit WITH CHECK
DROP POLICY IF EXISTS "Anyone can update goals" ON public.goals;
CREATE POLICY "Anyone can update goals"
  ON public.goals
  FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

-- Backfill missing flow_members for goals with created_by
INSERT INTO public.flow_members (goal_id, user_id, role)
SELECT g.id, g.created_by, 'owner'
FROM public.goals g
WHERE g.created_by IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.flow_members fm
    WHERE fm.goal_id = g.id AND fm.user_id = g.created_by
  )
ON CONFLICT (goal_id, user_id) DO NOTHING;