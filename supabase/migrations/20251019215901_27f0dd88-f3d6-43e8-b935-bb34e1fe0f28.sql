-- Create table for subcontractors (sous-traitants)
CREATE TABLE public.subcontractors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.subcontractors ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view subcontractors in their organization"
ON public.subcontractors FOR SELECT
USING (has_org_membership(auth.uid(), org_id));

CREATE POLICY "Users can create subcontractors in their organization"
ON public.subcontractors FOR INSERT
WITH CHECK (has_org_membership(auth.uid(), org_id));

CREATE POLICY "Users can update subcontractors in their organization"
ON public.subcontractors FOR UPDATE
USING (has_org_membership(auth.uid(), org_id));

CREATE POLICY "Users can delete subcontractors in their organization"
ON public.subcontractors FOR DELETE
USING (has_org_membership(auth.uid(), org_id));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_subcontractors_updated_at
BEFORE UPDATE ON public.subcontractors
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create table for delegates (délégataires)
CREATE TABLE public.delegates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.delegates ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view delegates in their organization"
ON public.delegates FOR SELECT
USING (has_org_membership(auth.uid(), org_id));

CREATE POLICY "Users can create delegates in their organization"
ON public.delegates FOR INSERT
WITH CHECK (has_org_membership(auth.uid(), org_id));

CREATE POLICY "Users can update delegates in their organization"
ON public.delegates FOR UPDATE
USING (has_org_membership(auth.uid(), org_id));

CREATE POLICY "Users can delete delegates in their organization"
ON public.delegates FOR DELETE
USING (has_org_membership(auth.uid(), org_id));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_delegates_updated_at
BEFORE UPDATE ON public.delegates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create table for appointment types (types de RDV)
CREATE TABLE public.appointment_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL,
  name TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.appointment_types ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view appointment types in their organization"
ON public.appointment_types FOR SELECT
USING (has_org_membership(auth.uid(), org_id));

CREATE POLICY "Users can create appointment types in their organization"
ON public.appointment_types FOR INSERT
WITH CHECK (has_org_membership(auth.uid(), org_id));

CREATE POLICY "Users can update appointment types in their organization"
ON public.appointment_types FOR UPDATE
USING (has_org_membership(auth.uid(), org_id));

CREATE POLICY "Users can delete appointment types in their organization"
ON public.appointment_types FOR DELETE
USING (has_org_membership(auth.uid(), org_id));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_appointment_types_updated_at
BEFORE UPDATE ON public.appointment_types
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();