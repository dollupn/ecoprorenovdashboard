-- Create kpi_goals table with correct schema
CREATE TABLE IF NOT EXISTS public.kpi_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  metric TEXT NOT NULL,
  target_value DECIMAL NOT NULL,
  target_unit TEXT NOT NULL,
  period TEXT NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.kpi_goals ENABLE ROW LEVEL SECURITY;

-- Create policies for org-based access
CREATE POLICY "Users can view their org's KPI goals"
  ON public.kpi_goals
  FOR SELECT
  USING (public.has_org_membership(auth.uid(), org_id));

CREATE POLICY "Users can create KPI goals for their org"
  ON public.kpi_goals
  FOR INSERT
  WITH CHECK (public.has_org_membership(auth.uid(), org_id));

CREATE POLICY "Users can update their org's KPI goals"
  ON public.kpi_goals
  FOR UPDATE
  USING (public.has_org_membership(auth.uid(), org_id));

CREATE POLICY "Users can delete their org's KPI goals"
  ON public.kpi_goals
  FOR DELETE
  USING (public.has_org_membership(auth.uid(), org_id));

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_kpi_goals_org_id ON public.kpi_goals(org_id);
CREATE INDEX IF NOT EXISTS idx_kpi_goals_is_active ON public.kpi_goals(is_active);

-- Create trigger for updated_at
CREATE TRIGGER update_kpi_goals_updated_at
  BEFORE UPDATE ON public.kpi_goals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();