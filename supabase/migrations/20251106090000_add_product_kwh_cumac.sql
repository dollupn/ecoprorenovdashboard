-- Create table to store kWh cumac values per product and building type
CREATE TABLE IF NOT EXISTS public.product_kwh_cumac (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.product_catalog(id) ON DELETE CASCADE,
  building_type TEXT NOT NULL,
  kwh_cumac NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT product_kwh_cumac_unique_product_type UNIQUE (product_id, building_type),
  CONSTRAINT product_kwh_cumac_non_negative CHECK (kwh_cumac >= 0)
);

-- Maintain updated_at automatically
CREATE TRIGGER update_product_kwh_cumac_updated_at
BEFORE UPDATE ON public.product_kwh_cumac
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable row level security
ALTER TABLE public.product_kwh_cumac ENABLE ROW LEVEL SECURITY;

-- Allow organization members to read product kWh data
CREATE POLICY product_kwh_cumac_select ON public.product_kwh_cumac
FOR SELECT USING (
  EXISTS (
    SELECT 1
    FROM public.product_catalog pc
    JOIN public.memberships m ON m.org_id = pc.org_id
    WHERE pc.id = product_kwh_cumac.product_id
      AND m.user_id = auth.uid()
  )
);

-- Allow organization members to insert product kWh data
CREATE POLICY product_kwh_cumac_insert ON public.product_kwh_cumac
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.product_catalog pc
    JOIN public.memberships m ON m.org_id = pc.org_id
    WHERE pc.id = product_kwh_cumac.product_id
      AND m.user_id = auth.uid()
  )
);

-- Allow organization members to update product kWh data
CREATE POLICY product_kwh_cumac_update ON public.product_kwh_cumac
FOR UPDATE USING (
  EXISTS (
    SELECT 1
    FROM public.product_catalog pc
    JOIN public.memberships m ON m.org_id = pc.org_id
    WHERE pc.id = product_kwh_cumac.product_id
      AND m.user_id = auth.uid()
  )
) WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.product_catalog pc
    JOIN public.memberships m ON m.org_id = pc.org_id
    WHERE pc.id = product_kwh_cumac.product_id
      AND m.user_id = auth.uid()
  )
);

-- Allow organization members to delete product kWh data
CREATE POLICY product_kwh_cumac_delete ON public.product_kwh_cumac
FOR DELETE USING (
  EXISTS (
    SELECT 1
    FROM public.product_catalog pc
    JOIN public.memberships m ON m.org_id = pc.org_id
    WHERE pc.id = product_kwh_cumac.product_id
      AND m.user_id = auth.uid()
  )
);
