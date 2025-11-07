import type { PostgrestSingleResponse } from "@supabase/supabase-js";

import type { Database } from "../../integrations/supabase/types.js";
import { getServiceSupabaseClient } from "./supabaseClient.js";

export type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
export type QuoteRow = Database["public"]["Tables"]["quotes"]["Row"];
export type SiteRow = Database["public"]["Tables"]["sites"]["Row"];
export type InvoiceRow = Database["public"]["Tables"]["invoices"]["Row"];

type Nullable<T> = T | null;

const client = () => getServiceSupabaseClient();

export const fetchProjectById = async (
  projectId: string,
  orgId: string,
): Promise<Nullable<ProjectRow>> => {
  const response: PostgrestSingleResponse<ProjectRow> = await client()
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("org_id", orgId)
    .single();

  if (response.error) {
    if (response.error.code === "PGRST116") {
      return null;
    }
    throw response.error;
  }

  return response.data;
};

export const fetchChantiersForProject = async (
  projectId: string,
  orgId: string,
): Promise<SiteRow[]> => {
  const { data, error } = await client()
    .from("sites")
    .select("*")
    .eq("project_id", projectId)
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
};

export const fetchQuotesForProject = async (
  projectId: string,
  orgId: string,
): Promise<QuoteRow[]> => {
  const { data, error } = await client()
    .from("quotes")
    .select("*")
    .eq("project_id", projectId)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
};

export const fetchInvoicesForProject = async (
  projectId: string,
  orgId: string,
): Promise<InvoiceRow[]> => {
  const { data, error } = await client()
    .from("invoices")
    .select("*")
    .eq("project_id", projectId)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
};

export const updateProjectStatus = async (
  projectId: string,
  orgId: string,
  status: ProjectRow["status"],
): Promise<ProjectRow> => {
  const response: PostgrestSingleResponse<ProjectRow> = await client()
    .from("projects")
    .update({ status })
    .eq("id", projectId)
    .eq("org_id", orgId)
    .select("*")
    .single();

  if (response.error) {
    throw response.error;
  }

  return response.data;
};

export const fetchChantierById = async (
  chantierId: string,
  orgId: string,
): Promise<Nullable<SiteRow>> => {
  const response: PostgrestSingleResponse<SiteRow> = await client()
    .from("sites")
    .select("*")
    .eq("id", chantierId)
    .eq("org_id", orgId)
    .single();

  if (response.error) {
    if (response.error.code === "PGRST116") {
      return null;
    }
    throw response.error;
  }

  return response.data;
};

export const fetchSiteById = fetchChantierById;

export const createChantier = async (
  values: Partial<SiteRow> &
    Pick<SiteRow, "project_id" | "project_ref" | "site_ref" | "client_name" | "address" | "city" | "postal_code" | "date_debut" | "user_id" | "org_id">,
): Promise<SiteRow> => {
  const response: PostgrestSingleResponse<SiteRow> = await client()
    .from("sites")
    .insert(values)
    .select("*")
    .single();

  if (response.error) {
    throw response.error;
  }

  return response.data;
};

export const updateSite = async (
  siteId: string,
  orgId: string,
  updates: Partial<SiteRow>,
): Promise<SiteRow> => {
  const response: PostgrestSingleResponse<SiteRow> = await client()
    .from("sites")
    .update(updates)
    .eq("id", siteId)
    .eq("org_id", orgId)
    .select("*")
    .single();

  if (response.error) {
    throw response.error;
  }

  return response.data;
};

export const createInvoice = async (
  values: Partial<InvoiceRow> &
    Pick<InvoiceRow, "project_id" | "invoice_ref" | "client_name" | "amount" | "status" | "user_id" | "org_id">,
): Promise<InvoiceRow> => {
  const response: PostgrestSingleResponse<InvoiceRow> = await client()
    .from("invoices")
    .insert(values)
    .select("*")
    .single();

  if (response.error) {
    throw response.error;
  }

  return response.data;
};
