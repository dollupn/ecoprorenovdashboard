-- Create table for lead product types
CREATE TABLE IF NOT EXISTS public.lead_product_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(org_id, name)
);

-- Enable Row Level Security
ALTER TABLE public.lead_product_types ENABLE ROW LEVEL SECURITY;

-- Create policies for lead product types
CREATE POLICY "Users can view lead product types in their organization"
  ON public.lead_product_types
  FOR SELECT
  USING (has_org_membership(auth.uid(), org_id));

CREATE POLICY "Users can create lead product types in their organization"
  ON public.lead_product_types
  FOR INSERT
  WITH CHECK (has_org_membership(auth.uid(), org_id));

CREATE POLICY "Users can update lead product types in their organization"
  ON public.lead_product_types
  FOR UPDATE
  USING (has_org_membership(auth.uid(), org_id));

CREATE POLICY "Users can delete lead product types in their organization"
  ON public.lead_product_types
  FOR DELETE
  USING (has_org_membership(auth.uid(), org_id));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_lead_product_types_updated_at
  BEFORE UPDATE ON public.lead_product_types
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();