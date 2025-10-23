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
  ADD COLUMN IF NOT EXISTS prime_bonification numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.organizations.business_location IS 'Primary geography used for Prime CEE calculations';
COMMENT ON COLUMN public.organizations.prime_bonification IS 'Additional euro amount to apply to Prime CEE valuations';
