const API_BASE_PATH = "/api/backups";

interface BackupRequestParams {
  accessToken: string;
  orgId: string;
}

const fetchWithAuth = async (path: string, { accessToken, orgId }: BackupRequestParams) => {
  const response = await fetch(`${API_BASE_PATH}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "x-organization-id": orgId,
    },
    credentials: "include",
  });

  if (!response.ok) {
    let message = response.statusText || "Une erreur est survenue";

    try {
      const payload = await response.json();
      if (payload && typeof payload.error === "string") {
        message = payload.error;
      }
    } catch (error) {
      // Ignore JSON parsing errors and use the default message
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return;
  }

  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return await response.json();
  }

  return;
};

export const testBackupWebhook = async (params: BackupRequestParams) => {
  return await fetchWithAuth("/test", params);
};

export const exportProjectsNow = async (params: BackupRequestParams) => {
  return await fetchWithAuth("/export", params);
};
