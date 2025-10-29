-- Create enum for project media categories
CREATE TYPE public.project_media_category AS ENUM (
  'PHOTOS',
  'DEVIS',
  'FACTURES',
  'CONTRATS',
  'TECHNIQUES',
  'AUTRES'
);

-- Create project_media table
CREATE TABLE IF NOT EXISTS public.project_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  org_id UUID NOT NULL,
  category public.project_media_category NOT NULL DEFAULT 'AUTRES',
  file_name TEXT NOT NULL,
  file_url TEXT,
  preview_url TEXT,
  thumbnail_url TEXT,
  storage_path TEXT,
  mime_type TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create project_status_events table for status change history
CREATE TABLE IF NOT EXISTS public.project_status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  org_id UUID NOT NULL,
  status TEXT NOT NULL,
  changed_by UUID,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT
);

-- Create project_notes table
CREATE TABLE IF NOT EXISTS public.project_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  org_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.project_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_status_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for project_media
CREATE POLICY "Users can view media in their org"
  ON public.project_media FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.memberships m 
    WHERE m.org_id = project_media.org_id 
    AND m.user_id = auth.uid()
  ));

CREATE POLICY "Users can create media in their org"
  ON public.project_media FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.memberships m 
    WHERE m.org_id = project_media.org_id 
    AND m.user_id = auth.uid()
  ));

CREATE POLICY "Users can update media in their org"
  ON public.project_media FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.memberships m 
    WHERE m.org_id = project_media.org_id 
    AND m.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete media in their org"
  ON public.project_media FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.memberships m 
    WHERE m.org_id = project_media.org_id 
    AND m.user_id = auth.uid()
  ));

-- RLS Policies for project_status_events
CREATE POLICY "Users can view status events in their org"
  ON public.project_status_events FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.memberships m 
    WHERE m.org_id = project_status_events.org_id 
    AND m.user_id = auth.uid()
  ));

CREATE POLICY "Users can create status events in their org"
  ON public.project_status_events FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.memberships m 
    WHERE m.org_id = project_status_events.org_id 
    AND m.user_id = auth.uid()
  ));

-- RLS Policies for project_notes
CREATE POLICY "Users can view notes in their org"
  ON public.project_notes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.memberships m 
    WHERE m.org_id = project_notes.org_id 
    AND m.user_id = auth.uid()
  ));

CREATE POLICY "Users can create notes in their org"
  ON public.project_notes FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.memberships m 
    WHERE m.org_id = project_notes.org_id 
    AND m.user_id = auth.uid()
  ));

CREATE POLICY "Users can update notes in their org"
  ON public.project_notes FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.memberships m 
    WHERE m.org_id = project_notes.org_id 
    AND m.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete notes in their org"
  ON public.project_notes FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.memberships m 
    WHERE m.org_id = project_notes.org_id 
    AND m.user_id = auth.uid()
  ));

-- Create indexes for better performance
CREATE INDEX idx_project_media_project_id ON public.project_media(project_id);
CREATE INDEX idx_project_media_org_id ON public.project_media(org_id);
CREATE INDEX idx_project_media_category ON public.project_media(category);
CREATE INDEX idx_project_media_created_at ON public.project_media(created_at DESC);

CREATE INDEX idx_project_status_events_project_id ON public.project_status_events(project_id);
CREATE INDEX idx_project_status_events_org_id ON public.project_status_events(org_id);
CREATE INDEX idx_project_status_events_changed_at ON public.project_status_events(changed_at DESC);

CREATE INDEX idx_project_notes_project_id ON public.project_notes(project_id);
CREATE INDEX idx_project_notes_org_id ON public.project_notes(org_id);
CREATE INDEX idx_project_notes_created_at ON public.project_notes(created_at DESC);

-- Add triggers for updated_at
CREATE TRIGGER update_project_media_updated_at
  BEFORE UPDATE ON public.project_media
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_notes_updated_at
  BEFORE UPDATE ON public.project_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();