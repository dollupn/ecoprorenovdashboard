import * as z from "zod";
import {
  TRAVAUX_NON_SUBVENTIONNES_OPTIONS,
  type TravauxNonSubventionnesValue,
} from "./travauxNonSubventionnes";

export const teamMemberSchema = z.object({
  id: z.string().min(1, "Sélection invalide"),
  name: z.string().optional().nullable(),
});

export type TeamMemberFormValue = z.infer<typeof teamMemberSchema>;

export const normalizeTeamMembers = (
  rawTeamMembers: unknown,
  nameLookup: Record<string, string>,
): TeamMemberFormValue[] => {
  if (!Array.isArray(rawTeamMembers)) {
    return [];
  }

  const uniqueMembers = new Map<string, TeamMemberFormValue>();

  for (const rawMember of rawTeamMembers) {
    if (!rawMember) continue;

    if (typeof rawMember === "string") {
      const trimmed = rawMember.trim();
      if (trimmed.length === 0) continue;

      if (!uniqueMembers.has(trimmed)) {
        uniqueMembers.set(trimmed, {
          id: trimmed,
          name: nameLookup[trimmed] ?? trimmed,
        });
      }
      continue;
    }

    if (typeof rawMember === "object") {
      const candidate = rawMember as Record<string, unknown>;
      const rawId = typeof candidate.id === "string" ? candidate.id.trim() : "";
      const rawName = typeof candidate.name === "string" ? candidate.name.trim() : "";
      const fallbackName = rawName.length > 0 ? rawName : nameLookup[rawId] ?? rawId;

      if (rawId.length > 0) {
        if (!uniqueMembers.has(rawId)) {
          uniqueMembers.set(rawId, {
            id: rawId,
            name: fallbackName.length > 0 ? fallbackName : undefined,
          });
        }
        continue;
      }

      if (rawName.length > 0 && !uniqueMembers.has(rawName)) {
        uniqueMembers.set(rawName, {
          id: rawName,
          name: rawName,
        });
      }
    }
  }

  return Array.from(uniqueMembers.values());
};

export const ADDITIONAL_COST_TVA_RATES = [0, 2.1, 5.5, 8.5, 10, 20] as const;

export type AdditionalCostTvaRate = (typeof ADDITIONAL_COST_TVA_RATES)[number];

const isAllowedTvaRate = (value: number): value is AdditionalCostTvaRate =>
  ADDITIONAL_COST_TVA_RATES.includes(value as AdditionalCostTvaRate);

const findClosestAllowedTvaRate = (rate: number): AdditionalCostTvaRate => {
  let closest: AdditionalCostTvaRate = ADDITIONAL_COST_TVA_RATES[0];
  let smallestDiff = Number.POSITIVE_INFINITY;

  for (const candidate of ADDITIONAL_COST_TVA_RATES) {
    const diff = Math.abs(candidate - rate);
    if (diff < smallestDiff) {
      closest = candidate;
      smallestDiff = diff;
    }
  }

  return closest;
};

export const normalizeAdditionalCostTvaRate = (
  value: unknown,
  fallback: AdditionalCostTvaRate = 8.5,
): AdditionalCostTvaRate => {
  if (typeof value === "number" && Number.isFinite(value) && isAllowedTvaRate(value)) {
    return value as AdditionalCostTvaRate;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(",", "."));
    if (Number.isFinite(parsed) && isAllowedTvaRate(parsed)) {
      return parsed as AdditionalCostTvaRate;
    }
  }

  return fallback;
};

export const additionalCostSchema = z.object({
  label: z.string().min(1, "Intitulé requis"),
  amount_ht: z.coerce
    .number({ invalid_type_error: "Montant HT invalide" })
    .min(0, "Le montant HT doit être positif"),
  tva_rate: z.coerce
    .number({ invalid_type_error: "TVA invalide" })
    .refine((value) => isAllowedTvaRate(value), {
      message: "Taux de TVA invalide",
    }),
  amount_ttc: z.coerce
    .number({ invalid_type_error: "Montant TTC invalide" })
    .min(0, "Le montant TTC doit être positif"),
  attachment: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((value) => (value && value.length > 0 ? value : null)),
});

export type AdditionalCostFormValue = z.infer<typeof additionalCostSchema>;

export const computeAdditionalCostTTC = (amountHT: unknown, tvaRate: unknown) => {
  const ht = typeof amountHT === "number" && Number.isFinite(amountHT) ? amountHT : 0;
  const normalizedRate = normalizeAdditionalCostTvaRate(tvaRate, 0);
  const taxes = ht * (normalizedRate / 100);
  const total = ht + taxes;
  return Math.round(total * 100) / 100;
};

