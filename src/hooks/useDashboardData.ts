import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PostgrestError } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  DEFAULT_PROJECT_STATUSES,
  getProjectClientName,
  sanitizeProjectStatuses,
  type ProjectStatusSetting,
} from "@/lib/projects";
import type { ProjectStatus } from "@/lib/projects";
import {
  addDays,
  addMonths,
  differenceInCalendarMonths,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subYears,
} from "date-fns";
import { fr } from "date-fns/locale";

import { getLeadStatusLabel, LEAD_STATUSES } from "@/components/leads/status";

const ACTIVE_LEAD_STATUSES = LEAD_STATUSES.filter((status) => status !== "Non éligible");
const QUALIFIED_LEAD_STATUS = "Éligible" as const;

const PROJECT_STATUS_LABELS = DEFAULT_PROJECT_STATUSES.reduce<Record<string, string>>(
  (acc, status) => {
    acc[status.value] = status.label;
    return acc;
  },
  {}
);

const PROJECT_SURFACE_STATUS_SET = new Set([
  "CHANTIER_EN_COURS",
  "TERMINE",
  "LIVRE",
  "FACTURE_ENVOYEE",
  "AH",
  "AAF",
  "CLOTURE",
]);

const ACCEPTED_PROJECT_STATUS =
  DEFAULT_PROJECT_STATUSES.find((status) => status.value === "DEVIS_SIGNE")?.value ?? "DEVIS_SIGNE";

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

type SettingsRow = Pick<
  Database["public"]["Tables"]["settings"]["Row"],
  "statuts_projets" | "backup_webhook_url" | "backup_daily_enabled" | "backup_time"
>;

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

import {
  aggregateEnergyByCategory,
  type EnergyBreakdownEntry,
  type ProjectWithProducts,
} from "@/lib/energy";
import { withDefaultProductCeeConfig } from "@/lib/prime-cee-unified";

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
  energyByCategory: EnergyBreakdownEntry[];
  tauxConversion: {
    rate: number;
    delta: number | null;
  };
  caMois: number;
  caSemaine: number;
  margeTotaleMois: number;
  ledInstalleesMois: number;
  generatedAt: string;
}

export interface RevenuePoint {
  month: string;
  isoMonth: string;
  total: number;
  invoicedTotal: number;
}

export interface RevenueData {
  points: RevenuePoint[];
  currentMonthTotal: number;
  previousMonthTotal: number;
  currentWeekTotal: number;
  previousWeekTotal: number;
  hasData: boolean;
  generatedAt: string;
  yearToDatePaid: number;
  yearToDateInvoiced: number;
  previousYearToDatePaid: number;
  previousYearToDateInvoiced: number;
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

interface RevenueQueryOptions extends QueryOptions {
  startDate?: Date;
  endDate?: Date;
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

      const {
        data: projectStatusSettings,
        error: projectStatusError,
      } = (await supabase
        .from("settings" as any)
        .select("statuts_projets, backup_webhook_url, backup_daily_enabled, backup_time")
        .eq("org_id", orgId)
        .maybeSingle()) as {
        data: SettingsRow | null;
        error: PostgrestError | null;
      };

      if (projectStatusError && projectStatusError.code !== "PGRST116") {
        throw projectStatusError;
      }

      const rawProjectStatuses =
        Array.isArray(projectStatusSettings?.statuts_projets) &&
        projectStatusSettings.statuts_projets.length > 0
          ? (projectStatusSettings.statuts_projets as unknown as ProjectStatusSetting[])
          : DEFAULT_PROJECT_STATUSES;

      const sanitizedProjectStatuses = sanitizeProjectStatuses(rawProjectStatuses);

      const activeProjectStatusValues = sanitizedProjectStatuses
        .filter((status) => status.isActive !== false)
        .map((status) => status.value);

      const projectSurfaceStatuses = Array.from(
        new Set(
          sanitizedProjectStatuses
            .filter(
              (status) =>
                status.isActive !== false || PROJECT_SURFACE_STATUS_SET.has(status.value),
            )
            .map((status) => status.value),
        ),
      );

      const projectStatusesToFetch = Array.from(
        new Set([...activeProjectStatusValues, ...projectSurfaceStatuses]),
      );

      const projectsQuery = supabase
        .from("projects")
        .select(
          `id, status, updated_at, surface_isolee_m2, surface_batiment_m2, city, client_name, building_type,
            project_products(id, quantity, dynamic_params, product:product_catalog(id, code, category, cee_config, default_params, is_active, params_schema, kwh_cumac_values:product_kwh_cumac(id, building_type, kwh_cumac_lt_400, kwh_cumac_gte_400)))`
        )
        .eq("org_id", orgId);

