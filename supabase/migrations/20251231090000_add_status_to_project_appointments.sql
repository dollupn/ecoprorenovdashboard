-- Add status tracking to project appointments
ALTER TABLE public.project_appointments
  ADD COLUMN status TEXT NOT NULL DEFAULT 'scheduled';

ALTER TABLE public.project_appointments
  ADD CONSTRAINT project_appointments_status_check
  CHECK (status IN ('scheduled', 'done'));

ALTER TABLE public.project_appointments
  ADD COLUMN completed_at TIMESTAMP WITH TIME ZONE;
