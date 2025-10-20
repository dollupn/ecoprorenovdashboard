-- Add email_template_id column to appointment_types for automation
ALTER TABLE public.appointment_types
ADD COLUMN email_template_id TEXT;

COMMENT ON COLUMN public.appointment_types.email_template_id IS 'ID of the email template to send when this appointment type is scheduled';