      if (projectStatusesToFetch.length > 0) {
        projectsQuery.in("status", projectStatusesToFetch as ProjectStatus[]);
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
        finishedSitesMonth,
        finishedSitesWeek,
      ] = await Promise.all([
        supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("org_id", orgId)
          .in("status", ACTIVE_LEAD_STATUSES),
        projectsQuery,
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
          .eq("status", ACCEPTED_PROJECT_STATUS as ProjectStatus)
          .gte("updated_at", previousPeriodStart.toISOString()),
        supabase
          .from("sites")
          .select("id, ca_ttc, marge_totale_ttc, surface_facturee_m2, nb_luminaires, date_fin, project_id, projects!inner(product_cee_categories)")
          .eq("org_id", orgId)
          .eq("status", "TERMINE")
          .gte("date_fin", startMonth.toISOString())
          .lt("date_fin", nextMonthStart.toISOString()),
        supabase
          .from("sites")
          .select("id, ca_ttc, date_fin")
          .eq("org_id", orgId)
          .eq("status", "TERMINE")
          .gte("date_fin", startWeek.toISOString())
          .lte("date_fin", endWeek.toISOString()),
      ]);

      if (activeLeads.error) throw activeLeads.error;
      if (projectsData.error) throw projectsData.error;
      if (pendingQuotes.error) throw pendingQuotes.error;
      if (sitesData.error) throw sitesData.error;
      if (leadsRdv.error) throw leadsRdv.error;
      if (qualifiedLeads.error) throw qualifiedLeads.error;
      if (acceptedProjects.error) throw acceptedProjects.error;
      if (finishedSitesMonth.error) throw finishedSitesMonth.error;
      if (finishedSitesWeek.error) throw finishedSitesWeek.error;

      const projets = (projectsData.data ?? []).map(
        (project): ProjectWithProducts => ({
          ...project,
          project_products: (project.project_products ?? []).map((pp) => ({
            ...pp,
            product: pp.product ? withDefaultProductCeeConfig(pp.product) : null,
          })),
        })
      );
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

      // Calculate KPIs from finished chantiers
      const finishedMonthSites = finishedSitesMonth.data ?? [];
      const finishedWeekSites = finishedSitesWeek.data ?? [];

      const caMois = finishedMonthSites.reduce((acc, site) => acc + (site.ca_ttc ?? 0), 0);
      const caSemaine = finishedWeekSites.reduce((acc, site) => acc + (site.ca_ttc ?? 0), 0);
      const margeTotaleMois = finishedMonthSites.reduce(
        (acc, site) => acc + (site.marge_totale_ttc ?? 0),
        0
      );

      const surfaceIsoleeMois = finishedMonthSites
        .filter((site) => {
          const category = (site.projects as any)?.product_cee_categories;
          return category === "Isolation";
        })
        .reduce((acc, site) => acc + (site.surface_facturee_m2 ?? 0), 0);

      const ledInstalleesMois = finishedMonthSites
        .filter((site) => {
          const category = (site.projects as any)?.product_cee_categories;
          return category === "Eclairage";
        })
        .reduce((acc, site) => acc + (site.nb_luminaires ?? 0), 0);

      const energyAggregation = aggregateEnergyByCategory(projets, {
        shouldIncludeProject: (project) =>
          isStatusValue(projectSurfaceStatuses, project.status),
      });
      const totalMwh = energyAggregation.totalMwh;

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
          isStatusValue(activeProjectStatusValues, project.status)
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
        surfaceIsoleeMois,
        totalMwh: Number.isFinite(totalMwh) ? Number(totalMwh.toFixed(2)) : 0,
        energyByCategory: energyAggregation.breakdown,
        tauxConversion: {
          rate: Number(currentRate.toFixed(1)),
          delta: delta === null ? null : Number(delta.toFixed(1)),
        },
        caMois,
        caSemaine,
        margeTotaleMois,
        ledInstalleesMois,
        generatedAt: now.toISOString(),
      };

      return metrics;
    },
  });
};

