import * as z from "zod";

export const LEAD_STATUSES = [
  "Nouveau",
  "Qualifié",
  "Converti",
  "Perdu",
  "Clôturé",
] as const satisfies readonly [string, ...string[]];

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const leadStatusEnum = z.enum(LEAD_STATUSES);

const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  Nouveau: "Nouveau",
  Qualifié: "Qualifié",
  Converti: "Converti",
  Perdu: "Perdu",
  Clôturé: "Clôturé",
};

const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  Nouveau: "bg-blue-500/10 text-blue-700 border-blue-200",
  Qualifié: "bg-orange-500/10 text-orange-700 border-orange-200",
  Converti: "bg-green-500/10 text-green-700 border-green-200",
  Perdu: "bg-red-500/10 text-red-700 border-red-200",
  Clôturé: "bg-slate-500/10 text-slate-700 border-slate-200",
};

export const isLeadStatus = (status: string): status is LeadStatus =>
  LEAD_STATUSES.includes(status as LeadStatus);

export const getLeadStatusLabel = (status: string) =>
  isLeadStatus(status) ? LEAD_STATUS_LABELS[status] : status;

export const getLeadStatusColor = (status: string) =>
  isLeadStatus(status) ? LEAD_STATUS_COLORS[status] : "bg-gray-500/10 text-gray-700 border-gray-200";
