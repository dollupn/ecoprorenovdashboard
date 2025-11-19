import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { LineChart, Line, ResponsiveContainer } from "recharts";

export type KPITrend = "up" | "down" | "neutral";

interface CompactKPICardProps {
  label: string;
  value: string;
  unit?: string;
  trendLabel?: string;
  trend?: KPITrend;
  icon: React.ReactNode;
  onClick?: () => void;
  isLoading?: boolean;
  miniChartData?: number[];
}

export function CompactKPICard({
  label,
  value,
  unit,
  trendLabel,
  trend,
  icon,
  onClick,
  isLoading,
  miniChartData,
}: CompactKPICardProps) {
  const TrendIcon = trend === "up" ? ArrowUp : trend === "down" ? ArrowDown : Minus;
  const trendColorClass =
    trend === "up"
      ? "text-emerald-500"
      : trend === "down"
        ? "text-red-500"
        : "text-muted-foreground";

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "p-4 transition-all duration-300",
        onClick && "cursor-pointer hover:-translate-y-0.5 hover:shadow-lg"
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className="space-y-2">
        {/* Header: Label + Icon */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
            {icon}
          </div>
        </div>

        {/* Main Value */}
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-semibold md:text-3xl">{value}</span>
          {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
        </div>

        {/* Mini Sparkline */}
        {miniChartData && miniChartData.length > 0 && (
          <div className="h-5 w-full opacity-50">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={miniChartData.map((v, i) => ({ value: v, index: i }))}>
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  dot={false}
                  animationDuration={300}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Trend Indicator */}
        {trendLabel && (
          <div className={cn("flex items-center gap-1 text-xs", trendColorClass)}>
            <TrendIcon className="h-3 w-3" />
            <span>{trendLabel}</span>
          </div>
        )}
      </div>
    </Card>
  );
}
