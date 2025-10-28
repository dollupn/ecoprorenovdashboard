-- Allow expanded project statuses aligned with UI options
ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_status_check;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_status_check
  CHECK (
    status IN (
      'NOUVEAU',
      'ETUDE',
      'DEVIS_ENVOYE',
      'DEVIS_SIGNE',
      'ACCEPTE',
      'A_PLANIFIER',
      'CHANTIER_PLANIFIE',
      'EN_COURS',
      'CHANTIER_EN_COURS',
      'CHANTIER_TERMINE',
      'VISITE_TECHNIQUE',
      'LIVRE',
      'CLOTURE',
      'ANNULE'
    )
  );
