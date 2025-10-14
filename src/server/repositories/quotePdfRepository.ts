import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { QuotePdfConfigurationError, QuotePdfNotFoundError, QuotePdfValidationError } from "../errors";
import type { QuotePdfDTO, QuotePdfItem } from "../types/quote-pdf";

const DEFAULT_COMPANY: QuotePdfDTO["company"] = {
  label: "ECOPRORENOVE",
  address1: "104C Avenue Raymond Vergès",
  postcode_city: "97400 Saint-Denis",
  phone: "09 70 34 64 23",
  legal_footer:
    "Ecoprorenove (EB.CONSEILS), SAS au capital de 1000 € – SIRET : 89497510900058 – RCS : Saint-Denis de La Réunion – APE : 7112B – TVA intracommunautaire : FR 90 894975109",
  bank_bic: "AGRIFRPP880",
  bank_iban: "FR76 3000 4012 3400 0100 6755 701",
};

type RawQuotePayload = Record<string, unknown>;

type QuotesTableRow = {
  id: string;
  quote_ref: string;
  notes: unknown;
  valid_until: string | null;
};

let cachedClient: SupabaseClient | null = null;

const normaliseString = (value: unknown, field: string, options?: { optional?: boolean }) => {
  if (value === null || value === undefined) {
    if (options?.optional) {
      return undefined;
    }
    throw new QuotePdfValidationError(`Le champ ${field} est requis`);
  }

  const stringValue = String(value).trim();

  if (!stringValue && !options?.optional) {
    throw new QuotePdfValidationError(`Le champ ${field} est requis`);
  }

  return stringValue || undefined;
};

const normaliseNumber = (value: unknown, field: string, options?: { optional?: boolean; defaultValue?: number }) => {
  if (value === null || value === undefined || value === "") {
    if (options?.optional) {
      return options.defaultValue ?? undefined;
    }
    throw new QuotePdfValidationError(`Le champ ${field} est requis`);
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9,.-]/g, "").replace(",", ".");
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  if (options?.optional) {
    return options.defaultValue;
  }

  throw new QuotePdfValidationError(`Le champ ${field} doit être numérique`);
};

const normaliseDate = (value: unknown, field: string, options?: { optional?: boolean; fallback?: string | null }) => {
  if (value === null || value === undefined || value === "") {
    if (options?.fallback) {
      return options.fallback;
    }

    if (options?.optional) {
      return null;
    }

    throw new QuotePdfValidationError(`Le champ ${field} est requis`);
  }

  const parseFromString = (input: string) => {
    const trimmed = input.trim();
    if (!trimmed) {
      return null;
    }

    const direct = new Date(trimmed);
    if (!Number.isNaN(direct.getTime())) {
      return direct.toISOString();
    }

    const match = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (match) {
      const [, day, month, year] = match;
      const candidate = new Date(Number(year), Number(month) - 1, Number(day));
      if (!Number.isNaN(candidate.getTime())) {
        return candidate.toISOString();
      }
    }

    return null;
  };

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    const parsed = parseFromString(value);
    if (parsed) {
      return parsed;
    }
  }

  throw new QuotePdfValidationError(`Le champ ${field} doit être une date valide`);
};

const parseItems = (rawItems: unknown): QuotePdfItem[] => {
  if (!Array.isArray(rawItems)) {
    throw new QuotePdfValidationError("Les lignes du devis sont manquantes");
  }

  return rawItems.map((rawItem, index) => {
    if (typeof rawItem !== "object" || rawItem === null) {
      throw new QuotePdfValidationError(`Ligne de devis invalide à l'index ${index}`);
    }

    const itemRecord = rawItem as Record<string, unknown>;

    return {
      code: normaliseString(itemRecord.code ?? itemRecord.item_code ?? itemRecord.reference ?? undefined, `items[${index}].code`, {
        optional: true,
      }),
      title: normaliseString(itemRecord.title ?? itemRecord.item_title ?? itemRecord.description ?? itemRecord.name, `items[${index}].title`),
      long_description: normaliseString(
        itemRecord.long_description ?? itemRecord.item_long_description ?? itemRecord.longDescription ?? itemRecord.details,
        `items[${index}].long_description`,
        { optional: true }
      ),
      unit_price_ht: normaliseNumber(
        itemRecord.unit_price_ht ?? itemRecord.unitPrice ?? itemRecord.unit_price ?? itemRecord.price,
        `items[${index}].unit_price_ht`
      ),
      quantity: normaliseNumber(itemRecord.quantity ?? itemRecord.qty ?? 0, `items[${index}].quantity`),
    };
  });
};

