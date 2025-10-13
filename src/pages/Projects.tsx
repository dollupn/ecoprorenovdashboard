import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AddProjectDialog } from "@/components/projects/AddProjectDialog";
import {
  AddQuoteDialog,
  type QuoteFormValues,
} from "@/components/quotes/AddQuoteDialog";
import { useToast } from "@/hooks/use-toast";
import type { Tables } from "@/integrations/supabase/types";
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
  Hammer,
  HandCoins
} from "lucide-react";

type Project = Tables<"projects">;
type ProjectProduct = Tables<"project_products"> & {
  product: Pick<Tables<"product_catalog">, "code" | "name"> | null;
};

type ProjectWithRelations = Project & {
  project_products: ProjectProduct[];
};

const getDisplayedProductCodes = (projectProducts?: ProjectProduct[]) =>
  (projectProducts ?? [])
    .map((item) => item.product?.code?.trim() ?? "")
    .filter((code) => code && code.toUpperCase().startsWith("BAT"));

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);

const Projects = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [quoteInitialValues, setQuoteInitialValues] =
    useState<Partial<QuoteFormValues>>({});

  const { data: projects = [], isLoading, refetch } = useQuery<ProjectWithRelations[]>({
    queryKey: ["projects", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("projects")
        .select(
          "*, project_products(id, quantity, product:product_catalog(code, name))"
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as ProjectWithRelations[];
    },
    enabled: !!user,
  });

  const filteredProjects = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (!normalizedSearch) {
      return projects;
    }

    return projects.filter((project) => {
      const searchable = [
        project.project_ref,
        project.client_name,
        project.company ?? "",
        project.city,
        project.postal_code,
        getDisplayedProductCodes(project.project_products).join(" "),
        project.assigned_to
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalizedSearch);
    });
  }, [searchTerm, projects]);

  const handleViewProject = (projectId: string) => {
    navigate(`/projects/${projectId}`);
  };

  const handleCreateQuote = (project: ProjectWithRelations) => {
    const firstProduct =
      project.project_products?.find((item) =>
        (item.product?.code ?? "").toUpperCase().startsWith("BAT")
      )?.product ?? project.project_products?.[0]?.product;

    setQuoteInitialValues({
      client_name: project.client_name ?? "",
      project_id: project.id,
      product_name:
        firstProduct?.name ||
        firstProduct?.code ||
        (project as Project & { product_name?: string }).product_name ||
        "",
      amount: project.estimated_value ?? undefined,
      quote_ref: project.project_ref
        ? `${project.project_ref}-DEV`
        : undefined,
    });
    setQuoteDialogOpen(true);
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

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">Chargement des projets...</p>
        </div>
      </Layout>
    );
  }

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
          <AddProjectDialog onProjectAdded={() => void refetch()} />
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
          {filteredProjects.map((project) => {
            const displayedProductCodes = getDisplayedProductCodes(
              project.project_products
            );

            return (
              <Card
                key={project.id}
                className="shadow-card bg-gradient-card border border-black/10 transition-all duration-300 hover:shadow-elevated dark:border-white/10"
              >
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
                        {project.phone && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground/80">
                            <Phone className="w-3.5 h-3.5" />
                            {project.phone}
                          </span>
                        )}
                      </p>
                    </div>
                    <Badge className={getStatusColor(project.status as any)}>
                      {getStatusLabel(project.status as any)}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Product & Location */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {displayedProductCodes.length ? (
                        displayedProductCodes.map((code, index) => (
                          <Badge
                            key={`${project.id}-${code}-${index}`}
                            variant="secondary"
                            className="text-xs font-medium"
                          >
                            {code}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Aucun code produit BAT renseigné
                        </span>
                      )}
                    </div>
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
                        {formatCurrency(project.estimated_value)}
                      </div>
                    </div>
                  )}
                  {typeof project.prime_cee === "number" && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Prime CEE:</span>
                      <div className="flex items-center gap-1 text-sm font-bold text-emerald-600">
                        <HandCoins className="w-4 h-4" />
                        {formatCurrency(project.prime_cee)}
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
            );
          })}
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
      <AddQuoteDialog
        open={quoteDialogOpen}
        onOpenChange={(open) => {
          setQuoteDialogOpen(open);
          if (!open) {
            setQuoteInitialValues({});
          }
        }}
        initialValues={quoteInitialValues}
      />
    </Layout>
  );
};

export default Projects;
