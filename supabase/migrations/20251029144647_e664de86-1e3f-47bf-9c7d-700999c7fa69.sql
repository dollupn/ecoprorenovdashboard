-- Add drive_url field to project_media table
ALTER TABLE public.project_media ADD COLUMN IF NOT EXISTS drive_url TEXT;