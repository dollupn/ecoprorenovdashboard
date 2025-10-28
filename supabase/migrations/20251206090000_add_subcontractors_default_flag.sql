-- Add default flag to subcontractors
ALTER TABLE public.subcontractors
ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;
