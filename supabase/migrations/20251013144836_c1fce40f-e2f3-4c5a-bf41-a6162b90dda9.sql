-- Add missing columns to product_catalog table
ALTER TABLE public.product_catalog 
ADD COLUMN IF NOT EXISTS custom_description_primary text,
ADD COLUMN IF NOT EXISTS custom_description_secondary text,
ADD COLUMN IF NOT EXISTS prime_percentage numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS eco_admin_percentage numeric DEFAULT 15,
ADD COLUMN IF NOT EXISTS eco_furn_percentage numeric DEFAULT 5,
ADD COLUMN IF NOT EXISTS eco_log_percentage numeric DEFAULT 0;