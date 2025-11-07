import { ValidationError } from "../errors.js";

export type ProjectStatus =
  | "NOUVEAU"
  | "ETUDE"
  | "DEVIS_ENVOYE"
  | "DEVIS_SIGNE"
  | "ACCEPTE"
  | "A_PLANIFIER"
  | "VISITE_TECHNIQUE"
  | "EN_COURS"
  | "CHANTIER_PLANIFIE"
  | "CHANTIER_EN_COURS"
  | "CHANTIER_TERMINE"
  | "LIVRE"
  | "FACTURE_ENVOYEE"
  | "AH"
  | "AAF"
  | "CLOTURE"
  | "ANNULE"
  | "ABANDONNE";

const PROJECT_STATUS_ORDER: ProjectStatus[] = [
  "NOUVEAU",
  "ETUDE",
  "DEVIS_ENVOYE",
  "DEVIS_SIGNE",
  "ACCEPTE",
  "VISITE_TECHNIQUE",
  "A_PLANIFIER",
  "CHANTIER_PLANIFIE",
  "EN_COURS",
  "CHANTIER_EN_COURS",
  "CHANTIER_TERMINE",
  "LIVRE",
  "FACTURE_ENVOYEE",
  "AH",
  "AAF",
  "CLOTURE",
  "ANNULE",
  "ABANDONNE",
];

const getProjectStatusIndex = (status: string): number => {
  const index = PROJECT_STATUS_ORDER.indexOf(status as ProjectStatus);
  return index === -1 ? -1 : index;
};

export const ensureProjectStatusTransition = (current: string, next: string) => {
  // Validate that the next status is valid
  if (!PROJECT_STATUS_ORDER.includes(next as ProjectStatus)) {
    const validStatuses = PROJECT_STATUS_ORDER.join(', ');
    throw new ValidationError(
      `Statut projet inconnu: "${next}". Statuts valides: ${validStatuses}`
    );
  }

  // Validate that the current status is valid (if it exists)
  if (current && !PROJECT_STATUS_ORDER.includes(current as ProjectStatus)) {
    throw new ValidationError(`Statut projet actuel inconnu: "${current}"`);
  }

  // Allow all transitions (forward and backward)
  // This allows users to correct mistakes or move projects back in the workflow
};

