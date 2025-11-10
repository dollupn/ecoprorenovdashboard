import type {
  CreateAuthUrlParams,
  CreateAuthUrlResponse,
  DriveConnectionMutationOptions,
  DriveConnectionStatus,
  DriveUploadOptions,
  DriveUploadResult,
  ExchangeAuthCodePayload,
  UpdateDriveSettingsRequest,
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

  try {
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

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error("Le serveur Google Drive n'est pas disponible");
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Erreur de connexion au serveur Google Drive");
  }
};

const buildAuthHeaders = (orgId: string, accessToken?: string | null): Record<string, string> => {
  const headers: Record<string, string> = {
    "x-organization-id": orgId,
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return headers;
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
): Promise<CreateAuthUrlResponse> => {
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

  return await fetchJson<CreateAuthUrlResponse>(`${API_BASE_PATH}/auth/url?${query.toString()}`);
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

export const refreshDriveConnection = async ({
  orgId,
  accessToken,
}: DriveConnectionMutationOptions): Promise<DriveConnectionStatus> => {
  if (!orgId) {
    throw new Error("Organisation requise pour actualiser Drive");
  }

  return await fetchJson<DriveConnectionStatus>(`${API_BASE_PATH}/connection/refresh`, {
    method: "POST",
    headers: buildAuthHeaders(orgId, accessToken),
    body: JSON.stringify({ orgId }),
  });
};

export const uploadFileToDrive = async (
  options: DriveUploadOptions,
): Promise<DriveUploadResult> => {
  if (!options.orgId) {
    throw new Error("Organisation requise pour l'upload Drive");
  }

  const { accessToken, ...rest } = options;

  const formData = new FormData();
  formData.append("orgId", rest.orgId);
  formData.append("file", rest.file);

  if (rest.parentFolderId) {
    formData.append("parentFolderId", rest.parentFolderId);
  }

  if (rest.entityType) {
    formData.append("entityType", rest.entityType);
  }

  if (rest.entityId) {
    formData.append("entityId", rest.entityId);
  }

  if (rest.description) {
    formData.append("description", rest.description);
  }

  return await fetchJson<DriveUploadResult>(`${API_BASE_PATH}/upload`, {
    method: "POST",
    headers: buildAuthHeaders(rest.orgId, accessToken),
    body: formData,
  });
};

export const disconnectDrive = async ({
  orgId,
  accessToken,
}: DriveConnectionMutationOptions): Promise<DriveConnectionStatus> => {
  if (!orgId) {
    throw new Error("Organisation requise pour déconnecter Drive");
  }

  return await fetchJson<DriveConnectionStatus>(`${API_BASE_PATH}/connection`, {
    method: "DELETE",
    headers: buildAuthHeaders(orgId, accessToken),
    body: JSON.stringify({ orgId }),
  });
};

export const updateDriveSettings = async ({ accessToken, ...payload }: UpdateDriveSettingsRequest) => {
  if (!payload.orgId) {
    throw new Error("Organisation requise pour configurer Google Drive");
  }

  return await fetchJson<DriveConnectionStatus>(`${API_BASE_PATH}/settings`, {
    method: "PUT",
    headers: buildAuthHeaders(payload.orgId, accessToken),
    body: JSON.stringify(payload),
  });
};

export const googleDriveClient = {
  getDriveConnectionStatus,
  createDriveAuthUrl,
  exchangeDriveAuthCode,
  refreshDriveConnection,
  uploadFileToDrive,
  disconnectDrive,
  updateDriveSettings,
};

export type GoogleDriveClient = typeof googleDriveClient;
