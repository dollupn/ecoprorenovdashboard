-- Create table to store project appointments (RDV)
CREATE TABLE public.project_appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  appointment_type_id UUID REFERENCES public.appointment_types(id) ON DELETE SET NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME WITHOUT TIME ZONE NOT NULL,
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX project_appointments_project_id_idx ON public.project_appointments(project_id);
CREATE INDEX project_appointments_org_id_idx ON public.project_appointments(org_id);
CREATE INDEX project_appointments_date_time_idx ON public.project_appointments(appointment_date, appointment_time);

ALTER TABLE public.project_appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view project appointments for their org"
ON public.project_appointments FOR SELECT
USING (has_org_membership(auth.uid(), org_id));

CREATE POLICY "Members can insert project appointments for their org"
ON public.project_appointments FOR INSERT
WITH CHECK (has_org_membership(auth.uid(), org_id) AND created_by = auth.uid());

CREATE POLICY "Members can update project appointments for their org"
ON public.project_appointments FOR UPDATE
USING (has_org_membership(auth.uid(), org_id));

CREATE POLICY "Members can delete project appointments for their org"
ON public.project_appointments FOR DELETE
USING (has_org_membership(auth.uid(), org_id));

CREATE TRIGGER update_project_appointments_updated_at
BEFORE UPDATE ON public.project_appointments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.project_appointments IS 'Stores scheduled appointments (RDV) linked to a project.';
COMMENT ON COLUMN public.project_appointments.org_id IS 'Organization that owns the appointment.';
COMMENT ON COLUMN public.project_appointments.assignee_id IS 'User assigned to the appointment.';
COMMENT ON COLUMN public.project_appointments.created_by IS 'User who created the appointment record.';
