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
    <Card className={cn("h-fit", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Objectifs KPI</CardTitle>
        <CardDescription className="text-xs">{surfaceDescription}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-1.5 w-full" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && error && (
          <div className="space-y-2 text-center py-4">
            <p className="text-sm text-muted-foreground">
              Impossible de charger les objectifs
            </p>
            <p className="text-xs text-destructive">{error.message}</p>
          </div>
        )}

        {!isLoading && !error && goals.length === 0 && (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground">
              Aucun objectif KPI configuré
            </p>
          </div>
        )}

        {!isLoading && !error && goals.length > 0 && (
          <div className="max-h-[400px] space-y-3 overflow-y-auto pr-2">
            {goals.map((goal) => {
              const currentValue = goal.metric.includes("surface") ? currentSurface : 0;
              const progressPercent = goal.target_value > 0 
                ? Math.min((currentValue / goal.target_value) * 100, 100) 
                : 0;
              const unit = resolveGoalUnit(goal);

              return (
                <div key={goal.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium truncate">{resolveGoalTitle(goal)}</span>
                    <span className="text-muted-foreground whitespace-nowrap ml-2">
                      {formatValueWithUnit(currentValue, unit)} / {formatValueWithUnit(goal.target_value, unit)}
                    </span>
                  </div>
                  <Progress
                    value={progressPercent}
                    className={cn(
                      "h-1.5",
                      progressPercent >= 100 && "[&>div]:bg-emerald-500",
                      progressPercent >= 75 && progressPercent < 100 && "[&>div]:bg-primary",
                      progressPercent < 75 && "[&>div]:bg-amber-500"
                    )}
                  />
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
