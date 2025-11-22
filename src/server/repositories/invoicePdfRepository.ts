import type { InvoicePdfDTO, InvoicePdfItem } from "../types/invoice-pdf.js";
import { getServiceSupabaseClient } from "./supabaseClient.js";
import { InvoicePdfNotFoundError, InvoicePdfValidationError } from "../errors.js";

const formatDate = (isoDate: string): string => {
  const date = new Date(isoDate);
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
};

const addDays = (isoDate: string, days: number): string => {
  const date = new Date(isoDate);
  date.setDate(date.getDate() + days);
  return date.toISOString();
};

const buildProductDescription = (site: any, project: any): string => {
  const parts: string[] = [];

  if (site.product_name) {
    parts.push(`Mise en place d'un système conforme ${site.product_name}`);
  }

  if (site.surface_facturee_m2) {
    parts.push(`Surface isolée : ${site.surface_facturee_m2} m²`);
  }

  if (site.date_debut) {
    parts.push(`Début travaux : ${formatDate(site.date_debut)}`);
  }

  if (project.building_type) {
    parts.push(`Type de bâtiment : ${project.building_type}`);
  }

  if (project.usage) {
    parts.push(`Usage : ${project.usage}`);
  }

  if (site.subcontractor_id) {
    parts.push(
      "\nLes travaux objets de la présente facture sont réalisés en sous-traitance conformément aux dispositions de la loi n°75-1334 du 31 décembre 1975.",
    );
  }

  return parts.join("\n");
};

const generateItemsFromSite = (site: any, project: any): InvoicePdfItem[] => {
  const items: InvoicePdfItem[] = [];

  if (site && site.product_name) {
    const unitPrice =
      (site.cout_mo_par_m2 || 0) + (site.cout_materiaux_par_m2 || site.cout_isolant_par_m2 || 0);
    const quantity = site.surface_facturee_m2 || 1;

    items.push({
      code: site.site_ref,
      title: site.product_name,
      long_description: buildProductDescription(site, project),
      unit_price_ht: unitPrice,
      quantity: quantity,
    });
  }

  return items;
};

