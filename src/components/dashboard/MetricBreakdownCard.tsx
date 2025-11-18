import { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SparklineChart } from "./SparklineChart";
import { cn } from "@/lib/utils";

interface Metric {
  label: string;
  value: number;
  type?: "percentage" | "count";
  color?: string;
}

interface MetricBreakdownCardProps {
  title: string;
  icon: LucideIcon;
  metrics: Metric[];
  aggregateValue: number;
  aggregateUnit?: string;
  aggregateLabel?: string;
  chartData?: number[];
  className?: string;
}

export function MetricBreakdownCard({
  title,
  icon: Icon,
  metrics,
  aggregateValue,
  aggregateUnit = "%",
  aggregateLabel,
  chartData = [],
  className,
}: MetricBreakdownCardProps) {
  return (
    <Card className={cn("hover:shadow-lg transition-all duration-300 border-border/60", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Aggregate Value */}
        <div className="space-y-1">
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-foreground">{aggregateValue}</span>
            <span className="text-xl text-muted-foreground">{aggregateUnit}</span>
          </div>
          {aggregateLabel && (
            <p className="text-xs text-muted-foreground">{aggregateLabel}</p>
          )}
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 py-3 border-y border-border/40">
          {metrics.map((metric, index) => (
            <div key={index} className="space-y-1">
              <p className="text-xs text-muted-foreground">{metric.label}</p>
              <p className={cn("text-lg font-semibold", metric.color || "text-foreground")}>
                {metric.value}
                {metric.type === "percentage" && "%"}
              </p>
            </div>
          ))}
        </div>

        {/* Chart */}
        {chartData.length > 0 && (
          <div className="space-y-2">
            <div className="h-16">
              <SparklineChart data={chartData} height={64} />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>30 jours</span>
              <span>Aujourd'hui</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
