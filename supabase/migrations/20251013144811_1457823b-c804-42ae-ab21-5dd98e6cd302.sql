-- Add siren field to projects table
ALTER TABLE public.projects 
ADD COLUMN siren text;