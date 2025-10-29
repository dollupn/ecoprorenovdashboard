-- Add PRODUITS to project_media_category enum
ALTER TYPE public.project_media_category ADD VALUE IF NOT EXISTS 'PRODUITS';

-- Create storage bucket for project media if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-media', 'project-media', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for project-media bucket
CREATE POLICY "Users can view project media in their org"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'project-media' AND
    EXISTS (
      SELECT 1 
      FROM public.project_media pm
      JOIN public.memberships m ON m.org_id = pm.org_id
      WHERE pm.storage_path = storage.objects.name
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can upload project media in their org"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'project-media' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can update project media in their org"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'project-media' AND
    auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can delete project media in their org"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'project-media' AND
    auth.uid() IS NOT NULL
  );