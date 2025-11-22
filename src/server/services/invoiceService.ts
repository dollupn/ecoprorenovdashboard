import {
  createInvoice,
  fetchChantiersForProject,
  fetchProjectById,
  fetchQuotesForProject,
} from "../repositories/projectRepository.js";
import { ForbiddenError, NotFoundError, ValidationError } from "../errors.js";
import { type ProjectStatus } from "./statusHelpers.js";

const ALLOWED_INVOICE_STATUSES: ProjectStatus[] = [
  "VISITE_TECHNIQUE",
  "CHANTIER_TERMINE",
  "LIVRE",
];

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

const buildDetailedDescription = (chantier: any, project: any): string => {
  const parts: string[] = [];

  if (chantier.product_name) {
    parts.push(`Mise en place d'un système conforme ${chantier.product_name}`);
  }

  if (chantier.surface_facturee_m2) {
    parts.push(`Surface isolée : ${chantier.surface_facturee_m2} m²`);
  }

  if (chantier.date_debut) {
    const formatted = new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date(chantier.date_debut));
    parts.push(`Début travaux : ${formatted}`);
  }

  if (project.building_type) {
    parts.push(`Type de bâtiment : ${project.building_type}`);
  }

  if (project.usage) {
    parts.push(`Usage : ${project.usage}`);
  }

  if (chantier.subcontractor_id) {
    parts.push(
      "\nLes travaux objets de la présente facture sont réalisés en sous-traitance conformément aux dispositions de la loi n°75-1334 du 31 décembre 1975.",
    );
  }

  return parts.join("\n");
};

const buildInvoiceItems = (chantier: any, project: any) => {
  const items = [];

  if (chantier && chantier.product_name) {
    const unitPrice =
      (chantier.cout_mo_par_m2 || 0) +
      (chantier.cout_materiaux_par_m2 || chantier.cout_isolant_par_m2 || 0);

    items.push({
      code: chantier.site_ref,
      title: chantier.product_name,
      long_description: buildDetailedDescription(chantier, project),
      unit_price_ht: unitPrice,
      quantity: chantier.surface_facturee_m2 || 1,
    });
  }

  return items;
};

const buildCeePrimeText = (chantier: any): string | undefined => {
  if (!chantier?.valorisation_cee || chantier.valorisation_cee === 0) {
    return undefined;
  }

  const primeAmount = Math.abs(chantier.valorisation_cee).toFixed(2);

  return `Tout ou partie des travaux relatifs à cette facture sont éligibles à une prime d'un montant de ${primeAmount} euros net de taxe dont [DÉLÉGATAIRE] est à l'origine dans le cadre de son rôle actif et incitatif pour le dispositif des Certificats d'Économies d'Énergie.

Le montant de cette prime ne pourra être révisé à la baisse qu'en cas de modification du volume des Certificats d'Économies d'Énergie attaché à l'opération et ce de manière proportionnelle.`;
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

  // Build PDF data structure
  const pdfData = {
    items: buildInvoiceItems(latestChantier, project),
    amounts: {
      discount_amount: 0,
      cee_prime_amount: -(latestChantier?.valorisation_cee || 0),
      vat_rate: latestChantier?.tva_rate || 0.085,
    },
    notes: {
      cee_prime_text: buildCeePrimeText(latestChantier),
      payment_terms: "Par prélèvement ou par virement bancaire",
      consultation_link: null,
    },
    _legacy: formatNotes({
      quoteRef: latestQuote.quote_ref,
      quoteAmount,
      chantierRef: latestChantier?.site_ref,
      chantierStatus: latestChantier?.status,
      surfaceFacturee: latestChantier?.surface_facturee ?? null,
      valorisationCee: latestChantier?.valorisation_cee ?? null,
    }),
  };

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
    status: "PENDING_VALIDATION",
    due_date: dueDate.toISOString(),
    notes: JSON.stringify(pdfData),
  });

  return { invoice };
};
