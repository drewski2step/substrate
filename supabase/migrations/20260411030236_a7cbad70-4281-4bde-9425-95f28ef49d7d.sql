
ALTER TABLE public.discussions ADD COLUMN edited_at timestamp with time zone DEFAULT NULL;
ALTER TABLE public.discussions ADD COLUMN deleted_at timestamp with time zone DEFAULT NULL;

-- Replace overly permissive update/delete policies with owner-only
DROP POLICY IF EXISTS "Anyone can update discussions" ON public.discussions;
DROP POLICY IF EXISTS "Anyone can delete discussions" ON public.discussions;

CREATE POLICY "Users can update own discussions"
  ON public.discussions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own discussions"
  ON public.discussions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
