import { useCallback, useEffect, useMemo, useState } from "react";
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
import { 
  SiteDialog, 
  type SiteFormValues 
} from "@/components/sites/SiteDialog";
import { toast as showToast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import {
  getProjectClientName,
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
  UserRound,
} from "lucide-react";
import { useOrg } from "@/features/organizations/OrgContext";
import { useMembers } from "@/features/members/api";
import { useToast } from "@/hooks/use-toast";
import type { SiteProjectOption } from "@/components/sites/SiteDialog";
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
  getDynamicFieldNumericValue,
} from "@/lib/product-params";
import { useProjectStatuses } from "@/hooks/useProjectStatuses";
import { useOrganizationPrimeSettings } from "@/features/organizations/useOrganizationPrimeSettings";
import {
  buildPrimeCeeEntries,
  computePrimeCee,
  getValorisationLabel,
  type PrimeCeeComputation,
  type PrimeCeeProductCatalogEntry,
  type PrimeCeeProductDisplayMap,
  type PrimeCeeProductResult,
  type PrimeCeeValorisationEntry,
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

type ProjectWithRelations = Project & {
  project_products: ProjectProduct[];
  lead?: Pick<Tables<"leads">, "email"> | null;
  delegate?: Pick<Tables<"delegates">, "id" | "name" | "price_eur_per_mwh"> | null;
};

// Show all products except those whose code starts with "ECO"
const getDisplayedProducts = (projectProducts?: ProjectProduct[]) =>
  (projectProducts ?? []).filter((item) => {
    const code = (item.product?.code ?? "").toUpperCase();
    return !code.startsWith("ECO");
  });

const currencyFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const decimalFormatter = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const formatCurrency = (value: number) => currencyFormatter.format(value);
const formatDecimal = (value: number) => decimalFormatter.format(value);

const SURFACE_FACTUREE_TARGETS = ["surface_facturee", "surface facturée"] as const;

const buildProjectProductDisplayMap = (
  projectProducts?: ProjectProduct[],
): PrimeCeeProductDisplayMap => {
  return (projectProducts ?? []).reduce<PrimeCeeProductDisplayMap>((acc, item) => {
    const key = item.id ?? item.product_id;
    if (!key) {
      return acc;
    }

    acc[key] = {
      productCode: item.product?.code ?? null,
      productName: item.product?.name ?? null,
    };

    return acc;
  }, {});
};

const Projects = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentOrgId } = useOrg();
  const { data: members = [], isLoading: membersLoading } = useMembers(currentOrgId);
  const projectStatuses = useProjectStatuses();
  const { primeBonification } = useOrganizationPrimeSettings();
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
          "*, delegate:delegates(id, name, price_eur_per_mwh), lead:leads(email), project_products(id, product_id, quantity, dynamic_params, product:product_catalog(id, code, name, category, params_schema, kwh_cumac_values:product_kwh_cumac(id, building_type, kwh_cumac)))"
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

  type ProjectValorisationSummary = {
    computation: PrimeCeeComputation | null;
    totalPrime: number;
    totalValorisationMwh: number;
    delegatePrice: number;
    products: PrimeCeeProductResult[];
  };

  const projectValorisationSummaries = useMemo(() => {
    return projects.reduce<Record<string, ProjectValorisationSummary>>((acc, project) => {
      const projectProducts = project.project_products.reduce<PrimeProductInput[]>((pAcc, pp) => {
        pAcc.push({
          id: pp.id,
          product_id: pp.product_id,
          quantity: pp.quantity,
          dynamic_params: (pp.dynamic_params as Record<string, unknown>) ?? {},
        });
        return pAcc;
      }, []);

      const productMap = project.project_products.reduce<Record<string, PrimeCeeProductCatalogEntry>>((pMap, pp) => {
        if (pp.product) {
          pMap[pp.product_id] = pp.product;
        }
        return pMap;
      }, {});

      const result = computePrimeCee({
        products: projectProducts,
        productMap,
        buildingType: project.building_type,
        delegate: project.delegate,
        primeBonification,
      });

      acc[project.id] = {
        computation: result ?? null,
        totalPrime: result?.totalPrime ?? 0,
        totalValorisationMwh: result?.totalValorisationMwh ?? 0,
        totalValorisationEur: result?.totalValorisationEur ?? 0,
        delegatePrice: result?.delegatePrice ?? 0,
        products: result?.products ?? [],
      };

      return acc;
    }, {});
  }, [projects, primeBonification]);

  const surfaceFactureeByProject = useMemo(() => {
    return projects.reduce<Record<string, number>>((acc, project) => {
      const total = (project.project_products ?? []).reduce((sum, projectProduct) => {
        const product = projectProduct.product;
        if (!product) {
          return sum;
        }

        const surfaceValue = getDynamicFieldNumericValue(
          product.params_schema,
          projectProduct.dynamic_params,
          [...SURFACE_FACTUREE_TARGETS],
        );

        if (typeof surfaceValue === "number" && surfaceValue > 0) {
          return sum + surfaceValue;
        }

        return sum;
      }, 0);

      if (total > 0 && project.id) {
        acc[project.id] = total;
      }

      return acc;
    }, {});
  }, [projects]);

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
      const clientName = getProjectClientName(project);
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
        clientName,
        project.client_first_name ?? "",
        project.client_last_name ?? "",
        project.company ?? "",
        project.siren ?? "",
        project.city,
        project.postal_code,
        productCodes,
        project.assigned_to,
        project.source ?? "",
        project.lead?.email ?? "",
        project.delegate?.name ?? "",
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

  const [siteDialogOpen, setSiteDialogOpen] = useState(false);
  const [siteInitialValues, setSiteInitialValues] = useState<Partial<SiteFormValues>>();

  const handleCreateSite = async (project: ProjectWithRelations) => {
    const clientName = getProjectClientName(project);
    const displayedProducts = getDisplayedProducts(project.project_products);
    const firstProduct = displayedProducts[0]?.product ?? project.project_products?.[0]?.product;
    const productLabel = firstProduct?.code || project.product_name || "";
    const address = (project as Project & { address?: string | null }).address ?? "";

    const valorisationSummary = projectValorisationSummaries[project.id];
    const valorisationEntries = displayedProducts
      .map((item) => (item.id ? valorisationSummary?.productMap[item.id] : undefined))
      .filter(
        (entry): entry is PrimeCeeProductResult =>
          Boolean(entry && entry.valorisationTotalEur && entry.valorisationTotalEur > 0),
      );
    const fallbackValorisation =
      valorisationSummary?.products.find(
        (entry) => typeof entry.valorisationTotalEur === "number" && entry.valorisationTotalEur > 0,
      ) ??
      valorisationSummary?.products.find(
        (entry) => typeof entry.valorisationTotalMwh === "number" && entry.valorisationTotalMwh > 0,
      );
    const selectedValorisation = valorisationEntries[0] ?? fallbackValorisation;
    const valorisationTotalEur = selectedValorisation?.valorisationTotalEur ?? selectedValorisation?.totalPrime ?? 0;
    const valorisationEntries = buildPrimeCeeEntries({
      computation: valorisationSummary?.computation ?? null,
      productMap: buildProjectProductDisplayMap(displayedProducts),
    });
    let fallbackValorisation: PrimeCeeValorisationEntry | undefined;
    if (!valorisationEntries.length) {
      fallbackValorisation = buildPrimeCeeEntries({
        computation: valorisationSummary?.computation ?? null,
        productMap: buildProjectProductDisplayMap(project.project_products),
      }).find((entry) => entry.valorisationTotalMwh > 0);
    }
    const selectedValorisation = valorisationEntries[0] ?? fallbackValorisation;
    const valorisationMwh = selectedValorisation?.valorisationTotalMwh ?? 0;
    const valorisationBase = selectedValorisation?.valorisationPerUnitEur ?? 0;
    const surfaceFacturee = surfaceFactureeByProject[project.id] ?? 0;

    // Generate unique site ref
    const today = new Date();
    const datePrefix = `SITE-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
    
    const { data: existingSites } = await supabase
      .from("sites")
      .select("site_ref")
      .eq("org_id", currentOrgId)
      .like("site_ref", `${datePrefix}-%`)
      .order("created_at", { ascending: false })
      .limit(1);

    let nextNumber = 1;
    if (existingSites && existingSites.length > 0) {
      const lastRef = existingSites[0].site_ref;
      const lastNumber = parseInt(lastRef.split("-").pop() || "0");
      nextNumber = lastNumber + 1;
    }

    const site_ref = `${datePrefix}-${String(nextNumber).padStart(3, "0")}`;

    setSiteInitialValues({
      site_ref,
      project_ref: project.project_ref ?? "",
      client_name: clientName,
      product_name: productLabel,
      address,
      city: project.city ?? "",
      postal_code: project.postal_code ?? "",
      date_debut: new Date().toISOString().slice(0, 10),
      status: "PLANIFIE",
      cofrac_status: "EN_ATTENTE",
      progress_percentage: 0,
      revenue: 0,
      profit_margin: 0,
      surface_facturee: surfaceFacturee,
      cout_main_oeuvre_m2_ht: 0,
      cout_isolation_m2: 0,
      isolation_utilisee_m2: 0,
      montant_commission: 0,
      valorisation_cee: valorisationTotalEur,
      team_members: [{ name: "" }],
      additional_costs: [],
    });
    setSiteDialogOpen(true);
  };

  const projectOptions = useMemo<SiteProjectOption[]>(() => {
    return projects.map((project) => {
      const clientName = getProjectClientName(project);
      const displayedProducts = getDisplayedProducts(project.project_products);
      const firstProduct = displayedProducts[0]?.product ?? project.project_products?.[0]?.product;
      const productLabel = firstProduct?.code || project.product_name || "";
      const address = (project as Project & { address?: string | null }).address ?? "";
      const surfaceFacturee = surfaceFactureeByProject[project.id] ?? undefined;

      return {
        id: project.id,
        project_ref: project.project_ref ?? "",
        client_name: clientName,
        product_name: productLabel,
        address,
        city: project.city ?? "",
        postal_code: project.postal_code ?? "",
        surface_facturee: surfaceFacturee && surfaceFacturee > 0 ? surfaceFacturee : undefined,
      } satisfies SiteProjectOption;
    });
  }, [projects, surfaceFactureeByProject]);

  const handleSubmitSite = useCallback(async (values: SiteFormValues) => {
    if (!user || !currentOrgId) return;

    const sanitizedTeam = values.team_members.map((member) => member.name.trim()).filter(Boolean);
    const sanitizedCosts = values.additional_costs
      ? values.additional_costs
          .filter((cost) => cost.label.trim().length > 0)
          .map((cost) => {
            const attachment = cost.attachment ? cost.attachment.trim() : "";

            return {
              label: cost.label.trim(),
              amount_ht: Number.isFinite(cost.amount_ht) ? cost.amount_ht : 0,
              taxes: Number.isFinite(cost.taxes) ? cost.taxes : 0,
              attachment: attachment.length > 0 ? attachment : null,
            };
          })
      : [];

    const siteData = {
      site_ref: values.site_ref,
      project_ref: values.project_ref,
      client_name: values.client_name,
      product_name: values.product_name?.trim() || "",
      address: values.address,
      city: values.city,
      postal_code: values.postal_code,
      status: values.status,
      cofrac_status: values.cofrac_status,
      date_debut: values.date_debut,
      date_fin_prevue: values.date_fin_prevue || null,
      progress_percentage: values.progress_percentage,
      revenue: values.revenue,
      profit_margin: values.profit_margin,
      surface_facturee: values.surface_facturee,
      cout_main_oeuvre_m2_ht: values.cout_main_oeuvre_m2_ht,
      cout_isolation_m2: values.cout_isolation_m2,
      isolation_utilisee_m2: values.isolation_utilisee_m2,
      montant_commission: values.montant_commission,
      valorisation_cee: values.valorisation_cee,
      notes: values.notes?.trim() || null,
      team_members: sanitizedTeam.length > 0 ? sanitizedTeam : null,
      additional_costs: sanitizedCosts.length > 0 ? sanitizedCosts : [],
      user_id: user.id,
      org_id: currentOrgId,
    };

    try {
      const { error } = await supabase.from("sites").insert([siteData]);

      if (error) throw error;

      showToast("Chantier créé", {
        description: `${siteData.site_ref} a été ajouté à la liste des chantiers.`,
      });

      setSiteDialogOpen(false);
      setSiteInitialValues(undefined);
      
      // Navigate to sites page
      navigate("/sites");
    } catch (error) {
      console.error("Error saving site:", error);
      showToast("Erreur", {
        description: "Impossible de créer le chantier.",
      });
    }
  }, [user, currentOrgId, navigate]);

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
            const clientName = getProjectClientName(project);
            const projectEmail =
              (project as Project & { email?: string | null; client_email?: string | null }).email ??
              (project as Project & { email?: string | null; client_email?: string | null }).client_email ??
              project.lead?.email ??
              null;
            const projectCostValue = project.estimated_value ?? null;
            const valorisationSummary = projectValorisationSummaries[project.id];
            const valorisationEntries = buildPrimeCeeEntries({
              computation: valorisationSummary?.computation ?? null,
              productMap: buildProjectProductDisplayMap(displayedProducts),
            });
            const valorisationEntries = displayedProducts
              .map((item) => (item.id ? valorisationSummary?.productMap[item.id] : undefined))
              .filter((entry): entry is PrimeCeeProductResult =>
                Boolean(entry && entry.valorisationPerUnitEur && entry.valorisationPerUnitEur > 0)
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
                          {clientName}
                          {project.company && (
                            <span className="block text-xs">{project.company}</span>
                          )}
                          {project.siren && (
                            <span className="block text-xs text-muted-foreground/80">
                              SIREN : {project.siren}
                            </span>
                          )}
                          {project.source && (
                            <span className="block text-xs text-muted-foreground/80">
                              Source : {project.source}
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
                      {(project as Project & { address?: string }).address
                        ? `${(project as Project & { address?: string }).address} • ${project.postal_code} ${project.city}`
                        : `${project.city} (${project.postal_code})`}
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
                    {typeof projectCostValue === "number" && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Coût du chantier:</span>
                        <div className="flex items-center gap-1 text-sm font-bold text-primary">
                          <Euro className="w-4 h-4" />
                          {formatCurrency(projectCostValue)}
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
                    {valorisationEntries.map((entry) => {
                      const valorisationLabel = (entry.valorisationLabel || "Valorisation m²/LED").trim();
                      return (
                        <div
                          key={`${project.id}-valorisation-${entry.projectProductId}`}
                          className="space-y-1"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <span className="text-xs uppercase tracking-wide text-muted-foreground">
                              {valorisationLabel}
                              {entry.productCode ? ` (${entry.productCode})` : ""}
                            </span>
                            <span className="text-sm font-semibold text-emerald-600 text-right">
                              {formatCurrency(entry.valorisationPerUnitEur ?? 0)} / {entry.multiplierLabel}
                            </span>
                          </div>
                          <div className="flex items-start justify-between gap-3 text-xs text-muted-foreground">
                            <span>
                              {`${formatDecimal(entry.valorisationPerUnitMwh)} MWh × ${entry.multiplierLabel} = ${formatDecimal(
                                entry.valorisationTotalMwh,
                              )} MWh`}
                            </span>
                            <span className="font-semibold text-amber-600 text-right">
                              Prime calculée : {formatCurrency(entry.valorisationTotalEur ?? entry.totalPrime ?? 0)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    {valorisationEntries.map((entry) => (
                      <div
                        key={`${project.id}-valorisation-${entry.projectProductId}`}
                        className="flex items-center justify-between"
                      >
                        <span className="text-sm text-muted-foreground">
                          Valorisation CEE
                          {entry.productCode ? ` (${entry.productCode})` : ""}:
                        </span>
                        <span className="text-sm font-semibold text-amber-600 text-right">
                          {formatCurrency(entry.valorisationPerUnitEur ?? 0)} / {getValorisationLabel(entry)}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <UserRound className="w-4 h-4" />
                        Délégataire:
                      </span>
                      <span className="font-medium flex items-center gap-1 text-right">
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
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Source:</span>
                      <span className="font-medium">
                        {project.source && project.source.trim().length > 0
                          ? project.source
                          : "Non renseigné"}
                      </span>
                    </div>
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
      <SiteDialog
        open={siteDialogOpen}
        mode="create"
        onOpenChange={(open) => {
          setSiteDialogOpen(open);
          if (!open) {
            setSiteInitialValues(undefined);
          }
        }}
        onSubmit={handleSubmitSite}
        initialValues={siteInitialValues}
        orgId={currentOrgId}
        projects={projectOptions}
      />
    </Layout>
  );
};

export default Projects;