export const resolveAdditionalCostTvaRate = (
  rawRate: unknown,
  amountHT: unknown,
  taxAmount: unknown,
  fallback: AdditionalCostTvaRate = 0,
): AdditionalCostTvaRate => {
  const normalized = normalizeAdditionalCostTvaRate(rawRate, fallback);
  if (normalized !== fallback) {
    return normalized;
  }

  const ht = typeof amountHT === "number" && Number.isFinite(amountHT) ? amountHT : 0;
  const taxes = typeof taxAmount === "number" && Number.isFinite(taxAmount) ? taxAmount : 0;

  if (ht <= 0 || taxes <= 0) {
    return fallback;
  }

  const computedRate = (taxes / ht) * 100;
  return findClosestAllowedTvaRate(computedRate);
};

const toPositiveNumber = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(",", "."));
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return 0;
};

export const normalizeAdditionalCostValue = (
  rawCost: unknown,
  fallbackRate: AdditionalCostTvaRate = 20,
): AdditionalCostFormValue => {
  const cost = (rawCost ?? {}) as Record<string, unknown>;
  const label = typeof cost.label === "string" ? cost.label.trim() : "";
  const amountHT = (() => {
    const candidates: unknown[] = [cost.amount_ht, cost.amount, cost.total_ht, cost.ht];
    for (const candidate of candidates) {
      const value = toPositiveNumber(candidate);
      if (value > 0) {
        return value;
      }
    }

    const totalCandidate = toPositiveNumber(cost.amount_ttc);
    return totalCandidate > 0 ? totalCandidate : 0;
  })();
  const rawTaxes = (() => {
    if (typeof cost.montant_tva === "number" && Number.isFinite(cost.montant_tva)) {
      return cost.montant_tva;
    }
    if (typeof cost.taxes === "number" && Number.isFinite(cost.taxes)) {
      return cost.taxes;
    }
    if (typeof cost.amount_ttc === "number" && Number.isFinite(cost.amount_ttc)) {
      const diff = cost.amount_ttc - amountHT;
      return Number.isFinite(diff) && diff > 0 ? diff : 0;
    }
    return 0;
  })();
  const tvaRate = resolveAdditionalCostTvaRate(cost.tva_rate, amountHT, rawTaxes, fallbackRate);
  const amountTTC = computeAdditionalCostTTC(amountHT, tvaRate);
  const attachment =
    typeof cost.attachment === "string" && cost.attachment.trim().length > 0
      ? cost.attachment.trim()
      : null;

  return {
    label,
    amount_ht: amountHT,
    tva_rate: tvaRate,
    amount_ttc: amountTTC,
    attachment,
  };
};

export const normalizeAdditionalCostsArray = (
  rawCosts: unknown,
  fallbackRate: AdditionalCostTvaRate = 20,
): AdditionalCostFormValue[] => {
  if (!Array.isArray(rawCosts)) {
    return [];
  }

  return rawCosts.map((cost) => normalizeAdditionalCostValue(cost, fallbackRate));
};

