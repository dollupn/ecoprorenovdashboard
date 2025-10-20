-- Add external_reference column to projects table
ALTER TABLE public.projects
ADD COLUMN external_reference TEXT;