-- Add custom descriptions and eco fee percentages to products
ALTER TABLE product_catalog
  ADD COLUMN custom_description_primary text,
  ADD COLUMN custom_description_secondary text,
  ADD COLUMN prime_percentage numeric DEFAULT 0,
  ADD COLUMN eco_admin_percentage numeric DEFAULT 15,
  ADD COLUMN eco_furn_percentage numeric DEFAULT 5,
  ADD COLUMN eco_log_percentage numeric DEFAULT 0;
