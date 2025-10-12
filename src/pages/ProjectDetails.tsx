import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { getStatusColor, getStatusLabel } from "@/lib/projects";
import {
  ArrowLeft,
  Calendar,
  Euro,
  Hammer,
  MapPin,
  Phone,
  UserRound,
  HandCoins
} from "lucide-react";

type Project = Tables<"projects">;
type ProjectProduct = Tables<"project_products"> & {
  product: Pick<Tables<"product_catalog">, "code" | "name"> | null;
};

type ProjectWithRelations = Project & {
  project_products: ProjectProduct[];
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);

const ProjectDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const {
    data: project,
    isLoading,
    error
  } = useQuery<ProjectWithRelations | null>({
    queryKey: ["project", id, user?.id],
    queryFn: async () => {
      if (!id || !user?.id) return null;

      const { data, error } = await supabase
        .from("projects")
        .select(
          "*, project_products(id, quantity, product:product_catalog(code, name))"
        )
        .eq("user_id", user.id)
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      return (data as ProjectWithRelations | null) ?? null;
    },
    enabled: !!id && !!user?.id,
  });

  const productCodes = useMemo(() => {
    if (!project?.project_products) return [] as string[];

    return project.project_products
      .map((item) => item.product?.code)
      .filter((code): code is string => Boolean(code));
  }, [project?.project_products]);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">Chargement du projet...</p>
        </div>
      </Layout>
    );
  }

  if (!project || error) {
    return (
      <Layout>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>
            <h1 className="text-2xl font-semibold">Projet introuvable</h1>
          </div>
          <Card className="shadow-card bg-gradient-card border-0">
            <CardContent className="py-10 text-center text-muted-foreground">
              Le projet que vous recherchez n'existe pas ou a été supprimé.
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const handleCreateSite = () => {
    navigate("/sites", { state: { createSite: { projectId: project.id } } });
    toast({
      title: "Création de chantier",
      description: `Nouveau chantier initialisé pour ${project.project_ref}.`
    });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={() => navigate(-1)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour
              </Button>
              <Badge className={getStatusColor(project.status)}>
                {getStatusLabel(project.status)}
              </Badge>
            </div>
            <h1 className="mt-2 text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              {project.project_ref}
            </h1>
            <p className="text-muted-foreground">
              {productCodes.length > 0 ? productCodes.join(", ") : "Aucun code produit"} – {project.city} (
              {project.postal_code})
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={handleCreateSite}>
              <Hammer className="w-4 h-4 mr-2" />
              Créer un chantier
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card className="shadow-card bg-gradient-card border-0 xl:col-span-2">
            <CardHeader>
              <CardTitle>Informations générales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Client</p>
                  <p className="font-medium flex items-center gap-2">
                    <UserRound className="w-4 h-4 text-primary" />
                    {project.client_name}
                  </p>
                  {project.company && (
                    <p className="text-sm text-muted-foreground">{project.company}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Téléphone</p>
                  <p className="font-medium flex items-center gap-2">
                    <Phone className="w-4 h-4 text-primary" />
                    {project.phone ?? "Non renseigné"}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Adresse</p>
                  <p className="font-medium flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    {project.city} ({project.postal_code})
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Montant estimé</p>
                  <p className="font-medium flex items-center gap-2">
                    <Euro className="w-4 h-4 text-primary" />
                    {typeof project.estimated_value === "number"
                      ? formatCurrency(project.estimated_value)
                      : "N/A"}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Assigné à</p>
                  <p className="font-medium">{project.assigned_to}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Prime CEE</p>
                  <p className="font-medium flex items-center gap-2">
                    <HandCoins className="w-4 h-4 text-emerald-600" />
                    {typeof project.prime_cee === "number"
                      ? formatCurrency(project.prime_cee)
                      : "N/A"}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Créé le</p>
                  <p className="font-medium">
                    {new Date(project.created_at).toLocaleDateString("fr-FR")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card bg-gradient-card border-0">
            <CardHeader>
              <CardTitle>Planning</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <span className="text-muted-foreground">Début prévu:</span>
                <span className="font-medium">
                  {project.date_debut_prevue
                    ? new Date(project.date_debut_prevue).toLocaleDateString("fr-FR")
                    : "Non défini"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <span className="text-muted-foreground">Fin prévue:</span>
                <span className="font-medium">
                  {project.date_fin_prevue
                    ? new Date(project.date_fin_prevue).toLocaleDateString("fr-FR")
                    : "Non définie"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default ProjectDetails;
