import { ValidationError } from "../errors";

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
  if (!PROJECT_STATUS_ORDER.includes(next as ProjectStatus)) {
    throw new ValidationError(`Statut projet inconnu: ${next}`);
  }

  if (current && !PROJECT_STATUS_ORDER.includes(current as ProjectStatus)) {
    throw new ValidationError(`Statut projet actuel inconnu: ${current}`);
  }

  if (!current) {
    return;
  }

  const currentIndex = getProjectStatusIndex(current);
  const nextIndex = getProjectStatusIndex(next);

  if (currentIndex === -1 || nextIndex === -1) {
    return;
  }

  if (nextIndex < currentIndex) {
    throw new ValidationError("Impossible de revenir à un statut projet précédent");
  }
};

