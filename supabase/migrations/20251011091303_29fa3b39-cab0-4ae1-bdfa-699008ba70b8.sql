-- Create user roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'commercial', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, org_id)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _org_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND org_id = _org_id
      AND role = _role
  )
$$;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND org_id = _org_id
      AND role = 'admin'
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "Users can view roles in their organizations"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.org_id = user_roles.org_id
      AND m.user_id = auth.uid()
  )
);

CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin(auth.uid(), org_id)
);

CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  public.is_admin(auth.uid(), org_id)
);

CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  public.is_admin(auth.uid(), org_id)
);

-- Update leads RLS for commercial role
DROP POLICY IF EXISTS "Users can view leads in their organization" ON public.leads;
CREATE POLICY "Users can view their assigned leads or all if admin"
ON public.leads
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.org_id = leads.org_id
      AND m.user_id = auth.uid()
  )
  AND (
    public.is_admin(auth.uid(), org_id)
    OR assigned_to::uuid = auth.uid()
    OR created_by = auth.uid()
  )
);

-- Update projects RLS for commercial role
DROP POLICY IF EXISTS "Users can view projects in their organization" ON public.projects;
CREATE POLICY "Users can view their assigned projects or all if admin"
ON public.projects
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.org_id = projects.org_id
      AND m.user_id = auth.uid()
  )
  AND (
    public.is_admin(auth.uid(), org_id)
    OR assigned_to = auth.uid()::text
  )
);

-- Update sites RLS for commercial role  
DROP POLICY IF EXISTS "Users can view sites in their organization" ON public.sites;
CREATE POLICY "Users can view their assigned sites or all if admin"
ON public.sites
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.org_id = sites.org_id
      AND m.user_id = auth.uid()
  )
  AND (
    public.is_admin(auth.uid(), org_id)
    OR auth.uid()::text = ANY(team_members)
  )
);