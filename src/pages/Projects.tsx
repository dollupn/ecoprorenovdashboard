import { useEffect, useMemo, useState } from "react";
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
import type { Tables } from "@/integrations/supabase/types";
import {
  getProjectStatusBadgeStyle,
  type ProjectStatusSetting,
} from "@/lib/projects";
import {
  Search,
  Filter,
  Calendar,
  MapPin,
  Euro,
  FileText,
  Eye,
  Phone,
  Hammer,
  HandCoins,
  Mail,
} from "lucide-react";
import { useOrg } from "@/features/organizations/OrgContext";
import { useMembers } from "@/features/members/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getDynamicFieldEntries,
  formatDynamicFieldValue,
} from "@/lib/product-params";
import { useProjectStatuses } from "@/hooks/useProjectStatuses";

type Project = Tables<"projects">;
type ProjectProduct = Tables<"project_products"> & {
  product: Pick<Tables<"product_catalog">, "code" | "name" | "params_schema"> | null;
};

type ProjectWithRelations = Project & {
  project_products: ProjectProduct[];
  lead?: Pick<Tables<"leads">, "email"> | null;
};

// Show all products except those whose code starts with "ECO"
const getDisplayedProducts = (projectProducts?: ProjectProduct[]) =>
  (projectProducts ?? []).filter((item) => {
    const code = (item.product?.code ?? "").toUpperCase();
    return !code.startsWith("ECO");
  });

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);

