import { Readable } from "node:stream";
import type { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";
import type { Express } from "express";
import {
  deleteDriveCredentials,
  fetchDriveCredentials,
  fetchDriveSettings,
  recordDriveFile,
  upsertDriveCredentials,
  type DriveConnectionStatus,
  type DriveCredentialsRow,
  type DriveSettingsRow,
} from "../repositories/googleDriveRepository.js";

export interface GoogleDriveUploadOptions {
  orgId: string;
  file: Express.Multer.File;
  parentFolderId?: string;
  entityType?: string;
  entityId?: string;
  userId?: string | null;
  description?: string;
}

export interface GoogleDriveConnectionSummary {
  orgId: string;
  connected: boolean;
  status: DriveConnectionStatus;
  hasRefreshToken: boolean;
  expiresAt: string | null;
  rootFolderId: string | null;
  sharedDriveId: string | null;
  errorMessage: string | null;
}

const DRIVE_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
];

const toIsoDate = (value?: number | string | null) => {
  if (!value) {
    return null;
  }

  if (typeof value === "number") {
    return new Date(value).toISOString();
  }

  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    return new Date(parsed).toISOString();
  }

  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return date.toISOString();
  }

  return null;
};

const shouldRefreshToken = (credentials: DriveCredentialsRow | null) => {
  if (!credentials?.expires_at) {
    return !credentials?.access_token;
  }

  const expiry = new Date(credentials.expires_at).getTime();
  const now = Date.now();
  return !credentials.access_token || Number.isNaN(expiry) || expiry - now < 60_000;
};

const createOAuthClient = (settings: DriveSettingsRow, redirectUri?: string) => {
  const clientId = settings.client_id;
  const clientSecret = settings.client_secret;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Les identifiants client Google Drive ne sont pas configurés pour cette organisation. Veuillez renseigner le client ID et le client secret.",
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri || settings.redirect_uri || undefined);
};

const loadClientWithCredentials = async (
  orgId: string,
  redirectUri?: string,
): Promise<{ oauthClient: OAuth2Client; settings: DriveSettingsRow; credentials: DriveCredentialsRow | null }> => {
  const settings = await fetchDriveSettings(orgId);

  if (!settings) {
    throw new Error(
      "Configuration Google Drive introuvable. Ajoutez les identifiants OAuth et le dossier de destination dans les paramètres organisationnels.",
    );
  }

  const oauthClient = createOAuthClient(settings, redirectUri);
  const credentials = await fetchDriveCredentials(orgId);

  if (credentials) {
    oauthClient.setCredentials({
      access_token: credentials.access_token ?? undefined,
      refresh_token: credentials.refresh_token ?? undefined,
      scope: credentials.scope?.join(" "),
      token_type: credentials.token_type ?? undefined,
      expiry_date: credentials.expires_at ? new Date(credentials.expires_at).getTime() : undefined,
    });
  }

  return { oauthClient, settings, credentials };
};

export const getDriveConnectionSummary = async (
  orgId: string,
): Promise<GoogleDriveConnectionSummary> => {
  const settings = await fetchDriveSettings(orgId);
  const credentials = await fetchDriveCredentials(orgId);

  const status: DriveConnectionStatus = credentials?.status
    ? credentials.status
    : settings
    ? "disconnected"
    : "pending";

  return {
    orgId,
    connected: status === "connected" && Boolean(credentials?.access_token && credentials?.refresh_token),
    status,
    hasRefreshToken: Boolean(credentials?.refresh_token),
    expiresAt: credentials?.expires_at ?? null,
    rootFolderId: settings?.root_folder_id ?? null,
    sharedDriveId: settings?.shared_drive_id ?? null,
    errorMessage: credentials?.error_message ?? null,
  };
};

export const generateDriveAuthUrl = async (
  orgId: string,
  options: { redirectUri?: string; state?: string; prompt?: string },
) => {
  const { oauthClient } = await loadClientWithCredentials(orgId, options.redirectUri);

  return oauthClient.generateAuthUrl({
    access_type: "offline",
    scope: DRIVE_SCOPES,
    include_granted_scopes: true,
    state: options.state,
    prompt: (options.prompt as "consent" | "select_account" | "none" | undefined) ?? "consent",
  });
};

