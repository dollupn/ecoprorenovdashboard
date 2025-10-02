-- Add phone field to projects table
ALTER TABLE public.projects ADD COLUMN phone text;

COMMENT ON COLUMN public.projects.phone IS 'Client phone number';