-- Add delegate reference to projects and supporting fields for pricing
ALTER TABLE public.delegates
  ADD COLUMN IF NOT EXISTS price_eur_per_mwh numeric;

UPDATE public.delegates
SET price_eur_per_mwh = COALESCE(price_eur_per_mwh, 0);

ALTER TABLE public.delegates
  ALTER COLUMN price_eur_per_mwh SET DEFAULT 0,
  ALTER COLUMN price_eur_per_mwh SET NOT NULL;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS delegate_id uuid REFERENCES public.delegates(id) ON DELETE SET NULL;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS prime_bonification_percentage numeric;

UPDATE public.organizations
SET prime_bonification_percentage = COALESCE(prime_bonification_percentage, 0);

ALTER TABLE public.organizations
  ALTER COLUMN prime_bonification_percentage SET DEFAULT 0,
  ALTER COLUMN prime_bonification_percentage SET NOT NULL;
