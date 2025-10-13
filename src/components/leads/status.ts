import * as z from "zod";

export const LEAD_STATUSES = [
  "Non éligible",
  "À rappeler",
  "Phoning",
  "À recontacter",
  "Programmer pré-visite",
  "Éligible",
] as const satisfies readonly [string, ...string[]];

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const leadStatusEnum = z.enum(LEAD_STATUSES);

const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  "Non éligible": "Non éligible",
  "À rappeler": "À rappeler",
  Phoning: "Phoning (script d'appel)",
  "À recontacter": "À recontacter",
  "Programmer pré-visite": "Programmer pré-visite",
  "Éligible": "Éligible (automatique lors de la conversion en projet)",
};

const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  "Non éligible": "bg-red-500/10 text-red-700 border-red-200",
  "À rappeler": "bg-amber-500/10 text-amber-700 border-amber-200",
  Phoning: "bg-cyan-500/10 text-cyan-700 border-cyan-200",
  "À recontacter": "bg-blue-500/10 text-blue-700 border-blue-200",
  "Programmer pré-visite": "bg-purple-500/10 text-purple-700 border-purple-200",
  "Éligible": "bg-green-500/10 text-green-700 border-green-200",
};

export const isLeadStatus = (status: string): status is LeadStatus =>
  LEAD_STATUSES.includes(status as LeadStatus);

export const getLeadStatusLabel = (status: string) =>
  isLeadStatus(status) ? LEAD_STATUS_LABELS[status] : status;

export const getLeadStatusColor = (status: string) =>
  isLeadStatus(status) ? LEAD_STATUS_COLORS[status] : "bg-gray-500/10 text-gray-700 border-gray-200";
