-- Create table to store KPI goals per organization
CREATE TABLE IF NOT EXISTS public.kpi_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  target_surface_m2 NUMERIC NOT NULL CHECK (target_surface_m2 >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT kpi_goals_unique_slug UNIQUE (org_id, slug)
);

-- Maintain updated_at automatically
CREATE TRIGGER update_kpi_goals_updated_at
BEFORE UPDATE ON public.kpi_goals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_kpi_goals_org_id ON public.kpi_goals(org_id);
CREATE INDEX IF NOT EXISTS idx_kpi_goals_org_active ON public.kpi_goals(org_id)
WHERE is_active;

-- Enable row level security
ALTER TABLE public.kpi_goals ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read KPI goals from their organization
CREATE POLICY kpi_goals_select ON public.kpi_goals
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.org_id = kpi_goals.org_id
      AND m.user_id = auth.uid()
  )
);

-- Only admins can insert KPI goals
CREATE POLICY kpi_goals_insert ON public.kpi_goals
FOR INSERT TO authenticated WITH CHECK (
  public.is_admin(auth.uid(), org_id)
);

-- Only admins can update KPI goals
CREATE POLICY kpi_goals_update ON public.kpi_goals
FOR UPDATE TO authenticated USING (
  public.is_admin(auth.uid(), org_id)
) WITH CHECK (
  public.is_admin(auth.uid(), org_id)
);

-- Only admins can delete KPI goals
CREATE POLICY kpi_goals_delete ON public.kpi_goals
FOR DELETE TO authenticated USING (
  public.is_admin(auth.uid(), org_id)
);

-- Function returning the current month's executed surface per organization
CREATE OR REPLACE FUNCTION public.kpi_current_month_surface()
RETURNS TABLE (
  goal_id UUID,
  org_id UUID,
  goal_name TEXT,
  target_surface_m2 NUMERIC,
  actual_surface_m2 NUMERIC,
  month_start DATE,
  month_end DATE
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
WITH user_orgs AS (
  SELECT m.org_id
  FROM public.memberships m
  WHERE m.user_id = auth.uid()
),
month_bounds AS (
  SELECT
    date_trunc('month', timezone('Indian/Mauritius', now()))::date AS month_start,
    (date_trunc('month', timezone('Indian/Mauritius', now())) + INTERVAL '1 month')::date AS next_month_start
),
goal_data AS (
  SELECT g.*
  FROM public.kpi_goals g
  JOIN user_orgs u ON u.org_id = g.org_id
  WHERE g.is_active
),
surface_totals AS (
  SELECT
    s.org_id,
    COALESCE(SUM(COALESCE(s.surface_posee_m2, s.surface_facturee_m2, 0)), 0) AS actual_surface_m2
  FROM public.sites s
  JOIN month_bounds mb ON TRUE
  WHERE s.org_id IN (SELECT org_id FROM user_orgs)
    AND s.status = 'CHANTIER_TERMINE'
    AND s.date_fin IS NOT NULL
    AND s.date_fin >= mb.month_start
    AND s.date_fin < mb.next_month_start
  GROUP BY s.org_id
)
SELECT
  g.id AS goal_id,
  g.org_id,
  g.name AS goal_name,
  g.target_surface_m2,
  COALESCE(st.actual_surface_m2, 0) AS actual_surface_m2,
  mb.month_start,
  (mb.next_month_start - INTERVAL '1 day')::date AS month_end
FROM goal_data g
CROSS JOIN month_bounds mb
LEFT JOIN surface_totals st ON st.org_id = g.org_id
ORDER BY g.name;
$$;

-- Seed default KPI goal if it does not already exist
INSERT INTO public.kpi_goals (org_id, slug, name, description, target_surface_m2)
SELECT
  'a1b2c3d4-5678-90ab-cdef-1234567890ab'::uuid,
  'porsche',
  'Porsche',
  'Objectif mensuel de surface pour financer la Porsche 911.',
  911
WHERE NOT EXISTS (
  SELECT 1
  FROM public.kpi_goals
  WHERE org_id = 'a1b2c3d4-5678-90ab-cdef-1234567890ab'::uuid
    AND slug = 'porsche'
);
