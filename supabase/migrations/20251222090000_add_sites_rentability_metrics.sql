ALTER TABLE public.sites
  ADD COLUMN IF NOT EXISTS travaux_non_subventionnes numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rentability_total_costs numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rentability_margin_total numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rentability_margin_per_unit numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rentability_margin_rate numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rentability_unit_label text DEFAULT 'm²',
  ADD COLUMN IF NOT EXISTS rentability_unit_count numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rentability_additional_costs_total numeric DEFAULT 0;

COMMENT ON COLUMN public.sites.travaux_non_subventionnes IS 'Montant des travaux non subventionnés liés au chantier.';
COMMENT ON COLUMN public.sites.rentability_total_costs IS 'Coût total du chantier utilisé pour calculer la rentabilité.';
COMMENT ON COLUMN public.sites.rentability_margin_total IS 'Marge totale en euros pour le chantier.';
COMMENT ON COLUMN public.sites.rentability_margin_per_unit IS 'Marge par unité (m² ou luminaire) selon le type de chantier.';
COMMENT ON COLUMN public.sites.rentability_margin_rate IS 'Taux de marge (0-1) calculé à partir du chiffre d''affaires.';
COMMENT ON COLUMN public.sites.rentability_unit_label IS 'Libellé de l''unité utilisée pour la marge (m², luminaire, etc.).';
COMMENT ON COLUMN public.sites.rentability_unit_count IS 'Quantité d''unités (surface réelle ou nombre de luminaires) utilisée pour le calcul de la marge.';
COMMENT ON COLUMN public.sites.rentability_additional_costs_total IS 'Total des frais de chantier (HT + TVA).';
