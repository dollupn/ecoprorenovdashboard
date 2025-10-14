import type {
  CreateAuthUrlParams,
  DriveConnectionStatus,
  DriveUploadOptions,
  DriveUploadResult,
  ExchangeAuthCodePayload,
} from "./types";

const API_BASE_PATH = "/api/google-drive";

const parseError = async (response: Response) => {
  try {
    const payload = await response.json();
    if (payload && typeof payload.error === "string") {
      return payload.error;
    }
  } catch (error) {
    console.warn("Unable to parse Google Drive API error", error);
  }

  return response.statusText || "Une erreur est survenue";
};

const fetchJson = async <T>(input: RequestInfo, init?: RequestInit): Promise<T> => {
  const isFormData = init?.body instanceof FormData;
  const headers = new Headers(init?.headers);

  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(input, {
    credentials: "include",
    ...init,
    headers,
  });

  if (!response.ok) {
    const message = await parseError(response);
    throw new Error(message);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return (await response.json()) as T;
};

export const getDriveConnectionStatus = async (orgId: string): Promise<DriveConnectionStatus> => {
  if (!orgId) {
    throw new Error("L'identifiant d'organisation est requis");
  }

  return await fetchJson<DriveConnectionStatus>(
    `${API_BASE_PATH}/connection?orgId=${encodeURIComponent(orgId)}`,
  );
};

export const createDriveAuthUrl = async (
  params: CreateAuthUrlParams,
): Promise<{ url: string }> => {
  if (!params.orgId) {
    throw new Error("L'identifiant d'organisation est requis");
  }

  const query = new URLSearchParams({ orgId: params.orgId });

  if (params.redirectUri) {
    query.set("redirectUri", params.redirectUri);
  }

  if (params.state) {
    query.set("state", params.state);
  }

  if (params.prompt) {
    query.set("prompt", params.prompt);
  }

  return await fetchJson<{ url: string }>(`${API_BASE_PATH}/auth/url?${query.toString()}`);
};

export const exchangeDriveAuthCode = async (
  payload: ExchangeAuthCodePayload,
): Promise<DriveConnectionStatus> => {
  if (!payload.orgId || !payload.code) {
    throw new Error("Paramètres d'authentification Drive manquants");
  }

  return await fetchJson<DriveConnectionStatus>(`${API_BASE_PATH}/auth/exchange`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const refreshDriveConnection = async (
  orgId: string,
): Promise<DriveConnectionStatus> => {
  return await fetchJson<DriveConnectionStatus>(`${API_BASE_PATH}/connection/refresh`, {
    method: "POST",
    body: JSON.stringify({ orgId }),
  });
};

export const uploadFileToDrive = async (
  options: DriveUploadOptions,
): Promise<DriveUploadResult> => {
  if (!options.orgId) {
    throw new Error("Organisation requise pour l'upload Drive");
  }

  const formData = new FormData();
  formData.append("orgId", options.orgId);
  formData.append("file", options.file);

  if (options.parentFolderId) {
    formData.append("parentFolderId", options.parentFolderId);
  }

  if (options.entityType) {
    formData.append("entityType", options.entityType);
  }

  if (options.entityId) {
    formData.append("entityId", options.entityId);
  }

  if (options.description) {
    formData.append("description", options.description);
  }

  return await fetchJson<DriveUploadResult>(`${API_BASE_PATH}/upload`, {
    method: "POST",
    body: formData,
  });
};

export const disconnectDrive = async (orgId: string): Promise<DriveConnectionStatus> => {
  if (!orgId) {
    throw new Error("Organisation requise pour déconnecter Drive");
  }

  return await fetchJson<DriveConnectionStatus>(`${API_BASE_PATH}/connection`, {
    method: "DELETE",
    body: JSON.stringify({ orgId }),
  });
};

export const googleDriveClient = {
  getDriveConnectionStatus,
  createDriveAuthUrl,
  exchangeDriveAuthCode,
  refreshDriveConnection,
  uploadFileToDrive,
  disconnectDrive,
};

export type GoogleDriveClient = typeof googleDriveClient;
