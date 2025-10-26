import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { getProjectClientName, getProjectStatusBadgeStyle } from "@/lib/projects";
import {
  ArrowLeft,
  Calendar,
  Euro,
  Hammer,
  MapPin,
  Phone,
  UserRound,
  HandCoins,
  Building2,
  FileText,
  Trash2,
  Mail,
} from "lucide-react";
import { useOrg } from "@/features/organizations/OrgContext";
import { useMembers } from "@/features/members/api";
import {
  AddQuoteDialog,
  type QuoteFormValues,
} from "@/components/quotes/AddQuoteDialog";
import {
  getDynamicFieldEntries,
  formatDynamicFieldValue,
} from "@/lib/product-params";
import { useProjectStatuses } from "@/hooks/useProjectStatuses";
import { useOrganizationPrimeSettings } from "@/features/organizations/useOrganizationPrimeSettings";
import {
  computePrimeCee,
  type PrimeCeeComputation,
  type PrimeCeeProductResult,
  type PrimeCeeProductCatalogEntry,
  type PrimeProductInput,
} from "@/lib/prime-cee-unified";

type Project = Tables<"projects">;
type ProductSummary = Pick<
  Tables<"product_catalog">,
  "id" | "code" | "name" | "category" | "params_schema" | "is_active" | "default_params"
> & {
  kwh_cumac_values?: Pick<Tables<"product_kwh_cumac">, "id" | "building_type" | "kwh_cumac">[];
};

type ProjectProduct = Pick<
  Tables<"project_products">,
  "id" | "product_id" | "quantity" | "dynamic_params"
> & {
  product: ProductSummary | null;
};

type DelegateSummary = Pick<Tables<"delegates">, "id" | "name" | "price_eur_per_mwh">;

type ProjectWithRelations = Project & {
  project_products: ProjectProduct[];
  delegate?: DelegateSummary | null;
};

const getDisplayedProducts = (projectProducts?: ProjectProduct[]) =>
  (projectProducts ?? []).filter((item) => {
    const code = (item.product?.code ?? "").toUpperCase();
    // Hide ECO* helper/edge products from display & counts
    return !code.startsWith("ECO");
  });

const currencyFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const decimalFormatter = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const formatCurrency = (value: number) => currencyFormatter.format(value);
const formatDecimal = (value: number) => decimalFormatter.format(value);

const ProjectDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { currentOrgId } = useOrg();
  const { data: members = [], isLoading: membersLoading } = useMembers(currentOrgId);
  const projectStatuses = useProjectStatuses();
  const { primeBonification } = useOrganizationPrimeSettings();

  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [quoteInitialValues, setQuoteInitialValues] = useState<Partial<QuoteFormValues>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const currentMember = members.find((member) => member.user_id === user?.id);
  const isAdmin = currentMember?.role === "admin" || currentMember?.role === "owner";

  const {
    data: project,
    isLoading,
    error,
  } = useQuery<ProjectWithRelations | null>({
    queryKey: ["project", id, user?.id, currentOrgId, isAdmin],
    queryFn: async () => {
      if (!id || !user?.id) return null;

      let query = supabase
        .from("projects")
        .select(
          "*, delegate:delegates(id, name, price_eur_per_mwh), project_products(id, product_id, quantity, dynamic_params, product:product_catalog(id, code, name, category, params_schema, kwh_cumac_values:product_kwh_cumac(id, building_type, kwh_cumac)))"
        )
        .eq("id", id);

      if (currentOrgId) {
        query = query.eq("org_id", currentOrgId);
      }

      if (!isAdmin) {
        query = query.eq("user_id", user.id);
      }

      const { data, error } = await query.maybeSingle();

      if (error) throw error;
      return (data as ProjectWithRelations | null) ?? null;
    },
    enabled: !!id && !!user?.id && (!currentOrgId || !membersLoading),
  });

  const productCodes = useMemo(() => {
    if (!project?.project_products) return [] as string[];
    return getDisplayedProducts(project.project_products)
      .map((item) => item.product?.code)
      .filter((code): code is string => Boolean(code));
  }, [project?.project_products]);

  const projectProducts = useMemo(
    () => getDisplayedProducts(project?.project_products),
    [project?.project_products]
  );

  const valorisationResult = useMemo<PrimeCeeComputation | null>(() => {
    if (!project) return null;

    const projectProductsInput = project.project_products.reduce<PrimeProductInput[]>((acc, pp) => {
      acc.push({
        id: pp.id,
        product_id: pp.product_id,
        quantity: pp.quantity,
        dynamic_params: (pp.dynamic_params as Record<string, unknown>) ?? {},
      });
      return acc;
    }, []);

    const productMap = project.project_products.reduce<Record<string, PrimeCeeProductCatalogEntry>>((acc, pp) => {
      if (pp.product) {
        acc[pp.product_id] = pp.product;
      }
      return acc;
    }, {});

    return computePrimeCee({
      products: projectProductsInput,
      productMap,
      buildingType: project.building_type,
      delegate: project.delegate,
      primeBonification,
    });
  }, [project, primeBonification]);

  const valorisationProductMap = useMemo(() => {
    if (!valorisationResult) return {} as Record<string, PrimeCeeProductResult>;

    return valorisationResult.products.reduce<Record<string, PrimeCeeProductResult>>((acc, item) => {
      acc[item.projectProductId] = item;
      return acc;
    }, {});
  }, [valorisationResult]);

  const valorisationEntries = useMemo(() => {
    return projectProducts
      .map((item) => (item.id ? valorisationProductMap[item.id] : undefined))
      .filter(
        (entry): entry is PrimeCeeProductResult =>
          Boolean(entry && entry.valorisationPerUnitEur && entry.valorisationPerUnitEur > 0),
      );
  }, [projectProducts, valorisationProductMap]);

  if (isLoading || membersLoading) {
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

  const statusConfig = projectStatuses.find((status) => status.value === project.status);
  const badgeStyle = getProjectStatusBadgeStyle(statusConfig?.color);
  const statusLabel = statusConfig?.label ?? project.status ?? "Statut";

  const handleCreateSite = () => {
    navigate("/sites", { state: { createSite: { projectId: project.id } } });
    toast({
      title: "Création de chantier",
      description: `Nouveau chantier initialisé pour ${project.project_ref}.`,
    });
  };

  const handleOpenQuote = () => {
    const displayedProducts = getDisplayedProducts(project.project_products);
    const firstProduct =
      displayedProducts[0]?.product ?? project.project_products?.[0]?.product;

    const clientName = getProjectClientName(project);

    setQuoteInitialValues({
      client_name: clientName,
      project_id: project.id,
      product_name:
        firstProduct?.name ||
        firstProduct?.code ||
        (project as Project & { product_name?: string }).product_name ||
        "",
      amount: project.estimated_value ?? undefined,
      quote_ref: project.project_ref ? `${project.project_ref}-DEV` : undefined,
    });
    setQuoteDialogOpen(true);
  };

  const handleDeleteProject = async () => {
    if (!project) return;

    try {
      const projectLabel = project.project_ref || "ce projet";
      setIsDeleting(true);
      let query = supabase.from("projects").delete().eq("id", project.id);

      if (currentOrgId) {
        query = query.eq("org_id", currentOrgId);
      }

      const { error: deleteError } = await query;

      if (deleteError) {
        throw deleteError;
      }

      setDeleteDialogOpen(false);
      toast({
        title: "Projet supprimé",
        description: `${projectLabel} a été supprimé avec succès.`,
      });
      navigate("/projects");
    } catch (deleteError) {
      const errorMessage =
        deleteError instanceof Error
          ? deleteError.message
          : "Une erreur est survenue lors de la suppression.";
      toast({
        title: "Erreur lors de la suppression",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const projectCostValue = project?.estimated_value ?? null;
  const projectEmail = (project as Project & { email?: string })?.email ?? null;

  const displayedPrimeValue =
    typeof project?.prime_cee === "number"
      ? project.prime_cee
      : valorisationResult?.totalPrime ?? null;

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
              <Badge variant="outline" style={badgeStyle}>
                {statusLabel}
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
            <Button variant="outline" onClick={handleOpenQuote}>
              <FileText className="w-4 h-4 mr-2" />
              Générer un devis
            </Button>
            <Button variant="secondary" onClick={handleCreateSite}>
              <Hammer className="w-4 h-4 mr-2" />
              Créer un chantier
            </Button>
            {(isAdmin || project.user_id === user?.id) && (
              <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Supprimer le projet
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Supprimer le projet ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Cette action est irréversible. Le projet {project.project_ref || "sélectionné"} sera définitivement supprimé.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteProject} disabled={isDeleting}>
                      {isDeleting ? "Suppression..." : "Confirmer"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Card className="shadow-card bg-gradient-card border-0 xl:col-span-2">
            <CardHeader>
              <CardTitle>Informations générales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Client</p>
                  <p className="font-medium flex items-center gap-2">
                    <UserRound className="w-4 h-4 text-primary" />
                    {getProjectClientName(project)}
                  </p>
                  {project.company && (
                    <p className="text-sm text-muted-foreground">{project.company}</p>
                  )}
                  {project.siren && (
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                      SIREN : {project.siren}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Téléphone</p>
                  <p className="font-medium flex items-center gap-2">
                    <Phone className="w-4 h-4 text-primary" />
                    {project.phone ?? "Non renseigné"}
                  </p>
                </div>
                {projectEmail && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium flex items-center gap-2">
                      <Mail className="w-4 h-4 text-primary" />
                      {projectEmail}
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Adresse</p>
                  <p className="font-medium flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    {(project as Project & { address?: string }).address
                      ? [
                          (project as Project & { address?: string }).address,
                          [project.postal_code, project.city].filter(Boolean).join(" "),
                        ]
                          .filter((part) => part && part.toString().trim().length > 0)
                          .join(", ")
                      : `${project.city} (${project.postal_code})`}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Source</p>
                  <p className="font-medium flex items-center gap-2">
                    <UserRound className="w-4 h-4 text-primary" />
                    {project.source && project.source.trim().length > 0
                      ? project.source
                      : "Non renseigné"}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Assigné à</p>
                  <p className="font-medium">{project.assigned_to}</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Type de bâtiment</p>
                  <p className="font-medium flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-primary" />
                    {project.building_type ?? "Non renseigné"}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Usage</p>
                  <p className="font-medium">{project.usage ?? "Non renseigné"}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Surface bâtiment</p>
                  <p className="font-medium">
                    {typeof project.surface_batiment_m2 === "number"
                      ? `${project.surface_batiment_m2} m²`
                      : "Non renseigné"}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Surface isolée</p>
                  <p className="font-medium">
                    {typeof project.surface_isolee_m2 === "number"
                      ? `${project.surface_isolee_m2} m²`
                      : "Non renseigné"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card bg-gradient-card border-0">
            <CardHeader>
              <CardTitle>Finances & planning</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center gap-2">
                <Euro className="w-4 h-4 text-primary" />
                <span className="text-muted-foreground">Coût du chantier:</span>
                <span className="font-medium">
                  {typeof projectCostValue === "number"
                    ? formatCurrency(projectCostValue)
                    : "Non défini"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <HandCoins className="w-4 h-4 text-emerald-600" />
                <span className="text-muted-foreground">Prime CEE:</span>
                <span className="font-medium">
                  {typeof displayedPrimeValue === "number"
                    ? formatCurrency(displayedPrimeValue)
                    : "Non définie"}
                </span>
              </div>
              {valorisationEntries.map((entry) => {
                const valorisationLabel = (entry.valorisationLabel || "Valorisation m²/LED").trim();
                return (
                  <div
                    key={`valorisation-summary-${entry.projectProductId}`}
                    className="flex items-start gap-2"
                  >
                    <HandCoins className="w-4 h-4 text-amber-600 mt-0.5" />
                    <div className="flex flex-col gap-1 text-xs sm:text-sm">
                      <span className="text-muted-foreground">
                        {valorisationLabel}
                        {entry.productCode ? ` (${entry.productCode})` : ""}
                      </span>
                      <span className="font-medium text-emerald-600 text-sm">
                        {formatCurrency(entry.valorisationPerUnitEur ?? 0)} / {entry.multiplierLabel}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {`${formatDecimal(entry.valorisationPerUnitMwh)} MWh × ${entry.multiplierLabel} = ${formatDecimal(
                          entry.valorisationTotalMwh,
                        )} MWh`}
                      </span>
                      <span className="text-xs font-semibold text-amber-600">
                        Prime calculée : {formatCurrency(entry.valorisationTotalEur ?? entry.totalPrime ?? 0)}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center gap-2">
                <UserRound className="w-4 h-4 text-primary" />
                <span className="text-muted-foreground">Délégataire:</span>
                <span className="font-medium flex items-center gap-2">
                  {project.delegate ? (
                    <>
                      {project.delegate.name}
                      {typeof project.delegate.price_eur_per_mwh === "number" ? (
                        <span className="text-xs text-muted-foreground">
                          ({formatCurrency(project.delegate.price_eur_per_mwh)} / MWh)
                        </span>
                      ) : null}
                    </>
                  ) : (
                    "Non défini"
                  )}
                </span>
              </div>
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
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Créé le:</span>
                <span className="font-medium">
                  {new Date(project.created_at).toLocaleDateString("fr-FR")}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-card bg-gradient-card border-0">
          <CardHeader>
            <CardTitle>Produits associés</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {projectProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun produit (hors ECO) n'est associé à ce projet.
              </p>
            ) : (
              projectProducts.map((item) => {
                const dynamicFields = getDynamicFieldEntries(
                  item.product?.params_schema ?? null,
                  item.dynamic_params
                );
                const valorisationEntry = item.id ? valorisationProductMap[item.id] : undefined;

                return (
                  <div
                    key={item.id}
                    className="border border-border/60 rounded-lg p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs font-semibold">
                          {item.product?.code ?? "Code inconnu"}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {item.product?.name ?? "Produit"}
                        </span>
                      </div>
                      {typeof item.quantity === "number" && (
                        <span className="text-sm font-medium">Quantité : {item.quantity}</span>
                      )}
                    </div>
                    {dynamicFields.length > 0 && (
                      <div className="grid gap-2 md:grid-cols-2 text-sm">
                        {dynamicFields.map((field) => (
                          <div
                            key={`${item.id}-${field.label}`}
                            className="flex items-center justify-between gap-2"
                          >
                            <span className="text-muted-foreground">{field.label}</span>
                            <span className="font-medium">
                              {String(formatDynamicFieldValue(field))}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {valorisationEntry?.valorisationPerUnitEur ? (
                      <div className="flex flex-col gap-1 text-sm pt-2 border-t border-border/40">
                        <span className="text-muted-foreground">
                          {(valorisationEntry.valorisationLabel || "Valorisation m²/LED").trim()}
                        </span>
                        <span className="font-medium text-emerald-600 text-right">
                          {formatCurrency(valorisationEntry.valorisationPerUnitEur ?? 0)} / {valorisationEntry.multiplierLabel}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {`${formatDecimal(valorisationEntry.valorisationPerUnitMwh)} MWh × ${valorisationEntry.multiplierLabel} = ${formatDecimal(
                            valorisationEntry.valorisationTotalMwh,
                          )} MWh`}
                        </span>
                        <span className="text-xs font-semibold text-amber-600 text-right">
                          Prime calculée : {formatCurrency(valorisationEntry.valorisationTotalEur ?? valorisationEntry.totalPrime ?? 0)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
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

export default ProjectDetails;
