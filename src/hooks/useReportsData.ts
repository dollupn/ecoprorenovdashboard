import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  differenceInCalendarDays,
  isValid,
  startOfYear,
  subYears,
} from "date-fns";
import { aggregateEnergyByCategory, type EnergyBreakdownEntry, type ProjectWithProducts } from "@/lib/energy";
import { withDefaultProductCeeConfig } from "@/lib/prime-cee-unified";
import { DEFAULT_PROJECT_STATUSES } from "@/lib/projects";

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

const SITE_COMPLETED_STATUSES: SiteStatus[] = ["TERMINE", "LIVRE"];

const MARGIN_TARGET = 0.35;

const PROJECT_STATUS_VALUES = DEFAULT_PROJECT_STATUSES.map((status) => status.value);
const PROJECT_SURFACE_STATUSES = PROJECT_STATUS_VALUES.filter((status) =>
  ["CHANTIER_EN_COURS", "CHANTIER_TERMINE", "LIVRE"].includes(status)
);

const isStatusValue = <T extends string>(
  statuses: readonly T[],
  value: string | null | undefined,
): value is T => (value ? (statuses as readonly string[]).includes(value) : false);

const toSiteStatus = (status: string | null | undefined): SiteStatus | null =>
  status && status in SITE_STATUS_LABELS ? (status as SiteStatus) : null;

interface QueryOptions {
  enabled?: boolean;
}

export interface LeadSourceBreakdown {
  source: string;
  leads: number;
  qualified: number;
  conversion: number;
}

export interface TopProjectSummary {
  id: string;
  projectRef: string | null;
  siteRef: string | null;
  clientName: string | null;
  revenue: number;
  profitMargin: number | null;
  status: string | null;
  statusLabel: string | null;
}

export interface ReportsData {
  conversion: {
    totalLeads: number;
    qualifiedLeads: number;
    averageRate: number;
    sources: LeadSourceBreakdown[];
  };
  margin: {
    average: number | null;
    target: number;
    sampleSize: number;
  };
  sites: {
    averageDuration: number | null;
    durationSampleSize: number;
    topProjects: TopProjectSummary[];
    activeCount: number;
    completedCount: number;
  };
  energy: {
    totalMwh: number;
    breakdown: EnergyBreakdownEntry[];
  };
  generatedAt: string;
}

type LeadRow = Pick<Tables<"leads">, "id" | "status" | "utm_source" | "created_at">;
type SiteRow = Pick<
  Tables<"sites">,
  | "id"
  | "project_ref"
  | "site_ref"
  | "client_name"
  | "status"
  | "revenue"
  | "profit_margin"
  | "date_debut"
  | "date_fin_prevue"
  | "created_at"
>;

const normalizeStatus = (value: string | null | undefined) =>
  value
    ? value
        .normalize("NFD")
        .replace(/[^\p{L}\p{N}]+/gu, "")
        .toUpperCase()
    : null;

