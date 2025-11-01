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

export const additionalCostSchema = z.object({
  label: z.string().min(1, "Intitulé requis"),
  amount_ht: z.coerce
    .number({ invalid_type_error: "Montant HT invalide" })
    .min(0, "Le montant HT doit être positif"),
  montant_tva: z.coerce
    .number({ invalid_type_error: "Montant TVA invalide" })
    .min(0, "Le montant de TVA doit être positif"),
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

export const computeAdditionalCostTTC = (
  amountHT: unknown,
  montantTVA: unknown,
) => {
  const ht = typeof amountHT === "number" && Number.isFinite(amountHT) ? amountHT : 0;
  const tva = typeof montantTVA === "number" && Number.isFinite(montantTVA) ? montantTVA : 0;

  const total = ht + tva;
  return Math.round(total * 100) / 100;
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
    progress_percentage: z.coerce
      .number({ invalid_type_error: "Avancement invalide" })
      .min(0)
      .max(100),
    revenue: z.coerce.number({ invalid_type_error: "CA invalide" }).min(0, "Le CA doit être positif"),
    profit_margin: z.coerce.number({ invalid_type_error: "Marge invalide" }).min(-100).max(100),
    surface_facturee: z.coerce.number({ invalid_type_error: "Surface invalide" }).min(0),
    cout_main_oeuvre_m2_ht: z.coerce.number({ invalid_type_error: "Coût invalide" }).min(0),
    cout_isolation_m2: z.coerce.number({ invalid_type_error: "Coût invalide" }).min(0),
    isolation_utilisee_m2: z.coerce.number({ invalid_type_error: "Quantité invalide" }).min(0),
    montant_commission: z.coerce.number({ invalid_type_error: "Montant invalide" }).min(0),
    valorisation_cee: z.coerce.number({ invalid_type_error: "Montant invalide" }).min(0),
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
    commission_commerciale_ht: z.boolean().default(false),
    commission_commerciale_ht_montant: z.coerce
      .number({ invalid_type_error: "Montant invalide" })
      .min(0),
    notes: z.string().optional(),
    subcontractor_id: z
      .string({ invalid_type_error: "Sélection invalide" })
      .uuid("Sélection invalide")
      .optional()
      .nullable(),
    team_members: z.array(teamMemberSchema).optional().default([]),
    additional_costs: z.array(additionalCostSchema).optional().default([]),
    subcontractor_payment_confirmed: z.boolean().default(false),
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
  rentability_unit_count: number;
  rentability_additional_costs_total: number;
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
  progress_percentage: 0,
  revenue: 0,
  profit_margin: 0,
  surface_facturee: 0,
  cout_main_oeuvre_m2_ht: 0,
  cout_isolation_m2: 0,
  isolation_utilisee_m2: 0,
  montant_commission: 0,
  valorisation_cee: 0,
  travaux_non_subventionnes: "NA",
  travaux_non_subventionnes_description: "",
  travaux_non_subventionnes_montant: 0,
  travaux_non_subventionnes_financement: false,
  commission_commerciale_ht: false,
  commission_commerciale_ht_montant: 0,
  notes: "",
  subcontractor_id: null,
  additional_costs: [],
  team_members: [],
  subcontractor_payment_confirmed: false,
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
};
