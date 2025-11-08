-- Create drive connection status enum
CREATE TYPE drive_connection_status AS ENUM ('connected', 'disconnected', 'error', 'pending');

-- Create drive_settings table
CREATE TABLE IF NOT EXISTS public.drive_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  client_id TEXT,
  client_secret TEXT,
  shared_drive_id TEXT,
  root_folder_id TEXT,
  redirect_uri TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(org_id)
);

-- Create drive_credentials table
CREATE TABLE IF NOT EXISTS public.drive_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  access_token TEXT,
  refresh_token TEXT,
  token_type TEXT,
  scope TEXT[],
  expires_at TIMESTAMP WITH TIME ZONE,
  status drive_connection_status DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(org_id)
);

-- Create drive_files table
CREATE TABLE IF NOT EXISTS public.drive_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  drive_file_id TEXT NOT NULL,
  drive_file_name TEXT,
  web_view_link TEXT,
  web_content_link TEXT,
  icon_link TEXT,
  mime_type TEXT,
  entity_type TEXT,
  entity_id UUID,
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX idx_drive_files_org_id ON public.drive_files(org_id);
CREATE INDEX idx_drive_files_entity ON public.drive_files(entity_type, entity_id);
CREATE INDEX idx_drive_credentials_org_id ON public.drive_credentials(org_id);
CREATE INDEX idx_drive_settings_org_id ON public.drive_settings(org_id);

-- Enable RLS
ALTER TABLE public.drive_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drive_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drive_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies for drive_settings
CREATE POLICY "Users can view their organization's drive settings"
  ON public.drive_settings
  FOR SELECT
  USING (has_org_membership(auth.uid(), org_id));

CREATE POLICY "Owners and admins can insert drive settings"
  ON public.drive_settings
  FOR INSERT
  WITH CHECK (is_org_owner_or_admin(auth.uid(), org_id));

CREATE POLICY "Owners and admins can update drive settings"
  ON public.drive_settings
  FOR UPDATE
  USING (is_org_owner_or_admin(auth.uid(), org_id));

CREATE POLICY "Owners and admins can delete drive settings"
  ON public.drive_settings
  FOR DELETE
  USING (is_org_owner_or_admin(auth.uid(), org_id));

-- RLS Policies for drive_credentials
CREATE POLICY "Users can view their organization's drive credentials"
  ON public.drive_credentials
  FOR SELECT
  USING (has_org_membership(auth.uid(), org_id));

CREATE POLICY "Users can insert drive credentials for their org"
  ON public.drive_credentials
  FOR INSERT
  WITH CHECK (has_org_membership(auth.uid(), org_id));

CREATE POLICY "Users can update drive credentials for their org"
  ON public.drive_credentials
  FOR UPDATE
  USING (has_org_membership(auth.uid(), org_id));

CREATE POLICY "Owners and admins can delete drive credentials"
  ON public.drive_credentials
  FOR DELETE
  USING (is_org_owner_or_admin(auth.uid(), org_id));

-- RLS Policies for drive_files
CREATE POLICY "Users can view their organization's drive files"
  ON public.drive_files
  FOR SELECT
  USING (has_org_membership(auth.uid(), org_id));

CREATE POLICY "Users can insert drive files for their org"
  ON public.drive_files
  FOR INSERT
  WITH CHECK (has_org_membership(auth.uid(), org_id));

CREATE POLICY "Users can delete their organization's drive files"
  ON public.drive_files
  FOR DELETE
  USING (has_org_membership(auth.uid(), org_id));

-- Add update trigger for drive_settings
CREATE TRIGGER update_drive_settings_updated_at
  BEFORE UPDATE ON public.drive_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add update trigger for drive_credentials
CREATE TRIGGER update_drive_credentials_updated_at
  BEFORE UPDATE ON public.drive_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();