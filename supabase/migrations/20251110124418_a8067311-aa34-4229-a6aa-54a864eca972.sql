-- Create function to check if user is admin or owner
CREATE OR REPLACE FUNCTION public.is_admin_or_owner(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Check if user is owner or admin in memberships table
    SELECT 1
    FROM public.memberships
    WHERE user_id = _user_id
      AND org_id = _org_id
      AND role IN ('owner', 'admin')
  ) OR EXISTS (
    -- OR check if user is admin in user_roles table
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND org_id = _org_id
      AND role = 'admin'
  )
$$;

-- Update Leads RLS Policy
DROP POLICY IF EXISTS "Users can view their assigned leads or all if admin" ON public.leads;
CREATE POLICY "Users can view their assigned leads or all if admin/owner"
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
    public.is_admin_or_owner(auth.uid(), org_id)
    OR assigned_to = auth.uid()
    OR created_by = auth.uid()
  )
);

-- Update Projects RLS Policy
DROP POLICY IF EXISTS "Users can view their assigned projects or all if admin" ON public.projects;
CREATE POLICY "Users can view their assigned projects or all if admin/owner"
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
    public.is_admin_or_owner(auth.uid(), org_id)
    OR assigned_to = auth.uid()::text
  )
);

-- Update Sites RLS Policy
DROP POLICY IF EXISTS "Users can view their assigned sites or all if admin" ON public.sites;
CREATE POLICY "Users can view their assigned sites or all if admin/owner"
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
    public.is_admin_or_owner(auth.uid(), org_id)
    OR (auth.uid())::text = ANY(team_members)
    OR user_id = auth.uid()
  )
);