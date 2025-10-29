-- Add missing appointment_type_id column to leads table
ALTER TABLE public.leads 
ADD COLUMN appointment_type_id UUID REFERENCES public.appointment_types(id) ON DELETE SET NULL;

-- Add missing columns to subcontractors table
ALTER TABLE public.subcontractors
ADD COLUMN pricing_details TEXT,
ADD COLUMN is_default BOOLEAN NOT NULL DEFAULT false;

-- Add missing prime_cee_total_cents column to projects table
ALTER TABLE public.projects
ADD COLUMN prime_cee_total_cents BIGINT;

-- Add missing subcontractor columns to sites table
ALTER TABLE public.sites
ADD COLUMN subcontractor_id UUID REFERENCES public.subcontractors(id) ON DELETE SET NULL,
ADD COLUMN subcontractor_payment_confirmed BOOLEAN NOT NULL DEFAULT false;

-- Create lookup_user_id_by_email function
CREATE OR REPLACE FUNCTION public.lookup_user_id_by_email(email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM auth.users
  WHERE auth.users.email = lookup_user_id_by_email.email
  LIMIT 1;
$$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_leads_appointment_type_id ON public.leads(appointment_type_id);
CREATE INDEX IF NOT EXISTS idx_sites_subcontractor_id ON public.sites(subcontractor_id);