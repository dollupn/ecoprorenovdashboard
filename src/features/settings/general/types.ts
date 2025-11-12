import type { Database } from "@/integrations/supabase/types";

export type BusinessLocation = Database["public"]["Enums"]["business_location"];

export const ROLE_OPTIONS = [
  "Administrateur",
  "Manager",
  "Commercial",
  "Technicien",
] as const;

export type RoleOption = (typeof ROLE_OPTIONS)[number];

export interface TeamMember {
  id: string;
  name: string;
  role: RoleOption;
  identifier: string;
  email: string | null;
  phone: string | null;
  active: boolean;
  lastConnection: string;
}

export interface Integration {
  id: string;
  name: string;
  description: string;
  status: "connected" | "pending" | "disconnected";
  lastSync: string;
}

export interface CompanyInfo {
  name: string;
  legalName: string;
  registration: string;
  address: string;
  city: string;
  postalCode: string;
  phone: string;
  email: string;
  description: string;
}

export interface Delegataire {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  textBlock: string;
  pricePerMwh: string;
}

export interface NotificationSettings {
  commercialEmails: boolean;
  operationalEmails: boolean;
  smsReminders: boolean;
  pushNotifications: boolean;
  weeklyDigest: boolean;
}

export interface SecuritySettings {
  twoFactor: boolean;
  passwordRotation: boolean;
  loginAlerts: boolean;
  sessionDuration: string;
}
