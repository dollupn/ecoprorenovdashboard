-- 1. Create SECURITY DEFINER functions to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.has_org_membership(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships
    WHERE user_id = _user_id
      AND org_id = _org_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_org_owner_or_admin(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships
    WHERE user_id = _user_id
      AND org_id = _org_id
      AND role IN ('owner', 'admin')
  )
$$;

-- 2. Add 'commercial' role to org_role enum
ALTER TYPE org_role ADD VALUE IF NOT EXISTS 'commercial';

-- 3. Drop and recreate memberships RLS policies to fix infinite recursion
DROP POLICY IF EXISTS "Users can view memberships of their organizations" ON public.memberships;
DROP POLICY IF EXISTS "Owners and admins can insert memberships" ON public.memberships;
DROP POLICY IF EXISTS "Owners and admins can update memberships" ON public.memberships;
DROP POLICY IF EXISTS "Owners and admins can delete memberships" ON public.memberships;

CREATE POLICY "Users can view memberships of their organizations"
ON public.memberships
FOR SELECT
TO authenticated
USING (public.has_org_membership(auth.uid(), org_id));

CREATE POLICY "Owners and admins can insert memberships"
ON public.memberships
FOR INSERT
TO authenticated
WITH CHECK (public.is_org_owner_or_admin(auth.uid(), org_id));

CREATE POLICY "Owners and admins can update memberships"
ON public.memberships
FOR UPDATE
TO authenticated
USING (public.is_org_owner_or_admin(auth.uid(), org_id));

CREATE POLICY "Owners and admins can delete memberships"
ON public.memberships
FOR DELETE
TO authenticated
USING (public.is_org_owner_or_admin(auth.uid(), org_id));

-- 4. Update other tables' RLS policies to use new functions
DROP POLICY IF EXISTS "Users can view categories in their organization" ON public.categories;
CREATE POLICY "Users can view categories in their organization"
ON public.categories
FOR SELECT
TO authenticated
USING (public.has_org_membership(auth.uid(), org_id));

DROP POLICY IF EXISTS "Users can create categories in their organization" ON public.categories;
CREATE POLICY "Users can create categories in their organization"
ON public.categories
FOR INSERT
TO authenticated
WITH CHECK (public.has_org_membership(auth.uid(), org_id));

DROP POLICY IF EXISTS "Users can update categories in their organization" ON public.categories;
CREATE POLICY "Users can update categories in their organization"
ON public.categories
FOR UPDATE
TO authenticated
USING (public.has_org_membership(auth.uid(), org_id));

DROP POLICY IF EXISTS "Users can delete categories in their organization" ON public.categories;
CREATE POLICY "Users can delete categories in their organization"
ON public.categories
FOR DELETE
TO authenticated
USING (public.has_org_membership(auth.uid(), org_id));

DROP POLICY IF EXISTS "Users can view products in their organization" ON public.product_catalog;
CREATE POLICY "Users can view products in their organization"
ON public.product_catalog
FOR SELECT
TO authenticated
USING (public.has_org_membership(auth.uid(), org_id));

DROP POLICY IF EXISTS "Users can create products in their organization" ON public.product_catalog;
CREATE POLICY "Users can create products in their organization"
ON public.product_catalog
FOR INSERT
TO authenticated
WITH CHECK (public.has_org_membership(auth.uid(), org_id));

DROP POLICY IF EXISTS "Users can update products in their organization" ON public.product_catalog;
CREATE POLICY "Users can update products in their organization"
ON public.product_catalog
FOR UPDATE
TO authenticated
USING (public.has_org_membership(auth.uid(), org_id));

DROP POLICY IF EXISTS "Users can delete products in their organization" ON public.product_catalog;
CREATE POLICY "Users can delete products in their organization"
ON public.product_catalog
FOR DELETE
TO authenticated
USING (public.has_org_membership(auth.uid(), org_id));

-- 5. Add new columns to product_catalog
ALTER TABLE public.product_catalog
ADD COLUMN IF NOT EXISTS unit_type text CHECK (unit_type IS NULL OR unit_type IN ('m²', 'unité', 'kit')),
ADD COLUMN IF NOT EXISTS base_price_ht numeric CHECK (base_price_ht IS NULL OR base_price_ht >= 0),
ADD COLUMN IF NOT EXISTS tva_percentage numeric DEFAULT 20.0 CHECK (tva_percentage IS NULL OR (tva_percentage >= 0 AND tva_percentage <= 100)),
ADD COLUMN IF NOT EXISTS price_ttc numeric,
ADD COLUMN IF NOT EXISTS supplier_name text,
ADD COLUMN IF NOT EXISTS supplier_reference text,
ADD COLUMN IF NOT EXISTS technical_sheet_url text;

-- 6. Create trigger function to auto-calculate price_ttc
CREATE OR REPLACE FUNCTION public.calculate_price_ttc()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.base_price_ht IS NOT NULL AND NEW.tva_percentage IS NOT NULL THEN
    NEW.price_ttc := NEW.base_price_ht * (1 + NEW.tva_percentage / 100);
  ELSE
    NEW.price_ttc := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS calculate_price_ttc_trigger ON public.product_catalog;
CREATE TRIGGER calculate_price_ttc_trigger
BEFORE INSERT OR UPDATE ON public.product_catalog
FOR EACH ROW
EXECUTE FUNCTION public.calculate_price_ttc();

-- 7. Create storage bucket for technical sheets
INSERT INTO storage.buckets (id, name, public)
VALUES ('technical-sheets', 'technical-sheets', false)
ON CONFLICT (id) DO NOTHING;

-- 8. Create RLS policies for technical-sheets storage
DROP POLICY IF EXISTS "Users can view technical sheets in their org" ON storage.objects;
CREATE POLICY "Users can view technical sheets in their org"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'technical-sheets' AND
  EXISTS (
    SELECT 1 FROM public.product_catalog pc
    INNER JOIN public.memberships m ON m.org_id = pc.org_id
    WHERE pc.technical_sheet_url = storage.objects.name
    AND m.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can upload technical sheets" ON storage.objects;
CREATE POLICY "Users can upload technical sheets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'technical-sheets' AND
  auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "Users can update technical sheets" ON storage.objects;
CREATE POLICY "Users can update technical sheets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'technical-sheets' AND
  auth.uid() IS NOT NULL
);

DROP POLICY IF EXISTS "Users can delete technical sheets" ON storage.objects;
CREATE POLICY "Users can delete technical sheets"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'technical-sheets' AND
  auth.uid() IS NOT NULL
);