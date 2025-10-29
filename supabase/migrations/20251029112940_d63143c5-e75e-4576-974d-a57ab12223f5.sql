-- Create project_appointments table
CREATE TABLE public.project_appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  appointment_type_id UUID REFERENCES public.appointment_types(id) ON DELETE SET NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  assignee_id UUID,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.project_appointments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view project appointments in their organization"
  ON public.project_appointments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.memberships m
      WHERE m.org_id = project_appointments.org_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create project appointments in their organization"
  ON public.project_appointments
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.memberships m
      WHERE m.org_id = project_appointments.org_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update project appointments in their organization"
  ON public.project_appointments
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.memberships m
      WHERE m.org_id = project_appointments.org_id
        AND m.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete project appointments in their organization"
  ON public.project_appointments
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.memberships m
      WHERE m.org_id = project_appointments.org_id
        AND m.user_id = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX idx_project_appointments_project_id ON public.project_appointments(project_id);
CREATE INDEX idx_project_appointments_org_id ON public.project_appointments(org_id);
CREATE INDEX idx_project_appointments_date ON public.project_appointments(appointment_date);
CREATE INDEX idx_project_appointments_assignee ON public.project_appointments(assignee_id);

-- Add trigger for automatic updated_at
CREATE TRIGGER update_project_appointments_updated_at
  BEFORE UPDATE ON public.project_appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();