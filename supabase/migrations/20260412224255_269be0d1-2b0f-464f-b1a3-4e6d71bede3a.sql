
-- Add heat column to goals
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS heat integer NOT NULL DEFAULT 0;
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS heat_updated_at timestamp with time zone NOT NULL DEFAULT now();

-- Create mission_followers table
CREATE TABLE public.mission_followers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL,
  user_id uuid NOT NULL,
  followed_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (goal_id, user_id)
);

ALTER TABLE public.mission_followers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view mission followers"
  ON public.mission_followers FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can follow"
  ON public.mission_followers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unfollow"
  ON public.mission_followers FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Trigger: block created -> mission heat +5
CREATE OR REPLACE FUNCTION public.on_block_created_mission_heat()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.goal_id IS NOT NULL AND NEW.is_files_block = false THEN
    UPDATE public.goals SET heat = heat + 5, heat_updated_at = now() WHERE id = NEW.goal_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_block_created_mission_heat
  AFTER INSERT ON public.blocks
  FOR EACH ROW EXECUTE FUNCTION public.on_block_created_mission_heat();

-- Trigger: discussion posted -> mission heat +3
CREATE OR REPLACE FUNCTION public.on_discussion_created_mission_heat()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.goal_id IS NOT NULL THEN
    UPDATE public.goals SET heat = heat + 3, heat_updated_at = now() WHERE id = NEW.goal_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_discussion_created_mission_heat
  AFTER INSERT ON public.discussions
  FOR EACH ROW EXECUTE FUNCTION public.on_discussion_created_mission_heat();

-- Trigger: block pledged -> mission heat +10
CREATE OR REPLACE FUNCTION public.on_pledge_created_mission_heat()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _goal_id uuid;
BEGIN
  SELECT goal_id INTO _goal_id FROM public.blocks WHERE id = NEW.block_id;
  IF _goal_id IS NOT NULL THEN
    UPDATE public.goals SET heat = heat + 10, heat_updated_at = now() WHERE id = _goal_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pledge_created_mission_heat
  AFTER INSERT ON public.block_pledges
  FOR EACH ROW EXECUTE FUNCTION public.on_pledge_created_mission_heat();

-- Trigger: block completed -> mission heat +15
CREATE OR REPLACE FUNCTION public.on_block_completed_mission_heat()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'done' AND (OLD.status IS NULL OR OLD.status <> 'done') AND NEW.goal_id IS NOT NULL THEN
    UPDATE public.goals SET heat = heat + 15, heat_updated_at = now() WHERE id = NEW.goal_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_block_completed_mission_heat
  AFTER UPDATE ON public.blocks
  FOR EACH ROW EXECUTE FUNCTION public.on_block_completed_mission_heat();

-- Trigger: follower joined -> mission heat +30
CREATE OR REPLACE FUNCTION public.on_follower_joined_mission_heat()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.goals SET heat = heat + 30, heat_updated_at = now() WHERE id = NEW.goal_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_follower_joined_mission_heat
  AFTER INSERT ON public.mission_followers
  FOR EACH ROW EXECUTE FUNCTION public.on_follower_joined_mission_heat();

-- Trigger: follower left -> mission heat -20 (min 0)
CREATE OR REPLACE FUNCTION public.on_follower_left_mission_heat()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.goals SET heat = GREATEST(heat - 20, 0), heat_updated_at = now() WHERE id = OLD.goal_id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_follower_left_mission_heat
  AFTER DELETE ON public.mission_followers
  FOR EACH ROW EXECUTE FUNCTION public.on_follower_left_mission_heat();
