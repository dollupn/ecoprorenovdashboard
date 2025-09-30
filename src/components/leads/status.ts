import * as z from "zod";

export const LEAD_STATUSES = [
  "NEW",
  "QUALIFIED",
  "RDV_PLANIFIE",
  "CONVERTED",
  "ARCHIVED",
] as const satisfies readonly [string, ...string[]];

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const leadStatusEnum = z.enum(LEAD_STATUSES);

const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "Nouveau",
  QUALIFIED: "Qualifié",
  RDV_PLANIFIE: "RDV Planifié",
  CONVERTED: "Converti",
  ARCHIVED: "Archivé",
};

const LEAD_STATUS_COLORS: Record<LeadStatus, string> = {
  NEW: "bg-blue-500/10 text-blue-700 border-blue-200",
  QUALIFIED: "bg-orange-500/10 text-orange-700 border-orange-200",
  RDV_PLANIFIE: "bg-purple-500/10 text-purple-700 border-purple-200",
  CONVERTED: "bg-green-500/10 text-green-700 border-green-200",
  ARCHIVED: "bg-gray-500/10 text-gray-700 border-gray-200",
};

export const isLeadStatus = (status: string): status is LeadStatus =>
  LEAD_STATUSES.includes(status as LeadStatus);

export const getLeadStatusLabel = (status: string) =>
  isLeadStatus(status) ? LEAD_STATUS_LABELS[status] : status;

export const getLeadStatusColor = (status: string) =>
  isLeadStatus(status) ? LEAD_STATUS_COLORS[status] : "bg-gray-500/10 text-gray-700 border-gray-200";
