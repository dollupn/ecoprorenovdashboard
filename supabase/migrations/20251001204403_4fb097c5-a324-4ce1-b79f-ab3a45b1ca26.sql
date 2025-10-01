-- Create product_catalog table
CREATE TABLE public.product_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  category TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  schema_version INTEGER NOT NULL DEFAULT 1,
  params_schema JSONB,
  default_params JSONB,
  owner_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.product_catalog ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own products" 
ON public.product_catalog 
FOR SELECT 
USING (auth.uid() = owner_id);

CREATE POLICY "Users can create their own products" 
ON public.product_catalog 
FOR INSERT 
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own products" 
ON public.product_catalog 
FOR UPDATE 
USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own products" 
ON public.product_catalog 
FOR DELETE 
USING (auth.uid() = owner_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_product_catalog_updated_at
BEFORE UPDATE ON public.product_catalog
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better performance
CREATE INDEX idx_product_catalog_owner_id ON public.product_catalog(owner_id);
CREATE INDEX idx_product_catalog_category ON public.product_catalog(category);
CREATE INDEX idx_product_catalog_is_active ON public.product_catalog(is_active);