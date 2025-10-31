import type { ProjectRow, SiteRow } from "../repositories/projectRepository";
import { updateProjectStatus, fetchChantiersForProject } from "../repositories/projectRepository";
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

// Unified status system - chantiers use the same statuses as projects
export type ChantierStatus = ProjectStatus;

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

// Unified status system - chantiers use same validation as projects
export const ensureChantierStatusTransition = (current: string, next: string) => {
  ensureProjectStatusTransition(current, next);
};

// Unified status system - chantiers have their own status directly
const deriveProjectStatusFromChantiers = (chantiers: SiteRow[]): ProjectStatus | null => {
  if (chantiers.length === 0) {
    return null;
  }

  // Return the most advanced status among all chantiers
  return chantiers.reduce<ProjectStatus>((acc, chantier) => {
    const chantierStatus = chantier.status as ProjectStatus;
    return getProjectStatusIndex(chantierStatus) > getProjectStatusIndex(acc) ? chantierStatus : acc;
  }, chantiers[0].status as ProjectStatus);
};

export const ensureProjectStatusNotBehindChantiers = (status: string, chantiers: SiteRow[]) => {
  if (!status) {
    return;
  }

  const derived = deriveProjectStatusFromChantiers(chantiers);
  if (!derived) {
    return;
  }

  if (getProjectStatusIndex(status) < getProjectStatusIndex(derived)) {
    throw new ValidationError(
      `Le statut projet doit être au moins '${derived}' en fonction de l'avancement des chantiers`,
    );
  }
};

export const syncProjectStatusWithChantiers = async (project: ProjectRow, orgId: string) => {
  const chantiers = await fetchChantiersForProject(project.id, orgId);
  const derived = deriveProjectStatusFromChantiers(chantiers);

  if (!derived) {
    return project;
  }

  if (getProjectStatusIndex(derived) > getProjectStatusIndex(project.status)) {
    return updateProjectStatus(project.id, orgId, derived);
  }

  return project;
};
