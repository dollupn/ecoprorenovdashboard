-- Add price_eur_per_mwh column to delegates table
ALTER TABLE public.delegates
ADD COLUMN IF NOT EXISTS price_eur_per_mwh numeric DEFAULT 0;

COMMENT ON COLUMN public.delegates.price_eur_per_mwh IS 'Price per MWh for delegate services';

-- Create product_kwh_cumac table for storing KWH Cumac values by building type
CREATE TABLE IF NOT EXISTS public.product_kwh_cumac (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.product_catalog(id) ON DELETE CASCADE,
  building_type text NOT NULL,
  kwh_cumac numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(product_id, building_type)
);

-- Enable RLS on product_kwh_cumac
ALTER TABLE public.product_kwh_cumac ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for product_kwh_cumac (inherit from product_catalog)
CREATE POLICY "Users can view kwh cumac in their organization"
ON public.product_kwh_cumac FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.product_catalog pc
    WHERE pc.id = product_kwh_cumac.product_id
    AND has_org_membership(auth.uid(), pc.org_id)
  )
);

CREATE POLICY "Users can create kwh cumac in their organization"
ON public.product_kwh_cumac FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.product_catalog pc
    WHERE pc.id = product_kwh_cumac.product_id
    AND has_org_membership(auth.uid(), pc.org_id)
  )
);

CREATE POLICY "Users can update kwh cumac in their organization"
ON public.product_kwh_cumac FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.product_catalog pc
    WHERE pc.id = product_kwh_cumac.product_id
    AND has_org_membership(auth.uid(), pc.org_id)
  )
);

CREATE POLICY "Users can delete kwh cumac in their organization"
ON public.product_kwh_cumac FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.product_catalog pc
    WHERE pc.id = product_kwh_cumac.product_id
    AND has_org_membership(auth.uid(), pc.org_id)
  )
);

-- Create trigger for product_kwh_cumac updated_at
CREATE TRIGGER update_product_kwh_cumac_updated_at
BEFORE UPDATE ON public.product_kwh_cumac
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_product_kwh_cumac_product_id ON public.product_kwh_cumac(product_id);

COMMENT ON TABLE public.product_kwh_cumac IS 'Stores KWH Cumac values for products by building type';
COMMENT ON COLUMN public.product_kwh_cumac.product_id IS 'Reference to product catalog';
COMMENT ON COLUMN public.product_kwh_cumac.building_type IS 'Type of building for this KWH Cumac value';
COMMENT ON COLUMN public.product_kwh_cumac.kwh_cumac IS 'KWH Cumac value for this building type';