import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getProjectClientName } from "@/lib/projects";
import type { Tables } from "@/integrations/supabase/types";
import {
  addDays,
  addMonths,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from "date-fns";
import { fr } from "date-fns/locale";

import { getLeadStatusLabel, LEAD_STATUSES } from "@/components/leads/status";
import { DEFAULT_PROJECT_STATUSES } from "@/lib/projects";

const ACTIVE_LEAD_STATUSES = LEAD_STATUSES.filter((status) => status !== "Non éligible");
const QUALIFIED_LEAD_STATUS = "Éligible" as const;

const PROJECT_STATUS_VALUES = DEFAULT_PROJECT_STATUSES.map((status) => status.value);
const PROJECT_STATUS_LABELS = DEFAULT_PROJECT_STATUSES.reduce<Record<string, string>>(
  (acc, status) => {
    acc[status.value] = status.label;
    return acc;
  },
  {}
);

const ACTIVE_PROJECT_STATUSES = PROJECT_STATUS_VALUES.filter(
  (status) => !["LIVRE", "CLOTURE"].includes(status)
);
const PROJECT_SURFACE_STATUSES = PROJECT_STATUS_VALUES.filter((status) =>
  ["EN_COURS", "LIVRE"].includes(status)
);

const ACCEPTED_PROJECT_STATUS =
  DEFAULT_PROJECT_STATUSES.find((status) => status.value === "ACCEPTE")?.value ?? "ACCEPTE";

const QUOTE_STATUS_LABELS = {
  SENT: "Envoyé",
  ACCEPTED: "Accepté",
  REJECTED: "Refusé",
} as const;
type QuoteActivityStatus = keyof typeof QUOTE_STATUS_LABELS;
const QUOTE_ACTIVITY_STATUSES = Object.keys(QUOTE_STATUS_LABELS) as QuoteActivityStatus[];
const QUOTE_PENDING_STATUS: QuoteActivityStatus = "SENT";
const QUOTE_ACTIVITY_TITLES: Record<QuoteActivityStatus, string> = {
  SENT: "Devis envoyé",
  ACCEPTED: "Devis accepté",
  REJECTED: "Devis refusé",
};

const SITE_STATUS_LABELS = {
  PLANIFIE: "Planifié",
  EN_PREPARATION: "En préparation",
  EN_COURS: "En cours",
  SUSPENDU: "Suspendu",
  TERMINE: "Terminé",
  LIVRE: "Livré",
} as const;
type SiteStatus = keyof typeof SITE_STATUS_LABELS;

const SITE_ACTIVE_STATUSES: SiteStatus[] = [
  "PLANIFIE",
  "EN_PREPARATION",
  "EN_COURS",
  "SUSPENDU",
];
const SITE_ENDING_STATUSES: SiteStatus[] = ["EN_COURS", "TERMINE", "LIVRE"];
const SITE_ACTIVITY_STATUSES: SiteStatus[] = ["EN_COURS", "TERMINE", "LIVRE"];
const SITE_ACTIVITY_TITLES: Partial<Record<SiteStatus, string>> = {
  EN_COURS: "Chantier en cours",
  TERMINE: "Chantier terminé",
  LIVRE: "Chantier livré",
};

const PRODUCT_ENERGY_EXCLUDED_CATEGORIES = ["ECO-FURN", "ECO-LOG", "ECO-ADMN"] as const;
const QUANTITY_PARAM_KEYS = ["quantity", "surface_isolee", "nombre_led", "surface"] as const;

type ProjectWithProducts = Pick<
  Tables<"projects">,
  "id" | "status" | "updated_at" | "surface_isolee_m2" | "city" | "client_name" | "building_type"
> & {
  project_products?: (
    Pick<Tables<"project_products">, "quantity" | "dynamic_params"> & {
      product?:
        | (Pick<Tables<"product_catalog">, "category"> & {
            kwh_cumac_values?: Pick<Tables<"product_kwh_cumac">, "building_type" | "kwh_cumac">[] | null;
          })
        | null;
    }
  )[] | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const parseNumericValue = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(",", ".").trim();
    if (!normalized) {
      return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const getProductMultiplier = (
  projectProduct: Pick<Tables<"project_products">, "quantity" | "dynamic_params">
) => {
  if (projectProduct.dynamic_params && isRecord(projectProduct.dynamic_params)) {
    const params = projectProduct.dynamic_params as Record<string, unknown>;
    for (const key of QUANTITY_PARAM_KEYS) {
      const rawValue = params[key];
      const parsed = parseNumericValue(rawValue);
      if (parsed && parsed > 0) {
        return parsed;
      }
    }
  }

  const fallback = parseNumericValue(projectProduct.quantity);
  return fallback && fallback > 0 ? fallback : 0;
};

const calculateProjectMwh = (project: ProjectWithProducts) => {
  if (!isStatusValue(PROJECT_SURFACE_STATUSES, project.status)) {
    return 0;
  }

  if (!project.building_type) {
    return 0;
  }

  const products = project.project_products ?? [];

  return products.reduce((sum, projectProduct) => {
    if (!projectProduct?.product) {
      return sum;
    }

    const { product } = projectProduct;

    if (
      typeof product.category === "string" &&
      PRODUCT_ENERGY_EXCLUDED_CATEGORIES.includes(product.category)
    ) {
      return sum;
    }

    const kwhEntry = product.kwh_cumac_values?.find(
      (entry) => entry && entry.building_type === project.building_type
    );

    if (!kwhEntry || typeof kwhEntry.kwh_cumac !== "number") {
      return sum;
    }

    const multiplier = getProductMultiplier(projectProduct);
    if (multiplier <= 0) {
      return sum;
    }

    const productMwh = (kwhEntry.kwh_cumac / 1000) * multiplier;
    return sum + productMwh;
  }, 0);
};

const calculateTotalMwh = (projects: ProjectWithProducts[]) => {
  return projects.reduce((acc, project) => acc + calculateProjectMwh(project), 0);
};

const INVOICE_ACTIVITY_STATUS_LABELS = {
  SENT: "Envoyée",
  PAID: "Payée",
} as const;
type InvoiceActivityStatus = keyof typeof INVOICE_ACTIVITY_STATUS_LABELS;
const INVOICE_ACTIVITY_STATUSES = Object.keys(
  INVOICE_ACTIVITY_STATUS_LABELS
) as InvoiceActivityStatus[];
const DEFAULT_INVOICE_STATUS: InvoiceActivityStatus = "SENT";
const INVOICE_ACTIVITY_TITLES: Record<InvoiceActivityStatus, string> = {
  SENT: "Facture envoyée",
  PAID: "Paiement reçu",
};

const isStatusValue = <T extends string>(
  statuses: readonly T[],
  value: string | null | undefined
): value is T => (value ? (statuses as readonly string[]).includes(value) : false);

export interface DashboardMetrics {
  leadsActifs: number;
  projetsEnCours: number;
  devisEnAttente: number;
  devisExpirantSous7Jours: number;
  chantiersOuverts: number;
  chantiersFinSemaine: number;
  rdvProgrammesSemaine: number;
  surfaceIsoleeMois: number;
  totalMwh: number;
  tauxConversion: {
    rate: number;
    delta: number | null;
  };
  generatedAt: string;
}

export interface RevenuePoint {
  month: string;
  isoMonth: string;
  total: number;
}

export interface RevenueData {
  points: RevenuePoint[];
  currentMonthTotal: number;
  previousMonthTotal: number;
  currentWeekTotal: number;
  previousWeekTotal: number;
  hasData: boolean;
  generatedAt: string;
}

export type ActivityType = "lead" | "quote" | "project" | "site" | "invoice";

export interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  status?: string | null;
  amount?: number | null;
  reference?: string | null;
  client?: string | null;
  city?: string | null;
  date: string;
}

interface QueryOptions {
  enabled?: boolean;
}

const formatMonthLabel = (date: Date) => {
  const label = format(date, "MMM", { locale: fr });
  return label.charAt(0).toUpperCase() + label.slice(1);
};

export const useDashboardMetrics = (
  orgId: string | null,
  options: QueryOptions = {}
) => {
  const { enabled = true } = options;

  return useQuery<DashboardMetrics, Error>({
    queryKey: ["dashboard", "metrics", orgId],
    enabled: Boolean(orgId) && enabled,
    queryFn: async () => {
      if (!orgId) {
        throw new Error("Organisation non définie");
      }

      const now = new Date();
      const startWeek = startOfWeek(now, { weekStartsOn: 1 });
      const endWeek = endOfWeek(now, { weekStartsOn: 1 });
      const startMonth = startOfMonth(now);
      const nextMonthStart = addMonths(startMonth, 1);
      const sevenDaysLater = addDays(now, 7);
      const ninetyDaysAgo = subDays(now, 90);
      const previousPeriodStart = subDays(ninetyDaysAgo, 90);

      const [
        activeLeads,
        projectsData,
        pendingQuotes,
        sitesData,
        leadsRdv,
        qualifiedLeads,
        acceptedProjects,
      ] = await Promise.all([
        supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("org_id", orgId)
          .in("status", ACTIVE_LEAD_STATUSES),
        supabase
          .from("projects")
          .select(
            `id, status, updated_at, surface_isolee_m2, city, client_name, building_type,
            project_products(id, quantity, dynamic_params, product:product_catalog(category, kwh_cumac_values:product_kwh_cumac(id, building_type, kwh_cumac)))`
          )
          .eq("org_id", orgId)
          .in("status", [...ACTIVE_PROJECT_STATUSES, ...PROJECT_SURFACE_STATUSES]),
        supabase
          .from("quotes")
          .select("id, status, valid_until")
          .eq("org_id", orgId)
          .eq("status", QUOTE_PENDING_STATUS),
        supabase
          .from("sites")
          .select("id, status, date_fin_prevue")
          .eq("org_id", orgId)
          .in("status", SITE_ACTIVE_STATUSES),
        supabase
          .from("leads")
          .select("id, date_rdv")
          .eq("org_id", orgId)
          .gte("date_rdv", startWeek.toISOString())
          .lte("date_rdv", endWeek.toISOString()),
        supabase
          .from("leads")
          .select("id, updated_at")
          .eq("org_id", orgId)
          .eq("status", QUALIFIED_LEAD_STATUS)
          .gte("updated_at", previousPeriodStart.toISOString()),
        supabase
          .from("projects")
          .select("id, updated_at")
          .eq("org_id", orgId)
          .eq("status", ACCEPTED_PROJECT_STATUS)
          .gte("updated_at", previousPeriodStart.toISOString()),
      ]);

      if (activeLeads.error) throw activeLeads.error;
      if (projectsData.error) throw projectsData.error;
      if (pendingQuotes.error) throw pendingQuotes.error;
      if (sitesData.error) throw sitesData.error;
      if (leadsRdv.error) throw leadsRdv.error;
      if (qualifiedLeads.error) throw qualifiedLeads.error;
      if (acceptedProjects.error) throw acceptedProjects.error;

      const projets = (projectsData.data ?? []) as ProjectWithProducts[];
      const sites = sitesData.data ?? [];
      const rdv = leadsRdv.data ?? [];
      const quotes = pendingQuotes.data ?? [];

      const chantiersFinSemaine = sites.filter((site) => {
        if (!site.date_fin_prevue) return false;
        const endDate = new Date(site.date_fin_prevue);
        return (
          isStatusValue(SITE_ENDING_STATUSES, site.status) &&
          endDate >= now &&
          endDate <= sevenDaysLater
        );
      }).length;

      const surfaceIsolee = projets
        .filter((project) => isStatusValue(PROJECT_SURFACE_STATUSES, project.status))
        .filter((project) => {
          if (!project.updated_at) return false;
          const updated = new Date(project.updated_at);
          return updated >= startMonth && updated < nextMonthStart;
        })
        .reduce((acc, project) => acc + (project.surface_isolee_m2 ?? 0), 0);

      const totalMwh = calculateTotalMwh(projets);

      const qualified = qualifiedLeads.data ?? [];
      const accepted = acceptedProjects.data ?? [];

      const currentQualified = qualified.filter((lead) => {
        const updated = new Date(lead.updated_at);
        return updated >= ninetyDaysAgo;
      }).length;

      const previousQualified = qualified.filter((lead) => {
        const updated = new Date(lead.updated_at);
        return updated < ninetyDaysAgo;
      }).length;

      const currentAccepted = accepted.filter((project) => {
        const updated = new Date(project.updated_at);
        return updated >= ninetyDaysAgo;
      }).length;

      const previousAccepted = accepted.filter((project) => {
        const updated = new Date(project.updated_at);
        return updated < ninetyDaysAgo;
      }).length;

      const currentRate = currentQualified === 0 ? 0 : (currentAccepted / currentQualified) * 100;
      const previousRate = previousQualified === 0 ? 0 : (previousAccepted / previousQualified) * 100;
      const delta = previousRate === 0 && currentRate === 0 ? null : currentRate - previousRate;

      const metrics: DashboardMetrics = {
        leadsActifs: activeLeads.count ?? 0,
        projetsEnCours: projets.filter((project) =>
          isStatusValue(ACTIVE_PROJECT_STATUSES, project.status)
        ).length,
        devisEnAttente: quotes.length,
        devisExpirantSous7Jours: quotes.filter((quote) => {
          if (!quote.valid_until) return false;
          const validUntil = new Date(quote.valid_until);
          return validUntil >= now && validUntil <= sevenDaysLater;
        }).length,
        chantiersOuverts: sites.length,
        chantiersFinSemaine,
        rdvProgrammesSemaine: rdv.length,
        surfaceIsoleeMois: surfaceIsolee,
        totalMwh: Number.isFinite(totalMwh) ? Number(totalMwh.toFixed(2)) : 0,
        tauxConversion: {
          rate: Number(currentRate.toFixed(1)),
          delta: delta === null ? null : Number(delta.toFixed(1)),
        },
        generatedAt: now.toISOString(),
      };

      return metrics;
    },
  });
};

export const useRevenueData = (
  orgId: string | null,
  options: QueryOptions = {}
) => {
  const { enabled = true } = options;

  return useQuery<RevenueData, Error>({
    queryKey: ["dashboard", "revenue", orgId],
    enabled: Boolean(orgId) && enabled,
    queryFn: async () => {
      if (!orgId) {
        throw new Error("Organisation non définie");
      }

      const now = new Date();
      const startPeriod = startOfMonth(subMonths(now, 11));
      const startWeek = startOfWeek(now, { weekStartsOn: 1 });
      const endWeek = endOfWeek(now, { weekStartsOn: 1 });
      const previousWeekStart = subDays(startWeek, 7);
      const previousWeekEnd = subDays(startWeek, 1);

      const { data, error } = await supabase
        .from("invoices")
        .select("id, amount, status, created_at, updated_at")
        .eq("org_id", orgId)
        .eq("status", "PAID")
        .gte("created_at", startPeriod.toISOString())
        .order("created_at", { ascending: true });

      if (error) throw error;

      const invoices = data ?? [];
      const buckets: RevenuePoint[] = [];

      for (let i = 0; i < 12; i += 1) {
        const monthDate = addMonths(startPeriod, i);
        const isoMonth = format(monthDate, "yyyy-MM");
        const total = invoices
          .filter((invoice) => format(new Date(invoice.created_at), "yyyy-MM") === isoMonth)
          .reduce((acc, invoice) => acc + (invoice.amount ?? 0), 0);

        buckets.push({
          isoMonth,
          month: formatMonthLabel(monthDate),
          total,
        });
      }

      const currentMonthTotal = buckets.at(-1)?.total ?? 0;
      const previousMonthTotal = buckets.at(-2)?.total ?? 0;

      const sumInInterval = (start: Date, end: Date) =>
        invoices
          .filter((invoice) => {
            const date = new Date(invoice.created_at);
            return date >= start && date <= end;
          })
          .reduce((acc, invoice) => acc + (invoice.amount ?? 0), 0);

      const currentWeekTotal = sumInInterval(startWeek, endWeek);
      const previousWeekTotal = sumInInterval(previousWeekStart, previousWeekEnd);

      return {
        points: buckets,
        currentMonthTotal,
        previousMonthTotal,
        currentWeekTotal,
        previousWeekTotal,
        hasData: invoices.length > 0,
        generatedAt: now.toISOString(),
      } satisfies RevenueData;
    },
  });
};

export const useActivityFeed = (
  orgId: string | null,
  options: QueryOptions = {}
) => {
  const { enabled = true } = options;

  return useQuery<ActivityItem[], Error>({
    queryKey: ["dashboard", "activity", orgId],
    enabled: Boolean(orgId) && enabled,
    queryFn: async () => {
      if (!orgId) {
        throw new Error("Organisation non définie");
      }

      const [leads, quotes, projects, sites, invoices] = await Promise.all([
        supabase
          .from("leads")
          .select("id, full_name, city, created_at, status")
          .eq("org_id", orgId)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("quotes")
          .select("id, quote_ref, client_name, status, updated_at")
          .eq("org_id", orgId)
          .in("status", QUOTE_ACTIVITY_STATUSES)
          .order("updated_at", { ascending: false })
          .limit(20),
        supabase
          .from("projects")
          .select(
            "id, project_ref, client_name, client_first_name, client_last_name, city, status, updated_at"
          )
          .eq("org_id", orgId)
          .eq("status", ACCEPTED_PROJECT_STATUS)
          .order("updated_at", { ascending: false })
          .limit(20),
        supabase
          .from("sites")
          .select("id, site_ref, client_name, city, status, updated_at")
          .eq("org_id", orgId)
          .in("status", SITE_ACTIVITY_STATUSES)
          .order("updated_at", { ascending: false })
          .limit(20),
        supabase
          .from("invoices")
          .select("id, invoice_ref, client_name, status, created_at, updated_at, amount")
          .eq("org_id", orgId)
          .in("status", INVOICE_ACTIVITY_STATUSES)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      if (leads.error) throw leads.error;
      if (quotes.error) throw quotes.error;
      if (projects.error) throw projects.error;
      if (sites.error) throw sites.error;
      if (invoices.error) throw invoices.error;

      const items: ActivityItem[] = [];

      (leads.data ?? []).forEach((lead) => {
        const statusLabel = lead.status ? getLeadStatusLabel(lead.status) : null;
        items.push({
          id: `lead-${lead.id}`,
          type: "lead",
          title: "Nouveau lead reçu",
          description: `${lead.full_name} • ${lead.city ?? "Ville inconnue"}`,
          status: statusLabel,
          client: lead.full_name,
          city: lead.city,
          date: lead.created_at,
        });
      });

      (quotes.data ?? []).forEach((quote) => {
        const normalizedStatus = quote.status?.toUpperCase() ?? null;
        const resolvedStatus = isStatusValue(QUOTE_ACTIVITY_STATUSES, normalizedStatus)
          ? normalizedStatus
          : QUOTE_PENDING_STATUS;
        const statusLabel = QUOTE_STATUS_LABELS[resolvedStatus];
        items.push({
          id: `quote-${quote.id}`,
          type: "quote",
          title: QUOTE_ACTIVITY_TITLES[resolvedStatus],
          description: `${quote.quote_ref ?? "Devis"} • ${quote.client_name ?? "Client"}`,
          status: statusLabel,
          reference: quote.quote_ref,
          client: quote.client_name,
          date: quote.updated_at,
        });
      });

      (projects.data ?? []).forEach((project: any) => {
        const statusLabel = project.status
          ? PROJECT_STATUS_LABELS[project.status] ?? project.status
          : null;
        const projectClientName =
          project.client_name ?? getProjectClientName(project) ?? null;

        items.push({
          id: `project-${project.id}`,
          type: "project",
          title: "Projet accepté",
          description: `${project.project_ref ?? "Projet"} • ${projectClientName || "Client"}`,
          status: statusLabel,
          client: projectClientName,
          city: project.city,
          date: project.updated_at,
        });
      });

      (sites.data ?? []).forEach((site) => {
        const resolvedStatus = isStatusValue(SITE_ACTIVITY_STATUSES, site.status) ? site.status : null;
        const statusLabel = resolvedStatus ? SITE_STATUS_LABELS[resolvedStatus] : site.status ?? null;
        const title =
          resolvedStatus && SITE_ACTIVITY_TITLES[resolvedStatus]
            ? SITE_ACTIVITY_TITLES[resolvedStatus]!
            : "Chantier en cours";
        items.push({
          id: `site-${site.id}`,
          type: "site",
          title,
          description: `${site.site_ref ?? "Chantier"} • ${site.client_name ?? "Client"}`,
          status: statusLabel,
          client: site.client_name,
          city: site.city,
          date: site.updated_at,
        });
      });

      (invoices.data ?? []).forEach((invoice) => {
        const normalizedStatus = invoice.status?.toUpperCase() ?? null;
        const resolvedStatus = isStatusValue(INVOICE_ACTIVITY_STATUSES, normalizedStatus)
          ? normalizedStatus
          : DEFAULT_INVOICE_STATUS;
        const statusLabel = INVOICE_ACTIVITY_STATUS_LABELS[resolvedStatus];
        items.push({
          id: `invoice-${invoice.id}`,
          type: "invoice",
          title: INVOICE_ACTIVITY_TITLES[resolvedStatus],
          description: `${invoice.invoice_ref ?? "Facture"} • ${invoice.client_name ?? "Client"}`,
          status: statusLabel,
          reference: invoice.invoice_ref,
          client: invoice.client_name,
          amount: invoice.amount,
          date:
            resolvedStatus === "PAID" && invoice.updated_at ? invoice.updated_at : invoice.created_at,
        });
      });

      return items
        .filter((item) => Boolean(item.date))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10);
    },
  });
};
