import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AddProjectDialog } from "@/components/projects/AddProjectDialog";
import { useToast } from "@/components/ui/use-toast";
import { mockProjects, type Project } from "@/data/projects";
import { getStatusColor, getStatusLabel } from "@/lib/projects";
import {
  Search,
  Filter,
  Calendar,
  MapPin,
  Euro,
  FileText,
  Settings,
  Eye,
  Phone,
  Hammer
} from "lucide-react";

const Projects = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredProjects = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (!normalizedSearch) {
      return mockProjects;
    }

    return mockProjects.filter((project) => {
      const searchable = [
        project.project_ref,
        project.client_name,
        project.company ?? "",
        project.city,
        project.postal_code,
        project.product_name,
        project.assigned_to
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalizedSearch);
    });
  }, [searchTerm]);

  const handleViewProject = (projectId: string) => {
    navigate(`/projects/${projectId}`);
  };

  const handleCreateQuote = (project: Project) => {
    toast({
      title: "Création de devis",
      description: `Préparez un devis pour ${project.client_name}.`
    });
  };

  const handleManageProject = (project: Project) => {
    toast({
      title: "Paramètres du projet",
      description: `Accédez aux paramètres de ${project.project_ref}.`
    });
  };

  const handleCreateSite = (project: Project) => {
    navigate(`/sites`, { state: { createSite: { projectId: project.id } } });
  };

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
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
              <Button variant="outline">
                <Filter className="w-4 h-4 mr-2" />
                Filtres
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <Card key={project.id} className="shadow-card bg-gradient-card border border-black/10 transition-all duration-300 hover:shadow-elevated dark:border-white/10">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg font-bold text-primary">
                      {project.project_ref}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1 space-y-1">
                      <span className="block">
                        {project.client_name}
                        {project.company && (
                          <span className="block text-xs">{project.company}</span>
                        )}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground/80">
                        <Phone className="w-3.5 h-3.5" />
                        {project.phone}
                      </span>
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
                <div className="flex gap-2 pt-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleViewProject(project.id)}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Voir
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCreateQuote(project)}
                  >
                    <FileText className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleManageProject(project)}
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => handleCreateSite(project)}
                  >
                    <Hammer className="w-4 h-4 mr-1" />
                    Créer chantier
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredProjects.length === 0 && (
          <Card className="shadow-card bg-gradient-card border border-dashed border-muted">
            <CardContent className="py-10 text-center space-y-2">
              <CardTitle className="text-lg">Aucun projet trouvé</CardTitle>
              <p className="text-muted-foreground">
                Essayez d'élargir votre recherche ou de réinitialiser vos filtres.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default Projects;