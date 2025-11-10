import type { PostgrestSingleResponse } from "@supabase/supabase-js";

import type { Database } from "../../integrations/supabase/types.js";
import { parseResponseBody } from "../utils/http.js";
import { getServiceSupabaseClient } from "./supabaseClient.js";

export type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
export type QuoteRow = Database["public"]["Tables"]["quotes"]["Row"];
export type SiteRow = Database["public"]["Tables"]["sites"]["Row"];
export type InvoiceRow = Database["public"]["Tables"]["invoices"]["Row"];
export type ProjectWithRelations = ProjectRow & {
  sites: SiteRow[];
  quotes: QuoteRow[];
  invoices: InvoiceRow[];
};

export type ProjectExportBundle = Record<string, unknown>;

type Nullable<T> = T | null;

const client = () => getServiceSupabaseClient();

type EdgeFunctionResponse = {
  ok: boolean;
  status: number;
  body: unknown;
  rawBody: string;
};

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

export const fetchChantierBySiteRef = async (
  projectId: string,
  orgId: string,
  siteRef: string,
): Promise<Nullable<SiteRow>> => {
  const response: PostgrestSingleResponse<SiteRow> = await client()
    .from("sites")
    .select("*")
    .eq("project_id", projectId)
    .eq("org_id", orgId)
    .eq("site_ref", siteRef)
    .maybeSingle();

  if (response.error) {
    throw response.error;
  }

  return response.data ?? null;
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

export const invokeProjectExportFunction = async (projectId: string): Promise<EdgeFunctionResponse> => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const exportKey = process.env.ECOPRO_EXPORT_KEY;

  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL non configurée pour l'export des projets");
  }

  if (!exportKey) {
    throw new Error("ECOPRO_EXPORT_KEY non configurée pour l'export des projets");
  }

  const endpoint = new URL("/functions/v1/export-project", supabaseUrl);
  endpoint.searchParams.set("project_id", projectId);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000);

  try {
    const response = await fetch(endpoint.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        "x-ecopro-key": exportKey,
      },
      signal: controller.signal,
    });

    const { body, text } = await parseResponseBody(response);

    return {
      ok: response.ok,
      status: response.status,
      body,
      rawBody: text,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.name === "AbortError"
          ? "Le service d'export n'a pas répondu à temps"
          : error.message
        : "Erreur inconnue lors de l'appel à la fonction export-project";

    return {
      ok: false,
      status: 500,
      body: { message },
      rawBody: message,
    };
  } finally {
    clearTimeout(timeoutId);
  }
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

type ProjectsPageResponse = {
  data: ProjectWithRelations[];
  count: number;
};

export const fetchProjectsPage = async (
  orgId: string,
  from: number,
  to: number,
): Promise<ProjectsPageResponse> => {
  const { data, error, count } = await client()
    .from("projects")
    .select(
      `*,
      sites(*),
      quotes(*),
      invoices(*)`,
      { count: "exact" },
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: true })
    .range(from, to);

  if (error) {
    throw error;
  }

  const projects = (data ?? []) as ProjectWithRelations[];

  return {
    data: projects,
    count: typeof count === "number" ? count : projects.length + from,
  };
};
