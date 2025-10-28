-- Step 1: Drop the existing check constraint completely
ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_status_check;

-- Step 2: Update existing rows to use the new status value
UPDATE public.projects
SET status = 'NOUVEAU'
WHERE status = 'PROSPECTION';

-- Step 3: Set the default value to NOUVEAU
ALTER TABLE public.projects
  ALTER COLUMN status SET DEFAULT 'NOUVEAU';

-- Step 4: Add the new check constraint with all valid statuses including NOUVEAU
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
    'CLOTURE',
    'PROSPECTION'
  ));