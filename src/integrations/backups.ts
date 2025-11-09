export type BackupTestRequest = {
  orgId: string;
  webhookUrl: string;
  accessToken: string;
};

export type BackupExportRequest = BackupTestRequest & {
  chunkSize?: number;
};

export type BackupExportResponse = {
  chunkIndex: number;
  totalChunks: number;
  exportedAt: string;
  failedChunks: Array<{ chunkIndex: number; error: string }>;
  totalProjects: number;
  success: boolean;
};

const API_BASE_PATH = "/api/backups";

const parseError = async (response: Response) => {
  try {
    const payload = await response.json();
    if (payload && typeof payload.message === "string" && payload.message.trim().length > 0) {
      return payload.message.trim();
    }
    if (payload && typeof payload.error === "string" && payload.error.trim().length > 0) {
      return payload.error.trim();
    }
  } catch {
    // ignore JSON parse errors
  }

  return response.statusText || "Une erreur est survenue";
};

const fetchJson = async <T>(input: RequestInfo, init: RequestInit): Promise<T> => {
  const headers = new Headers(init.headers);

  if (!headers.has("Content-Type")) {
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

  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    throw new Error("Réponse inattendue du serveur de sauvegarde");
  }

  return (await response.json()) as T;
};

const buildHeaders = (orgId: string, accessToken: string) => {
  if (!orgId) {
    throw new Error("L'identifiant d'organisation est requis");
  }

  if (!accessToken) {
    throw new Error("Jeton d'accès requis pour les sauvegardes");
  }

  return {
    Authorization: `Bearer ${accessToken}`,
    "x-organization-id": orgId,
  } satisfies HeadersInit;
};

export const testBackupWebhook = async (options: BackupTestRequest) => {
  const headers = buildHeaders(options.orgId, options.accessToken);

  return await fetchJson<{ success: boolean }>(`${API_BASE_PATH}/test`, {
    method: "POST",
    headers,
    body: JSON.stringify({ webhookUrl: options.webhookUrl }),
  });
};

export const exportBackups = async (options: BackupExportRequest) => {
  const headers = buildHeaders(options.orgId, options.accessToken);

  return await fetchJson<BackupExportResponse>(`${API_BASE_PATH}/export`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      webhookUrl: options.webhookUrl,
      chunkSize: options.chunkSize,
    }),
  });
};

export const backupClient = {
  testBackupWebhook,
  exportBackups,
};

export type BackupClient = typeof backupClient;
