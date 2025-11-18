import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Euro, FileText, Loader2, User, Building2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useActivityFeed, ActivityItem } from "@/hooks/useDashboardData";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface ActivityFeedProps {
  orgId: string | null;
  enabled?: boolean;
}

// 🔹 Type → Icône
const getActivityIcon = (type: ActivityItem["type"]) => {
  switch (type) {
    case "lead":
      return User;
    case "project":
      return Building2;
    case "quote":
      return FileText;
    case "invoice":
      return Euro;
    case "site":
    default:
      return Building2;
  }
};

// 🔹 Format du temps relatif (FR)
const formatRelativeTime = (date: string) => {
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true, locale: fr })
      .replace("environ ", "")
      .replace("moins d'", "moins d' ");
  } catch (error) {
    return "À l'instant";
  }
};

// 🔹 Couleurs de badges selon statut
const getStatusBadgeClasses = (status?: string | null) => {
  if (!status) return "bg-muted text-muted-foreground";

  switch (status.toLowerCase()) {
    case "nouveau":
      return "bg-blue-500/10 text-blue-300 border-blue-400/40";
    case "qualifié":
      return "bg-purple-500/10 text-purple-300 border-purple-400/40";
    case "converti":
      return "bg-green-500/10 text-green-300 border-green-400/40";
    case "perdu":
      return "bg-red-500/10 text-red-300 border-red-400/40";
    case "clôturé":
      return "bg-primary/10 text-primary border-primary/30";
    case "sent":
      return "bg-orange-500/10 text-orange-300 border-orange-400/40";
    case "accepted":
      return "bg-green-500/10 text-green-300 border-green-400/40";
    case "paid":
      return "bg-emerald-500/10 text-emerald-300 border-emerald-400/40";
    case "completed":
      return "bg-primary/10 text-primary border-primary/30";
    default:
      return "bg-muted text-muted-foreground";
  }
};

export function ActivityFeed({ orgId, enabled = true }: ActivityFeedProps) {
  const { data, isLoading, error, isFetching } = useActivityFeed(orgId, { enabled });

  return (
    <Card className="shadow-card bg-gradient-card border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          Activité Récente
          {isFetching && !isLoading && (
            <Loader2 className="w-4 h-4 text-muted-foreground animate-spin ml-2" />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex items-start gap-3 p-3 rounded-lg">
              <Skeleton className="w-8 h-8 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))
        ) : error ? (
          <p className="text-sm text-destructive">Impossible de charger l'activité récente.</p>
        ) : data && data.length > 0 ? (
          data.map((activity) => {
            const Icon = getActivityIcon(activity.type);
            const timeAgo = formatRelativeTime(activity.date);

            return (
              <div
                key={activity.id}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h4 className="text-sm font-medium text-foreground truncate flex-1 min-w-0">
                      {activity.title}
                    </h4>
                    {activity.status && (
                      <Badge
                        variant="secondary"
                        className={`${getStatusBadgeClasses(activity.status)} md:ml-auto`}
                      >
                        {activity.status}
                      </Badge>
                    )}
                  </div>

                  <p className="text-sm text-muted-foreground mb-1 truncate">
                    {activity.description}
                  </p>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{timeAgo}</span>
                    {activity.client && (
                      <>
                        <span>•</span>
                        <span>{activity.client}</span>
                      </>
                    )}
                    {activity.city && (
                      <>
                        <span>•</span>
                        <span>{activity.city}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-sm text-muted-foreground p-6 text-center bg-background/40 rounded-lg">
            <p className="font-medium text-foreground mb-1">Aucune activité récente</p>
            <p>Vos interactions apparaîtront ici dès qu'elles seront disponibles.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
