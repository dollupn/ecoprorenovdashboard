-- Add backup-related columns to settings table
ALTER TABLE settings 
  ADD COLUMN IF NOT EXISTS backup_webhook_url TEXT,
  ADD COLUMN IF NOT EXISTS backup_daily_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS backup_time TIME;

-- Add helpful comments
COMMENT ON COLUMN settings.backup_webhook_url IS 'Webhook URL for automated project backup exports';
COMMENT ON COLUMN settings.backup_daily_enabled IS 'Enable daily automated backup exports';
COMMENT ON COLUMN settings.backup_time IS 'Time of day to run daily backup exports (e.g. 09:00:00)';