const Projects = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentOrgId } = useOrg();
  const { data: members = [], isLoading: membersLoading } = useMembers(currentOrgId);
  const projectStatuses = useProjectStatuses();
  const [searchTerm, setSearchTerm] = useState("");
  const [assignedFilter, setAssignedFilter] = useState<string>("all");
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [quoteInitialValues, setQuoteInitialValues] =
    useState<Partial<QuoteFormValues>>({});

  const currentMember = members.find((member) => member.user_id === user?.id);
  const isAdmin = currentMember?.role === "admin" || currentMember?.role === "owner";

  const { data: projects = [], isLoading, refetch } = useQuery<ProjectWithRelations[]>({
    queryKey: ["projects", user?.id, currentOrgId, isAdmin],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from("projects")
        .select(
          "*, lead:leads(email), project_products(id, quantity, dynamic_params, product:product_catalog(code, name, params_schema))"
        )
        .order("created_at", { ascending: false });

      if (currentOrgId) {
        query = query.eq("org_id", currentOrgId);
      }

      if (!isAdmin) {
        query = query.eq("user_id", user.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data ?? []) as ProjectWithRelations[];
    },
    enabled: !!user && (!currentOrgId || !membersLoading),
  });

  const assignedOptions = useMemo(() => {
    const unique = new Set<string>();
    projects.forEach((project) => {
      if (project.assigned_to) {
        unique.add(project.assigned_to);
      }
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [projects]);

  useEffect(() => {
    if (assignedFilter !== "all" && !assignedOptions.includes(assignedFilter)) {
      setAssignedFilter("all");
    }
  }, [assignedFilter, assignedOptions]);

  const statusMap = useMemo(() => {
    return projectStatuses.reduce<Record<string, ProjectStatusSetting>>((acc, status) => {
      acc[status.value] = status;
      return acc;
    }, {});
  }, [projectStatuses]);

  const filteredProjects = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    let base = projects;

    if (assignedFilter !== "all") {
      base = base.filter((project) => project.assigned_to === assignedFilter);
    }

    if (!normalizedSearch) {
      return base;
    }

    return base.filter((project) => {
      const displayedProducts = getDisplayedProducts(project.project_products);

      const productCodes = displayedProducts
        .map((item) => item.product?.code ?? "")
        .join(" ");

      const dynamicValues = displayedProducts
        .flatMap((item) =>
          getDynamicFieldEntries(
            item.product?.params_schema ?? null,
            item.dynamic_params
          ).map((entry) => entry.value?.toString().toLowerCase())
        )
        .join(" ");

      const searchable = [
        project.project_ref,
        project.client_name,
        project.company ?? "",
        project.siren ?? "",
        project.city,
        project.postal_code,
        productCodes,
        project.assigned_to,
        project.lead?.email ?? "",
        dynamicValues,
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(normalizedSearch);
    });
  }, [searchTerm, projects, assignedFilter]);

  const handleViewProject = (projectId: string) => {
    navigate(`/projects/${projectId}`);
  };

  const handleCreateQuote = (project: ProjectWithRelations) => {
    const displayedProducts = getDisplayedProducts(project.project_products);
    const firstProduct = displayedProducts[0]?.product ?? project.project_products?.[0]?.product;

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
      client_phone: project.phone ?? "",
      site_address: "", // Will be derived from city/postal_code if needed
      site_city: project.city ?? "",
      site_postal_code: project.postal_code ?? "",
    });
    setQuoteDialogOpen(true);
  };

  const handleCreateSite = (project: Project) => {
    navigate(`/sites`, { state: { createSite: { projectId: project.id } } });
  };

  if (isLoading || membersLoading) {
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
            <div className="flex flex-col xl:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par référence, client, SIREN, ville..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
              <div className="flex flex-col md:flex-row gap-4">
                <Select
                  value={assignedFilter}
                  onValueChange={(value) => setAssignedFilter(value)}
                >
                  <SelectTrigger className="md:w-[220px]">
                    <SelectValue placeholder="Toutes les assignations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les assignations</SelectItem>
                    {assignedOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline">
                  <Filter className="w-4 h-4 mr-2" />
                  Filtres
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredProjects.map((project) => {
            const displayedProducts = getDisplayedProducts(project.project_products);
            const statusConfig = statusMap[project.status ?? ""];
            const badgeStyle = getProjectStatusBadgeStyle(statusConfig?.color);
            const statusLabel = statusConfig?.label ?? project.status ?? "Statut";
            const projectEmail =
              (project as Project & { email?: string | null; client_email?: string | null }).email ??
              (project as Project & { email?: string | null; client_email?: string | null }).client_email ??
              project.lead?.email ??
              null;

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
                          {project.siren && (
                            <span className="block text-xs text-muted-foreground/80">
                              SIREN : {project.siren}
                            </span>
                          )}
                        </span>
                        {project.phone && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground/80">
                            <Phone className="w-3.5 h-3.5" />
                            {project.phone}
                          </span>
                        )}
                        {projectEmail && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground/80">
                            <Mail className="w-3.5 h-3.5" />
                            {projectEmail}
                          </span>
                        )}
                      </p>
                    </div>
                    <Badge variant="outline" style={badgeStyle}>
                      {statusLabel}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Product & Location */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {displayedProducts.length ? (
                        displayedProducts.map((item, index) => (
                          <Badge
                            key={`${project.id}-${item.product?.code}-${index}`}
                            variant="secondary"
                            className="text-xs font-medium"
                          >
                            {item.product?.code}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          Aucun produit à afficher
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      {project.city} ({project.postal_code})
                    </div>

                    {displayedProducts.map((item, index) => {
                      const dynamicFields = getDynamicFieldEntries(
                        item.product?.params_schema ?? null,
                        item.dynamic_params
                      );

                      if (!dynamicFields.length) {
                        return null;
                      }

                      return (
                        <div
                          key={`${project.id}-dynamic-${index}`}
                          className="space-y-1 text-xs text-muted-foreground"
                        >
                          {dynamicFields.map((field) => (
                            <div
                              key={`${project.id}-${item.product?.code}-${field.label}`}
                              className="flex items-center justify-between gap-2"
                            >
                              <span>{field.label}</span>
                              <span className="font-medium text-foreground">
                                {String(formatDynamicFieldValue(field))}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    })}
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
                          {new Date(project.date_debut_prevue).toLocaleDateString("fr-FR")}
                        </span>
                      </div>
                      {project.date_fin_prevue && (
                        <div className="flex items-center gap-2 text-sm ml-6">
                          <span className="text-muted-foreground">Fin prévue:</span>
                          <span className="font-medium">
                            {new Date(project.date_fin_prevue).toLocaleDateString("fr-FR")}
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
