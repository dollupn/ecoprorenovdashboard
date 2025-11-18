import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useMemo } from "react";
import { useRevenueData } from "@/hooks/useDashboardData";

interface RevenueChartProps {
  orgId: string | null;
  enabled?: boolean;
}

const currencyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function RevenueChart({ orgId, enabled = true }: RevenueChartProps) {
  const { data, isLoading, error } = useRevenueData(orgId, { enabled });

  const variation = useMemo(() => {
    if (!data) return 0;
    if (data.previousMonthTotal === 0) {
      return data.currentMonthTotal === 0 ? 0 : 100;
    }
    return ((data.currentMonthTotal - data.previousMonthTotal) / data.previousMonthTotal) * 100;
  }, [data]);

  return (
    <Card className="shadow-card bg-gradient-card border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Chiffre d'Affaires
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-72 w-full" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          </div>
        ) : error ? (
          <div className="h-72 flex items-center justify-center">
            <p className="text-sm text-destructive">Impossible de charger le graphique.</p>
          </div>
        ) : data && data.points.length > 0 && data.hasData ? (
          <>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.points}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-muted-foreground" fontSize={12} />
                  <YAxis
                    className="text-muted-foreground"
                    fontSize={12}
                    tickFormatter={(value) => `${Math.round(value / 1000)}k€`}
                  />
                  <Tooltip
                    formatter={(value: number) => [currencyFormatter.format(value), "CA"]}
                    labelFormatter={(label) => `Mois: ${label}`}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Bar dataKey="total" name="CA Encaissé" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 pt-4 border-t border-border/60">
              <div className="rounded-lg bg-background/40 p-4">
                <p className="text-xs uppercase text-muted-foreground tracking-wide">Mois en cours</p>
                <p className="text-xl font-semibold text-foreground mt-1">
                  {currencyFormatter.format(data.currentMonthTotal)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {variation === 0
                    ? "Stable vs mois précédent"
                    : variation > 0
                      ? `+${variation.toFixed(1)}% vs mois précédent`
                      : `${variation.toFixed(1)}% vs mois précédent`}
                </p>
              </div>
              <div className="rounded-lg bg-background/40 p-4">
                <p className="text-xs uppercase text-muted-foreground tracking-wide">Cette semaine</p>
                <p className="text-xl font-semibold text-foreground mt-1">
                  {currencyFormatter.format(data.currentWeekTotal)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {data.previousWeekTotal === 0
                    ? "Pas de données la semaine passée"
                    : `${((data.currentWeekTotal - data.previousWeekTotal) / data.previousWeekTotal * 100).toFixed(1)}% vs semaine dernière`}
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="h-72 flex flex-col items-center justify-center text-muted-foreground text-sm">
            <p className="font-medium text-foreground mb-1">Aucune facture payée</p>
            <p>Encaissez vos premières factures pour alimenter ce graphique.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
