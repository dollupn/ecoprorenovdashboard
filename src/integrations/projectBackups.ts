const API_BASE_PATH = "/api/projects";

const parseError = async (response: Response) => {
  try {
    const data = await response.json();
    if (data && typeof data.message === "string" && data.message.trim().length > 0) {
      return data.message.trim();
    }
    if (data && typeof data.error === "string" && data.error.trim().length > 0) {
      return data.error.trim();
    }
  } catch {
    // ignore parsing errors
  }

  return response.statusText || "Une erreur est survenue";
};

const fetchJson = async <T>(input: RequestInfo, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, {
    credentials: "include",
    ...init,
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
    throw new Error("Réponse inattendue du serveur");
  }

  return (await response.json()) as T;
};

export type ProjectBackupExportPayload = Record<string, unknown>;

export const exportProjectBackup = async ({
  projectId,
}: {
  projectId: string;
}): Promise<ProjectBackupExportPayload> => {
  if (!projectId) {
    throw new Error("Identifiant du projet requis pour l'export");
  }

  const url = `${API_BASE_PATH}/${encodeURIComponent(projectId)}/backup/export`;

  return await fetchJson<ProjectBackupExportPayload>(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });
};

export const syncProjectBackup = async ({
  projectId,
}: {
  projectId: string;
}): Promise<{ success: boolean }> => {
  if (!projectId) {
    throw new Error("Identifiant du projet requis pour la synchronisation");
  }

  const url = `${API_BASE_PATH}/${encodeURIComponent(projectId)}/backup/sync`;

  return await fetchJson<{ success: boolean }>(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });
};

export const projectBackupClient = {
  exportProjectBackup,
  syncProjectBackup,
};

export type ProjectBackupClient = typeof projectBackupClient;
