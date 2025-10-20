-- Add address column for construction site to projects table
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS address TEXT;