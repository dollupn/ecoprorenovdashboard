import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkline } from "./Sparkline";
import { ErrorState } from "./ErrorState";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface KPICardAction {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}

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
  sparklineData?: number[];
  onClick?: () => void;
  actions?: KPICardAction[];
  onRetry?: () => void;
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
  sparklineData,
  onClick,
  actions,
  onRetry,
}: KPICardProps) {
  const changeColor = cn(
    "text-xs flex items-center gap-1",
    changeType === "positive" && "text-success",
    changeType === "negative" && "text-destructive",
    changeType === "neutral" && "text-muted-foreground"
  );

  const isClickable = Boolean(onClick);

  const cardContent = (
    <>
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
        {isClickable && !isLoading && !error && (
          <ArrowRight className="absolute top-4 right-4 w-4 h-4 text-muted-foreground/0 group-hover:text-muted-foreground transition-all duration-300" />
        )}
      </CardHeader>

      <CardContent className="relative z-10">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-24" />
            {sparklineData && <Skeleton className="h-10 w-full mt-2" />}
            {change && <Skeleton className="h-3 w-32" />}
            {detailsWhileLoading && (
              <div className="mt-3 text-xs text-muted-foreground">
                {detailsWhileLoading}
              </div>
            )}
          </div>
        ) : error ? (
          <ErrorState 
            title="Erreur de chargement" 
            message={error}
            onRetry={onRetry}
          />
        ) : (
          <>
            <div className="text-3xl font-bold text-foreground mb-1">
              {value}
            </div>
            {sparklineData && sparklineData.length > 0 && (
              <Sparkline data={sparklineData} className="my-2" />
            )}
            {change && <p className={changeColor}>{change}</p>}
            {details && (
              <div className="mt-3 text-xs text-muted-foreground">
                {details}
              </div>
            )}
          </>
        )}
      </CardContent>

      {actions && actions.length > 0 && !isLoading && !error && (
        <TooltipProvider>
          <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 flex gap-1 z-20">
            {actions.map((action) => (
              <Tooltip key={action.label}>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      action.onClick();
                    }}
                  >
                    <action.icon className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>{action.label}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>
      )}
    </>
  );

  if (isClickable) {
    return (
      <Card 
        className={cn(
          "relative overflow-hidden border-0 shadow-card transition-all duration-300 bg-gradient-card group",
          "cursor-pointer hover:shadow-elevated hover:scale-[1.02] hover:-translate-y-1",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        )}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick?.();
          }
        }}
      >
        {cardContent}
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden border-0 shadow-card hover:shadow-elevated transition-all duration-300 bg-gradient-card group">
      {cardContent}
    </Card>
  );
}
