-- Create project_updates table for quick status updates
CREATE TABLE IF NOT EXISTS public.project_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  org_id UUID NOT NULL,
  content TEXT,
  status TEXT,
  next_step TEXT,
  author_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.project_updates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view updates in their org"
  ON public.project_updates FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.memberships m 
    WHERE m.org_id = project_updates.org_id 
    AND m.user_id = auth.uid()
  ));

CREATE POLICY "Users can create updates in their org"
  ON public.project_updates FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.memberships m 
    WHERE m.org_id = project_updates.org_id 
    AND m.user_id = auth.uid()
  ));

CREATE POLICY "Users can update updates in their org"
  ON public.project_updates FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.memberships m 
    WHERE m.org_id = project_updates.org_id 
    AND m.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete updates in their org"
  ON public.project_updates FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.memberships m 
    WHERE m.org_id = project_updates.org_id 
    AND m.user_id = auth.uid()
  ));

-- Create indexes for better performance
CREATE INDEX idx_project_updates_project_id ON public.project_updates(project_id);
CREATE INDEX idx_project_updates_org_id ON public.project_updates(org_id);
CREATE INDEX idx_project_updates_author_id ON public.project_updates(author_id);
CREATE INDEX idx_project_updates_created_at ON public.project_updates(created_at DESC);

-- Add trigger for updated_at
CREATE TRIGGER update_project_updates_updated_at
  BEFORE UPDATE ON public.project_updates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();