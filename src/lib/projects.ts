import type { Project } from "@/data/projects";

export const getStatusLabel = (status: Project["status"]) => {
  const labels = {
    PROSPECTION: "Prospection",
    ETUDE: "Étude",
    DEVIS_ENVOYE: "Devis Envoyé",
    ACCEPTE: "Accepté",
    A_PLANIFIER: "À Planifier",
    EN_COURS: "En Cours",
    LIVRE: "Livré",
    CLOTURE: "Clôturé"
  } as const;

  return labels[status];
};

export const getStatusColor = (status: Project["status"]) => {
  const colors = {
    PROSPECTION: "bg-blue-500/10 text-blue-700 border-blue-200",
    ETUDE: "bg-purple-500/10 text-purple-700 border-purple-200",
    DEVIS_ENVOYE: "bg-orange-500/10 text-orange-700 border-orange-200",
    ACCEPTE: "bg-green-500/10 text-green-700 border-green-200",
    A_PLANIFIER: "bg-yellow-500/10 text-yellow-700 border-yellow-200",
    EN_COURS: "bg-primary/10 text-primary border-primary/20",
    LIVRE: "bg-teal-500/10 text-teal-700 border-teal-200",
    CLOTURE: "bg-gray-500/10 text-gray-700 border-gray-200"
  } as const;

  return colors[status];
};
