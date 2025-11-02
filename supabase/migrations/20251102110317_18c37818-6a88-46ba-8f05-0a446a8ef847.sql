-- Drop the old check constraint
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_status_check;

-- Add the updated check constraint with all valid status values
ALTER TABLE public.projects ADD CONSTRAINT projects_status_check 
CHECK (status = ANY (ARRAY[
  'NOUVEAU'::text,
  'ETUDE'::text,
  'DEVIS_ENVOYE'::text,
  'DEVIS_SIGNE'::text,
  'ACCEPTE'::text,
  'A_PLANIFIER'::text,
  'VISITE_TECHNIQUE'::text,
  'EN_COURS'::text,
  'CHANTIER_PLANIFIE'::text,
  'CHANTIER_EN_COURS'::text,
  'CHANTIER_TERMINE'::text,
  'LIVRE'::text,
  'FACTURE_ENVOYEE'::text,
  'AH'::text,
  'AAF'::text,
  'CLOTURE'::text,
  'ANNULE'::text,
  'ABANDONNE'::text
]));