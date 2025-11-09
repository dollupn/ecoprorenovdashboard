-- Ensure backup configuration columns exist and are nullable
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS backup_webhook_url TEXT,
  ADD COLUMN IF NOT EXISTS backup_daily_enabled BOOLEAN,
  ADD COLUMN IF NOT EXISTS backup_time TEXT;

-- Align column nullability and defaults
ALTER TABLE public.settings
  ALTER COLUMN backup_daily_enabled DROP NOT NULL,
  ALTER COLUMN backup_daily_enabled SET DEFAULT false,
  ALTER COLUMN backup_time DROP NOT NULL,
  ALTER COLUMN backup_time SET DEFAULT '02:00';
