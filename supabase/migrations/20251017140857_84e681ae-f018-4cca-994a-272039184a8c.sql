-- Add source column to projects table
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS source TEXT;