const parseClient = (rawClient: unknown): QuotePdfDTO["client"] => {
  if (typeof rawClient !== "object" || rawClient === null) {
    throw new QuotePdfValidationError("Les informations client sont manquantes");
  }

  const client = rawClient as Record<string, unknown>;

  return {
    company_name: normaliseString(client.company_name ?? client.companyName ?? client.raison_sociale, "client.company_name"),
    siret_or_siren: normaliseString(client.siret_or_siren ?? client.siret ?? client.siren, "client.siret_or_siren"),
    address_line1: normaliseString(client.address_line1 ?? client.address ?? client.addressLine1, "client.address_line1"),
    address_line2: normaliseString(client.address_line2 ?? client.addressLine2, "client.address_line2", { optional: true }),
    city_postcode: normaliseString(client.city_postcode ?? client.city ?? client.postcode_city ?? client.postal_city, "client.city_postcode"),
    contact_name: normaliseString(client.contact_name ?? client.contact ?? client.signatory_name, "client.contact_name", {
      optional: true,
    }),
    contact_role: normaliseString(client.contact_role ?? client.contact_role_or_status ?? client.signatory_role, "client.contact_role", {
      optional: true,
    }),
    phone: normaliseString(client.phone ?? client.telephone, "client.phone", { optional: true }),
    email: normaliseString(client.email, "client.email", { optional: true }),
    tenant_note: normaliseString(client.tenant_note ?? client.tenantNote, "client.tenant_note", { optional: true }),
  };
};

const parseBuilding = (rawBuilding: unknown): QuotePdfDTO["building"] => {
  if (typeof rawBuilding !== "object" || rawBuilding === null) {
    throw new QuotePdfValidationError("Les caractéristiques du bâtiment sont manquantes");
  }

  const building = rawBuilding as Record<string, unknown>;

  return {
    type: normaliseString(building.type ?? building.building_type, "building.type"),
    usage: normaliseString(building.usage ?? building.building_usage, "building.usage"),
    surface_total_m2: normaliseNumber(
      building.surface_total_m2 ?? building.surfaceTotal ?? building.surface,
      "building.surface_total_m2"
    ),
    surface_operation_m2: normaliseNumber(
      building.surface_operation_m2 ?? building.surfaceOperation ?? building.surface_operation,
      "building.surface_operation_m2"
    ),
  };
};

const parseCompany = (rawCompany: unknown): QuotePdfDTO["company"] => {
  if (typeof rawCompany !== "object" || rawCompany === null) {
    return DEFAULT_COMPANY;
  }

  const company = rawCompany as Record<string, unknown>;

  return {
    label: normaliseString(company.label ?? company.name ?? DEFAULT_COMPANY.label, "company.label"),
    address1: normaliseString(company.address1 ?? company.address ?? DEFAULT_COMPANY.address1, "company.address1"),
    postcode_city: normaliseString(
      company.postcode_city ?? company.postal_city ?? DEFAULT_COMPANY.postcode_city,
      "company.postcode_city"
    ),
    phone: normaliseString(company.phone ?? DEFAULT_COMPANY.phone, "company.phone"),
    legal_footer: normaliseString(company.legal_footer ?? company.legalFooter ?? DEFAULT_COMPANY.legal_footer, "company.legal_footer"),
    bank_bic: normaliseString(company.bank_bic ?? DEFAULT_COMPANY.bank_bic, "company.bank_bic"),
    bank_iban: normaliseString(company.bank_iban ?? DEFAULT_COMPANY.bank_iban, "company.bank_iban"),
  };
};

