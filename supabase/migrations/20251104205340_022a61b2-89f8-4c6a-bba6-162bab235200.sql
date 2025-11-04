-- Add isolation-specific fields
ALTER TABLE public.sites
ADD COLUMN IF NOT EXISTS surface_facturee_m2 NUMERIC,
ADD COLUMN IF NOT EXISTS surface_posee_m2 NUMERIC,
ADD COLUMN IF NOT EXISTS cout_mo_par_m2 NUMERIC,
ADD COLUMN IF NOT EXISTS cout_isolant_par_m2 NUMERIC,
ADD COLUMN IF NOT EXISTS cout_materiaux_par_m2 NUMERIC,
ADD COLUMN IF NOT EXISTS cout_total_materiaux NUMERIC,
ADD COLUMN IF NOT EXISTS commission_commerciale_par_m2 NUMERIC;

-- Add eclairage-specific fields
ALTER TABLE public.sites
ADD COLUMN IF NOT EXISTS nb_luminaires INTEGER,
ADD COLUMN IF NOT EXISTS cout_total_mo NUMERIC,
ADD COLUMN IF NOT EXISTS cout_total_materiaux_eclairage NUMERIC;

-- Add common financial fields
ALTER TABLE public.sites
ADD COLUMN IF NOT EXISTS travaux_non_subventionnes_client NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS tva_rate NUMERIC DEFAULT 0.021,
ADD COLUMN IF NOT EXISTS frais_additionnels_total NUMERIC DEFAULT 0;

-- Add derived snapshot totals
ALTER TABLE public.sites
ADD COLUMN IF NOT EXISTS ca_ttc NUMERIC,
ADD COLUMN IF NOT EXISTS cout_chantier_ttc NUMERIC,
ADD COLUMN IF NOT EXISTS marge_totale_ttc NUMERIC;

-- Add chantier tracking fields
ALTER TABLE public.sites
ADD COLUMN IF NOT EXISTS date_fin DATE;

-- Add comment explaining the status field already exists
COMMENT ON COLUMN public.sites.status IS 'Status field supports values including: PLANIFIE, EN_COURS, TERMINE, ANNULE, CHANTIER_TERMINE';