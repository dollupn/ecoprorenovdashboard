-- Add pricing details column to subcontractors
ALTER TABLE public.subcontractors
  ADD COLUMN IF NOT EXISTS pricing_details text;

COMMENT ON COLUMN public.subcontractors.pricing_details IS 'Informations de tarification pour le sous-traitant (contenu riche).';
