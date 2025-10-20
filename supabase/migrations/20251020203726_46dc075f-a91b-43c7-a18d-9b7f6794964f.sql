-- Add headquarters address fields to projects table
ALTER TABLE public.projects
ADD COLUMN hq_address TEXT,
ADD COLUMN hq_city TEXT,
ADD COLUMN hq_postal_code TEXT,
ADD COLUMN same_address BOOLEAN DEFAULT false;

-- Add comments for clarity
COMMENT ON COLUMN public.projects.hq_address IS 'Headquarters/company address';
COMMENT ON COLUMN public.projects.hq_city IS 'Headquarters city';
COMMENT ON COLUMN public.projects.hq_postal_code IS 'Headquarters postal code';
COMMENT ON COLUMN public.projects.same_address IS 'Flag indicating if headquarters and site address are the same';

-- Note: Existing address, city, postal_code columns will be used for the site/construction address