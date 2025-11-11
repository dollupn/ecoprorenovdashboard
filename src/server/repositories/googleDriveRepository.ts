import "../env.js";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type DriveConnectionStatus = "connected" | "disconnected" | "error" | "pending";

export interface DriveSettingsRow {
  id: string;
  org_id: string;
  client_id: string | null;
  client_secret: string | null;
  shared_drive_id: string | null;
  root_folder_id: string | null;
  redirect_uri: string | null;
  created_at: string;
  updated_at: string;
}

export interface DriveCredentialsRow {
  id: string;
  org_id: string;
  access_token: string | null;
  refresh_token: string | null;
  token_type: string | null;
  scope: string[] | null;
  expires_at: string | null;
  status: DriveConnectionStatus | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface DriveFileRow {
  id: string;
  org_id: string;
  drive_file_id: string;
  drive_file_name: string | null;
  web_view_link: string | null;
  web_content_link: string | null;
  icon_link: string | null;
  mime_type: string | null;
  entity_type: string | null;
  entity_id: string | null;
  uploaded_by: string | null;
  created_at: string;
}

let cachedClient: SupabaseClient | null = null;

const getServiceClient = () => {
  if (cachedClient) {
    return cachedClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      "Les identifiants Supabase ne sont pas configurés pour l'intégration Google Drive. Définissez la variable d'environnement SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_SERVICE_KEY) pour continuer."
    );
  }

  cachedClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return cachedClient;
};

const isNotFound = (error: { code?: string } | null) => error?.code === "PGRST116";

export const fetchDriveSettings = async (orgId: string): Promise<DriveSettingsRow | null> => {
  const client = getServiceClient();
  const { data, error } = await client.from("drive_settings").select("*").eq("org_id", orgId).single();

  if (error) {
    if (isNotFound(error)) {
      return null;
    }
    throw error;
  }

  return data;
};

export const upsertDriveSettings = async (
  orgId: string,
  values: Partial<Omit<DriveSettingsRow, "id" | "org_id" | "created_at" | "updated_at">> &
    Pick<DriveSettingsRow, "client_id" | "client_secret">,
) => {
  const client = getServiceClient();
  const payload = {
    org_id: orgId,
    ...values,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await client.from("drive_settings").upsert(payload, { onConflict: 'org_id' }).select("*").single();

  if (error) {
    throw error;
  }

  return data as DriveSettingsRow;
};

export const fetchDriveCredentials = async (orgId: string): Promise<DriveCredentialsRow | null> => {
  const client = getServiceClient();
  const { data, error } = await client.from("drive_credentials").select("*").eq("org_id", orgId).single();

  if (error) {
    if (isNotFound(error)) {
      return null;
    }
    throw error;
  }

  return data;
};

export const upsertDriveCredentials = async (
  orgId: string,
  values: Partial<Omit<DriveCredentialsRow, "id" | "org_id" | "created_at" | "updated_at">>,
) => {
  const client = getServiceClient();
  const payload = {
    org_id: orgId,
    ...values,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await client.from("drive_credentials").upsert(payload, { onConflict: 'org_id' }).select("*").single();

  if (error) {
    throw error;
  }

  return data as DriveCredentialsRow;
};

export const recordDriveFile = async (
  orgId: string,
  values: Omit<DriveFileRow, "id" | "org_id" | "created_at">,
) => {
  const client = getServiceClient();
  const payload = {
    org_id: orgId,
    ...values,
    created_at: new Date().toISOString(),
  };

  const { data, error } = await client.from("drive_files").insert(payload).select("*").single();

  if (error) {
    throw error;
  }

  return data as DriveFileRow;
};

export const deleteDriveCredentials = async (orgId: string) => {
  const client = getServiceClient();
  const { error } = await client.from("drive_credentials").delete().eq("org_id", orgId);

  if (error) {
    throw error;
  }
};
