-- Add cee_config JSONB column to product_catalog table
ALTER TABLE product_catalog 
ADD COLUMN IF NOT EXISTS cee_config JSONB DEFAULT '{
  "category": "isolation",
  "formulaTemplate": "standard",
  "formulaExpression": null,
  "primeMultiplierParam": "__quantity__",
  "primeMultiplierCoefficient": null,
  "ledWattConstant": null
}'::jsonb;

-- Add comment to document the column
COMMENT ON COLUMN product_catalog.cee_config IS 'Configuration for Prime CEE calculations including category, formula template, multiplier settings, and LED watt constant for lighting products';