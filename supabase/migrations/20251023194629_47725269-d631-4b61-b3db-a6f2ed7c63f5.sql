-- Add delegate_id column to projects table
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS delegate_id uuid REFERENCES public.delegates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_delegate_id ON public.projects(delegate_id);

COMMENT ON COLUMN public.projects.delegate_id IS 'Reference to delegate handling CEE for this project';