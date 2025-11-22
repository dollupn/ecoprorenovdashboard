-- Fix incorrect RLS policies on kpi_goals to allow org members to read and admins/owners to manage

-- Ensure RLS is enabled
ALTER TABLE public.kpi_goals ENABLE ROW LEVEL SECURITY;

-- Drop existing incorrect policies
DROP POLICY IF EXISTS "Users can view their org's KPI goals" ON public.kpi_goals;
DROP POLICY IF EXISTS "Users can create KPI goals for their org" ON public.kpi_goals;
DROP POLICY IF EXISTS "Users can update their org's KPI goals" ON public.kpi_goals;
DROP POLICY IF EXISTS "Users can delete their org's KPI goals" ON public.kpi_goals;

-- Members of an organization can view its KPI goals
CREATE POLICY "Users can view KPI goals in their organization"
ON public.kpi_goals
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.org_id = kpi_goals.org_id
      AND m.user_id = auth.uid()
  )
);

-- Only admins/owners can insert KPI goals for their org
CREATE POLICY "Owners and admins can insert KPI goals"
ON public.kpi_goals
FOR INSERT
WITH CHECK (
  public.is_admin_or_owner(auth.uid(), org_id)
);

-- Only admins/owners can update KPI goals for their org
CREATE POLICY "Owners and admins can update KPI goals"
ON public.kpi_goals
FOR UPDATE
USING (
  public.is_admin_or_owner(auth.uid(), org_id)
)
WITH CHECK (
  public.is_admin_or_owner(auth.uid(), org_id)
);

-- Only admins/owners can delete KPI goals for their org
CREATE POLICY "Owners and admins can delete KPI goals"
ON public.kpi_goals
FOR DELETE
USING (
  public.is_admin_or_owner(auth.uid(), org_id)
);
