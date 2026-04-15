
ALTER TABLE public.blocks
  ADD COLUMN deadline_at timestamptz DEFAULT NULL,
  ADD COLUMN recurrence_interval text DEFAULT NULL;

COMMENT ON COLUMN public.blocks.deadline_at IS 'Optional deadline for block completion';
COMMENT ON COLUMN public.blocks.recurrence_interval IS 'Optional recurrence pattern: daily, weekly, monthly, or custom cron';
