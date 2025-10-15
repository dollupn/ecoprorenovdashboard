import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getProjectClientName } from "@/lib/projects";
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

const ACTIVE_LEAD_STATUSES = ["NEW", "QUALIFIED"] as const;
const ACTIVE_PROJECT_STATUSES = ["NEW", "QUOTE_SENT", "ACCEPTED", "IN_PROGRESS"] as const;
const QUOTE_PENDING_STATUS = "SENT" as const;
const SITE_ACTIVE_STATUSES = ["PREPARATION", "PLANIFIE", "EN_COURS", "CONTROLE"] as const;
const SITE_ENDING_STATUSES = ["PLANIFIE", "EN_COURS", "CONTROLE"] as const;
const PROJECT_SURFACE_STATUSES = ["IN_PROGRESS", "DONE"] as const;
const QUOTE_ACTIVITY_STATUSES = ["SENT", "ACCEPTED", "REFUSED"] as const;
const SITE_ACTIVITY_STATUSES = ["EN_COURS", "CLOTURE"] as const;
const INVOICE_ACTIVITY_STATUSES = ["SENT", "PAID"] as const;

export interface DashboardMetrics {
  leadsActifs: number;
  projetsEnCours: number;
  devisEnAttente: number;
  devisExpirantSous7Jours: number;
  chantiersOuverts: number;
  chantiersFinSemaine: number;
  rdvProgrammesSemaine: number;
  surfaceIsoleeMois: number;
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

      const [activeLeads, projectsData, pendingQuotes, sitesData, leadsRdv, qualifiedLeads, acceptedProjects] =
        await Promise.all([
          supabase
            .from("leads")
            .select("id", { count: "exact", head: true })
            .eq("user_id", orgId)
            .in("status", ACTIVE_LEAD_STATUSES),
          supabase
            .from("projects")
            .select("id, status, updated_at, surface_isolee_m2, city, client_name")
            .eq("user_id", orgId)
            .in("status", [...ACTIVE_PROJECT_STATUSES, ...PROJECT_SURFACE_STATUSES]),
          supabase
            .from("quotes")
            .select("id, status, valid_until")
            .eq("user_id", orgId)
            .eq("status", QUOTE_PENDING_STATUS),
          supabase
            .from("sites")
            .select("id, status, date_fin_prevue")
            .eq("user_id", orgId)
            .in("status", SITE_ACTIVE_STATUSES),
          supabase
            .from("leads")
            .select("id, date_rdv")
            .eq("user_id", orgId)
            .gte("date_rdv", startWeek.toISOString())
            .lte("date_rdv", endWeek.toISOString()),
          supabase
            .from("leads")
            .select("id, updated_at")
            .eq("user_id", orgId)
            .eq("status", "QUALIFIED")
            .gte("updated_at", previousPeriodStart.toISOString()),
          supabase
            .from("projects")
            .select("id, updated_at")
            .eq("user_id", orgId)
            .eq("status", "ACCEPTED")
            .gte("updated_at", previousPeriodStart.toISOString()),
        ]);

      if (activeLeads.error) throw activeLeads.error;
      if (projectsData.error) throw projectsData.error;
      if (pendingQuotes.error) throw pendingQuotes.error;
      if (sitesData.error) throw sitesData.error;
      if (leadsRdv.error) throw leadsRdv.error;
      if (qualifiedLeads.error) throw qualifiedLeads.error;
      if (acceptedProjects.error) throw acceptedProjects.error;

      const projets = projectsData.data ?? [];
      const sites = sitesData.data ?? [];
      const rdv = leadsRdv.data ?? [];
      const quotes = pendingQuotes.data ?? [];

      const chantiersFinSemaine = sites.filter((site) => {
        if (!site.date_fin_prevue) return false;
        const endDate = new Date(site.date_fin_prevue);
        return (
          SITE_ENDING_STATUSES.includes(site.status as typeof SITE_ENDING_STATUSES[number]) &&
          endDate >= now &&
          endDate <= sevenDaysLater
        );
      }).length;

