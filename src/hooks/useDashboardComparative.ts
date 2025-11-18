import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, format, subWeeks, subMonths, subQuarters } from "date-fns";
import { fr } from "date-fns/locale";
import type { DateRange, PeriodType } from "@/components/dashboard/PeriodFilter";

interface ComparativeData {
  label: string;
  current: number;
  previous: number;
}

export function useDashboardComparative(
  orgId: string | null,
  periodType: PeriodType,
  dateRange: DateRange,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ["dashboard-comparative", orgId, periodType, dateRange],
    queryFn: async () => {
      if (!orgId) throw new Error("Organization ID is required");

      // Calculate previous period
      let previousRange: DateRange;
      const diff = dateRange.to.getTime() - dateRange.from.getTime();

      switch (periodType) {
        case "week":
          previousRange = {
            from: startOfWeek(subWeeks(dateRange.from, 1), { locale: fr }),
            to: endOfWeek(subWeeks(dateRange.to, 1), { locale: fr }),
          };
          break;
        case "month":
          previousRange = {
            from: startOfMonth(subMonths(dateRange.from, 1)),
            to: endOfMonth(subMonths(dateRange.to, 1)),
          };
          break;
        case "quarter":
          previousRange = {
            from: startOfQuarter(subQuarters(dateRange.from, 1)),
            to: endOfQuarter(subQuarters(dateRange.to, 1)),
          };
          break;
        default:
          previousRange = {
            from: new Date(dateRange.from.getTime() - diff),
            to: new Date(dateRange.to.getTime() - diff),
          };
      }

      // Fetch sites data for revenue
      const { data: currentSites, error: currentSitesError } = await supabase
        .from("sites")
        .select("ca_ttc, date_fin, status")
        .eq("org_id", orgId)
        .eq("status", "TERMINE")
        .gte("date_fin", format(dateRange.from, "yyyy-MM-dd"))
        .lte("date_fin", format(dateRange.to, "yyyy-MM-dd"));

      if (currentSitesError) throw currentSitesError;

      const { data: previousSites, error: previousSitesError } = await supabase
        .from("sites")
        .select("ca_ttc, date_fin, status")
        .eq("org_id", orgId)
        .eq("status", "TERMINE")
        .gte("date_fin", format(previousRange.from, "yyyy-MM-dd"))
        .lte("date_fin", format(previousRange.to, "yyyy-MM-dd"));

      if (previousSitesError) throw previousSitesError;

      // Fetch projects data
      const { data: currentProjects, error: currentProjectsError } = await supabase
        .from("projects")
        .select("id, created_at, status")
        .eq("org_id", orgId)
        .gte("created_at", dateRange.from.toISOString())
        .lte("created_at", dateRange.to.toISOString());

      if (currentProjectsError) throw currentProjectsError;

      const { data: previousProjects, error: previousProjectsError } = await supabase
        .from("projects")
        .select("id, created_at, status")
        .eq("org_id", orgId)
        .gte("created_at", previousRange.from.toISOString())
        .lte("created_at", previousRange.to.toISOString());

      if (previousProjectsError) throw previousProjectsError;

      // Fetch leads data
      const { data: currentLeads, error: currentLeadsError } = await supabase
        .from("leads")
        .select("id, created_at, status")
        .eq("org_id", orgId)
        .gte("created_at", dateRange.from.toISOString())
        .lte("created_at", dateRange.to.toISOString());

      if (currentLeadsError) throw currentLeadsError;

      const { data: previousLeads, error: previousLeadsError } = await supabase
        .from("leads")
        .select("id, created_at, status")
        .eq("org_id", orgId)
        .gte("created_at", previousRange.from.toISOString())
        .lte("created_at", previousRange.to.toISOString());

      if (previousLeadsError) throw previousLeadsError;

      // Generate time intervals based on period type
      let intervals: Date[];
      let labelFormat: string;

      if (periodType === "week") {
        intervals = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
        labelFormat = "EEE";
      } else if (periodType === "month") {
        intervals = eachWeekOfInterval({ start: dateRange.from, end: dateRange.to });
        labelFormat = "'S'w";
      } else {
        intervals = eachMonthOfInterval({ start: dateRange.from, end: dateRange.to });
        labelFormat = "MMM";
      }

      // Aggregate data by intervals
      const revenueData: ComparativeData[] = intervals.map((date, idx) => {
        const intervalStart = date;
        const intervalEnd = intervals[idx + 1] || dateRange.to;

        const currentRevenue = (currentSites || [])
          .filter((s) => {
            const dateFin = s.date_fin ? new Date(s.date_fin) : null;
            return dateFin && dateFin >= intervalStart && dateFin < intervalEnd;
          })
          .reduce((sum, s) => sum + (s.ca_ttc || 0), 0);

        // Calculate corresponding previous interval
        const prevIntervalStart = new Date(intervalStart.getTime() - diff);
        const prevIntervalEnd = new Date(intervalEnd.getTime() - diff);

        const previousRevenue = (previousSites || [])
          .filter((s) => {
            const dateFin = s.date_fin ? new Date(s.date_fin) : null;
            return dateFin && dateFin >= prevIntervalStart && dateFin < prevIntervalEnd;
          })
          .reduce((sum, s) => sum + (s.ca_ttc || 0), 0);

        return {
          label: format(date, labelFormat, { locale: fr }),
          current: currentRevenue,
          previous: previousRevenue,
        };
      });

      const projectsData: ComparativeData[] = intervals.map((date, idx) => {
        const intervalStart = date;
        const intervalEnd = intervals[idx + 1] || dateRange.to;

        const currentCount = (currentProjects || []).filter((p) => {
          const createdAt = new Date(p.created_at);
          return createdAt >= intervalStart && createdAt < intervalEnd;
        }).length;

        const prevIntervalStart = new Date(intervalStart.getTime() - diff);
        const prevIntervalEnd = new Date(intervalEnd.getTime() - diff);

        const previousCount = (previousProjects || []).filter((p) => {
          const createdAt = new Date(p.created_at);
          return createdAt >= prevIntervalStart && createdAt < prevIntervalEnd;
        }).length;

        return {
          label: format(date, labelFormat, { locale: fr }),
          current: currentCount,
          previous: previousCount,
        };
      });

      const leadsData: ComparativeData[] = intervals.map((date, idx) => {
        const intervalStart = date;
        const intervalEnd = intervals[idx + 1] || dateRange.to;

        const currentCount = (currentLeads || []).filter((l) => {
          const createdAt = new Date(l.created_at);
          return createdAt >= intervalStart && createdAt < intervalEnd;
        }).length;

        const prevIntervalStart = new Date(intervalStart.getTime() - diff);
        const prevIntervalEnd = new Date(intervalEnd.getTime() - diff);

        const previousCount = (previousLeads || []).filter((l) => {
          const createdAt = new Date(l.created_at);
          return createdAt >= prevIntervalStart && createdAt < prevIntervalEnd;
        }).length;

        return {
          label: format(date, labelFormat, { locale: fr }),
          current: currentCount,
          previous: previousCount,
        };
      });

      return {
        revenueData,
        projectsData,
        leadsData,
        periodLabel: getPeriodLabel(periodType, dateRange),
      };
    },
    enabled: options?.enabled && Boolean(orgId),
  });
}

function getPeriodLabel(periodType: PeriodType, dateRange: DateRange): string {
  const start = format(dateRange.from, "dd MMM", { locale: fr });
  const end = format(dateRange.to, "dd MMM yyyy", { locale: fr });

  switch (periodType) {
    case "week":
      return `Semaine du ${start} au ${end}`;
    case "month":
      return format(dateRange.from, "MMMM yyyy", { locale: fr });
    case "quarter":
      return `T${Math.floor(dateRange.from.getMonth() / 3) + 1} ${dateRange.from.getFullYear()}`;
    default:
      return `${start} - ${end}`;
  }
}
