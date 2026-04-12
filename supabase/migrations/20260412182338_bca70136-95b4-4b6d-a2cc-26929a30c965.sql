
DROP TRIGGER IF EXISTS on_goal_created_add_owner ON public.goals;

CREATE TRIGGER on_goal_created_add_owner
AFTER INSERT ON public.goals
FOR EACH ROW
EXECUTE FUNCTION public.auto_add_goal_owner();

-- Backfill missing owner memberships
INSERT INTO public.flow_members (goal_id, user_id, role)
SELECT g.id, g.created_by, 'owner'
FROM public.goals g
WHERE g.created_by IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM public.flow_members fm
    WHERE fm.goal_id = g.id AND fm.user_id = g.created_by
);
