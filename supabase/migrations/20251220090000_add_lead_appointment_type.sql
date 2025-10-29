-- Add appointment_type_id to leads
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS appointment_type_id uuid REFERENCES public.appointment_types(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.leads.appointment_type_id IS 'Type de rendez-vous sélectionné pour ce lead';

CREATE INDEX IF NOT EXISTS leads_appointment_type_id_idx ON public.leads (appointment_type_id);
