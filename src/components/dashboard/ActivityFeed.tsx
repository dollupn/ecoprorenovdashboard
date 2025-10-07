import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, User, FileText, Euro, Building } from "lucide-react";

interface Activity {
  id: string;
  type: "lead" | "project" | "quote" | "invoice" | "site";
  title: string;
  description: string;
  time: string;
  user: string;
  status?: string;
}

const mockActivities: Activity[] = [
  {
    id: "1",
    type: "lead",
    title: "Nouveau lead reçu",
    description: "Marie Dupont - Isolation combles à Paris 15e",
    time: "il y a 2h",
    user: "System",
    status: "Nouveau"
  },
  {
    id: "2",
    type: "quote",
    title: "Devis envoyé",
    description: "Devis DV-2024-0156 - Pompe à chaleur M. Martin",
    time: "il y a 4h",
    user: "Jean Commercial",
    status: "SENT"
  },
  {
    id: "3",
    type: "project",
    title: "Projet accepté",
    description: "PRJ-2024-0089 - Isolation façade Mme Bernard",
    time: "il y a 6h",
    user: "Sophie Commercial",
    status: "ACCEPTED"
  },
  {
    id: "4",
    type: "invoice",
    title: "Paiement reçu",
    description: "Facture F-2024-0134 - 15 500€ TTC",
    time: "hier",
    user: "System",
    status: "PAID"
  },
  {
    id: "5",
    type: "site",
    title: "Chantier terminé",
    description: "Site ST-2024-0045 - Installation photovoltaïque",
    time: "il y a 2 jours",
    user: "Marc Technicien",
    status: "COMPLETED"
  }
];

const getActivityIcon = (type: Activity["type"]) => {
  switch (type) {
    case "lead": return User;
    case "project": return Building;
    case "quote": return FileText;
    case "invoice": return Euro;
    case "site": return Building;
  }
};

const getStatusColor = (status?: string) => {
  switch (status) {
    case "Nouveau": return "bg-blue-500/10 text-blue-700 border-blue-200";
    case "SENT": return "bg-orange-500/10 text-orange-700 border-orange-200";
    case "ACCEPTED": return "bg-green-500/10 text-green-700 border-green-200";
    case "PAID": return "bg-green-500/10 text-green-700 border-green-200";
    case "COMPLETED": return "bg-primary/10 text-primary border-primary/20";
    default: return "bg-muted text-muted-foreground";
  }
};

export function ActivityFeed() {
  return (
    <Card className="shadow-card bg-gradient-card border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          Activité Récente
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {mockActivities.map((activity) => {
          const IconComponent = getActivityIcon(activity.type);
          
          return (
            <div key={activity.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0">
                <IconComponent className="w-4 h-4 text-primary" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-medium text-foreground truncate">
                    {activity.title}
                  </h4>
                  {activity.status && (
                    <Badge variant="secondary" className={getStatusColor(activity.status)}>
                      {activity.status}
                    </Badge>
                  )}
                </div>
                
                <p className="text-sm text-muted-foreground mb-1">
                  {activity.description}
                </p>
                
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{activity.time}</span>
                  <span>•</span>
                  <span>{activity.user}</span>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}