      const surfaceIsolee = projets
        .filter((project) =>
          PROJECT_SURFACE_STATUSES.includes(project.status as typeof PROJECT_SURFACE_STATUSES[number])
        )
        .filter((project) => {
          if (!project.updated_at) return false;
          const updated = new Date(project.updated_at);
          return updated >= startMonth && updated < nextMonthStart;
        })
        .reduce((acc, project) => acc + (project.surface_isolee_m2 ?? 0), 0);

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
          ACTIVE_PROJECT_STATUSES.includes(project.status as typeof ACTIVE_PROJECT_STATUSES[number])
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
        .eq("user_id", orgId)
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
          .select("id, full_name, city, created_at")
          .eq("user_id", orgId)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("quotes")
          .select("id, quote_ref, client_name, status, updated_at")
          .eq("user_id", orgId)
          .in("status", QUOTE_ACTIVITY_STATUSES)
          .order("updated_at", { ascending: false })
          .limit(20),
        supabase
          .from("projects")
          .select(
            "id, project_ref, client_name, client_first_name, client_last_name, city, status, updated_at"
          )
          .eq("user_id", orgId)
          .eq("status", "ACCEPTED")
          .order("updated_at", { ascending: false })
          .limit(20),
        supabase
          .from("sites")
          .select("id, site_ref, client_name, city, status, updated_at")
          .eq("user_id", orgId)
          .in("status", SITE_ACTIVITY_STATUSES)
          .order("updated_at", { ascending: false })
          .limit(20),
        supabase
          .from("invoices")
          .select("id, invoice_ref, client_name, status, created_at, updated_at, amount")
          .eq("user_id", orgId)
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
        items.push({
          id: `lead-${lead.id}`,
          type: "lead",
          title: "Nouveau lead reçu",
          description: `${lead.full_name} • ${lead.city ?? "Ville inconnue"}`,
          status: "NEW",
          client: lead.full_name,
          city: lead.city,
          date: lead.created_at,
        });
      });

      (quotes.data ?? []).forEach((quote) => {
        const status = quote.status?.toUpperCase() ?? "SENT";
        items.push({
          id: `quote-${quote.id}`,
          type: "quote",
          title:
            status === "ACCEPTED"
              ? "Devis accepté"
              : status === "REFUSED"
                ? "Devis refusé"
                : "Devis envoyé",
          description: `${quote.quote_ref ?? "Devis"} • ${quote.client_name ?? "Client"}`,
          status,
          reference: quote.quote_ref,
          client: quote.client_name,
          date: quote.updated_at,
        });
      });

      (projects.data ?? []).forEach((project) => {
        const projectClientName = getProjectClientName(project);
        items.push({
          id: `project-${project.id}`,
          type: "project",
          title: "Projet accepté",
          description: `${project.project_ref ?? "Projet"} • ${projectClientName || "Client"}`,
          status: project.status?.toUpperCase(),
          client: projectClientName,
          city: project.city,
          date: project.updated_at,
        });
      });

      (sites.data ?? []).forEach((site) => {
        const status = site.status?.toUpperCase();
        items.push({
          id: `site-${site.id}`,
          type: "site",
          title: status === "CLOTURE" ? "Chantier clôturé" : "Chantier en cours",
          description: `${site.site_ref ?? "Chantier"} • ${site.client_name ?? "Client"}`,
          status,
          client: site.client_name,
          city: site.city,
          date: site.updated_at,
        });
      });

      (invoices.data ?? []).forEach((invoice) => {
        const status = invoice.status?.toUpperCase();
        items.push({
          id: `invoice-${invoice.id}`,
          type: "invoice",
          title: status === "PAID" ? "Paiement reçu" : "Facture envoyée",
          description: `${invoice.invoice_ref ?? "Facture"} • ${invoice.client_name ?? "Client"}`,
          status,
          reference: invoice.invoice_ref,
          client: invoice.client_name,
          amount: invoice.amount,
          date: status === "PAID" && invoice.updated_at ? invoice.updated_at : invoice.created_at,
        });
      });

      return items
        .filter((item) => Boolean(item.date))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10);
    },
  });
};
