-- Align site statuses with front-end project status usage.
-- StartChantierDialog relies on these statuses when opening a chantier.
ALTER TABLE public.sites
  DROP CONSTRAINT IF EXISTS sites_status_check;

ALTER TABLE public.sites
  ADD CONSTRAINT sites_status_check CHECK (
    status IN (
      'NOUVEAU',
      'ETUDE',
      'DEVIS_ENVOYE',
      'DEVIS_SIGNE',
      'DEVIS_ACCEPTE',
      'DEVIS_REFUSE',
      'ACCEPTE',
      'A_PLANIFIER',
      'VISITE_TECHNIQUE',
      'PLANIFIE',
      'EN_PREPARATION',
      'EN_COURS',
      'CHANTIER_PLANIFIE',
      'CHANTIER_EN_COURS',
      'CHANTIER_TERMINE',
      'SUSPENDU',
      'TERMINE',
      'LIVRE',
      'FACTURE',
      'FACTURE_ENVOYEE',
      'AH',
      'AAF',
      'CLOTURE',
      'ANNULE',
      'ABANDONNE'
    )
  );
