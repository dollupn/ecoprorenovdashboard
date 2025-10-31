-- Add missing columns to sites table for travaux non subventionnés

-- Add the travaux_non_subventionnes column (text field for status: NA, CLIENT, MARGE, MOITIE)
ALTER TABLE public.sites
ADD COLUMN IF NOT EXISTS travaux_non_subventionnes TEXT DEFAULT 'NA';

-- Add the travaux_non_subventionnes_montant column (numeric field for the amount)
ALTER TABLE public.sites
ADD COLUMN IF NOT EXISTS travaux_non_subventionnes_montant NUMERIC DEFAULT 0;

-- Add comments for documentation
COMMENT ON COLUMN public.sites.travaux_non_subventionnes IS 'Type de travaux non subventionnés: NA, CLIENT, MARGE, MOITIE';
COMMENT ON COLUMN public.sites.travaux_non_subventionnes_montant IS 'Montant des travaux non subventionnés en euros';