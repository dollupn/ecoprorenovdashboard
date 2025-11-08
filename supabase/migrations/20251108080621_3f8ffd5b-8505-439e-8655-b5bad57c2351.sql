-- Add new columns for kWh cumac values based on building surface
ALTER TABLE product_kwh_cumac 
  ADD COLUMN kwh_cumac_lt_400 NUMERIC,
  ADD COLUMN kwh_cumac_gte_400 NUMERIC;

-- Migrate existing data (copy kwh_cumac to both new columns if it exists)
UPDATE product_kwh_cumac 
SET kwh_cumac_lt_400 = kwh_cumac,
    kwh_cumac_gte_400 = kwh_cumac
WHERE kwh_cumac IS NOT NULL;

-- Make new columns NOT NULL (now that data is migrated)
ALTER TABLE product_kwh_cumac
  ALTER COLUMN kwh_cumac_lt_400 SET NOT NULL,
  ALTER COLUMN kwh_cumac_gte_400 SET NOT NULL;

-- Drop the old column
ALTER TABLE product_kwh_cumac DROP COLUMN kwh_cumac;

-- Update the check constraint to validate both new columns
ALTER TABLE product_kwh_cumac DROP CONSTRAINT IF EXISTS product_kwh_cumac_non_negative;
ALTER TABLE product_kwh_cumac 
  ADD CONSTRAINT product_kwh_cumac_non_negative 
  CHECK (kwh_cumac_lt_400 >= 0 AND kwh_cumac_gte_400 >= 0);