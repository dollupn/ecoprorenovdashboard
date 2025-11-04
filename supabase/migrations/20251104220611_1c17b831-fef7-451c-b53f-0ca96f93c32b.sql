-- Add product_cee_categories column to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS product_cee_categories text;

-- Add indexes for chantier KPI queries
CREATE INDEX IF NOT EXISTS idx_sites_status_date_fin ON public.sites (status, date_fin) WHERE status = 'CHANTIER_TERMINE';
CREATE INDEX IF NOT EXISTS idx_projects_product_cee_categories ON public.projects (product_cee_categories);