import {
  createInvoice,
  fetchChantiersForProject,
  fetchProjectById,
  fetchQuotesForProject,
} from "../repositories/projectRepository";
import { ForbiddenError, NotFoundError, ValidationError } from "../errors";
import { type ProjectStatus } from "./statusHelpers";

const ALLOWED_INVOICE_STATUSES: ProjectStatus[] = ["VISITE_TECHNIQUE", "LIVRE"];

const isAllowedForInvoice = (status: string): status is ProjectStatus => {
  const normalized = (status ?? "").toUpperCase() as ProjectStatus;
  return ALLOWED_INVOICE_STATUSES.includes(normalized);
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const buildInvoiceReference = (projectRef: string | null): string => {
  const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, "");
  const base = (projectRef ?? "PROJET").replace(/\s+/g, "").toUpperCase();
  return `${base}-INV-${timestamp}`;
};

const formatNotes = (args: {
  quoteRef?: string | null;
  quoteAmount?: number | null;
  chantierRef?: string | null;
  chantierStatus?: string | null;
  surfaceFacturee?: number | null;
  valorisationCee?: number | null;
}) => {
  const segments: string[] = [];

  if (args.quoteRef) {
    const formattedAmount =
      typeof args.quoteAmount === "number" && Number.isFinite(args.quoteAmount)
        ? `${args.quoteAmount.toFixed(2)} €`
        : undefined;

    segments.push(
      formattedAmount
        ? `Basé sur le devis ${args.quoteRef} (${formattedAmount})`
        : `Basé sur le devis ${args.quoteRef}`,
    );
  }

  if (args.chantierRef) {
    segments.push(
      args.chantierStatus
        ? `Dernier chantier : ${args.chantierRef} (${args.chantierStatus})`
        : `Dernier chantier : ${args.chantierRef}`,
    );
  }

  if (typeof args.surfaceFacturee === "number" && Number.isFinite(args.surfaceFacturee)) {
    segments.push(`Surface facturée : ${args.surfaceFacturee.toFixed(2)} m²`);
  }

  if (typeof args.valorisationCee === "number" && Number.isFinite(args.valorisationCee)) {
    segments.push(`Valorisation CEE : ${args.valorisationCee.toFixed(2)} €`);
  }

  return segments.join("\n");
};

const resolveClientName = (project: { client_first_name?: string | null; client_last_name?: string | null; client_name?: string | null }) => {
  const first = (project.client_first_name ?? "").trim();
  const last = (project.client_last_name ?? "").trim();
  const combined = `${first} ${last}`.trim();

  if (combined.length > 0) {
    return combined;
  }

  return project.client_name?.trim() ?? "Client";
};

export const generateInvoiceForProject = async (orgId: string, projectId: string) => {
  const project = await fetchProjectById(projectId, orgId);

  if (!project) {
    throw new NotFoundError("Projet introuvable");
  }

  if (!isAllowedForInvoice(project.status)) {
    throw new ForbiddenError(
      "La génération de facture est uniquement autorisée pour les projets en visite technique ou livrés",
    );
  }

  if (!project.org_id) {
    throw new ValidationError("Le projet n'est pas associé à une organisation valide");
  }

  const [quotes, chantiers] = await Promise.all([
    fetchQuotesForProject(projectId, orgId),
    fetchChantiersForProject(projectId, orgId),
  ]);

  const latestQuote = quotes[0] ?? null;
  if (!latestQuote) {
    throw new ValidationError("Aucun devis n'est associé à ce projet");
  }

  const latestChantier = chantiers.reduce<typeof chantiers[number] | null>((acc, chantier) => {
    if (!acc) {
      return chantier;
    }

    const current = new Date(chantier.updated_at ?? chantier.created_at ?? new Date(0)).getTime();
    const previous = new Date(acc.updated_at ?? acc.created_at ?? new Date(0)).getTime();

    return current > previous ? chantier : acc;
  }, null);

  const revenue = latestChantier ? toNumber(latestChantier.revenue) : null;
  const quoteAmount = toNumber(latestQuote.amount);
  const invoiceAmount = revenue ?? quoteAmount;

  if (!invoiceAmount || invoiceAmount <= 0) {
    throw new ValidationError("Impossible de générer une facture sans montant valide");
  }

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 30);

  const invoice = await createInvoice({
    project_id: project.id,
    org_id: project.org_id,
    user_id: project.user_id,
    quote_id: latestQuote.id,
    invoice_ref: buildInvoiceReference(project.project_ref),
    client_name: resolveClientName(project),
    client_first_name: project.client_first_name,
    client_last_name: project.client_last_name,
    amount: invoiceAmount,
    status: "DRAFT",
    due_date: dueDate.toISOString(),
    notes: formatNotes({
      quoteRef: latestQuote.quote_ref,
      quoteAmount,
      chantierRef: latestChantier?.site_ref,
      chantierStatus: latestChantier?.status,
      surfaceFacturee: latestChantier?.surface_facturee ?? null,
      valorisationCee: latestChantier?.valorisation_cee ?? null,
    }) || null,
  });

  return { invoice };
};
