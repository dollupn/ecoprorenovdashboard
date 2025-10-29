import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import Projects from "./Projects";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrg } from "@/features/organizations/OrgContext";
import { useMembers } from "@/features/members/api";

const CHANTIER_STATUSES = ["PLANIFIE", "EN_COURS", "TERMINE", "LIVRE"] as const;

const ProjectChantiers = () => {
  const { user } = useAuth();
  const { currentOrgId } = useOrg();
  const { data: members = [], isLoading: membersLoading } = useMembers(currentOrgId);

  const currentMember = useMemo(
    () => members.find((member) => member.user_id === user?.id),
    [members, user?.id],
  );
  const isAdmin = currentMember?.role === "admin" || currentMember?.role === "owner";

  const { data: chantierProjectIds = [], isLoading: chantiersLoading } = useQuery<string[]>({
    queryKey: ["project-chantiers", user?.id, currentOrgId, isAdmin],
    queryFn: async () => {
      if (!user) return [] as string[];

      let query = supabase
        .from("sites")
        .select("project_id")
        .in("status", CHANTIER_STATUSES);

      if (currentOrgId) {
        query = query.eq("org_id", currentOrgId);
      }

      if (!isAdmin) {
        query = query.eq("user_id", user.id);
      }

      const { data, error } = await query;

      if (error) throw error;

      const uniqueIds = new Set<string>();
      (data ?? []).forEach((site) => {
        if (site?.project_id) {
          uniqueIds.add(site.project_id);
        }
      });

      return Array.from(uniqueIds);
    },
    enabled: !!user && (!currentOrgId || !membersLoading),
  });

  const restrictionLoading = chantiersLoading || membersLoading;
  const allowedProjectIds = restrictionLoading ? null : chantierProjectIds;

  return (
    <Projects
      title="Projets avec chantiers actifs"
      description="Visualisez les projets disposant d'au moins un chantier planifié, en cours, terminé ou livré."
      allowedProjectIds={allowedProjectIds}
      isRestrictionLoading={restrictionLoading}
    />
  );
};

export default ProjectChantiers;
