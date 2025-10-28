-- Ensure only one default subcontractor per organization
CREATE UNIQUE INDEX IF NOT EXISTS subcontractors_single_default_per_org
ON public.subcontractors (org_id)
WHERE is_default;