export const useRevenueData = (
  orgId: string | null,
  options: RevenueQueryOptions = {}
) => {
  const { enabled = true, startDate, endDate } = options;

  return useQuery<RevenueData, Error>({
    queryKey: [
      "dashboard",
      "revenue",
      orgId,
      startDate ? startDate.toISOString() : null,
      endDate ? endDate.toISOString() : null,
    ],
    enabled: Boolean(orgId) && enabled,
    queryFn: async () => {
      if (!orgId) {
        throw new Error("Organisation non définie");
      }

      const now = new Date();
      const rangeEnd = endDate ? endOfDay(endDate) : now;
      const rangeStart = startDate ? startOfDay(startDate) : startOfYear(rangeEnd);
      const previousRangeStart = subYears(rangeStart, 1);
      const previousRangeEnd = subYears(rangeEnd, 1);
      const trendStart = startDate
        ? startOfMonth(rangeStart)
        : startOfMonth(subMonths(rangeEnd, 11));
      const monthsInTrend = startDate && endDate
        ? Math.max(
            1,
            differenceInCalendarMonths(endOfMonth(rangeEnd), trendStart) + 1,
          )
        : 12;
      const queryStart = previousRangeStart;
      const queryEnd = rangeEnd;
      const startWeek = startOfWeek(rangeEnd, { weekStartsOn: 1 });
      const endWeek = endOfWeek(rangeEnd, { weekStartsOn: 1 });
      const previousWeekStart = subDays(startWeek, 7);
      const previousWeekEnd = subDays(startWeek, 1);

      const { data, error } = await supabase
        .from("invoices")
        .select("id, amount, status, created_at, updated_at")
        .eq("org_id", orgId)
        .gte("created_at", queryStart.toISOString())
        .lte("created_at", queryEnd.toISOString())
        .order("created_at", { ascending: true });

      if (error) throw error;

      const invoices = (data ?? []).map((invoice) => ({
        ...invoice,
        status: invoice.status ? invoice.status.toUpperCase() : null,
      }));
      const paidInvoices = invoices.filter((invoice) => invoice.status === "PAID");
      const inRangeInvoices = invoices.filter((invoice) => {
        const date = new Date(invoice.created_at);
        return date >= rangeStart && date <= rangeEnd;
      });
      const inRangePaidInvoices = paidInvoices.filter((invoice) => {
        const date = new Date(invoice.created_at);
        return date >= rangeStart && date <= rangeEnd;
      });

      const buckets: RevenuePoint[] = [];
      for (let i = 0; i < monthsInTrend; i += 1) {
        const monthDate = addMonths(trendStart, i);
        const isoMonth = format(monthDate, "yyyy-MM");
        const invoicedTotal = inRangeInvoices
          .filter((invoice) => format(new Date(invoice.created_at), "yyyy-MM") === isoMonth)
          .reduce((acc, invoice) => acc + (invoice.amount ?? 0), 0);
        const paidTotal = inRangePaidInvoices
          .filter((invoice) => format(new Date(invoice.created_at), "yyyy-MM") === isoMonth)
          .reduce((acc, invoice) => acc + (invoice.amount ?? 0), 0);

        buckets.push({
          isoMonth,
          month: formatMonthLabel(monthDate),
          total: paidTotal,
          invoicedTotal,
        });
      }

      const currentMonthTotal = buckets.at(-1)?.total ?? 0;
      const previousMonthTotal = monthsInTrend > 1 ? buckets.at(-2)?.total ?? 0 : 0;

      const sumInInterval = (records: typeof invoices, start: Date, end: Date) =>
        records
          .filter((invoice) => {
            const date = new Date(invoice.created_at);
            return date >= start && date <= end;
          })
          .reduce((acc, invoice) => acc + (invoice.amount ?? 0), 0);

      const currentWeekTotal = sumInInterval(inRangePaidInvoices, startWeek, endWeek);
      const previousWeekTotal = sumInInterval(inRangePaidInvoices, previousWeekStart, previousWeekEnd);
      const yearToDatePaid = sumInInterval(inRangePaidInvoices, rangeStart, rangeEnd);
      const yearToDateInvoiced = sumInInterval(inRangeInvoices, rangeStart, rangeEnd);
      const previousYearToDatePaid = sumInInterval(paidInvoices, previousRangeStart, previousRangeEnd);
      const previousYearToDateInvoiced = sumInInterval(
        invoices,
        previousRangeStart,
        previousRangeEnd,
      );

      return {
        points: buckets,
        currentMonthTotal,
        previousMonthTotal,
        currentWeekTotal,
        previousWeekTotal,
        hasData: inRangePaidInvoices.length > 0,
        generatedAt: now.toISOString(),
        yearToDatePaid,
        yearToDateInvoiced,
        previousYearToDatePaid,
        previousYearToDateInvoiced,
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
          .eq("status", ACCEPTED_PROJECT_STATUS as ProjectStatus)
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
