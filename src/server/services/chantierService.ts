import {
  createChantier,
  fetchChantierById,
  fetchProjectById,
  updateChantierStatus,
  type ProjectRow,
  type SiteRow,
} from "../repositories/projectRepository";
import { NotFoundError, ValidationError } from "../errors";
import {
  ensureChantierStatusTransition,
  syncProjectStatusWithChantiers,
} from "./statusHelpers";

type StartChantierInput = {
  siteRef?: string;
  dateDebut?: string;
  dateFinPrevue?: string | null;
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  productName?: string | null;
  notes?: string | null;
  teamMembers?: unknown;
  subcontractorId?: string | null;
};

const normaliseDate = (value?: string | null): string => {
  if (!value) {
    return new Date().toISOString();
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError("Date de début de chantier invalide");
  }

  return parsed.toISOString();
};

const normaliseOptionalDate = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError("Date de fin prévisionnelle invalide");
  }

  return parsed.toISOString();
};

const resolveClientName = (project: ProjectRow) => {
  const firstName = (project.client_first_name ?? "").trim();
  const lastName = (project.client_last_name ?? "").trim();
  const combined = `${firstName} ${lastName}`.trim();

  if (combined.length > 0) {
    return combined;
  }

  if (project.client_name?.trim()) {
    return project.client_name.trim();
  }

  if (project.company?.trim()) {
    return project.company.trim();
  }

  return "Client";
};

const normaliseTeamMembers = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (typeof entry === "string") {
        return entry.trim();
      }

      if (entry && typeof entry === "object" && "id" in entry && typeof (entry as { id?: unknown }).id === "string") {
        return ((entry as { id?: string }).id ?? "").trim();
      }

      return "";
    })
    .filter((member): member is string => member.length > 0);
};

export const startChantierService = async (orgId: string, projectId: string, input: StartChantierInput) => {
  const project = await fetchProjectById(projectId, orgId);

  if (!project) {
    throw new NotFoundError("Projet introuvable");
  }

  if (!project.org_id) {
    throw new ValidationError("Le projet n'est pas associé à une organisation");
  }

  const siteRef = (input.siteRef ?? `${project.project_ref}-CHANTIER`).trim();
  if (siteRef.length < 3) {
    throw new ValidationError("La référence chantier doit contenir au moins 3 caractères");
  }

  const address = (input.address ?? project.address ?? project.hq_address ?? "").trim();
  const city = (input.city ?? project.city ?? "").trim();
  const postalCode = (input.postalCode ?? project.postal_code ?? "").trim();

  if (!address) {
    throw new ValidationError("L'adresse du chantier est requise");
  }
  if (!city) {
    throw new ValidationError("La ville du chantier est requise");
  }
  if (!postalCode) {
    throw new ValidationError("Le code postal du chantier est requis");
  }

  const dateDebut = normaliseDate(input.dateDebut);
  const dateFinPrevue = normaliseOptionalDate(input.dateFinPrevue);
  const notes = typeof input.notes === "string" ? input.notes.trim() || null : null;

  const chantier = await createChantier({
    project_id: project.id,
    project_ref: project.project_ref,
    site_ref: siteRef,
    client_name: resolveClientName(project),
    client_first_name: project.client_first_name,
    client_last_name: project.client_last_name,
    product_name: (input.productName ?? project.product_name ?? "").trim() || project.product_name,
    address,
    city,
    postal_code: postalCode,
    status: "PLANIFIE",
    date_debut: dateDebut,
    date_fin_prevue: dateFinPrevue,
    team_members: normaliseTeamMembers(input.teamMembers),
    notes,
    user_id: project.user_id,
    org_id: project.org_id,
    subcontractor_id:
      typeof input.subcontractorId === "string" && input.subcontractorId.trim().length > 0
        ? input.subcontractorId
        : null,
  });

  const syncedProject = await syncProjectStatusWithChantiers(project, orgId);

  return { chantier, project: syncedProject };
};

export const updateChantierStatusService = async (orgId: string, chantierId: string, nextStatus: string) => {
  const chantier = await fetchChantierById(chantierId, orgId);

  if (!chantier) {
    throw new NotFoundError("Chantier introuvable");
  }

  const normalizedStatus = (nextStatus ?? "").toUpperCase();
  if (!normalizedStatus) {
    throw new ValidationError("Statut chantier manquant");
  }

  ensureChantierStatusTransition(chantier.status, normalizedStatus);

  const updatedChantier: SiteRow = await updateChantierStatus(chantierId, orgId, normalizedStatus as SiteRow["status"]);

  let updatedProject: ProjectRow | null = null;

  if (chantier.project_id) {
    const project = await fetchProjectById(chantier.project_id, orgId);
    if (project) {
      updatedProject = await syncProjectStatusWithChantiers(project, orgId);
    }
  }

  return { chantier: updatedChantier, project: updatedProject };
};
