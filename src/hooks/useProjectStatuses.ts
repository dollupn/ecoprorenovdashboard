import { useCallback, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useOrg } from "@/features/organizations/OrgContext";
import {
  DEFAULT_PROJECT_STATUSES,
  getProjectStatusSettings,
  PROJECT_STATUS_UPDATED_EVENT,
  saveProjectStatuses,
  sanitizeProjectStatuses,
  type ProjectStatusSetting,
} from "@/lib/projects";

const PROJECT_STATUSES_QUERY_KEY = "project-statuses" as const;
const SETTINGS_TABLE = "settings" as unknown as keyof Database["public"]["Tables"];

type SettingsRow = Pick<
  Database["public"]["Tables"]["settings"]["Row"],
  "statuts_projets" | "backup_webhook_url" | "backup_daily_enabled" | "backup_time"
>;

const fetchProjectStatuses = async (
  orgId: string | null,
): Promise<ProjectStatusSetting[]> => {
  if (!orgId) {
    return getProjectStatusSettings();
  }

  const { data, error } = (await supabase
    .from("settings" as any)
    .select("statuts_projets, backup_webhook_url, backup_daily_enabled, backup_time")
    .eq("org_id", orgId)
    .maybeSingle()) as { data: SettingsRow | null; error: PostgrestError | null };

  if (error && error.code !== "PGRST116") {
    throw error;
  }

      const rawStatuses = Array.isArray(data?.statuts_projets) && data.statuts_projets.length > 0
    ? (data?.statuts_projets as unknown as ProjectStatusSetting[])
    : DEFAULT_PROJECT_STATUSES;

  return sanitizeProjectStatuses(rawStatuses);
};

export const useProjectStatuses = () => {
  const { currentOrgId } = useOrg();
  const queryClient = useQueryClient();

  useEffect(() => {
    getProjectStatusSettings({ skipCache: true });
  }, [currentOrgId]);

  const queryKey = useMemo(
    () => [PROJECT_STATUSES_QUERY_KEY, currentOrgId] as const,
    [currentOrgId],
  );

  const query = useQuery({
    queryKey,
    queryFn: () => fetchProjectStatuses(currentOrgId ?? null),
    enabled: Boolean(currentOrgId),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    initialData: () => getProjectStatusSettings(),
    retry: 1,
  });

  useEffect(() => {
    if (query.data) {
      saveProjectStatuses(query.data);
    }
  }, [query.data]);

  const refresh = useCallback(() => {
    return queryClient.invalidateQueries({ queryKey: [PROJECT_STATUSES_QUERY_KEY] });
  }, [queryClient]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleUpdate = () => {
      void refresh();
    };

    window.addEventListener(PROJECT_STATUS_UPDATED_EVENT, handleUpdate);

    return () => {
      window.removeEventListener(PROJECT_STATUS_UPDATED_EVENT, handleUpdate);
    };
  }, [refresh]);

  useEffect(() => {
    if (!currentOrgId) return;

    const channel = supabase
      .channel(`public:settings_project_statuses:${currentOrgId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "settings", filter: `org_id=eq.${currentOrgId}` },
        () => {
          void refresh();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentOrgId, refresh]);

  const statuses = useMemo(() => {
    if (query.data) {
      return query.data;
    }

    return getProjectStatusSettings();
  }, [query.data]);

  return {
    statuses,
    isLoading: query.isLoading && !query.data,
    isFetching: query.isFetching,
    refresh,
    error: query.error ?? null,
  };
};
