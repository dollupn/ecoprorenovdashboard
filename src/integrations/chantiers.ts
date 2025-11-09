import type { Tables } from "@/integrations/supabase/types";

const API_BASE_PATH = "/api/chantiers";

type StartChantierPayload = {
  siteRef?: string;
  dateDebut?: string;
  dateFinPrevue?: string | null;
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  productName?: string | null;
  notes?: string | null;
  teamMembers?: unknown;
  subcontractorId?: string | null;
};

type ChantierResponse = {
  chantier: Tables<"sites">;
  project: Tables<"projects"> | null;
};

const parseErrorMessage = async (response: Response) => {
  try {
    const data = await response.json();
    if (data && typeof data.message === "string" && data.message.trim().length > 0) {
      return data.message.trim();
    }
    if (data && typeof data.error === "string" && data.error.trim().length > 0) {
      return data.error.trim();
    }
  } catch (error) {
    console.warn("Unable to parse chantier API error", error);
  }

  return response.statusText || "Une erreur est survenue";
};

const fetchJson = async <T>(input: RequestInfo, init?: RequestInit): Promise<T> => {
  const headers = new Headers(init?.headers);

  if (!(init?.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(input, {
    credentials: "include",
    ...init,
    headers,
  });

  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new Error(message);
  }

  if (response.status === 204) {
    return {} as T;
  }

  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    throw new Error("Réponse inattendue du serveur chantier");
  }

  return (await response.json()) as T;
};

export const startChantier = async (
  projectId: string,
  payload: StartChantierPayload,
): Promise<ChantierResponse> => {
  if (!projectId) {
    throw new Error("Identifiant du projet requis pour démarrer un chantier");
  }

  return await fetchJson<ChantierResponse>(`${API_BASE_PATH}/${projectId}/start`, {
    method: "POST",
    body: JSON.stringify(payload ?? {}),
  });
};

type UpdateChantierPayload = {
  // Common fields
  travaux_non_subventionnes_client?: number | null;
  tva_rate?: number | null;
  frais_additionnels_total?: number | null;
  
  // Isolation fields
  surface_facturee_m2?: number | null;
  surface_posee_m2?: number | null;
  cout_mo_par_m2?: number | null;
  cout_isolant_par_m2?: number | null;
  cout_materiaux_par_m2?: number | null;
  cout_total_materiaux?: number | null;
  commission_commerciale_par_m2?: number | null;
  commission_eur_per_m2_enabled?: boolean | null;
  
  // Éclairage fields
  nb_luminaires?: number | null;
  cout_total_mo?: number | null;
  
  // Snapshot totals (TTC only)
  ca_ttc?: number | null;
  cout_chantier_ttc?: number | null;
  marge_totale_ttc?: number | null;
  
  // Per-unit margins
  rentability_margin_per_unit?: number | null;
};

export const saveChantier = async (
  siteId: string,
  payload: UpdateChantierPayload,
): Promise<Tables<"sites">> => {
  if (!siteId) {
    throw new Error("Identifiant du chantier requis");
  }

  return await fetchJson<Tables<"sites">>(`${API_BASE_PATH}/${siteId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
};

export type { StartChantierPayload, ChantierResponse, UpdateChantierPayload };
