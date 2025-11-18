import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function usePerformanceMetrics(orgId: string | null) {
  return useQuery({
    queryKey: ["performance-metrics", orgId],
    queryFn: async () => {
      if (!orgId) {
        return {
          conversionRate: 0,
          closureRate: 0,
          onTimeCompletion: 0,
          utilizationRate: 0,
        };
      }

      // Fetch all data in parallel
      const [leadsData, projectsData, sitesData] = await Promise.all([
        supabase.from("leads").select("id, status").eq("org_id", orgId),
        supabase
          .from("projects")
          .select("id, status, date_debut_prevue, date_fin_prevue")
          .eq("org_id", orgId),
        supabase
          .from("sites")
          .select("id, status, date_debut, date_fin, date_fin_prevue")
          .eq("org_id", orgId),
      ]);

      if (leadsData.error) throw leadsData.error;
      if (projectsData.error) throw projectsData.error;
      if (sitesData.error) throw sitesData.error;

      // Calculate conversion rate (leads -> projects)
      const totalLeads = leadsData.data?.length || 0;
      const convertedLeads =
        leadsData.data?.filter((l) => l.status === "Converti" || l.status === "Gagné")
          .length || 0;
      const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;

      // Calculate closure rate (completed projects)
      const totalProjects = projectsData.data?.length || 0;
      const completedProjects =
        projectsData.data?.filter((p) => p.status === "Terminé").length || 0;
      const closureRate = totalProjects > 0 ? (completedProjects / totalProjects) * 100 : 0;

      // Calculate on-time completion
      const finishedSites =
        sitesData.data?.filter(
          (s) => s.status === "Terminé" || s.status === "Facturation" || s.status === "Clôturé"
        ) || [];
      const onTimeSites = finishedSites.filter((s) => {
        if (!s.date_fin || !s.date_fin_prevue) return false;
        return new Date(s.date_fin) <= new Date(s.date_fin_prevue);
      });
      const onTimeCompletion =
        finishedSites.length > 0 ? (onTimeSites.length / finishedSites.length) * 100 : 0;

      // Calculate utilization rate (active sites vs total sites)
      const activeSites =
        sitesData.data?.filter((s) => s.status === "En cours" || s.status === "Démarré")
          .length || 0;
      const totalSites = sitesData.data?.length || 0;
      const utilizationRate = totalSites > 0 ? (activeSites / totalSites) * 100 : 0;

      return {
        conversionRate: Math.round(conversionRate * 100) / 100,
        closureRate: Math.round(closureRate * 100) / 100,
        onTimeCompletion: Math.round(onTimeCompletion * 100) / 100,
        utilizationRate: Math.round(utilizationRate * 100) / 100,
      };
    },
    enabled: !!orgId,
  });
}
