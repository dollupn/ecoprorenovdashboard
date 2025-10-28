import {
  fetchChantiersForProject,
  fetchInvoicesForProject,
  fetchProjectById,
  fetchQuotesForProject,
  updateProjectStatus,
  type ProjectRow,
} from "../repositories/projectRepository";
import { NotFoundError, ValidationError } from "../errors";
import {
  ensureProjectStatusNotBehindChantiers,
  ensureProjectStatusTransition,
  type ProjectStatus,
} from "./statusHelpers";

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

  const chantiers = await fetchChantiersForProject(projectId, orgId);
  ensureProjectStatusNotBehindChantiers(normalizedNextStatus, chantiers);

  const updatedProject: ProjectRow = await updateProjectStatus(projectId, orgId, normalizedNextStatus);

  return {
    project: updatedProject,
  };
};
