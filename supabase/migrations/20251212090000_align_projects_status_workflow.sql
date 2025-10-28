-- Align project status literals with the updated workflow
ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_status_check;

UPDATE public.projects
SET status = CASE
  WHEN status IN ('PROSPECTION', 'ETUDE') THEN 'NOUVEAU'
  WHEN status IN ('DEVIS_ENVOYE', 'ACCEPTE') THEN 'DEVIS_SIGNE'
  WHEN status = 'A_PLANIFIER' THEN 'CHANTIER_PLANIFIE'
  WHEN status = 'EN_COURS' THEN 'CHANTIER_EN_COURS'
  WHEN status = 'CLOTURE' THEN 'ANNULE'
  ELSE status
END;

ALTER TABLE public.projects
  ALTER COLUMN status SET DEFAULT 'NOUVEAU';

ALTER TABLE public.projects
  ADD CONSTRAINT projects_status_check
  CHECK (
    status IN (
      'NOUVEAU',
      'DEVIS_SIGNE',
      'CHANTIER_PLANIFIE',
      'CHANTIER_EN_COURS',
      'CHANTIER_TERMINE',
      'VISITE_TECHNIQUE',
      'LIVRE',
      'ANNULE'
    )
  );
