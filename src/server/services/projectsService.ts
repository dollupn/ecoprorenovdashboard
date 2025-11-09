import {
  fetchChantiersForProject,
  fetchInvoicesForProject,
  fetchProjectById,
  fetchQuotesForProject,
  invokeProjectExportFunction,
  updateProjectStatus,
  type ProjectExportBundle,
  type ProjectRow,
} from "../repositories/projectRepository.js";
import { fetchOrganizationSettings } from "../repositories/settingsRepository.js";
import { ApiError, NotFoundError, ValidationError } from "../errors.js";
import { ensureProjectStatusTransition, type ProjectStatus } from "./statusHelpers.js";
import { extractMessage, isRecord, parseResponseBody } from "../utils/http.js";

export const getProjectDetails = async (orgId: string, projectId: string) => {
  const project = await fetchProjectById(projectId, orgId);

  if (!project) {
    throw new NotFoundError("Projet introuvable");
  }

  const [chantiers, quotes, invoices] = await Promise.all([
    fetchChantiersForProject(projectId, orgId),
    fetchQuotesForProject(projectId, orgId),
    fetchInvoicesForProject(projectId, orgId),
  ]);

  return {
    project,
    chantiers,
    quotes,
    invoices,
  };
};

const toProjectStatus = (status: string): ProjectStatus => {
  const normalized = (status ?? "").toUpperCase();

  if (!normalized) {
    throw new ValidationError("Statut projet manquant");
  }

  return normalized as ProjectStatus;
};

export const updateProjectStatusService = async (orgId: string, projectId: string, nextStatus: string) => {
  const project = await fetchProjectById(projectId, orgId);

  if (!project) {
    throw new NotFoundError("Projet introuvable");
  }

  const normalizedNextStatus = toProjectStatus(nextStatus);

  ensureProjectStatusTransition(project.status, normalizedNextStatus);

  const previousStatus = project.status;

  const updatedProject: ProjectRow = await updateProjectStatus(projectId, orgId, normalizedNextStatus);

  return {
    project: updatedProject,
  };
};

const requireExportKey = () => {
  const exportKey = process.env.ECOPRO_EXPORT_KEY;

  if (!exportKey) {
    throw new ApiError("La clé d'export ECOPRO_EXPORT_KEY n'est pas configurée", 500);
  }

  return exportKey;
};

export const exportProjectBundle = async (
  orgId: string,
  projectId: string,
): Promise<ProjectExportBundle> => {
  const project = await fetchProjectById(projectId, orgId);

  if (!project) {
    throw new NotFoundError("Projet introuvable");
  }

  const exportResponse = await invokeProjectExportFunction(projectId);

  if (!exportResponse.ok) {
    const message = extractMessage(exportResponse.body, "Le service d'export a rencontré une erreur");
    throw new ApiError(message, exportResponse.status);
  }

  if (!isRecord(exportResponse.body)) {
    throw new ApiError("Réponse invalide du service d'export", 500);
  }

  return exportResponse.body;
};

export type ProjectSyncResult = {
  success: true;
  message: string;
  status: number;
  webhookUrl: string;
  webhookResponse: unknown;
};

export const syncProjectToWebhook = async (
  orgId: string,
  projectId: string,
): Promise<ProjectSyncResult> => {
  const bundle = await exportProjectBundle(orgId, projectId);
  const settings = await fetchOrganizationSettings(orgId);
  const webhookUrl = settings?.backup_webhook_url?.trim();

  if (!webhookUrl) {
    throw new ValidationError("Aucun webhook de sauvegarde configuré pour cette organisation");
  }

  const exportKey = requireExportKey();
  const webhookSecret = process.env.ECOPRO_WEBHOOK_SECRET;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-ecopro-key": exportKey,
        ...(webhookSecret ? { "x-ecopro-webhook-secret": webhookSecret } : {}),
      },
      body: JSON.stringify(bundle),
      signal: controller.signal,
    });

    const { body } = await parseResponseBody(response);

    if (!response.ok) {
      const message = extractMessage(body, `Le webhook a répondu avec le statut ${response.status}`);
      throw new ApiError(message, response.status);
    }

    const message = extractMessage(body, "Projet synchronisé avec succès");

    return {
      success: true,
      message,
      status: response.status,
      webhookUrl,
      webhookResponse: body,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    const message =
      error instanceof Error
        ? error.name === "AbortError"
          ? "Le webhook n'a pas répondu à temps"
          : error.message
        : "Erreur inconnue lors de l'appel du webhook";

    throw new ApiError(message, 502);
  } finally {
    clearTimeout(timeoutId);
  }
};
