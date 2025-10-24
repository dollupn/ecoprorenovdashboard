-- Change default project status from PROSPECTION to NOUVEAU

-- Update existing rows to use the new status value
UPDATE public.projects
SET status = 'NOUVEAU'
WHERE status = 'PROSPECTION';

-- Ensure the default value reflects the new status
ALTER TABLE public.projects
  ALTER COLUMN status SET DEFAULT 'NOUVEAU';

-- Refresh the check constraint with the updated status list
ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_status_check;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_status_check
  CHECK (status IN (
    'NOUVEAU',
    'ETUDE',
    'DEVIS_ENVOYE',
    'ACCEPTE',
    'A_PLANIFIER',
    'EN_COURS',
    'LIVRE',
    'CLOTURE'
  ));