export const useReportsData = (orgId: string | null, options: QueryOptions = {}) => {
  const { enabled = true } = options;

  return useQuery<ReportsData, Error>({
    queryKey: ["reports", "metrics", orgId],
    enabled: Boolean(orgId) && enabled,
    queryFn: async () => {
      if (!orgId) {
        throw new Error("Organisation non définie");
      }

      const now = new Date();
      const currentYearStart = startOfYear(now);
      const previousYearStart = startOfYear(subYears(now, 1));

      const [leadsRes, sitesRes, projectsRes] = await Promise.all([
        supabase
          .from("leads")
          .select("id, status, utm_source, created_at")
          .eq("org_id", orgId)
          .gte("created_at", currentYearStart.toISOString()),
        supabase
          .from("sites")
          .select(
            "id, project_ref, site_ref, client_name, status, revenue, profit_margin, date_debut, date_fin_prevue, created_at",
          )
          .eq("org_id", orgId)
          .gte("created_at", previousYearStart.toISOString()),
        supabase
          .from("projects")
          .select(
            `id, status, updated_at, surface_isolee_m2, city, client_name, building_type,
            project_products(id, quantity, dynamic_params, product:product_catalog(id, code, category, cee_config, default_params, is_active, params_schema, kwh_cumac_values:product_kwh_cumac(id, building_type, kwh_cumac)))`
          )
          .eq("org_id", orgId)
          .in("status", PROJECT_SURFACE_STATUSES),
      ]);

      if (leadsRes.error) throw leadsRes.error;
      if (sitesRes.error) throw sitesRes.error;
      if (projectsRes.error) throw projectsRes.error;

      const leads = (leadsRes.data ?? []) as LeadRow[];
      const sites = (sitesRes.data ?? []) as SiteRow[];
      const projects = (projectsRes.data ?? []).map(
        (project): ProjectWithProducts => ({
          ...project,
          project_products: (project.project_products ?? []).map((pp) => ({
            ...pp,
            product: pp.product ? withDefaultProductCeeConfig(pp.product) : null,
          })),
        })
      );

      const energyAggregation = aggregateEnergyByCategory(projects, {
        shouldIncludeProject: (project) => isStatusValue(PROJECT_SURFACE_STATUSES, project.status),
      });

      const sourceStats = new Map<string, { leads: number; qualified: number }>();
      let qualifiedLeads = 0;

      for (const lead of leads) {
        const sourceKey = lead.utm_source?.trim() || "Autres";
        const normalizedStatus = normalizeStatus(lead.status);
        const isQualified = normalizedStatus === "ELIGIBLE";

        const entry = sourceStats.get(sourceKey) ?? { leads: 0, qualified: 0 };
        entry.leads += 1;
        if (isQualified) {
          entry.qualified += 1;
          qualifiedLeads += 1;
        }
        sourceStats.set(sourceKey, entry);
      }

      const sources: LeadSourceBreakdown[] = Array.from(sourceStats.entries())
        .map(([source, stats]) => ({
          source,
          leads: stats.leads,
          qualified: stats.qualified,
          conversion: stats.leads === 0 ? 0 : stats.qualified / stats.leads,
        }))
        .sort((a, b) => b.leads - a.leads);

      const marginValues = sites
        .map((site) => (typeof site.profit_margin === "number" ? site.profit_margin : null))
        .filter((value): value is number => value !== null);

      const averageMargin =
        marginValues.length > 0
          ? marginValues.reduce((sum, value) => sum + value, 0) / marginValues.length
          : null;

      const completedDurationSamples = sites
        .filter((site) => {
          const status = toSiteStatus(site.status);
          return status ? SITE_COMPLETED_STATUSES.includes(status) : false;
        })
        .map((site) => {
          if (!site.date_debut || !site.date_fin_prevue) {
            return null;
          }

          const start = new Date(site.date_debut);
          const end = new Date(site.date_fin_prevue);

          if (!isValid(start) || !isValid(end) || end < start) {
            return null;
          }

          return differenceInCalendarDays(end, start);
        })
        .filter((value): value is number => value !== null);

      const averageDuration =
        completedDurationSamples.length > 0
          ? Math.round(
              completedDurationSamples.reduce((sum, value) => sum + value, 0) /
                completedDurationSamples.length,
            )
          : null;

      const activeCount = sites.filter((site) => {
        const status = toSiteStatus(site.status);
        return status ? SITE_ACTIVE_STATUSES.includes(status) : false;
      }).length;

      const completedCount = sites.filter((site) => {
        const status = toSiteStatus(site.status);
        return status ? SITE_COMPLETED_STATUSES.includes(status) : false;
      }).length;

      const topProjects: TopProjectSummary[] = sites
        .filter((site) => typeof site.revenue === "number" && site.revenue !== null)
        .sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0))
        .slice(0, 5)
        .map((site) => ({
          id: site.id,
          projectRef: site.project_ref,
          siteRef: site.site_ref,
          clientName: site.client_name,
          revenue: site.revenue ?? 0,
          profitMargin: typeof site.profit_margin === "number" ? site.profit_margin : null,
          status: site.status,
          statusLabel: (() => {
            const status = toSiteStatus(site.status);
            if (status) {
              return SITE_STATUS_LABELS[status];
            }
            return site.status ?? null;
          })(),
        }));

      return {
        conversion: {
          totalLeads: leads.length,
          qualifiedLeads,
          averageRate: leads.length === 0 ? 0 : qualifiedLeads / leads.length,
          sources,
        },
        margin: {
          average: averageMargin,
          target: MARGIN_TARGET,
          sampleSize: marginValues.length,
        },
        sites: {
          averageDuration,
          durationSampleSize: completedDurationSamples.length,
          topProjects,
          activeCount,
          completedCount,
        },
        energy: {
          totalMwh: energyAggregation.totalMwh,
          breakdown: energyAggregation.breakdown,
        },
        generatedAt: now.toISOString(),
      } satisfies ReportsData;
    },
  });
};
