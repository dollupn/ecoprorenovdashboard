import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, subDays, format } from "date-fns";

type MetricType = "revenue" | "sites" | "leads" | "projects";

export function useSparklineData(
  orgId: string | null,
  metric: MetricType,
  days: number = 30
) {
  return useQuery({
    queryKey: ["sparkline", orgId, metric, days],
    queryFn: async () => {
      if (!orgId) return [];

      const startDate = startOfDay(subDays(new Date(), days));

      switch (metric) {
        case "revenue": {
          const { data, error } = await supabase
            .from("invoices")
            .select("paid_date, amount")
            .eq("org_id", orgId)
            .eq("status", "paid")
            .gte("paid_date", startDate.toISOString())
            .order("paid_date", { ascending: true });

          if (error) throw error;

          // Group by date
          const revenueByDate = new Map<string, number>();
          for (let i = 0; i < days; i++) {
            const date = format(subDays(new Date(), days - i - 1), "yyyy-MM-dd");
            revenueByDate.set(date, 0);
          }

          data?.forEach((invoice) => {
            if (invoice.paid_date) {
              const date = format(new Date(invoice.paid_date), "yyyy-MM-dd");
              revenueByDate.set(date, (revenueByDate.get(date) || 0) + invoice.amount);
            }
          });

          return Array.from(revenueByDate.values());
        }

        case "sites": {
          const { data, error } = await supabase
            .from("sites")
            .select("created_at")
            .eq("org_id", orgId)
            .gte("created_at", startDate.toISOString())
            .order("created_at", { ascending: true });

          if (error) throw error;

          const sitesByDate = new Map<string, number>();
          for (let i = 0; i < days; i++) {
            const date = format(subDays(new Date(), days - i - 1), "yyyy-MM-dd");
            sitesByDate.set(date, 0);
          }

          data?.forEach((site) => {
            const date = format(new Date(site.created_at), "yyyy-MM-dd");
            sitesByDate.set(date, (sitesByDate.get(date) || 0) + 1);
          });

          return Array.from(sitesByDate.values());
        }

        case "leads": {
          const { data, error } = await supabase
            .from("leads")
            .select("created_at")
            .eq("org_id", orgId)
            .gte("created_at", startDate.toISOString())
            .order("created_at", { ascending: true });

          if (error) throw error;

          const leadsByDate = new Map<string, number>();
          for (let i = 0; i < days; i++) {
            const date = format(subDays(new Date(), days - i - 1), "yyyy-MM-dd");
            leadsByDate.set(date, 0);
          }

          data?.forEach((lead) => {
            const date = format(new Date(lead.created_at), "yyyy-MM-dd");
            leadsByDate.set(date, (leadsByDate.get(date) || 0) + 1);
          });

          return Array.from(leadsByDate.values());
        }

        case "projects": {
          const { data, error } = await supabase
            .from("projects")
            .select("created_at")
            .eq("org_id", orgId)
            .gte("created_at", startDate.toISOString())
            .order("created_at", { ascending: true });

          if (error) throw error;

          const projectsByDate = new Map<string, number>();
          for (let i = 0; i < days; i++) {
            const date = format(subDays(new Date(), days - i - 1), "yyyy-MM-dd");
            projectsByDate.set(date, 0);
          }

          data?.forEach((project) => {
            const date = format(new Date(project.created_at), "yyyy-MM-dd");
            projectsByDate.set(date, (projectsByDate.get(date) || 0) + 1);
          });

          return Array.from(projectsByDate.values());
        }

        default:
          return [];
      }
    },
    enabled: !!orgId,
  });
}
