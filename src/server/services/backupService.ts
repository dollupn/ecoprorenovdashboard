import { ValidationError } from "../errors.js";
import { fetchProjectsPage } from "../repositories/projectRepository.js";

const DEFAULT_CHUNK_SIZE = 50;
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 250;

const sleep = async (ms: number) => await new Promise((resolve) => setTimeout(resolve, ms));

const isValidUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return Boolean(parsed.protocol && parsed.host);
  } catch {
    return false;
  }
};

type WebhookPayload = Record<string, unknown>;

type SendOptions = {
  maxRetries?: number;
};

const parseWebhookError = async (response: Response) => {
  try {
    const data = await response.json();
    if (data && typeof data.error === "string" && data.error.trim().length > 0) {
      return data.error.trim();
    }
    if (data && typeof data.message === "string" && data.message.trim().length > 0) {
      return data.message.trim();
    }
  } catch {
    // ignore parsing errors
  }

  return `Webhook responded with status ${response.status}`;
};

const sendWebhookPayload = async (
  webhookUrl: string,
  payload: WebhookPayload,
  options?: SendOptions,
): Promise<void> => {
  const maxRetries = options?.maxRetries ?? MAX_RETRIES;
  let attempt = 0;
  let lastError: unknown;

  while (attempt < maxRetries) {
    attempt += 1;

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const message = await parseWebhookError(response);
        throw new Error(message);
      }

      return;
    } catch (error) {
      lastError = error;
      if (attempt >= maxRetries) {
        break;
      }

      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error("Unknown webhook error");
};

type ChunkResult = {
  chunkIndex: number;
  totalChunks: number;
  exportedAt: string;
  failedChunks: Array<{ chunkIndex: number; error: string }>;
  totalProjects: number;
  success: boolean;
};

const chunkArray = <T>(items: T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
};

export const testBackupWebhook = async (webhookUrl: string) => {
  if (!webhookUrl || typeof webhookUrl !== "string") {
    throw new ValidationError("URL du webhook de sauvegarde requise");
  }

  if (!isValidUrl(webhookUrl)) {
    throw new ValidationError("URL du webhook de sauvegarde invalide");
  }

  const payload = {
    ping: true,
    app: "EcoProRenov",
    timestamp: new Date().toISOString(),
  } satisfies WebhookPayload;

  await sendWebhookPayload(webhookUrl, payload);

  return { success: true } as const;
};

type ExportOptions = {
  chunkSize?: number;
};

export const exportOrganizationBackup = async (
  orgId: string,
  webhookUrl: string,
  options?: ExportOptions,
): Promise<ChunkResult> => {
  if (!orgId || typeof orgId !== "string") {
    throw new ValidationError("Identifiant d'organisation requis pour l'export");
  }

  if (!webhookUrl || typeof webhookUrl !== "string") {
    throw new ValidationError("URL du webhook de sauvegarde requise");
  }

  if (!isValidUrl(webhookUrl)) {
    throw new ValidationError("URL du webhook de sauvegarde invalide");
  }

  const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;

  if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
    throw new ValidationError("La taille des lots doit être un entier positif");
  }

  const exportedAt = new Date().toISOString();
  const failedChunks: Array<{ chunkIndex: number; error: string }> = [];

  let from = 0;
  let to = from + chunkSize - 1;
  let chunkIndex = 0;
  let totalCount: number | null = null;
  let processedProjects = 0;

  while (true) {
    const { data, count } = await fetchProjectsPage(orgId, from, to);

    if (typeof count === "number") {
      if (totalCount === null || count > totalCount) {
        totalCount = count;
      }
    }

    if (!data || data.length === 0) {
      break;
    }

    const chunks = chunkArray(data, chunkSize);

    for (const currentChunk of chunks) {
      chunkIndex += 1;

      processedProjects += currentChunk.length;

      const totalChunks =
        typeof totalCount === "number"
          ? Math.ceil(totalCount / chunkSize)
          : Math.max(Math.ceil(processedProjects / chunkSize), chunkIndex);

      const payload: WebhookPayload = {
        meta: {
          chunkIndex,
          totalChunks,
          exportedAt,
          count: currentChunk.length,
        },
        projects: currentChunk,
      };

      try {
        await sendWebhookPayload(webhookUrl, payload);
      } catch (error) {
        failedChunks.push({
          chunkIndex,
          error: error instanceof Error ? error.message : "Erreur inconnue lors de l'envoi du webhook",
        });
      }
    }

    if (data.length < chunkSize) {
      break;
    }

    from += chunkSize;
    to = from + chunkSize - 1;
  }

  const finalTotal = typeof totalCount === "number" ? totalCount : processedProjects;
  const totalChunks = finalTotal > 0 ? Math.ceil(finalTotal / chunkSize) : 0;

  return {
    chunkIndex,
    totalChunks,
    exportedAt,
    failedChunks,
    totalProjects: finalTotal,
    success: failedChunks.length === 0,
  };
};

export type BackupExportResult = Awaited<ReturnType<typeof exportOrganizationBackup>>;
