-- Add per-product Valorisation CEE configuration
ALTER TABLE public.product_catalog
  ADD COLUMN IF NOT EXISTS valorisation_tarif_override numeric,
  ADD COLUMN IF NOT EXISTS valorisation_formula jsonb;