export const fetchInvoicePdfDto = async (invoiceId: string): Promise<InvoicePdfDTO> => {
  const client = getServiceSupabaseClient();

  // Fetch invoice with related data
  const { data: invoice, error: invoiceError } = await client
    .from("invoices")
    .select(
      `
      *,
      projects!invoices_project_id_fkey(
        *
      ),
      quotes!invoices_quote_id_fkey(
        quote_ref
      )
    `,
    )
    .eq("id", invoiceId)
    .single();

  if (invoiceError || !invoice) {
    throw new InvoicePdfNotFoundError(invoiceId);
  }

  if (!invoice.org_id) {
    throw new InvoicePdfValidationError("La facture n'est pas associée à une organisation");
  }

  // Fetch site data
  const { data: sites } = await client
    .from("sites")
    .select("*")
    .eq("project_id", invoice.project_id)
    .order("updated_at", { ascending: false })
    .limit(1);

  const latestSite = sites?.[0];

  // Fetch subcontractor if applicable
  let subcontractor = null;
  if (latestSite?.subcontractor_id) {
    const { data: subData } = await client
      .from("subcontractors")
      .select("*")
      .eq("id", latestSite.subcontractor_id)
      .maybeSingle();

    subcontractor = subData;
  }

  // Fetch organization
  const { data: org } = await client
    .from("organizations")
    .select("*")
    .eq("id", invoice.org_id)
    .single();

  if (!org) {
    throw new InvoicePdfValidationError("Organisation introuvable");
  }

  // Fetch settings
  const { data: settings } = await client
    .from("settings")
    .select("*")
    .eq("org_id", invoice.org_id)
    .maybeSingle();

  // Parse invoice notes for PDF data
  let items: InvoicePdfItem[] = [];
  let amounts = {
    discount_amount: 0,
    cee_prime_amount: 0,
    vat_rate: 0.085,
  };
  let notes = {
    cee_prime_text: undefined as string | undefined,
    payment_terms: undefined as string | undefined,
    consultation_link: undefined as string | undefined,
  };

  if (invoice.notes) {
    try {
      const parsed = typeof invoice.notes === "string" ? JSON.parse(invoice.notes) : invoice.notes;

      if (parsed.items && Array.isArray(parsed.items)) {
        items = parsed.items;
      }

      if (parsed.amounts) {
        amounts = {
          discount_amount: parsed.amounts.discount_amount || 0,
          cee_prime_amount: parsed.amounts.cee_prime_amount || 0,
          vat_rate: parsed.amounts.vat_rate || 0.085,
        };
      }

      if (parsed.notes) {
        notes = {
          cee_prime_text: parsed.notes.cee_prime_text,
          payment_terms: parsed.notes.payment_terms,
          consultation_link: parsed.notes.consultation_link,
        };
      }
    } catch (e) {
      console.warn("Failed to parse invoice notes as JSON:", e);
    }
  }

  // If no items from notes, generate from site
  if (items.length === 0 && latestSite && invoice.projects) {
    items = generateItemsFromSite(latestSite, invoice.projects);

    // Set default amounts from site
    amounts = {
      discount_amount: 0,
      cee_prime_amount: -(latestSite.valorisation_cee || 0),
      vat_rate: latestSite.tva_rate || 0.085,
    };
  }

  // Build CEE prime text if applicable
  if (!notes.cee_prime_text && amounts.cee_prime_amount !== 0) {
    const primeAmount = Math.abs(amounts.cee_prime_amount).toFixed(2);
    notes.cee_prime_text = `Tout ou partie des travaux relatifs à cette facture sont éligibles à une prime d'un montant de ${primeAmount} euros net de taxe dont [DÉLÉGATAIRE] est à l'origine dans le cadre de son rôle actif et incitatif pour le dispositif des Certificats d'Économies d'Énergie.

Le montant de cette prime ne pourra être révisé à la baisse qu'en cas de modification du volume des Certificats d'Économies d'Énergie attaché à l'opération et ce de manière proportionnelle.`;
  }

  // Build DTO
  const dto: InvoicePdfDTO = {
    invoice_number: invoice.invoice_ref,
    invoice_date_city: invoice.projects?.city || org.city || "Saint-Denis",
    invoice_date: invoice.created_at,
    due_date: invoice.due_date || addDays(invoice.created_at, 30),

    client: {
      company_name: invoice.client_name,
      contact_name:
        invoice.client_first_name && invoice.client_last_name
          ? `${invoice.client_first_name} ${invoice.client_last_name}`
          : null,
      contact_role: null,
      address_line1: invoice.projects?.address || "",
      address_line2: null,
      city_postcode: `${invoice.projects?.postal_code || ""} ${invoice.projects?.city || ""}`,
      phone: invoice.projects?.phone,
      email: invoice.projects?.email,
      siret: invoice.projects?.siren,
    },

    project: {
      ref: invoice.projects?.project_ref || "",
      site_ref: latestSite?.site_ref,
      work_start_date: latestSite?.date_debut,
      surface_m2: latestSite?.surface_facturee_m2,
      building_type: invoice.projects?.building_type,
      building_usage: invoice.projects?.usage,
    },

    subcontractor: subcontractor
      ? {
          name: subcontractor.company_name,
          siret: subcontractor.siret,
          insurance_policy: subcontractor.insurance_policy,
          qualifications: subcontractor.qualifications,
        }
      : null,

    company: {
      label: org.name || "ECOPRORENOVE",
      address1: org.address || "104C Avenue Leconte de Lisle",
      address2: null,
      postcode_city: `${org.postal_code || "97490"} ${org.city || "Saint-Denis"}`,
      phone: "06 93 54 62 53",
      email: "contact@ecoprorenove.fr",
      website: null,
      legal_footer:
        "Ecoprorenove (EB.CONSEILS), SAS au capital de 1000 €, RCS Saint-Denis B 894 975 150",
      siret: org.siret || "89497515000018",
      tva_intracommunautaire: org.tva || "FR91894975150",
      bank_bic: "CRLYFRPP",
      bank_iban: "FR82 3000 2010 6900 0009 9651 K12",
      bank_name: "Crédit Lyonnais",
    },

    items,
    amounts,
    notes,
  };

  return dto;
};
