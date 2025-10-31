-- Seed default project statuses for organizations with empty status arrays
UPDATE public.settings
SET statuts_projets = '[
  {"id": "NOUVEAU", "value": "NOUVEAU", "label": "Nouveau", "color": "#3B82F6", "isActive": true},
  {"id": "DEVIS_SIGNE", "value": "DEVIS_SIGNE", "label": "Devis signé", "color": "#22C55E", "isActive": true},
  {"id": "CHANTIER_PLANIFIE", "value": "CHANTIER_PLANIFIE", "label": "Chantier planifié", "color": "#FACC15", "isActive": true},
  {"id": "CHANTIER_EN_COURS", "value": "CHANTIER_EN_COURS", "label": "Chantier en cours", "color": "#2563EB", "isActive": true},
  {"id": "CHANTIER_TERMINE", "value": "CHANTIER_TERMINE", "label": "Chantier terminé", "color": "#8B5CF6", "isActive": true},
  {"id": "VISITE_TECHNIQUE", "value": "VISITE_TECHNIQUE", "label": "Visite technique", "color": "#F97316", "isActive": true},
  {"id": "LIVRE", "value": "LIVRE", "label": "Livré", "color": "#14B8A6", "isActive": false},
  {"id": "FACTURE_ENVOYEE", "value": "FACTURE_ENVOYEE", "label": "Facture envoyée", "color": "#F59E0B", "isActive": true},
  {"id": "AH", "value": "AH", "label": "AH", "color": "#0EA5E9", "isActive": true},
  {"id": "AAF", "value": "AAF", "label": "AAF", "color": "#F472B6", "isActive": true},
  {"id": "CLOTURE", "value": "CLOTURE", "label": "Clôturé", "color": "#475569", "isActive": false},
  {"id": "ANNULE", "value": "ANNULE", "label": "Annulé", "color": "#94A3B8", "isActive": false},
  {"id": "ABANDONNE", "value": "ABANDONNE", "label": "Abandonné", "color": "#A855F7", "isActive": false}
]'::jsonb
WHERE statuts_projets = '[]'::jsonb OR statuts_projets IS NULL;