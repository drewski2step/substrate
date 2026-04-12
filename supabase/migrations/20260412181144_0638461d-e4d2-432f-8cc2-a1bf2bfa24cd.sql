
-- Fix goals INSERT policy to allow any authenticated user
DROP POLICY IF EXISTS "Anyone can create goals" ON public.goals;
CREATE POLICY "Authenticated users can create goals"
  ON public.goals FOR INSERT
  TO authenticated
  WITH CHECK (true);
