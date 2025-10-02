-- Add missing fields to projects table
ALTER TABLE public.projects 
  ADD COLUMN building_type text,
  ADD COLUMN usage text,
  ADD COLUMN prime_cee numeric,
  ADD COLUMN discount numeric,
  ADD COLUMN unit_price numeric,
  ADD COLUMN signatory_name text,
  ADD COLUMN signatory_title text;

COMMENT ON COLUMN public.projects.building_type IS 'Type of building';
COMMENT ON COLUMN public.projects.usage IS 'Usage type (residential, commercial, etc.)';
COMMENT ON COLUMN public.projects.prime_cee IS 'CEE bonus amount';
COMMENT ON COLUMN public.projects.discount IS 'Discount amount';
COMMENT ON COLUMN public.projects.unit_price IS 'Unit price';
COMMENT ON COLUMN public.projects.signatory_name IS 'Name of the signatory';
COMMENT ON COLUMN public.projects.signatory_title IS 'Title/function of the signatory';