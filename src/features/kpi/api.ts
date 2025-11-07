import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  ensureKpiMetric,
  ensureKpiPeriod,
  kpiGoalSchema,
  type KpiGoalFormValues,
} from "@/lib/kpi-goals";

export type KpiGoal = Database["public"]["Tables"]["kpi_goals"]["Row"];

const KPI_GOALS_QUERY_KEY = "kpi-goals" as const;

type ToggleVariables = { id: string; isActive: boolean };

type ToggleContext = {
  previousGoals?: KpiGoal[];
};

const mapFormToInsert = (values: KpiGoalFormValues, orgId: string) => {
  const timestamp = new Date().toISOString();

  return {
    org_id: orgId,
    title: values.title,
    description: values.description ? values.description : null,
    metric: values.metric,
    period: values.period,
    target_value: values.targetValue,
    target_unit: values.targetUnit,
    is_active: values.isActive,
    created_at: timestamp,
    updated_at: timestamp,
  };
};

const mapFormToUpdate = (values: KpiGoalFormValues) => ({
  title: values.title,
  description: values.description ? values.description : null,
  metric: values.metric,
  period: values.period,
  target_value: values.targetValue,
  target_unit: values.targetUnit,
  is_active: values.isActive,
  updated_at: new Date().toISOString(),
});

export const mapGoalToFormValues = (goal: KpiGoal): KpiGoalFormValues => ({
  id: goal.id,
  orgId: goal.org_id,
  title: goal.title,
  description: goal.description ?? "",
  metric: ensureKpiMetric(goal.metric),
  period: ensureKpiPeriod(goal.period),
  targetValue: goal.target_value,
  targetUnit: goal.target_unit,
  isActive: goal.is_active,
});

export function useKpiGoals(orgId: string | null) {
  return useQuery({
    queryKey: [KPI_GOALS_QUERY_KEY, orgId],
    queryFn: async () => {
      if (!orgId) {
        return [] as KpiGoal[];
      }

      const { data, error } = await supabase
        .from("kpi_goals")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: true });

      if (error) {
        throw error;
      }

      return (data ?? []) as KpiGoal[];
    },
    enabled: !!orgId,
  });
}

export function useCreateKpiGoal(orgId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: KpiGoalFormValues) => {
      if (!orgId) {
        throw new Error("Organisation requise pour créer un objectif.");
      }

      const parsed = kpiGoalSchema.parse({ ...values, orgId });
      if (!parsed.orgId) {
        throw new Error("Organisation invalide.");
      }

      const { data, error } = await supabase
        .from("kpi_goals")
        .insert(mapFormToInsert(parsed, parsed.orgId))
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data as KpiGoal;
    },
    onSuccess: (_data, _variables, _context) => {
      queryClient.invalidateQueries({ queryKey: [KPI_GOALS_QUERY_KEY, orgId] });
    },
  });
}

export function useUpdateKpiGoal(orgId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (values: KpiGoalFormValues) => {
      const parsed = kpiGoalSchema.parse({ ...values, orgId });

      if (!parsed.id) {
        throw new Error("Identifiant d'objectif manquant.");
      }

      const { data, error } = await supabase
        .from("kpi_goals")
        .update(mapFormToUpdate(parsed))
        .eq("id", parsed.id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data as KpiGoal;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [KPI_GOALS_QUERY_KEY, orgId] });
    },
  });
}

export function useDeleteKpiGoal(orgId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase.from("kpi_goals").delete().eq("id", id);

      if (error) {
        throw error;
      }

      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [KPI_GOALS_QUERY_KEY, orgId] });
    },
  });
}

export function useToggleKpiGoal(orgId: string | null) {
  const queryClient = useQueryClient();

  return useMutation<KpiGoal, unknown, ToggleVariables, ToggleContext>({
    mutationFn: async ({ id, isActive }) => {
      const { data, error } = await supabase
        .from("kpi_goals")
        .update({
          is_active: isActive,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data as KpiGoal;
    },
    onMutate: async ({ id, isActive }) => {
      await queryClient.cancelQueries({ queryKey: [KPI_GOALS_QUERY_KEY, orgId] });
      const previousGoals = queryClient.getQueryData<KpiGoal[]>([
        KPI_GOALS_QUERY_KEY,
        orgId,
      ]);

      queryClient.setQueryData<KpiGoal[]>(
        [KPI_GOALS_QUERY_KEY, orgId],
        (current) =>
          current?.map((goal) =>
            goal.id === id
              ? {
                  ...goal,
                  is_active: isActive,
                  updated_at: new Date().toISOString(),
                }
              : goal,
          ) ?? [],
      );

      return { previousGoals } satisfies ToggleContext;
    },
    onError: (_error, _variables, context) => {
      if (context?.previousGoals) {
        queryClient.setQueryData(
          [KPI_GOALS_QUERY_KEY, orgId],
          context.previousGoals,
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [KPI_GOALS_QUERY_KEY, orgId] });
    },
  });
}
