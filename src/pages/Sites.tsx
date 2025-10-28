import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  SiteDialog,
  type SiteFormValues,
  type SiteProjectOption,
} from "@/components/sites/SiteDialog";

import { useToast } from "@/components/ui/use-toast";
import type { Tables } from "@/integrations/supabase/types";
import { useOrg } from "@/features/organizations/OrgContext";
import { getProjectClientName } from "@/lib/projects";
import { getDynamicFieldNumericValue } from "@/lib/product-params";
import { withDefaultProductCeeConfig, type ProductCeeConfig } from "@/lib/prime-cee-unified";
import {
  Plus,
  Search,
  Filter,
  Calendar,
  MapPin,
  Euro,
  Users,
  Clock,
  Pencil,
  CheckCircle2,
  RefreshCcw,
  TrendingUp,
  ShieldCheck,
  Ruler,
  HandCoins,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

type SiteStatus = "PLANIFIE" | "EN_PREPARATION" | "EN_COURS" | "SUSPENDU" | "TERMINE" | "LIVRE";
type CofracStatus = "EN_ATTENTE" | "CONFORME" | "NON_CONFORME" | "A_PLANIFIER";

type ProjectProduct = Tables<"project_products"> & {
  product: (Pick<Tables<"product_catalog">, "code" | "params_schema" | "cee_config"> & {
    cee_config: ProductCeeConfig;
    kwh_cumac_values?: Tables<"product_kwh_cumac">[];
  }) | null;
};
type ProjectWithProducts = Tables<"projects"> & {
  project_products?: ProjectProduct[] | null;
};

type SiteAdditionalCostFormValue = SiteFormValues["additional_costs"][number];

const createEmptyAdditionalCost = (): SiteAdditionalCostFormValue => ({
  label: "",
  amount_ht: 0,
  taxes: 0,
  attachment: null,
});

const parseNumber = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const normalizeAdditionalCosts = (costs: unknown): SiteAdditionalCostFormValue[] => {
  if (!Array.isArray(costs)) {
    return [createEmptyAdditionalCost()];
  }

  const normalized = costs
    .map((cost) => {
      if (!cost || typeof cost !== "object") {
        return null;
      }

      const raw = cost as Record<string, unknown>;
      const label = typeof raw.label === "string" ? raw.label : "";

      const amountHTValue =
        parseNumber(raw.amount_ht) ?? parseNumber(raw.amount) ?? parseNumber(raw.amount_ttc) ?? 0;
      const taxesValue = parseNumber(raw.taxes) ?? 0;
      const attachmentValue =
        typeof raw.attachment === "string" && raw.attachment.trim().length > 0
          ? raw.attachment.trim()
          : null;

      return {
        label,
        amount_ht: amountHTValue,
        taxes: taxesValue,
        attachment: attachmentValue,
      } as SiteAdditionalCostFormValue;
    })
    .filter((cost) => cost !== null) as SiteAdditionalCostFormValue[];

  return normalized.length > 0 ? normalized : [createEmptyAdditionalCost()];
};

type Site = Tables<"sites"> & {
  revenue?: number | null;
  profit_margin?: number | null;
  surface_facturee?: number | null;
  cout_main_oeuvre_m2_ht?: number | null;
  cout_isolation_m2?: number | null;
  isolation_utilisee_m2?: number | null;
  montant_commission?: number | null;
  valorisation_cee?: number | null;
  cofrac_status?: string | null;
  notes?: string | null;
};

const SURFACE_FACTUREE_TARGETS = ["surface_facturee", "surface facturée"] as const;

const getStatusLabel = (status: SiteStatus) => {
  const labels: Record<SiteStatus, string> = {
    PLANIFIE: "Planifié",
    EN_PREPARATION: "En préparation",
    EN_COURS: "En cours",
    SUSPENDU: "Suspendu",
    TERMINE: "Terminé",
    LIVRE: "Livré",
  };
  return labels[status];
};

const getStatusColor = (status: SiteStatus) => {
  const colors: Record<SiteStatus, string> = {
    PLANIFIE: "bg-blue-500/10 text-blue-700 border-blue-200",
    EN_PREPARATION: "bg-orange-500/10 text-orange-700 border-orange-200",
    EN_COURS: "bg-primary/10 text-primary border-primary/20",
    SUSPENDU: "bg-red-500/10 text-red-700 border-red-200",
    TERMINE: "bg-green-500/10 text-green-700 border-green-200",
    LIVRE: "bg-teal-500/10 text-teal-700 border-teal-200",
  };
  return colors[status];
};

const STATUS_OPTIONS: { value: SiteStatus; label: string }[] = (
  ["PLANIFIE", "EN_PREPARATION", "EN_COURS", "SUSPENDU", "TERMINE", "LIVRE"] as const
).map((status) => ({ value: status, label: getStatusLabel(status) }));

const getProgressColor = (percentage: number) => {
  if (percentage === 0) return "bg-gray-200";
  if (percentage < 50) return "bg-orange-500";
  if (percentage < 100) return "bg-primary";
  return "bg-green-500";
};

const getCofracStatusLabel = (status: CofracStatus) => {
  const labels: Record<CofracStatus, string> = {
    EN_ATTENTE: "En attente",
    CONFORME: "Conforme",
    NON_CONFORME: "Non conforme",
    A_PLANIFIER: "Audit à planifier",
  };
  return labels[status];
};

const getCofracStatusColor = (status: CofracStatus) => {
  const colors: Record<CofracStatus, string> = {
    EN_ATTENTE: "bg-amber-500/10 text-amber-700 border-amber-200",
    CONFORME: "bg-green-500/10 text-green-700 border-green-200",
    NON_CONFORME: "bg-red-500/10 text-red-700 border-red-200",
    A_PLANIFIER: "bg-blue-500/10 text-blue-700 border-blue-200",
  };
  return colors[status];
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);

const formatPercent = (value: number) =>
  `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value)} %`;

const Sites = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [activeSiteId, setActiveSiteId] = useState<string | null>(null);
  const [dialogInitialValues, setDialogInitialValues] = useState<Partial<SiteFormValues>>();
  const [selectedStatuses, setSelectedStatuses] = useState<SiteStatus[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { currentOrgId } = useOrg();

  const { data: sites = [], isLoading, refetch } = useQuery({
    queryKey: ["sites", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("sites")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Site[];
    },
    enabled: !!user,
  });

  const { data: projects = [], isLoading: projectsLoading } = useQuery<ProjectWithProducts[]>({
    queryKey: ["projects", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("projects")
        .select(
          "*, project_products(id, dynamic_params, product:product_catalog(code, params_schema, cee_config, kwh_cumac_values:product_kwh_cumac(id, building_type, kwh_cumac)))"
        )
        .eq("user_id", user.id);

      if (error) throw error;

      return ((data as ProjectWithProducts[]) ?? []).map((project) => ({
        ...project,
        project_products: (project.project_products ?? []).map((pp) => ({
          ...pp,
          product: pp.product ? withDefaultProductCeeConfig(pp.product) : null,
        })),
      }));
    },
    enabled: !!user,
  });

  const surfaceFactureeByProject = useMemo(() => {
    return projects.reduce<Record<string, number>>((acc, project) => {
      const total = (project.project_products ?? []).reduce((sum, projectProduct) => {
        const product = projectProduct.product;
        if (!product) {
          return sum;
        }

        const surfaceValue = getDynamicFieldNumericValue(
          product?.params_schema,
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

  const projectOptions = useMemo<SiteProjectOption[]>(() => {
    return projects.map((project) => {
      const clientName = getProjectClientName(project);
      const productCodes =
        project.project_products
          ?.map((item) => item.product?.code)
          .filter((code): code is string => Boolean(code)) ?? [];

      const productLabel =
        productCodes.length > 0
          ? productCodes.join(", ")
          : project.product_name ?? "";

      const address = (project as { address?: string | null }).address ?? "";
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

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setActiveSiteId(null);
      setDialogInitialValues(undefined);
    }
  };

  const handleOpenCreate = useCallback(
    async (initial?: Partial<SiteFormValues>) => {
      // Générer une référence unique basée sur la date et un compteur
      const today = new Date();
      const datePrefix = `SITE-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
      
      // Récupérer les sites existants avec le même préfixe pour trouver le prochain numéro
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

      const baseDefaults: Partial<SiteFormValues> = {
        site_ref,
        date_debut: new Date().toISOString().slice(0, 10),
        status: "PLANIFIE",
        cofrac_status: "EN_ATTENTE",
        progress_percentage: 0,
        revenue: 0,
        profit_margin: 0,
        surface_facturee: 0,
        cout_main_oeuvre_m2_ht: 0,
        cout_isolation_m2: 0,
        isolation_utilisee_m2: 0,
        montant_commission: 0,
        valorisation_cee: 0,
        team_members: [{ name: "" }],
        additional_costs: [],
      };

      setDialogMode("create");
      setActiveSiteId(null);
      setDialogInitialValues({ ...baseDefaults, ...initial });
      setDialogOpen(true);
    },
    [currentOrgId],
  );

  const handleEditSite = (site: Site) => {
    setDialogMode("edit");
    setActiveSiteId(site.id);
    setDialogInitialValues({
      site_ref: site.site_ref,
      project_ref: site.project_ref,
      client_name: site.client_name,
      product_name: site.product_name,
      address: site.address,
      city: site.city,
      postal_code: site.postal_code,
      status: site.status as SiteStatus,
      cofrac_status: (site.cofrac_status || "EN_ATTENTE") as CofracStatus,
      date_debut: site.date_debut,
      date_fin_prevue: site.date_fin_prevue || "",
      progress_percentage: site.progress_percentage || 0,
      revenue: site.revenue || 0,
      profit_margin: site.profit_margin || 0,
      surface_facturee: site.surface_facturee || 0,
      cout_main_oeuvre_m2_ht: site.cout_main_oeuvre_m2_ht || 0,
      cout_isolation_m2: site.cout_isolation_m2 || 0,
      isolation_utilisee_m2: site.isolation_utilisee_m2 || 0,
      montant_commission: site.montant_commission || 0,
      valorisation_cee: site.valorisation_cee || 0,
      notes: site.notes || "",
      team_members: (site.team_members && site.team_members.length > 0)
        ? site.team_members.map(name => ({ name }))
        : [{ name: "" }],
      additional_costs: normalizeAdditionalCosts(site.additional_costs ?? []),
    });
    setDialogOpen(true);
  };


  const handleSubmitSite = async (values: SiteFormValues) => {
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
      if (dialogMode === "create") {
        const { error } = await supabase
          .from("sites")
          .insert([siteData]);

        if (error) throw error;

        toast({
          title: "Chantier créé",
          description: `${siteData.site_ref} a été ajouté à la liste des chantiers.`,
        });
      } else if (dialogMode === "edit" && activeSiteId) {
        const { error } = await supabase
          .from("sites")
          .update(siteData)
          .eq("id", activeSiteId);

        if (error) throw error;

        toast({
          title: "Chantier mis à jour",
          description: `${values.site_ref} a été mis à jour avec succès.`,
        });
      }

      refetch();
      setDialogOpen(false);
    } catch (error) {
      console.error("Error saving site:", error);
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder le chantier.",
        variant: "destructive",
      });
    }
  };

  const handleStatusChange = async (siteId: string, status: SiteStatus) => {
    try {
      const { error } = await supabase
        .from("sites")
        .update({ status })
        .eq("id", siteId);

      if (error) throw error;

      toast({
        title: "Statut mis à jour",
        description: `Le chantier est maintenant ${getStatusLabel(status)}.`,
      });
      refetch();
    } catch (error) {
      console.error("Error updating status:", error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le statut.",
        variant: "destructive",
      });
    }
  };

  const handleMarkAsDone = async (siteId: string) => {
    try {
      const { error } = await supabase
        .from("sites")
        .update({ status: "TERMINE", progress_percentage: 100 })
        .eq("id", siteId);

      if (error) throw error;

      toast({
        title: "Chantier terminé",
        description: "Le chantier est marqué comme terminé.",
      });
      refetch();
    } catch (error) {
      console.error("Error marking site as done:", error);
      toast({
        title: "Erreur",
        description: "Impossible de marquer le chantier comme terminé.",
        variant: "destructive",
      });
    }
  };

  const handleStatusFilterChange = useCallback(
    (status: SiteStatus, checked: boolean | "indeterminate") => {
      const isChecked = checked === true;
      setSelectedStatuses((previous) => {
        if (isChecked) {
          if (previous.includes(status)) {
            return previous;
          }
          return [...previous, status];
        }

        return previous.filter((item) => item !== status);
      });
    },
    [],
  );

  const handleClearFilters = useCallback(() => {
    setSelectedStatuses([]);
    setSearchTerm("");
  }, []);

  const hasActiveFilters = selectedStatuses.length > 0 || searchTerm.trim().length > 0;

  const filteredSites = useMemo(() => {
    if (!sites) return [];

    const normalizedSearch = searchTerm.trim().toLowerCase();

    return sites.filter((site) => {
      const siteStatus = (site.status ?? "") as SiteStatus;
      const matchesStatus =
        selectedStatuses.length === 0 || (siteStatus && selectedStatuses.includes(siteStatus));

      if (!matchesStatus) {
        return false;
      }

      if (normalizedSearch.length === 0) {
        return true;
      }

      const searchableValues = [
        site.site_ref,
        site.project_ref,
        site.client_name,
        site.product_name,
        site.address,
        site.city,
        site.postal_code,
      ]
        .filter((value): value is string => Boolean(value))
        .map((value) => value.toLowerCase());

      return searchableValues.some((value) => value.includes(normalizedSearch));
    });
  }, [sites, selectedStatuses, searchTerm]);

  type SitesLocationState = {
    createSite?: {
      projectId: string;
    };
  };

  const locationState = (location.state as SitesLocationState | undefined) ?? undefined;

  useEffect(() => {
    if (projectsLoading) return;

    if (locationState?.createSite?.projectId) {
      const project = projects.find((item) => item.id === locationState.createSite?.projectId);

      if (project) {
        const clientName = getProjectClientName(project);
        const productCodes =
          project.project_products
            ?.map((item) => item.product?.code)
            .filter((code): code is string => Boolean(code)) ?? [];
        const productLabel =
          productCodes.length > 0
            ? productCodes.join(", ")
            : project.product_name ?? "";
        const address = (project as { address?: string | null }).address ?? "";

        handleOpenCreate({
          project_ref: project.project_ref ?? "",
          client_name: clientName,
          product_name: productLabel,
          address,
          city: project.city ?? "",
          postal_code: project.postal_code ?? "",
        });

        toast({
          title: "Préparation du chantier",
          description: `Chantier pré-rempli à partir de ${project.project_ref}.`,
        });
      } else {
        toast({
          title: "Projet introuvable",
          description: "Impossible de pré-remplir le chantier avec ce projet.",
          variant: "destructive",
        });
      }

      navigate(location.pathname, { replace: true });
    }
  }, [
    locationState,
    navigate,
    location.pathname,
    toast,
    projects,
    projectsLoading,
    handleOpenCreate,
  ]);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Gestion des Chantiers
            </h1>
            <p className="text-muted-foreground mt-1">
              Suivi en temps réel de vos chantiers de rénovation énergétique
            </p>
          </div>
          <Button onClick={() => handleOpenCreate()}>
            <Plus className="w-4 h-4 mr-2" />
            Nouveau chantier
          </Button>
        </div>

        <Card className="shadow-card bg-gradient-card border-0">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par référence, client, adresse..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                />
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">
                    <Filter className="w-4 h-4 mr-2" />
                    {selectedStatuses.length > 0
                      ? `Filtres (${selectedStatuses.length})`
                      : "Filtres"}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuLabel>Filtrer par statut</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {STATUS_OPTIONS.map((status) => (
                    <DropdownMenuCheckboxItem
                      key={status.value}
                      checked={selectedStatuses.includes(status.value)}
                      onCheckedChange={(checked) => handleStatusFilterChange(status.value, checked)}
                    >
                      {status.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setSelectedStatuses([])}>
                    Réinitialiser les filtres
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            {hasActiveFilters && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>Filtres actifs :</span>
                {searchTerm.trim().length > 0 && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    Recherche :
                    <span className="font-medium text-foreground">{searchTerm}</span>
                    <button
                      type="button"
                      onClick={() => setSearchTerm("")}
                      className="ml-1 inline-flex rounded-full p-0.5 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {selectedStatuses.map((status) => (
                  <Badge key={status} variant="outline" className="flex items-center gap-1">
                    {getStatusLabel(status)}
                    <button
                      type="button"
                      onClick={() => handleStatusFilterChange(status, false)}
                      className="ml-1 inline-flex rounded-full p-0.5 text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                  Effacer tout
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredSites.map((site) => (
            <Card
              key={site.id}
              className="shadow-card bg-gradient-card border-0 hover:shadow-elevated transition-all duration-300"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg font-bold text-primary">
                      {site.site_ref}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Projet : {site.project_ref}
                    </p>
                    <p className="text-sm font-medium">{site.client_name}</p>
                  </div>
                  <Badge className={getStatusColor(site.status as SiteStatus)}>
                    {getStatusLabel(site.status as SiteStatus)}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold text-foreground mb-1">{site.product_name}</h4>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    {site.address ? `${site.address} · ` : null}
                    {site.city} ({site.postal_code})
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Euro className="w-4 h-4 text-primary" />
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">CA</p>
                      <p className="font-semibold">{formatCurrency(site.revenue || 0)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Marge</p>
                      <p className="font-semibold">{formatPercent(site.profit_margin || 0)}</p>
                    </div>
                  </div>
                  {/* Masquer COFRAC avant la fin des travaux */}
                  {(site.status === "TERMINE" || site.status === "LIVRE") && (
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-sky-600" />
                      <Badge className={getCofracStatusColor((site.cofrac_status || "EN_ATTENTE") as CofracStatus)}>
                        {getCofracStatusLabel((site.cofrac_status || "EN_ATTENTE") as CofracStatus)}
                      </Badge>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Ruler className="w-4 h-4 text-amber-600" />
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Surface facturée</p>
                      <p className="font-semibold">{site.surface_facturee || 0} m²</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <HandCoins className="w-4 h-4 text-purple-600" />
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Commission</p>
                      <p className="font-semibold">{formatCurrency(site.montant_commission || 0)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Euro className="w-4 h-4 text-primary" />
                    <div>
                      <p className="text-xs uppercase text-muted-foreground">Valorisation CEE</p>
                      <p className="font-semibold">{formatCurrency(site.valorisation_cee || 0)}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Début :</span>
                    <span className="font-medium">
                      {new Date(site.date_debut).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                  {site.date_fin_prevue && (
                    <div className="flex items-center gap-2 text-sm ml-6">
                      <span className="text-muted-foreground">Fin prévue :</span>
                      <span className="font-medium">
                        {new Date(site.date_fin_prevue).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Avancement :</span>
                    <span className="font-medium">{site.progress_percentage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(site.progress_percentage)}`}
                      style={{ width: `${site.progress_percentage}%` }}
                    ></div>
                  </div>
                </div>

                <div className="pt-2 border-t space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Équipe :</span>
                  </div>
                  <div className="flex flex-wrap gap-1 ml-6">
                    {(site.team_members || []).map((member, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {member}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => handleEditSite(site)}>
                    <Pencil className="w-4 h-4 mr-1" /> Modifier
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline">
                        <RefreshCcw className="w-4 h-4 mr-1" /> Statut
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {(["PLANIFIE", "EN_PREPARATION", "EN_COURS", "SUSPENDU", "TERMINE", "LIVRE"] as SiteStatus[]).map((status) => (
                        <DropdownMenuItem
                          key={status}
                          onClick={() => handleStatusChange(site.id, status)}
                        >
                          {getStatusLabel(status)}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => handleMarkAsDone(site.id)}
                    disabled={site.status === "TERMINE"}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1" /> Terminer
                  </Button>
                  <Button size="sm" variant="ghost" className="flex-1" disabled>
                    <Clock className="w-4 h-4 mr-1" /> Planning
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <SiteDialog
        open={dialogOpen}
        mode={dialogMode}
        onOpenChange={handleDialogOpenChange}
        onSubmit={handleSubmitSite}
        initialValues={dialogInitialValues}
        orgId={currentOrgId}
        projects={projectOptions}
      />
    </Layout>
  );
};

export default Sites;
