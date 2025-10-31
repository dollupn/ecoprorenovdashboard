-- Add missing rentability and commission columns to sites table

-- Rentability calculated fields
ALTER TABLE public.sites
ADD COLUMN IF NOT EXISTS rentability_unit_label TEXT,
ADD COLUMN IF NOT EXISTS rentability_additional_costs_total NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS rentability_total_costs NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS rentability_margin_per_unit NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS rentability_margin_total NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS rentability_margin_rate NUMERIC DEFAULT 0;

-- Commission fields
ALTER TABLE public.sites
ADD COLUMN IF NOT EXISTS commission_commerciale_ht TEXT,
ADD COLUMN IF NOT EXISTS commission_commerciale_ht_montant NUMERIC DEFAULT 0;

-- Add comments
COMMENT ON COLUMN public.sites.rentability_unit_label IS 'Label de l''unité pour les calculs de rentabilité';
COMMENT ON COLUMN public.sites.rentability_additional_costs_total IS 'Total des coûts additionnels';
COMMENT ON COLUMN public.sites.rentability_total_costs IS 'Coûts totaux calculés';
COMMENT ON COLUMN public.sites.rentability_margin_per_unit IS 'Marge par unité';
COMMENT ON COLUMN public.sites.rentability_margin_total IS 'Marge totale';
COMMENT ON COLUMN public.sites.rentability_margin_rate IS 'Taux de marge en pourcentage';
COMMENT ON COLUMN public.sites.commission_commerciale_ht IS 'Type de commission commerciale';
COMMENT ON COLUMN public.sites.commission_commerciale_ht_montant IS 'Montant de la commission commerciale HT';