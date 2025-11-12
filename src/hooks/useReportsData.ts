import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { ProjectStatus } from "@/lib/projects";
import {
  differenceInCalendarDays,
  endOfDay,
  isValid,
  startOfDay,
  startOfYear,
} from "date-fns";
import { aggregateEnergyByCategory, type EnergyBreakdownEntry, type ProjectWithProducts } from "@/lib/energy";
import {
  calculateRentability,
  buildRentabilityInputFromSite,
  type RentabilityInput,
} from "@/lib/rentability";
import { normalizeAdditionalCostsArray } from "@/components/sites/siteFormSchema";
import { normalizeTravauxNonSubventionnesValue } from "@/components/sites/travauxNonSubventionnes";
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
const PROJECT_SURFACE_STATUS_SET = new Set([
  "CHANTIER_EN_COURS",
  "CHANTIER_TERMINE",
  "LIVRE",
  "FACTURE_ENVOYEE",
  "AH",
  "AAF",
  "CLOTURE",
]);
const PROJECT_SURFACE_STATUSES = PROJECT_STATUS_VALUES.filter((status) =>
  PROJECT_SURFACE_STATUS_SET.has(status),
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

interface ReportsQueryOptions extends QueryOptions {
  startDate?: Date;
  endDate?: Date;
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
  marginRate: number | null;
  marginTotal: number | null;
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
    totalRevenue: number;
    revenueSampleSize: number;
    averageRevenuePerSite: number | null;
    totalMargin: number;
  };
  energy: {
    totalMwh: number;
    breakdown: EnergyBreakdownEntry[];
  };
  generatedAt: string;
}

type LeadRow = Pick<Tables<"leads">, "id" | "status" | "utm_source" | "created_at">;
type SiteRow = Tables<"sites">;

const normalizeStatus = (value: string | null | undefined) =>
  value
    ? value
        .normalize("NFD")
        .replace(/[^\p{L}\p{N}]+/gu, "")
        .toUpperCase()
    : null;

const resolveSiteRentability = (site: SiteRow) => {
  const additionalCosts = normalizeAdditionalCostsArray(site.additional_costs ?? []);

  const travauxChoice = normalizeTravauxNonSubventionnesValue(
    site.travaux_non_subventionnes,
  );
  const travauxMontant =
    typeof site.travaux_non_subventionnes_montant === "number" &&
    Number.isFinite(site.travaux_non_subventionnes_montant)
      ? site.travaux_non_subventionnes_montant
      : typeof site.travaux_non_subventionnes === "number" &&
          Number.isFinite(site.travaux_non_subventionnes)
        ? site.travaux_non_subventionnes
        : 0;

  const computed = calculateRentability(
    buildRentabilityInputFromSite({
      revenue: site.revenue,
      cout_main_oeuvre_m2_ht: site.cout_main_oeuvre_m2_ht,
      cout_isolation_m2: site.cout_isolation_m2,
      isolation_utilisee_m2: site.isolation_utilisee_m2,
      surface_facturee: site.surface_facturee,
      montant_commission: site.montant_commission,
      travaux_non_subventionnes: travauxChoice,
      travaux_non_subventionnes_montant: travauxMontant,
      additional_costs: additionalCosts ?? [],
      product_name: site.product_name,
      valorisation_cee: site.valorisation_cee ?? 0,
      subcontractor_payment_confirmed: site.subcontractor_payment_confirmed ?? false,
      project_category: site.product_name,
    }),
  );

  const marginRate =
    typeof site.rentability_margin_rate === "number" && Number.isFinite(site.rentability_margin_rate)
      ? site.rentability_margin_rate
      : typeof site.profit_margin === "number" && Number.isFinite(site.profit_margin)
        ? site.profit_margin
        : computed.marginRate;

  const marginTotal =
    typeof site.rentability_margin_total === "number" && Number.isFinite(site.rentability_margin_total)
      ? site.rentability_margin_total
      : computed.marginTotal;

  const totalCosts =
    typeof site.rentability_total_costs === "number" && Number.isFinite(site.rentability_total_costs)
      ? site.rentability_total_costs
      : computed.totalCosts;

  const additionalCostsTotal =
    typeof site.rentability_additional_costs_total === "number" &&
    Number.isFinite(site.rentability_additional_costs_total)
      ? site.rentability_additional_costs_total
      : computed.additionalCostsTotal;

  const unitLabel =
    typeof site.rentability_unit_label === "string" && site.rentability_unit_label.trim().length > 0
      ? site.rentability_unit_label
      : computed.unitLabel;

  return {
    ca: computed.ca,
    marginRate,
    marginTotal,
    totalCosts,
    additionalCostsTotal,
    unitLabel,
  };
};

