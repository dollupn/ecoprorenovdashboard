-- Add backup configuration columns to settings
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS backup_webhook_url TEXT,
  ADD COLUMN IF NOT EXISTS backup_daily_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS backup_time TEXT DEFAULT '02:00';

-- Ensure existing rows have the expected defaults
UPDATE public.settings
SET
  backup_daily_enabled = COALESCE(backup_daily_enabled, false),
  backup_time = COALESCE(backup_time, '02:00');
