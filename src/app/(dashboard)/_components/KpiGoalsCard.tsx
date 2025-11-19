import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const numberFormatter = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 0,
});

const percentageFormatter = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 1,
});

interface KpiGoal {
  id: string;
  org_id: string;
  title: string;
  description?: string | null;
  metric: string;
  target_value: number;
  target_unit: string;
  period: string;
  is_active: boolean;
}

interface KpiGoalsCardProps {
  orgId: string | null;
  enabled?: boolean;
  className?: string;
}

const normalizeUnit = (unit?: string | null) => {
  if (!unit) return "";
  if (unit === "m2" || unit === "m^2") {
    return "m²";
  }
  return unit;
};

const extractSurfaceValue = (payload: unknown): number => {
  if (typeof payload === "number") {
    return payload;
  }

  if (Array.isArray(payload) && payload.length > 0) {
    const [first] = payload;
    if (first && typeof first === "object" && "total_surface_m2" in first) {
      const value = (first as { total_surface_m2?: unknown }).total_surface_m2;
      return typeof value === "number" ? value : 0;
    }
  }

  if (payload && typeof payload === "object" && "total_surface_m2" in payload) {
    const value = (payload as { total_surface_m2?: unknown }).total_surface_m2;
    return typeof value === "number" ? value : 0;
  }

  return 0;
};

const formatValueWithUnit = (value: number, unit?: string | null) => {
  const normalizedUnit = normalizeUnit(unit);
  const formatted = numberFormatter.format(value);
  return normalizedUnit ? `${formatted} ${normalizedUnit}` : formatted;
};

const resolveGoalTitle = (goal: KpiGoal) => goal.title || goal.metric || "Objectif";

const resolveGoalUnit = (goal: KpiGoal) => normalizeUnit(goal.target_unit) || (goal.metric?.includes("surface") ? "m²" : "");

export const KpiGoalsCard = ({ orgId, enabled, className }: KpiGoalsCardProps) => {
  const queriesEnabled = enabled ?? Boolean(orgId);

  const goalsQuery = useQuery<KpiGoal[], Error>({
    queryKey: ["kpi-goals", orgId],
    queryFn: async () => {
      if (!orgId) {
        return [];
      }

      const { data, error } = await supabase
        .from("kpi_goals")
        .select("*")
        .eq("org_id", orgId)
        .eq("is_active", true);

      if (error) throw error;

      return (data as KpiGoal[]) ?? [];
    },
    enabled: queriesEnabled,
  });

  const surfaceQuery = useQuery<number, Error>({
    queryKey: ["kpi-current-month-surface", orgId],
    queryFn: async () => {
      // Return 0 for now - surface calculation can be implemented later
      return 0;
    },
    enabled: queriesEnabled,
  });

  const goals = goalsQuery.data ?? [];
  const surfaceValue = surfaceQuery.data;
  const currentSurface = surfaceValue ?? 0;

  const isAwaitingQueries = !queriesEnabled && Boolean(orgId);
  const isLoading = goalsQuery.isLoading || surfaceQuery.isLoading || isAwaitingQueries;
  const error = goalsQuery.error || surfaceQuery.error;

  const surfaceDescription = useMemo(() => {
    if (!orgId) {
      return "Sélectionnez une organisation pour voir vos objectifs";
    }

    if (isLoading) {
      return null;
    }

    if (surfaceValue == null) {
      return "Mois en cours • Données indisponibles";
    }

    return `Mois en cours • ${formatValueWithUnit(currentSurface, "m²")} posés`;
  }, [orgId, isLoading, currentSurface, surfaceValue]);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Objectifs KPI</CardTitle>
        <CardDescription>
          {isLoading ? <Skeleton className="h-4 w-40" /> : surfaceDescription}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-destructive">
            Impossible de charger les objectifs : {error.message}
          </p>
        ) : isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        ) : goals.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun objectif actif pour le moment.
          </p>
        ) : (
          <div className="space-y-6">
            {goals.map((goal) => {
              const targetValue = goal.target_value ?? 0;
              const currentValue = (() => {
                if (goal.metric && goal.metric.includes("surface")) {
                  return currentSurface;
                }

                return 0;
              })();

              const rawProgress = targetValue > 0 ? (currentValue / targetValue) * 100 : 0;
              const clampedProgress = Math.min(Math.max(rawProgress, 0), 100);
              const isOverTarget = rawProgress >= 100;
              const progressLabel = `${percentageFormatter.format(Math.max(rawProgress, 0))}% atteint`;

              return (
                <div key={goal.id} className="space-y-2">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-foreground">{resolveGoalTitle(goal)}</p>
                      {goal.description ? (
                        <p className="text-xs text-muted-foreground">{goal.description}</p>
                      ) : null}
                    </div>
                    <div
                      className={cn(
                        "text-sm font-semibold",
                        isOverTarget ? "text-emerald-600" : "text-foreground"
                      )}
                    >
                      {formatValueWithUnit(currentValue, resolveGoalUnit(goal))} / {formatValueWithUnit(targetValue, resolveGoalUnit(goal))}
                    </div>
                  </div>
                  <Progress
                    value={clampedProgress}
                    className={cn(
                      "h-2",
                      isOverTarget ? "bg-emerald-100 [&>*]:bg-emerald-500" : "bg-secondary"
                    )}
                  />
                  <p
                    className={cn(
                      "text-xs font-medium",
                      isOverTarget ? "text-emerald-600" : "text-muted-foreground"
                    )}
                  >
                    {isOverTarget ? "Objectif dépassé" : progressLabel}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default KpiGoalsCard;
