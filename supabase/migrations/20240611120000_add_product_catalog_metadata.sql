-- Add metadata columns for richer product catalogue management
ALTER TABLE public.product_catalog
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS schema_version INTEGER,
  ADD COLUMN IF NOT EXISTS params_schema JSONB,
  ADD COLUMN IF NOT EXISTS default_params JSONB;

ALTER TABLE public.product_catalog
  ALTER COLUMN schema_version SET DEFAULT 1;

ALTER TABLE public.product_catalog
  ALTER COLUMN params_schema
  SET DEFAULT jsonb_build_object('fields', '[]'::jsonb);

-- Ensure legacy rows have sensible defaults so the application can parse them safely
UPDATE public.product_catalog
SET schema_version = COALESCE(schema_version, 1)
WHERE schema_version IS NULL;

UPDATE public.product_catalog
SET params_schema = COALESCE(params_schema, jsonb_build_object('fields', '[]'::jsonb))
WHERE params_schema IS NULL;

-- Keep default parameters empty rather than null only when previously undefined
UPDATE public.product_catalog
SET default_params = NULL
WHERE default_params = 'null'::jsonb;