export const useReportsData = (
  orgId: string | null,
  options: ReportsQueryOptions = {},
) => {
  const { enabled = true, startDate, endDate } = options;

  return useQuery<ReportsData, Error>({
    queryKey: [
      "reports",
      "metrics",
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

      const [leadsRes, sitesRes, projectsRes] = await Promise.all([
        supabase
          .from("leads")
          .select("id, status, utm_source, created_at")
          .eq("org_id", orgId)
          .gte("created_at", rangeStart.toISOString())
          .lte("created_at", rangeEnd.toISOString()),
        supabase
          .from("sites")
          .select(
            "id, project_ref, site_ref, client_name, status, revenue, profit_margin, rentability_margin_rate, rentability_margin_total, rentability_total_costs, rentability_additional_costs_total, rentability_unit_label, cout_main_oeuvre_m2_ht, cout_isolation_m2, isolation_utilisee_m2, surface_facturee, montant_commission, travaux_non_subventionnes, additional_costs, product_name, date_debut, date_fin_prevue, created_at",
          )
          .eq("org_id", orgId)
          .gte("created_at", rangeStart.toISOString())
          .lte("created_at", rangeEnd.toISOString()),
        supabase
          .from("projects")
          .select(
            `id, status, updated_at, surface_isolee_m2, surface_batiment_m2, city, client_name, building_type,
            project_products(id, quantity, dynamic_params, product:product_catalog(id, code, category, cee_config, default_params, is_active, params_schema, kwh_cumac_values:product_kwh_cumac(id, building_type, kwh_cumac_lt_400, kwh_cumac_gte_400)))`
          )
          .eq("org_id", orgId)
          .in("status", PROJECT_SURFACE_STATUSES as ProjectStatus[])
          .gte("updated_at", rangeStart.toISOString())
          .lte("updated_at", rangeEnd.toISOString()),
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

      const sitesWithRentability = sites.map((site) => ({
        site,
        rentability: resolveSiteRentability(site),
      }));

      const marginValues = sitesWithRentability
        .map(({ rentability }) =>
          Number.isFinite(rentability.marginRate) ? rentability.marginRate : null,
        )
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

      const revenueTotals = sitesWithRentability.reduce(
        (acc, { site, rentability }) => {
          if (typeof site.revenue === "number" && Number.isFinite(site.revenue)) {
            acc.totalRevenue += site.revenue;
            acc.revenueSampleSize += 1;
          }

          if (Number.isFinite(rentability.marginTotal)) {
            acc.totalMargin += rentability.marginTotal;
          }

          return acc;
        },
        { totalRevenue: 0, revenueSampleSize: 0, totalMargin: 0 },
      );

      const averageRevenuePerSite =
        revenueTotals.revenueSampleSize > 0
          ? revenueTotals.totalRevenue / revenueTotals.revenueSampleSize
          : null;

      const topProjects: TopProjectSummary[] = sitesWithRentability
        .filter(({ site }) => typeof site.revenue === "number" && site.revenue !== null)
        .sort((a, b) => (b.site.revenue ?? 0) - (a.site.revenue ?? 0))
        .slice(0, 5)
        .map(({ site, rentability }) => {
          return {
            id: site.id,
            projectRef: site.project_ref,
            siteRef: site.site_ref,
            clientName: site.client_name,
            revenue: site.revenue ?? 0,
            marginRate: Number.isFinite(rentability.marginRate) ? rentability.marginRate : null,
            marginTotal: Number.isFinite(rentability.marginTotal) ? rentability.marginTotal : null,
            status: site.status,
            statusLabel: (() => {
              const status = toSiteStatus(site.status);
              if (status) {
                return SITE_STATUS_LABELS[status];
              }
              return site.status ?? null;
            })(),
          } satisfies TopProjectSummary;
        });

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
          totalRevenue: revenueTotals.totalRevenue,
          revenueSampleSize: revenueTotals.revenueSampleSize,
          averageRevenuePerSite,
          totalMargin: revenueTotals.totalMargin,
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
