-- Add default flag to subcontractors
ALTER TABLE public.subcontractors
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

-- Ensure existing rows have a non-null value
UPDATE public.subcontractors
SET is_default = COALESCE(is_default, false);
