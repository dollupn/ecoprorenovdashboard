import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { BentoDemo } from "@/components/ui/demo";
import { AddProjectDialog } from "@/components/projects/AddProjectDialog";
import { 
  Search, 
  Filter, 
  Calendar, 
  MapPin,
  Euro,
  FileText,
  Settings,
  Eye
} from "lucide-react";

interface Project {
  id: string;
  project_ref: string;
  client_name: string;
  company?: string;
  product_name: string;
  city: string;
  postal_code: string;
  surface_batiment_m2?: number;
  surface_isolee_m2?: number;
  status: "PROSPECTION" | "ETUDE" | "DEVIS_ENVOYE" | "ACCEPTE" | "A_PLANIFIER" | "EN_COURS" | "LIVRE" | "CLOTURE";
  assigned_to: string;
  date_debut_prevue?: string;
  date_fin_prevue?: string;
  estimated_value?: number;
  created_at: string;
}

const mockProjects: Project[] = [
  {
    id: "1",
    project_ref: "PRJ-2024-0089",
    client_name: "Sophie Bernard",
    company: "Cabinet Bernard",
    product_name: "Isolation Façade",
    city: "Toulouse",
    postal_code: "31000",
    surface_batiment_m2: 200,
    surface_isolee_m2: 150,
    status: "ACCEPTE",
    assigned_to: "Jean Commercial",
    date_debut_prevue: "2024-04-01",
    date_fin_prevue: "2024-04-15",
    estimated_value: 45000,
    created_at: "2024-03-10T09:00:00Z"
  },
  {
    id: "2",
    project_ref: "PRJ-2024-0090",
    client_name: "Marie Dupont",
    product_name: "Pompe à Chaleur",
    city: "Paris",
    postal_code: "75015",
    surface_batiment_m2: 120,
    status: "DEVIS_ENVOYE",
    assigned_to: "Sophie Commercial",
    date_debut_prevue: "2024-04-10",
    estimated_value: 18000,
    created_at: "2024-03-12T14:30:00Z"
  },
  {
    id: "3",
    project_ref: "PRJ-2024-0091",
    client_name: "Jean Martin",
    product_name: "Panneaux Solaires",
    city: "Lyon",
    postal_code: "69003",
    surface_batiment_m2: 85,
    status: "EN_COURS",
    assigned_to: "Marc Technicien",
    date_debut_prevue: "2024-03-20",
    date_fin_prevue: "2024-03-25",
    estimated_value: 25000,
    created_at: "2024-03-08T11:15:00Z"
  }
];

const getStatusLabel = (status: Project["status"]) => {
  const labels = {
    PROSPECTION: "Prospection",
    ETUDE: "Étude",
    DEVIS_ENVOYE: "Devis Envoyé",
    ACCEPTE: "Accepté",
    A_PLANIFIER: "À Planifier",
    EN_COURS: "En Cours",
    LIVRE: "Livré",
    CLOTURE: "Clôturé"
  };
  return labels[status];
};

const getStatusColor = (status: Project["status"]) => {
  const colors = {
    PROSPECTION: "bg-blue-500/10 text-blue-700 border-blue-200",
    ETUDE: "bg-purple-500/10 text-purple-700 border-purple-200",
    DEVIS_ENVOYE: "bg-orange-500/10 text-orange-700 border-orange-200",
    ACCEPTE: "bg-green-500/10 text-green-700 border-green-200",
    A_PLANIFIER: "bg-yellow-500/10 text-yellow-700 border-yellow-200",
    EN_COURS: "bg-primary/10 text-primary border-primary/20",
    LIVRE: "bg-teal-500/10 text-teal-700 border-teal-200",
    CLOTURE: "bg-gray-500/10 text-gray-700 border-gray-200"
  };
  return colors[status];
};

const Projects = () => {
  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Gestion des Projets
            </h1>
            <p className="text-muted-foreground mt-1">
              Suivi et gestion de vos projets de rénovation énergétique
            </p>
          </div>
          <AddProjectDialog />
        </div>

        {/* Filters */}
        <Card className="shadow-card bg-gradient-card border-0">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Rechercher par référence, client, ville..." 
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

        {/* Vue rapide */}
        <section className="rounded-2xl border border-black/10 bg-gradient-card p-6 shadow-card dark:border-white/10">
          <div className="flex flex-col gap-2 pb-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Vue rapide des dossiers</h2>
              <p className="text-sm text-muted-foreground">
                Accédez aux raccourcis clés pour suivre vos projets et coordonner les équipes.
              </p>
            </div>
          </div>
          <BentoDemo />
        </section>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {mockProjects.map((project) => (
            <Card key={project.id} className="shadow-card bg-gradient-card border border-black/10 transition-all duration-300 hover:shadow-elevated dark:border-white/10">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg font-bold text-primary">
                      {project.project_ref}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {project.client_name}
                      {project.company && (
                        <span className="block text-xs">{project.company}</span>
                      )}
                    </p>
                  </div>
                  <Badge className={getStatusColor(project.status)}>
                    {getStatusLabel(project.status)}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Product & Location */}
                <div>
                  <h4 className="font-semibold text-foreground mb-1">
                    {project.product_name}
                  </h4>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    {project.city} ({project.postal_code})
                  </div>
                </div>

                {/* Technical Details */}
                {(project.surface_batiment_m2 || project.surface_isolee_m2) && (
                  <div className="space-y-2">
                    {project.surface_batiment_m2 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Surface bâtiment:</span>
                        <span className="font-medium">{project.surface_batiment_m2} m²</span>
                      </div>
                    )}
                    {project.surface_isolee_m2 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Surface isolée:</span>
                        <span className="font-medium">{project.surface_isolee_m2} m²</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Timeline */}
                {project.date_debut_prevue && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Début:</span>
                      <span className="font-medium">
                        {new Date(project.date_debut_prevue).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                    {project.date_fin_prevue && (
                      <div className="flex items-center gap-2 text-sm ml-6">
                        <span className="text-muted-foreground">Fin prévue:</span>
                        <span className="font-medium">
                          {new Date(project.date_fin_prevue).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Value & Assignment */}
                <div className="pt-2 border-t space-y-2">
                  {project.estimated_value && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Montant estimé:</span>
                      <div className="flex items-center gap-1 text-sm font-bold text-primary">
                        <Euro className="w-4 h-4" />
                        {project.estimated_value.toLocaleString()} €
                      </div>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Assigné à:</span>
                    <span className="font-medium">{project.assigned_to}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => window.open(`/projects/${project.id}`, '_blank')}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Voir
                  </Button>
                  <Button size="sm" variant="outline">
                    <FileText className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="outline">
                    <Settings className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default Projects;