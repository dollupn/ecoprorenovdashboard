import type { ProjectRow, SiteRow } from "../repositories/projectRepository";
import { updateProjectStatus, fetchChantiersForProject } from "../repositories/projectRepository";
import { ValidationError } from "../errors";

export type ProjectStatus =
  | "NOUVEAU"
  | "ETUDE"
  | "DEVIS_ENVOYE"
  | "ACCEPTE"
  | "A_PLANIFIER"
  | "VISITE_TECHNIQUE"
  | "EN_COURS"
  | "LIVRE"
  | "CLOTURE";

export type ChantierStatus =
  | "PLANIFIE"
  | "EN_PREPARATION"
  | "EN_COURS"
  | "SUSPENDU"
  | "TERMINE"
  | "LIVRE";

const PROJECT_STATUS_ORDER: ProjectStatus[] = [
  "NOUVEAU",
  "ETUDE",
  "DEVIS_ENVOYE",
  "ACCEPTE",
  "A_PLANIFIER",
  "VISITE_TECHNIQUE",
  "EN_COURS",
  "LIVRE",
  "CLOTURE",
];

const CHANTIER_STATUS_FLOW: Record<ChantierStatus, ChantierStatus[]> = {
  PLANIFIE: ["PLANIFIE", "EN_PREPARATION", "EN_COURS"],
  EN_PREPARATION: ["EN_PREPARATION", "EN_COURS"],
  EN_COURS: ["EN_COURS", "SUSPENDU", "TERMINE"],
  SUSPENDU: ["SUSPENDU", "EN_COURS", "TERMINE"],
  TERMINE: ["TERMINE", "LIVRE"],
  LIVRE: ["LIVRE"],
};

const CHANTIER_TO_PROJECT_STATUS: Partial<Record<ChantierStatus, ProjectStatus>> = {
  PLANIFIE: "A_PLANIFIER",
  EN_PREPARATION: "A_PLANIFIER",
  EN_COURS: "EN_COURS",
  SUSPENDU: "EN_COURS",
  TERMINE: "LIVRE",
  LIVRE: "LIVRE",
};

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

export const ensureChantierStatusTransition = (current: string, next: string) => {
  if (!(next in CHANTIER_TO_PROJECT_STATUS || next === "PLANIFIE" || next === "EN_PREPARATION")) {
    throw new ValidationError(`Statut chantier inconnu: ${next}`);
  }

  if (!current) {
    return;
  }

  if (!(current in CHANTIER_STATUS_FLOW)) {
    throw new ValidationError(`Statut chantier actuel inconnu: ${current}`);
  }

  const allowed = CHANTIER_STATUS_FLOW[current as ChantierStatus];
  if (!allowed.includes(next as ChantierStatus)) {
    throw new ValidationError(`Transition chantier interdite: ${current} -> ${next}`);
  }
};

const deriveProjectStatusFromChantiers = (chantiers: SiteRow[]): ProjectStatus | null => {
  const candidateStatuses = chantiers
    .map((chantier) => CHANTIER_TO_PROJECT_STATUS[chantier.status as ChantierStatus])
    .filter((status): status is ProjectStatus => Boolean(status));

  if (candidateStatuses.length === 0) {
    return null;
  }

  return candidateStatuses.reduce<ProjectStatus>((acc, status) => {
    return getProjectStatusIndex(status) > getProjectStatusIndex(acc) ? status : acc;
  }, candidateStatuses[0]);
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
