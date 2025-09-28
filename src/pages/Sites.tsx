import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  MapPin,
  Euro,
  Users,
  Clock,
  AlertTriangle
} from "lucide-react";

interface Site {
  id: string;
  site_ref: string;
  project_ref: string;
  client_name: string;
  product_name: string;
  address: string;
  city: string;
  postal_code: string;
  status: "PLANIFIE" | "EN_PREPARATION" | "EN_COURS" | "SUSPENDU" | "TERMINE" | "LIVRE";
  team_members: string[];
  date_debut: string;
  date_fin_prevue?: string;
  progress_percentage: number;
  created_at: string;
}

const mockSites: Site[] = [
  {
    id: "1",
    site_ref: "SITE-2024-0034",
    project_ref: "PRJ-2024-0089",
    client_name: "Sophie Bernard",
    product_name: "Isolation Façade",
    address: "45 Avenue de la République",
    city: "Toulouse",
    postal_code: "31000",
    status: "EN_COURS",
    team_members: ["Marc Technicien", "Paul Ouvrier"],
    date_debut: "2024-04-01",
    date_fin_prevue: "2024-04-15",
    progress_percentage: 65,
    created_at: "2024-03-25T10:00:00Z"
  },
  {
    id: "2",
    site_ref: "SITE-2024-0035",
    project_ref: "PRJ-2024-0091",
    client_name: "Jean Martin",
    product_name: "Panneaux Solaires",
    address: "12 Rue de la Paix",
    city: "Lyon",
    postal_code: "69003",
    status: "TERMINE",
    team_members: ["Marc Technicien"],
    date_debut: "2024-03-20",
    date_fin_prevue: "2024-03-25",
    progress_percentage: 100,
    created_at: "2024-03-18T09:30:00Z"
  },
  {
    id: "3",
    site_ref: "SITE-2024-0036",
    project_ref: "PRJ-2024-0087",
    client_name: "Pierre Dubois",
    product_name: "Pompe à Chaleur",
    address: "78 Boulevard Voltaire",
    city: "Paris",
    postal_code: "75011",
    status: "PLANIFIE",
    team_members: ["Sophie Technicien", "Luc Ouvrier"],
    date_debut: "2024-04-20",
    date_fin_prevue: "2024-04-22",
    progress_percentage: 0,
    created_at: "2024-04-10T14:20:00Z"
  }
];

const getStatusLabel = (status: Site["status"]) => {
  const labels = {
    PLANIFIE: "Planifié",
    EN_PREPARATION: "En Préparation", 
    EN_COURS: "En Cours",
    SUSPENDU: "Suspendu",
    TERMINE: "Terminé",
    LIVRE: "Livré"
  };
  return labels[status];
};

const getStatusColor = (status: Site["status"]) => {
  const colors = {
    PLANIFIE: "bg-blue-500/10 text-blue-700 border-blue-200",
    EN_PREPARATION: "bg-orange-500/10 text-orange-700 border-orange-200",
    EN_COURS: "bg-primary/10 text-primary border-primary/20",
    SUSPENDU: "bg-red-500/10 text-red-700 border-red-200",
    TERMINE: "bg-green-500/10 text-green-700 border-green-200",
    LIVRE: "bg-teal-500/10 text-teal-700 border-teal-200"
  };
  return colors[status];
};

const getProgressColor = (percentage: number) => {
  if (percentage === 0) return "bg-gray-200";
  if (percentage < 50) return "bg-orange-500";
  if (percentage < 100) return "bg-primary";
  return "bg-green-500";
};

const Sites = () => {
  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Gestion des Chantiers
            </h1>
            <p className="text-muted-foreground mt-1">
              Suivi en temps réel de vos chantiers de rénovation énergétique
            </p>
          </div>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Nouveau Chantier
          </Button>
        </div>

        {/* Filters */}
        <Card className="shadow-card bg-gradient-card border-0">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Rechercher par référence, client, adresse..." 
                  className="pl-10"
                />
              </div>
              <Button variant="outline">
                <Filter className="w-4 h-4 mr-2" />
                Filtres
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Sites Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {mockSites.map((site) => (
            <Card key={site.id} className="shadow-card bg-gradient-card border-0 hover:shadow-elevated transition-all duration-300">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg font-bold text-primary">
                      {site.site_ref}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Projet: {site.project_ref}
                    </p>
                    <p className="text-sm font-medium">
                      {site.client_name}
                    </p>
                  </div>
                  <Badge className={getStatusColor(site.status)}>
                    {getStatusLabel(site.status)}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Product */}
                <div>
                  <h4 className="font-semibold text-foreground mb-1">
                    {site.product_name}
                  </h4>
                </div>

                {/* Address */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    {site.address}
                  </div>
                  <div className="text-sm text-muted-foreground ml-6">
                    {site.city} ({site.postal_code})
                  </div>
                </div>

                {/* Progress */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Avancement:</span>
                    <span className="font-medium">{site.progress_percentage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(site.progress_percentage)}`}
                      style={{ width: `${site.progress_percentage}%` }}
                    ></div>
                  </div>
                </div>

                {/* Timeline */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Début:</span>
                    <span className="font-medium">
                      {new Date(site.date_debut).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                  {site.date_fin_prevue && (
                    <div className="flex items-center gap-2 text-sm ml-6">
                      <span className="text-muted-foreground">Fin prévue:</span>
                      <span className="font-medium">
                        {new Date(site.date_fin_prevue).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Team */}
                <div className="pt-2 border-t space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Équipe:</span>
                  </div>
                  <div className="flex flex-wrap gap-1 ml-6">
                    {site.team_members.map((member, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {member}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" className="flex-1">
                    <Clock className="w-4 h-4 mr-1" />
                    Planning
                  </Button>
                  {site.status === "EN_COURS" && (
                    <Button size="sm" variant="outline">
                      <AlertTriangle className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default Sites;