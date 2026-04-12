
-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "Anyone can view edit history" ON public.edit_history;

-- Allow viewing edit history only when the entity belongs to a public goal or user is a flow member
CREATE POLICY "Edit history visible for public goals or flow members"
ON public.edit_history FOR SELECT
USING (
  -- entity is a goal itself
  (entity_type = 'goal' AND (
    get_goal_visibility(entity_id) = 'public'
    OR is_flow_member(auth.uid(), entity_id)
  ))
  OR
  -- entity is a block — look up its goal_id
  (entity_type = 'block' AND (
    EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE b.id = edit_history.entity_id
      AND (get_goal_visibility(b.goal_id) = 'public' OR is_flow_member(auth.uid(), b.goal_id))
    )
  ))
  OR
  -- entity is a discussion — look up its goal_id
  (entity_type = 'discussion' AND (
    EXISTS (
      SELECT 1 FROM public.discussions d
      WHERE d.id = edit_history.entity_id
      AND (get_goal_visibility(d.goal_id) = 'public' OR is_flow_member(auth.uid(), d.goal_id))
    )
  ))
);
