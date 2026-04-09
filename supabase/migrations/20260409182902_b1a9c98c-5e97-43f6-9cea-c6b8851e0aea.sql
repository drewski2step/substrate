
DROP POLICY "Authenticated users can create goals" ON public.goals;
DROP POLICY "Users can update their own goals" ON public.goals;
DROP POLICY "Users can delete their own goals" ON public.goals;

CREATE POLICY "Anyone can create goals" ON public.goals FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update goals" ON public.goals FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete goals" ON public.goals FOR DELETE USING (true);

DROP POLICY "Authenticated users can create blocks" ON public.blocks;
DROP POLICY "Users can update their own blocks" ON public.blocks;
DROP POLICY "Users can delete their own blocks" ON public.blocks;

CREATE POLICY "Anyone can create blocks" ON public.blocks FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update blocks" ON public.blocks FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete blocks" ON public.blocks FOR DELETE USING (true);

DROP POLICY "Authenticated users can create signals" ON public.signals;
CREATE POLICY "Anyone can create signals" ON public.signals FOR INSERT WITH CHECK (true);
