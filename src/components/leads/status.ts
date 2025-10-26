import * as z from "zod";

import {
  getLeadStatusBadgeStyle,
  getLeadStatusColorFromSettings,
  getLeadStatusLabelFromSettings,
  LEAD_STATUS_VALUES,
} from "@/lib/leads";

export const LEAD_STATUSES = LEAD_STATUS_VALUES;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const leadStatusEnum = z.enum(LEAD_STATUSES);

export const isLeadStatus = (status: string): status is LeadStatus =>
  LEAD_STATUSES.includes(status as LeadStatus);

export const getLeadStatusLabel = (status: string) =>
  getLeadStatusLabelFromSettings(status);

export const getLeadStatusColor = (status: string) =>
  getLeadStatusColorFromSettings(status);

export const getLeadStatusBadgeStyles = (status: string) =>
  getLeadStatusBadgeStyle(status);
