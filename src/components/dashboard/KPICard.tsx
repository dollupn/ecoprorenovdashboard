import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

interface KPICardProps {
  title: string;
  value?: string | number;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  gradient?: string;
  isLoading?: boolean;
  error?: string;
  badgeLabel?: string;
  details?: ReactNode;
  detailsWhileLoading?: ReactNode;
}

export function KPICard({
  title,
  value,
  change,
  changeType = "neutral",
  icon: Icon,
  gradient = "from-primary to-primary-glow",
  isLoading = false,
  error,
  badgeLabel,
  details,
  detailsWhileLoading,
}: KPICardProps) {
  const changeColor = cn(
    "text-xs flex items-center gap-1",
    changeType === "positive" && "text-success",
    changeType === "negative" && "text-destructive",
    changeType === "neutral" && "text-muted-foreground"
  );

  return (
    <Card className="relative overflow-hidden border-0 shadow-card hover:shadow-elevated transition-all duration-300 bg-gradient-card">
      <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-10`} />

      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0 pb-2 relative z-10">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {badgeLabel && !isLoading && !error && (
            <Badge variant="outline" className="text-xs border-primary/30 text-primary bg-primary/10">
              {badgeLabel}
            </Badge>
          )}
          <div className={`p-2 rounded-lg bg-gradient-to-br ${gradient}`}>
            <Icon className="w-4 h-4 text-white" />
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative z-10">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-24" />
            {change && <Skeleton className="h-3 w-32" />}
            {detailsWhileLoading && (
              <div className="mt-3 text-xs text-muted-foreground">
                {detailsWhileLoading}
              </div>
            )}
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <>
            <div className="text-2xl font-bold text-foreground mb-1">
              {value}
            </div>
            {change && <p className={changeColor}>{change}</p>}
            {details && (
              <div className="mt-3 text-xs text-muted-foreground">
                {details}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