export const createBaseSiteSchema = () => {
  return z.object({
    site_ref: z.string().min(3, "Référence requise"),
    project_ref: z.string(),
    client_name: z.string(),
    product_name: z.string().optional().nullable(),
    address: z.string().min(3, "Adresse requise"),
    city: z.string().min(2, "Ville requise"),
    postal_code: z.string().min(4, "Code postal invalide"),
    cofrac_status: z.enum(["EN_ATTENTE", "CONFORME", "NON_CONFORME", "A_PLANIFIER"]),
    date_debut: z.string().min(1, "Date de début requise"),
    date_fin_prevue: z.string().optional(),
    date_fin: z.string().optional().nullable(),
    progress_percentage: z.coerce
      .number({ invalid_type_error: "Avancement invalide" })
      .min(0)
      .max(100),
    revenue: z.coerce
      .number({ invalid_type_error: "CA invalide" })
      .min(0, "Le CA doit être positif")
      .optional()
      .default(0),
    profit_margin: z.coerce.number({ invalid_type_error: "Marge invalide" }).min(-100).max(100),
    surface_facturee: z.coerce.number({ invalid_type_error: "Surface invalide" }).min(0),
    cout_main_oeuvre_m2_ht: z.coerce.number({ invalid_type_error: "Coût invalide" }).min(0),
    cout_isolation_m2: z.coerce.number({ invalid_type_error: "Coût invalide" }).min(0),
    isolation_utilisee_m2: z.coerce.number({ invalid_type_error: "Quantité invalide" }).min(0),
    montant_commission: z.coerce
      .number({ invalid_type_error: "Montant invalide" })
      .min(0)
      .optional()
      .default(0),
    valorisation_cee: z.coerce
      .number({ invalid_type_error: "Montant invalide" })
      .min(0)
      .optional()
      .default(0),
    travaux_non_subventionnes_enabled: z.boolean().default(false),
    travaux_non_subventionnes: z.enum(
      TRAVAUX_NON_SUBVENTIONNES_OPTIONS.map((option) => option.value) as [
        TravauxNonSubventionnesValue,
        ...TravauxNonSubventionnesValue[],
      ],
    ),
    travaux_non_subventionnes_description: z
      .string()
      .optional()
      .nullable()
      .transform((value) => value ?? ""),
    travaux_non_subventionnes_montant: z.coerce
      .number({ invalid_type_error: "Montant invalide" })
      .min(0),
    travaux_non_subventionnes_financement: z.boolean().default(false),
    commission_eur_per_m2_enabled: z.boolean().default(false),
    commission_eur_per_m2: z.coerce
      .number({ invalid_type_error: "Montant invalide" })
      .min(0),
    commission_eur_per_led_enabled: z.boolean().default(false),
    commission_eur_per_led: z.coerce
      .number({ invalid_type_error: "Commission/LED invalide" })
      .min(0, "La commission doit être positive")
      .optional()
      .nullable(),
    notes: z.string().optional(),
    subcontractor_id: z
      .string({ invalid_type_error: "Sélection invalide" })
      .uuid("Sélection invalide")
      .optional()
      .nullable(),
    team_members: z.array(teamMemberSchema).optional().default([]),
    additional_costs: z.array(additionalCostSchema).optional().default([]),
    subcontractor_payment_confirmed: z.boolean().default(false),
    subcontractor_base_units: z.coerce
      .number({ invalid_type_error: "Base unités invalide" })
      .min(0, "Les unités doivent être positives")
      .default(0),
    subcontractor_payment_amount: z.coerce
      .number({ invalid_type_error: "Montant sous-traitant invalide" })
      .min(0, "Le montant doit être positif")
      .default(0),
    subcontractor_payment_units: z.coerce
      .number({ invalid_type_error: "Unités sous-traitant invalides" })
      .min(0, "Les unités doivent être positives")
      .default(0),
    subcontractor_payment_unit_label: z
      .string({ required_error: "Libellé d'unité requis" })
      .trim()
      .optional()
      .nullable()
      .transform((value) => (value ?? "").trim()),
    subcontractor_payment_rate: z.coerce
      .number({ invalid_type_error: "Tarif sous-traitant invalide" })
      .min(0, "Le tarif doit être positif")
      .default(0),
    // Isolation fields
    surface_facturee_m2: z.coerce
      .number({ invalid_type_error: "Surface facturée invalide" })
      .min(0, "La surface facturée doit être positive")
      .refine((val) => val > 0, {
        message: "La surface facturée ne peut pas être zéro",
      })
      .optional()
      .nullable(),
    surface_posee_m2: z.coerce
      .number({ invalid_type_error: "Surface posée invalide" })
      .min(0, "La surface posée doit être positive")
      .optional()
      .nullable(),
    cout_mo_par_m2: z.coerce
      .number({ invalid_type_error: "Coût MO/m² invalide" })
      .min(0, "Le coût doit être positif")
      .optional()
      .nullable(),
    cout_isolant_par_m2: z.coerce
      .number({ invalid_type_error: "Coût isolant/m² invalide" })
      .min(0, "Le coût doit être positif")
      .optional()
      .nullable(),
    cout_materiaux_par_m2: z.coerce
      .number({ invalid_type_error: "Coût matériaux/m² invalide" })
      .min(0, "Le coût doit être positif")
      .optional()
      .nullable(),
    cout_total_materiaux: z.coerce
      .number({ invalid_type_error: "Coût total matériaux invalide" })
      .min(0, "Le coût doit être positif")
      .optional()
      .nullable(),
    commission_commerciale_par_m2: z.coerce
      .number({ invalid_type_error: "Commission/m² invalide" })
      .min(0, "La commission doit être positive")
      .optional()
      .nullable(),
    // Eclairage fields
    nb_luminaires: z.coerce
      .number({ invalid_type_error: "Nombre de luminaires invalide" })
      .int("Le nombre doit être un entier")
      .min(0, "Le nombre doit être positif")
      .optional()
      .nullable(),
    cout_total_mo: z.coerce
      .number({ invalid_type_error: "Coût total MO invalide" })
      .min(0, "Le coût doit être positif")
      .optional()
      .nullable(),
    cout_total_materiaux_eclairage: z.coerce
      .number({ invalid_type_error: "Coût total matériaux éclairage invalide" })
      .min(0, "Le coût doit être positif")
      .optional()
      .nullable(),
    // Common financial fields
    travaux_non_subventionnes_client: z.coerce
      .number({ invalid_type_error: "Montant client invalide" })
      .min(0, "Le montant doit être positif")
      .default(0),
    tva_rate: z.coerce
      .number({ invalid_type_error: "Taux TVA invalide" })
      .min(0, "Le taux doit être positif")
      .max(1, "Le taux doit être inférieur ou égal à 1")
      .default(0.021),
    frais_additionnels_total: z.coerce
      .number({ invalid_type_error: "Frais additionnels invalides" })
      .min(0, "Les frais doivent être positifs")
      .default(0),
    // Derived snapshot totals
    ca_ttc: z.coerce
      .number({ invalid_type_error: "CA TTC invalide" })
      .min(0, "Le CA doit être positif")
      .optional()
      .nullable(),
    cout_chantier_ttc: z.coerce
      .number({ invalid_type_error: "Coût chantier TTC invalide" })
      .min(0, "Le coût doit être positif")
      .optional()
      .nullable(),
    marge_totale_ttc: z.coerce
      .number({ invalid_type_error: "Marge totale TTC invalide" })
      .optional()
      .nullable(),
  });
};

