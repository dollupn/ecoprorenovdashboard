import { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SparklineChart } from "./SparklineChart";
import { GaugeChart } from "./GaugeChart";
import { cn } from "@/lib/utils";

interface SubMetric {
  label: string;
  value: string | number;
  color?: string;
}

interface CompactKPICardProps {
  title: string;
  icon: LucideIcon;
  mainValue: string | number;
  mainUnit?: string;
  subMetrics?: SubMetric[];
  sparklineData?: number[];
  variant?: "default" | "gauge" | "chart";
  gaugePercentage?: number;
  className?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
}

export function CompactKPICard({
  title,
  icon: Icon,
  mainValue,
  mainUnit,
  subMetrics = [],
  sparklineData = [],
  variant = "default",
  gaugePercentage,
  className,
  trend,
  trendValue,
}: CompactKPICardProps) {
  return (
    <Card className={cn("hover:shadow-lg transition-all duration-300 border-border/60", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Main Value */}
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-foreground">{mainValue}</span>
          {mainUnit && <span className="text-xl text-muted-foreground">{mainUnit}</span>}
          {trend && trendValue && (
            <span
              className={cn(
                "ml-2 text-xs font-medium",
                trend === "up" && "text-green-500",
                trend === "down" && "text-red-500",
                trend === "neutral" && "text-muted-foreground"
              )}
            >
              {trend === "up" ? "↑" : trend === "down" ? "↓" : "→"} {trendValue}
            </span>
          )}
        </div>

        {/* Gauge Chart */}
        {variant === "gauge" && gaugePercentage !== undefined && (
          <div className="flex justify-center py-2">
            <GaugeChart percentage={gaugePercentage} size={120} />
          </div>
        )}

        {/* Sparkline Chart */}
        {variant === "chart" && sparklineData.length > 0 && (
          <div className="h-16">
            <SparklineChart data={sparklineData} />
          </div>
        )}

        {/* Sub Metrics */}
        {subMetrics.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-border/40">
            {subMetrics.map((metric, index) => (
              <div key={index} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{metric.label}</span>
                <span className={cn("font-medium", metric.color || "text-foreground")}>
                  {metric.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Default Sparkline at bottom */}
        {variant === "default" && sparklineData.length > 0 && (
          <div className="h-12 -mx-2 -mb-2">
            <SparklineChart data={sparklineData} height={48} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
