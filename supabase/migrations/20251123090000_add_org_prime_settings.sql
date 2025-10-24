-- Add business location and prime bonification columns to organizations
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'business_location') THEN
    CREATE TYPE public.business_location AS ENUM (
      'metropole',
      'guadeloupe',
      'martinique',
      'guyane',
      'reunion',
      'mayotte'
    );
  END IF;
END
$$;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS business_location public.business_location NOT NULL DEFAULT 'metropole';

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS prime_bonification numeric NOT NULL DEFAULT 1;

ALTER TABLE public.organizations
  ALTER COLUMN prime_bonification SET DEFAULT 1;

UPDATE public.organizations
SET prime_bonification = 1
WHERE prime_bonification IS NULL OR prime_bonification = 0;

COMMENT ON COLUMN public.organizations.business_location IS 'Primary geography used for Prime CEE calculations';
COMMENT ON COLUMN public.organizations.prime_bonification IS 'Multiplier applied to Prime CEE valuations at the organization level';
