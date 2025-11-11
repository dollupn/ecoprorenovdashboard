-- Create table for tracking Google Drive project folders
CREATE TABLE IF NOT EXISTS public.project_drive_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  drive_folder_id text NOT NULL,
  folder_name text NOT NULL,
  web_view_link text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, org_id)
);

-- Enable RLS
ALTER TABLE public.project_drive_folders ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view folders in their org"
  ON public.project_drive_folders FOR SELECT
  USING (has_org_membership(auth.uid(), org_id));

CREATE POLICY "Users can create folders in their org"
  ON public.project_drive_folders FOR INSERT
  WITH CHECK (has_org_membership(auth.uid(), org_id));

CREATE POLICY "Users can update folders in their org"
  ON public.project_drive_folders FOR UPDATE
  USING (has_org_membership(auth.uid(), org_id));

-- Add trigger for updated_at
CREATE TRIGGER update_project_drive_folders_updated_at
  BEFORE UPDATE ON public.project_drive_folders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Drop storage policies that depend on project_media columns
DROP POLICY IF EXISTS "Users can view project media in their org" ON storage.objects;

-- Update project_media table to remove Supabase storage fields
ALTER TABLE public.project_media 
  DROP COLUMN IF EXISTS file_url,
  DROP COLUMN IF EXISTS preview_url,
  DROP COLUMN IF EXISTS thumbnail_url,
  DROP COLUMN IF EXISTS storage_path;

-- Make drive_url required (set default empty string first for existing rows)
UPDATE public.project_media SET drive_url = '' WHERE drive_url IS NULL;
ALTER TABLE public.project_media 
  ALTER COLUMN drive_url SET NOT NULL,
  ALTER COLUMN drive_url SET DEFAULT '';