export const exchangeDriveAuthCode = async (
  orgId: string,
  code: string,
  redirectUri?: string,
): Promise<GoogleDriveConnectionSummary> => {
  const { oauthClient, credentials: currentCredentials } = await loadClientWithCredentials(orgId, redirectUri);

  const { tokens } = await oauthClient.getToken(code);
  oauthClient.setCredentials(tokens);

  const scopeArray = Array.isArray(tokens.scope)
    ? tokens.scope
    : typeof tokens.scope === "string"
    ? tokens.scope.split(/\s+/).filter(Boolean)
    : undefined;

  await upsertDriveCredentials(orgId, {
    access_token: tokens.access_token ?? null,
    refresh_token: tokens.refresh_token ?? currentCredentials?.refresh_token ?? null,
    token_type: tokens.token_type ?? null,
    scope: scopeArray ?? currentCredentials?.scope ?? null,
    expires_at: toIsoDate(tokens.expiry_date),
    status: "connected",
    error_message: null,
  });

  return await getDriveConnectionSummary(orgId);
};

export const refreshDriveCredentials = async (
  orgId: string,
  redirectUri?: string,
): Promise<GoogleDriveConnectionSummary> => {
  const { oauthClient, credentials } = await loadClientWithCredentials(orgId, redirectUri);

  if (!credentials?.refresh_token) {
    throw new Error("Aucun refresh token disponible. Veuillez reconnecter Google Drive.");
  }

  try {
    const { credentials: refreshed } = await oauthClient.refreshAccessToken();

    await upsertDriveCredentials(orgId, {
      access_token: refreshed.access_token ?? null,
      refresh_token: refreshed.refresh_token ?? credentials.refresh_token,
      token_type: refreshed.token_type ?? credentials.token_type ?? null,
      scope:
        (Array.isArray(refreshed.scope)
          ? refreshed.scope
          : typeof refreshed.scope === "string"
          ? refreshed.scope.split(/\s+/).filter(Boolean)
          : credentials.scope) ?? null,
      expires_at: toIsoDate(refreshed.expiry_date),
      status: "connected",
      error_message: null,
    });
  } catch (error) {
    await upsertDriveCredentials(orgId, {
      status: "error",
      error_message: error instanceof Error ? error.message : "Impossible d'actualiser le token Drive",
    });
    throw error;
  }

  return await getDriveConnectionSummary(orgId);
};

export const disconnectDrive = async (orgId: string) => {
  await deleteDriveCredentials(orgId);
  return await getDriveConnectionSummary(orgId);
};

export const uploadFileToDrive = async (
  options: GoogleDriveUploadOptions,
): Promise<{
  id: string;
  name: string;
  mimeType: string | undefined;
  webViewLink: string | undefined;
  webContentLink: string | undefined;
  iconLink: string | undefined;
  parents?: string[];
}> => {
  let { oauthClient, settings, credentials } = await loadClientWithCredentials(options.orgId);

  if (shouldRefreshToken(credentials || null)) {
    await refreshDriveCredentials(options.orgId);
    const refreshed = await loadClientWithCredentials(options.orgId);
    oauthClient = refreshed.oauthClient;
    settings = refreshed.settings;
    credentials = refreshed.credentials;
  }

  const drive = google.drive({ version: "v3", auth: oauthClient });
  const parentId = options.parentFolderId || settings.root_folder_id || undefined;

  const requestBody: Record<string, unknown> = {
    name: options.file.originalname,
  };

  if (parentId) {
    requestBody.parents = [parentId];
  }

  if (options.description) {
    requestBody.description = options.description;
  }

  const media = {
    mimeType: options.file.mimetype,
    body: Readable.from(options.file.buffer),
  };

  const { data } = await drive.files.create({
    requestBody,
    media,
    fields: "id, name, mimeType, webViewLink, webContentLink, iconLink, parents",
    supportsAllDrives: Boolean(settings.shared_drive_id),
  });

  if (!data.id) {
    throw new Error("L'upload Google Drive n'a pas renvoyé d'identifiant de fichier");
  }

  await recordDriveFile(options.orgId, {
    drive_file_id: data.id,
    drive_file_name: data.name ?? options.file.originalname,
    web_view_link: data.webViewLink ?? null,
    web_content_link: data.webContentLink ?? null,
    icon_link: data.iconLink ?? null,
    mime_type: data.mimeType ?? options.file.mimetype ?? null,
    entity_type: options.entityType ?? null,
    entity_id: options.entityId ?? null,
    uploaded_by: options.userId ?? null,
  });

  return {
    id: data.id,
    name: data.name ?? options.file.originalname,
    mimeType: data.mimeType ?? options.file.mimetype,
    webViewLink: data.webViewLink ?? undefined,
    webContentLink: data.webContentLink ?? undefined,
    iconLink: data.iconLink ?? undefined,
    parents: Array.isArray(data.parents) ? data.parents : undefined,
  };
};