export type SiteFormSchema = ReturnType<typeof createBaseSiteSchema>;

export type SiteFormValues = z.infer<SiteFormSchema>;

export type SiteSubmitValues = SiteFormValues & {
  rentability_total_costs: number;
  rentability_margin_total: number;
  rentability_margin_per_unit: number;
  rentability_margin_rate: number;
  rentability_unit_label: string;
  rentability_additional_costs_total: number;
  subcontractor_payment_amount: number;
  subcontractor_payment_units: number;
  subcontractor_payment_unit_label: string;
  subcontractor_payment_rate: number;
  subcontractor_base_units: number;
};

export const defaultSiteFormValues: SiteFormValues = {
  site_ref: "",
  project_ref: "",
  client_name: "",
  product_name: "",
  address: "",
  city: "",
  postal_code: "",
  cofrac_status: "EN_ATTENTE",
  date_debut: "",
  date_fin_prevue: "",
  date_fin: null,
  progress_percentage: 0,
  revenue: 0,
  profit_margin: 0,
  surface_facturee: 0,
  cout_main_oeuvre_m2_ht: 0,
  cout_isolation_m2: 0,
  isolation_utilisee_m2: 0,
  montant_commission: 0,
  valorisation_cee: 0,
  travaux_non_subventionnes_enabled: false,
  travaux_non_subventionnes: "NA",
  travaux_non_subventionnes_description: "",
  travaux_non_subventionnes_montant: 0,
  travaux_non_subventionnes_financement: false,
  commission_eur_per_m2_enabled: false,
  commission_eur_per_m2: 0,
  commission_eur_per_led_enabled: false,
  commission_eur_per_led: null,
  notes: "",
  subcontractor_id: null,
  additional_costs: [],
  team_members: [],
  subcontractor_payment_confirmed: false,
  subcontractor_base_units: 0,
  subcontractor_payment_amount: 0,
  subcontractor_payment_units: 0,
  subcontractor_payment_unit_label: "",
  subcontractor_payment_rate: 0,
  // Isolation fields
  surface_facturee_m2: null,
  surface_posee_m2: null,
  cout_mo_par_m2: null,
  cout_isolant_par_m2: null,
  cout_materiaux_par_m2: null,
  cout_total_materiaux: null,
  commission_commerciale_par_m2: null,
  // Eclairage fields
  nb_luminaires: null,
  cout_total_mo: null,
  cout_total_materiaux_eclairage: null,
  // Common financial fields
  travaux_non_subventionnes_client: 0,
  tva_rate: 0.021,
  frais_additionnels_total: 0,
  // Derived snapshot totals
  ca_ttc: null,
  cout_chantier_ttc: null,
  marge_totale_ttc: null,
};

export const createSiteSchema = (requiresProjectAssociation: boolean) =>
  createBaseSiteSchema().superRefine((data, ctx) => {
    const projectRef = data.project_ref?.trim?.() ?? "";
    const clientName = data.client_name?.trim?.() ?? "";

    if (requiresProjectAssociation || projectRef.length > 0) {
      if (projectRef.length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["project_ref"],
          message: "Référence projet requise",
        });
      }
    }

    if (requiresProjectAssociation || clientName.length > 0) {
      if (clientName.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["client_name"],
          message: "Client requis",
        });
      }
    }
  });

export type SiteProjectOption = {
  id?: string;
  project_ref: string;
  client_name: string;
  product_name: string;
  address?: string | null;
  city: string;
  postal_code: string;
  surface_facturee?: number | null;
};

export type SubcontractorOption = {
  id: string;
  name: string;
  pricing_details: string | null;
};
