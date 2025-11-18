/**
 * Statuts de projet qui correspondent à un site terminé
 */
export const COMPLETED_PROJECT_STATUSES = [
  "CHANTIER_TERMINE",
  "LIVRE", 
  "FACTURE_ENVOYEE",
  "AH",
  "AAF",
  "CLOTURE"
] as const;

/**
 * Vérifie si un projet est considéré comme terminé
 */
export const isProjectCompleted = (projectStatus: string): boolean => {
  return COMPLETED_PROJECT_STATUSES.includes(projectStatus as any);
};

/**
 * Dérive le statut du site à partir du statut du projet
 */
export const deriveSiteStatusFromProject = (projectStatus: string): "TERMINE" | "EN_COURS" | "PLANIFIE" => {
  if (isProjectCompleted(projectStatus)) return "TERMINE";
  if (projectStatus === "CHANTIER_EN_COURS") return "EN_COURS";
  return "PLANIFIE";
};