const parseNotes = (rawNotes: unknown): QuotePdfDTO["notes"] => {
  if (typeof rawNotes !== "object" || rawNotes === null) {
    return {
      prime_cee_text:
        "Le montant de la prime CEE est soumis à validation définitive des certificats d'économie d'énergie.",
      payment_terms: "Par prélèvement ou par virement bancaire à réception de facture.",
    };
  }

  const notes = rawNotes as Record<string, unknown>;

  return {
    prime_cee_text:
      (normaliseString(notes.prime_cee_text ?? notes.primeCeeText, "notes.prime_cee_text", { optional: true }) ??
        "Le montant de la prime CEE est soumis à validation définitive des certificats d'économie d'énergie."),
    payment_terms:
      normaliseString(notes.payment_terms ?? notes.paymentTerms, "notes.payment_terms", { optional: true }) ??
      "Par prélèvement ou par virement bancaire à réception de facture.",
  };
};

const parseQuotePayload = (payload: RawQuotePayload, fallback: { quoteRef: string; validUntil?: string | null }): QuotePdfDTO => {
  const quote = payload.pdf ?? payload.quote ?? payload;

  if (typeof quote !== "object" || quote === null) {
    throw new QuotePdfValidationError("Le contenu du devis est invalide");
  }

  const quoteRecord = quote as Record<string, unknown>;

  const parsedQuoteNumber = normaliseNumber(
    quoteRecord.quote_number ?? quoteRecord.number ?? quoteRecord.quoteNumber ?? fallback.quoteRef,
    "quote_number"
  );

  const parsedValidUntil = normaliseDate(quoteRecord.valid_until ?? fallback.validUntil, "valid_until", {
    fallback: fallback.validUntil ?? null,
  });

  return {
    quote_number: parsedQuoteNumber,
    quote_date_city: normaliseString(quoteRecord.quote_date_city ?? quoteRecord.city, "quote_date_city"),
    quote_date: normaliseDate(quoteRecord.quote_date ?? quoteRecord.date, "quote_date"),
    valid_until: parsedValidUntil ?? normaliseDate(fallback.validUntil, "valid_until"),
    scheduled_date: normaliseDate(quoteRecord.scheduled_date ?? quoteRecord.scheduledDate, "scheduled_date", {
      optional: true,
    }),
    discount_amount: normaliseNumber(quoteRecord.discount_amount ?? quoteRecord.discount ?? 0, "discount_amount", {
      optional: true,
      defaultValue: 0,
    }) ?? 0,
    cee_prime_amount: normaliseNumber(
      quoteRecord.cee_prime_amount ?? quoteRecord.prime_cee_amount ?? 0,
      "cee_prime_amount",
      { optional: true, defaultValue: 0 }
    ) ?? 0,
    vat_rate: normaliseNumber(quoteRecord.vat_rate ?? quoteRecord.vatRate ?? 0.085, "vat_rate", {
      optional: true,
      defaultValue: 0.085,
    }) ?? 0.085,
    client: parseClient(quoteRecord.client ?? quoteRecord.customer),
    building: parseBuilding(quoteRecord.building ?? {}),
    company: parseCompany(quoteRecord.company),
    items: parseItems(quoteRecord.items ?? []),
    notes: parseNotes(quoteRecord.notes),
  };
};

const getSupabaseClient = () => {
  if (cachedClient) {
    return cachedClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new QuotePdfConfigurationError(
      "Les variables d'environnement SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requises pour générer un devis PDF"
    );
  }

  cachedClient = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
    },
  });

  return cachedClient;
};

export const fetchQuotePdfDto = async (quoteId: string): Promise<QuotePdfDTO> => {
  const client = getSupabaseClient();

  const { data, error } = await client
    .from("quotes")
    .select("id, quote_ref, notes, valid_until")
    .eq("id", quoteId)
    .maybeSingle<QuotesTableRow>();

  if (error) {
    throw new QuotePdfValidationError("Impossible de récupérer le devis", error);
  }

  if (!data) {
    throw new QuotePdfNotFoundError(quoteId);
  }

  let payload: RawQuotePayload;

  if (typeof data.notes === "string") {
    try {
      payload = JSON.parse(data.notes) as RawQuotePayload;
    } catch (error_) {
      throw new QuotePdfValidationError("Le champ notes du devis contient un JSON invalide", error_);
    }
  } else if (typeof data.notes === "object" && data.notes !== null) {
    payload = data.notes as RawQuotePayload;
  } else {
    throw new QuotePdfValidationError("Le devis ne contient pas les informations nécessaires pour générer le PDF");
  }

  return parseQuotePayload(payload, { quoteRef: data.quote_ref, validUntil: data.valid_until });
};
