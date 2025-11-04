-- Add missing commission tracking fields referenced in the codebase
ALTER TABLE public.sites
ADD COLUMN IF NOT EXISTS commission_eur_per_m2_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS commission_eur_per_m2 NUMERIC DEFAULT 0;