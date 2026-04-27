-- Add new columns to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS about text,
  ADD COLUMN IF NOT EXISTS social_instagram text,
  ADD COLUMN IF NOT EXISTS social_youtube text,
  ADD COLUMN IF NOT EXISTS social_twitter text,
  ADD COLUMN IF NOT EXISTS social_linkedin text,
  ADD COLUMN IF NOT EXISTS social_substack text,
  ADD COLUMN IF NOT EXISTS social_github text,
  ADD COLUMN IF NOT EXISTS social_website text;

-- Create experience entries table
CREATE TABLE IF NOT EXISTS public.profile_experiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  organization text NOT NULL,
  experience_type text NOT NULL CHECK (experience_type IN ('work','education','mission','volunteer','project')),
  start_date date NOT NULL,
  end_date date,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profile_experiences ENABLE ROW LEVEL SECURITY;

-- Anyone can read experiences
CREATE POLICY "Public experience read"
  ON public.profile_experiences FOR SELECT
  USING (true);

-- Users can only insert their own
CREATE POLICY "Users insert own experiences"
  ON public.profile_experiences FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can only update their own
CREATE POLICY "Users update own experiences"
  ON public.profile_experiences FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Users can only delete their own
CREATE POLICY "Users delete own experiences"
  ON public.profile_experiences FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
