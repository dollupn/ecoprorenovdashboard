import type { Database } from "../../integrations/supabase/types.js";
import { getServiceSupabaseClient } from "./supabaseClient.js";

export type SettingsRow = Database["public"]["Tables"]["settings"]["Row"];

export const fetchOrganizationSettings = async (orgId: string): Promise<SettingsRow | null> => {
  const { data, error } = await getServiceSupabaseClient()
    .from("settings")
    .select("*")
    .eq("org_id", orgId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ?? null;
};
