-- Drop legacy product catalog table and related trigger/policies
DROP TRIGGER IF EXISTS update_product_catalog_updated_at ON public.product_catalog;
DROP TABLE IF EXISTS public.product_catalog CASCADE;

-- Categories table
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS categories_org_idx ON public.categories (org_id, name);

-- Products table
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sku TEXT UNIQUE,
  name TEXT NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  product_type TEXT NOT NULL,
  unit TEXT DEFAULT 'unité',
  price_ref NUMERIC,
  quantity_default NUMERIC,
  description TEXT,
  enabled BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS products_org_idx ON public.products (org_id);
CREATE INDEX IF NOT EXISTS products_type_idx ON public.products (org_id, product_type);
CREATE INDEX IF NOT EXISTS products_category_idx ON public.products (org_id, category_id);

-- Trigger to maintain updated_at
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Read-only catalog view
CREATE OR REPLACE VIEW public.product_catalog AS
SELECT
  p.id,
  p.org_id,
  p.sku,
  p.name,
  c.name AS category,
  p.category_id,
  p.product_type,
  p.unit,
  p.price_ref,
  COALESCE(p.quantity_default, 1) AS quantity_default,
  p.description,
  p.enabled,
  p.created_at,
  p.updated_at
FROM public.products p
LEFT JOIN public.categories c ON c.id = p.category_id;

ALTER VIEW public.product_catalog OWNER TO postgres;

-- Row Level Security
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Policies for products
CREATE POLICY products_select ON public.products
FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.org_id = public.products.org_id
      AND m.user_id = auth.uid()
  )
);

CREATE POLICY products_write ON public.products
FOR ALL USING (
  EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.org_id = public.products.org_id
      AND m.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.org_id = public.products.org_id
      AND m.user_id = auth.uid()
  )
);

-- Policies for categories
CREATE POLICY categories_select ON public.categories
FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.org_id = public.categories.org_id
      AND m.user_id = auth.uid()
  )
);

CREATE POLICY categories_write ON public.categories
FOR ALL USING (
  EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.org_id = public.categories.org_id
      AND m.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.memberships m
    WHERE m.org_id = public.categories.org_id
      AND m.user_id = auth.uid()
  )
);

-- Grant read access to the catalog view
GRANT SELECT ON public.product_catalog TO anon, authenticated;
