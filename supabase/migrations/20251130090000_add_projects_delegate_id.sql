-- Add delegate reference to projects
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS delegate_id uuid REFERENCES public.delegates(id) ON DELETE SET NULL;

-- Ensure new column participates in row level security policies implicitly
-- (no additional policies required as existing project policies already govern access).
