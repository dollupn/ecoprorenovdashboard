-- Create business_location enum type if it doesn't exist
DO $$ BEGIN
  CREATE TYPE business_location AS ENUM (
    'metropole',
    'guadeloupe',
    'martinique',
    'guyane',
    'reunion',
    'mayotte'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add Prime CEE settings columns to organizations table
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS business_location business_location DEFAULT 'metropole'::business_location,
ADD COLUMN IF NOT EXISTS prime_bonification numeric DEFAULT 0;

-- Add comments for documentation
COMMENT ON COLUMN public.organizations.business_location IS 'Business location for Prime CEE calculations';
COMMENT ON COLUMN public.organizations.prime_bonification IS 'Additional Prime CEE bonification amount';