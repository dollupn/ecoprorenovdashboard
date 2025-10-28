-- Add default flag to subcontractors
ALTER TABLE public.subcontractors
ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;

-- Ensure only one default subcontractor per organization
CREATE UNIQUE INDEX IF NOT EXISTS subcontractors_single_default_per_org
ON public.subcontractors (org_id)
WHERE is_default;
