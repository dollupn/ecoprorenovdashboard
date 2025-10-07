-- Create organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  siret TEXT,
  tva TEXT,
  address TEXT,
  postal_code TEXT,
  city TEXT,
  country TEXT DEFAULT 'FR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create role enum
CREATE TYPE public.org_role AS ENUM ('owner', 'admin', 'member');

-- Create memberships table
CREATE TABLE IF NOT EXISTS public.memberships (
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.org_role NOT NULL DEFAULT 'member',
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);

CREATE INDEX IF NOT EXISTS memberships_user_idx ON public.memberships (user_id);
CREATE INDEX IF NOT EXISTS memberships_org_idx ON public.memberships (org_id);

-- Add org_id to all existing tables
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.sites ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;
ALTER TABLE public.product_catalog ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Create indexes for org_id
CREATE INDEX IF NOT EXISTS leads_org_idx ON public.leads (org_id);
CREATE INDEX IF NOT EXISTS projects_org_idx ON public.projects (org_id);
CREATE INDEX IF NOT EXISTS sites_org_idx ON public.sites (org_id);
CREATE INDEX IF NOT EXISTS quotes_org_idx ON public.quotes (org_id);
CREATE INDEX IF NOT EXISTS invoices_org_idx ON public.invoices (org_id);
CREATE INDEX IF NOT EXISTS product_catalog_org_idx ON public.product_catalog (org_id);

-- Enable RLS on new tables
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organizations
CREATE POLICY "Users can view organizations they are member of"
  ON public.organizations FOR SELECT
  USING (
    EXISTS(
      SELECT 1 FROM public.memberships m 
      WHERE m.org_id = organizations.id 
      AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert organizations"
  ON public.organizations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Owners and admins can update their organization"
  ON public.organizations FOR UPDATE
  USING (
    EXISTS(
      SELECT 1 FROM public.memberships m 
      WHERE m.org_id = organizations.id 
      AND m.user_id = auth.uid() 
      AND m.role IN ('owner', 'admin')
    )
  );

-- RLS Policies for memberships
CREATE POLICY "Users can view memberships of their organizations"
  ON public.memberships FOR SELECT
  USING (
    EXISTS(
      SELECT 1 FROM public.memberships m 
      WHERE m.org_id = memberships.org_id 
      AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners and admins can insert memberships"
  ON public.memberships FOR INSERT
  WITH CHECK (
    EXISTS(
      SELECT 1 FROM public.memberships m 
      WHERE m.org_id = memberships.org_id 
      AND m.user_id = auth.uid() 
      AND m.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Owners and admins can update memberships"
  ON public.memberships FOR UPDATE
  USING (
    EXISTS(
      SELECT 1 FROM public.memberships m 
      WHERE m.org_id = memberships.org_id 
      AND m.user_id = auth.uid() 
      AND m.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Owners and admins can delete memberships"
  ON public.memberships FOR DELETE
  USING (
    EXISTS(
      SELECT 1 FROM public.memberships m 
      WHERE m.org_id = memberships.org_id 
      AND m.user_id = auth.uid() 
      AND m.role IN ('owner', 'admin')
    )
  );

-- Update RLS policies for existing tables to include org_id check
-- Leads
DROP POLICY IF EXISTS "Users can view their own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can create their own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can update their own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can delete their own leads" ON public.leads;

CREATE POLICY "Users can view leads in their organization"
  ON public.leads FOR SELECT
  USING (
    EXISTS(
      SELECT 1 FROM public.memberships m 
      WHERE m.org_id = leads.org_id 
      AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create leads in their organization"
  ON public.leads FOR INSERT
  WITH CHECK (
    EXISTS(
      SELECT 1 FROM public.memberships m 
      WHERE m.org_id = leads.org_id 
      AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update leads in their organization"
  ON public.leads FOR UPDATE
  USING (
    EXISTS(
      SELECT 1 FROM public.memberships m 
      WHERE m.org_id = leads.org_id 
      AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete leads in their organization"
  ON public.leads FOR DELETE
  USING (
    EXISTS(
      SELECT 1 FROM public.memberships m 
      WHERE m.org_id = leads.org_id 
      AND m.user_id = auth.uid()
    )
  );

-- Projects
DROP POLICY IF EXISTS "Users can view their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can create their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete their own projects" ON public.projects;

CREATE POLICY "Users can view projects in their organization"
  ON public.projects FOR SELECT
  USING (
    EXISTS(
      SELECT 1 FROM public.memberships m 
      WHERE m.org_id = projects.org_id 
      AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create projects in their organization"
  ON public.projects FOR INSERT
  WITH CHECK (
    EXISTS(
      SELECT 1 FROM public.memberships m 
      WHERE m.org_id = projects.org_id 
      AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update projects in their organization"
  ON public.projects FOR UPDATE
  USING (
    EXISTS(
      SELECT 1 FROM public.memberships m 
      WHERE m.org_id = projects.org_id 
      AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete projects in their organization"
  ON public.projects FOR DELETE
  USING (
    EXISTS(
      SELECT 1 FROM public.memberships m 
      WHERE m.org_id = projects.org_id 
      AND m.user_id = auth.uid()
    )
  );

-- Sites
DROP POLICY IF EXISTS "Users can view their own sites" ON public.sites;
DROP POLICY IF EXISTS "Users can create their own sites" ON public.sites;
DROP POLICY IF EXISTS "Users can update their own sites" ON public.sites;
DROP POLICY IF EXISTS "Users can delete their own sites" ON public.sites;

CREATE POLICY "Users can view sites in their organization"
  ON public.sites FOR SELECT
  USING (
    EXISTS(
      SELECT 1 FROM public.memberships m 
      WHERE m.org_id = sites.org_id 
      AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create sites in their organization"
  ON public.sites FOR INSERT
  WITH CHECK (
    EXISTS(
      SELECT 1 FROM public.memberships m 
      WHERE m.org_id = sites.org_id 
      AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update sites in their organization"
  ON public.sites FOR UPDATE
  USING (
    EXISTS(
      SELECT 1 FROM public.memberships m 
      WHERE m.org_id = sites.org_id 
      AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete sites in their organization"
  ON public.sites FOR DELETE
  USING (
    EXISTS(
      SELECT 1 FROM public.memberships m 
      WHERE m.org_id = sites.org_id 
      AND m.user_id = auth.uid()
    )
  );

-- Quotes
DROP POLICY IF EXISTS "Users can view their own quotes" ON public.quotes;
DROP POLICY IF EXISTS "Users can create their own quotes" ON public.quotes;
DROP POLICY IF EXISTS "Users can update their own quotes" ON public.quotes;
DROP POLICY IF EXISTS "Users can delete their own quotes" ON public.quotes;

CREATE POLICY "Users can view quotes in their organization"
  ON public.quotes FOR SELECT
  USING (
    EXISTS(
      SELECT 1 FROM public.memberships m 
      WHERE m.org_id = quotes.org_id 
      AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create quotes in their organization"
  ON public.quotes FOR INSERT
  WITH CHECK (
    EXISTS(
      SELECT 1 FROM public.memberships m 
      WHERE m.org_id = quotes.org_id 
      AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update quotes in their organization"
  ON public.quotes FOR UPDATE
  USING (
    EXISTS(
      SELECT 1 FROM public.memberships m 
      WHERE m.org_id = quotes.org_id 
      AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete quotes in their organization"
  ON public.quotes FOR DELETE
  USING (
    EXISTS(
      SELECT 1 FROM public.memberships m 
      WHERE m.org_id = quotes.org_id 
      AND m.user_id = auth.uid()
    )
  );

-- Invoices
DROP POLICY IF EXISTS "Users can view their own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can create their own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can update their own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can delete their own invoices" ON public.invoices;

CREATE POLICY "Users can view invoices in their organization"
  ON public.invoices FOR SELECT
  USING (
    EXISTS(
      SELECT 1 FROM public.memberships m 
      WHERE m.org_id = invoices.org_id 
      AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create invoices in their organization"
  ON public.invoices FOR INSERT
  WITH CHECK (
    EXISTS(
      SELECT 1 FROM public.memberships m 
      WHERE m.org_id = invoices.org_id 
      AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update invoices in their organization"
  ON public.invoices FOR UPDATE
  USING (
    EXISTS(
      SELECT 1 FROM public.memberships m 
      WHERE m.org_id = invoices.org_id 
      AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete invoices in their organization"
  ON public.invoices FOR DELETE
  USING (
    EXISTS(
      SELECT 1 FROM public.memberships m 
      WHERE m.org_id = invoices.org_id 
      AND m.user_id = auth.uid()
    )
  );

-- Product catalog
DROP POLICY IF EXISTS "Users can view their own products" ON public.product_catalog;
DROP POLICY IF EXISTS "Users can create their own products" ON public.product_catalog;
DROP POLICY IF EXISTS "Users can update their own products" ON public.product_catalog;
DROP POLICY IF EXISTS "Users can delete their own products" ON public.product_catalog;

CREATE POLICY "Users can view products in their organization"
  ON public.product_catalog FOR SELECT
  USING (
    EXISTS(
      SELECT 1 FROM public.memberships m 
      WHERE m.org_id = product_catalog.org_id 
      AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create products in their organization"
  ON public.product_catalog FOR INSERT
  WITH CHECK (
    EXISTS(
      SELECT 1 FROM public.memberships m 
      WHERE m.org_id = product_catalog.org_id 
      AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update products in their organization"
  ON public.product_catalog FOR UPDATE
  USING (
    EXISTS(
      SELECT 1 FROM public.memberships m 
      WHERE m.org_id = product_catalog.org_id 
      AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete products in their organization"
  ON public.product_catalog FOR DELETE
  USING (
    EXISTS(
      SELECT 1 FROM public.memberships m 
      WHERE m.org_id = product_catalog.org_id 
      AND m.user_id = auth.uid()
    )
  );

-- Function to create default organization for new users
CREATE OR REPLACE FUNCTION public.handle_new_user_organization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
BEGIN
  -- Create a default organization
  INSERT INTO public.organizations (name)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)) || ' Organization')
  RETURNING id INTO new_org_id;
  
  -- Add user as owner
  INSERT INTO public.memberships (org_id, user_id, role)
  VALUES (new_org_id, NEW.id, 'owner');
  
  RETURN NEW;
END;
$$;

-- Update the existing trigger or create new one
DROP TRIGGER IF EXISTS on_auth_user_created_org ON auth.users;
CREATE TRIGGER on_auth_user_created_org
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_organization();

-- Trigger for updated_at on organizations
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();