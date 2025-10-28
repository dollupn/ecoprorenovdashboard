import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AddProjectDialog, type ProjectFormValues } from "@/components/projects/AddProjectDialog";
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
  FileText,
  Eye,
  Hammer,
  Lightbulb,
  Thermometer,
  Layers,
  MapPin,
  Calendar,
  Phone,
  Mail,
  UserRound,
  Pencil,
  Euro,
  HandCoins,
  LayoutGrid,
  List,
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
  getDynamicFieldNumericValue,
  formatDynamicFieldValue,
} from "@/lib/product-params";
import { useProjectStatuses } from "@/hooks/useProjectStatuses";
import { useOrganizationPrimeSettings } from "@/features/organizations/useOrganizationPrimeSettings";
import { cn } from "@/lib/utils";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  buildPrimeCeeEntries,
  computePrimeCee,
  withDefaultProductCeeConfig,
  type PrimeCeeComputation,
  type PrimeCeeProductCatalogEntry,
  type PrimeCeeProductDisplayMap,
  type PrimeCeeProductResult,
  type PrimeCeeValorisationEntry,
  type PrimeProductInput,
  type ProductCeeConfig,
} from "@/lib/prime-cee-unified";

type Project = Tables<"projects">;
type ProductSummary = Pick<
  Tables<"product_catalog">,
  | "id"
  | "code"
  | "name"
  | "category"
  | "params_schema"
  | "is_active"
  | "default_params"
  | "cee_config"
> & {
  cee_config: ProductCeeConfig;
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

const resolvePrimeCeeEuro = (project: Project | null | undefined) => {
  if (!project) return null;

  if (
    typeof project.prime_cee_total_cents === "number" &&
    Number.isFinite(project.prime_cee_total_cents)
  ) {
    return project.prime_cee_total_cents / 100;
  }

  if (typeof project.prime_cee === "number" && Number.isFinite(project.prime_cee)) {
    return project.prime_cee;
  }

  return null;
};

type ViewMode = "card" | "list";
const VIEW_MODE_STORAGE_KEY = "projects:view-mode";
const PROJECT_CATEGORY_VALUES = ["EQ", "EN"] as const;

type ProjectCategoryValue = (typeof PROJECT_CATEGORY_VALUES)[number];
type CategoryFilterValue = "all" | ProjectCategoryValue;
type StatusFilterValue = "active" | "all";

const normalizeCategorySource = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

const detectCategoryFromValue = (value?: string | null): ProjectCategoryValue | null => {
  if (!value) {
    return null;
  }

  const normalized = normalizeCategorySource(value);
  const directMatch = normalized.match(/\b(EQ|EN)\b/);
  if (directMatch) {
    return directMatch[1] as ProjectCategoryValue;
  }

  const hyphenMatch = normalized.match(/BAT-(EQ|EN)/);
  if (hyphenMatch) {
    return hyphenMatch[1] as ProjectCategoryValue;
  }

  const segments = normalized.split(/[^A-Z]/).filter(Boolean);
  for (const segment of segments) {
    if (segment === "EQ" || segment === "EN") {
      return segment as ProjectCategoryValue;
    }
  }

  return null;
};

const deriveProjectCategory = (
  project: ProjectWithRelations,
  projectProducts: ProjectProduct[],
): ProjectCategoryValue | null => {
  const candidates: Array<string | null | undefined> = [
    project.usage,
    project.project_ref,
    project.product_name,
    ...projectProducts.map((item) => item.product?.code),
    ...projectProducts.map((item) => item.product?.name),
  ];

  for (const candidate of candidates) {
    const detected = detectCategoryFromValue(candidate);
    if (detected) {
      return detected;
    }
  }

  return null;
};

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

const CATEGORY_METADATA = {
  EQ: {
    icon: Lightbulb,
    iconWrapper: "bg-yellow-100 text-yellow-800 ring-1 ring-inset ring-yellow-200",
    accentBar: "from-yellow-200/70 via-yellow-200/0 to-transparent",
    srLabel: "Catégorie EQ",
  },
  EN: {
    icon: Thermometer,
    iconWrapper: "bg-sky-100 text-sky-800 ring-1 ring-inset ring-sky-200",
    accentBar: "from-sky-200/70 via-sky-200/0 to-transparent",
    srLabel: "Catégorie EN",
  },
} as const;

const DEFAULT_CATEGORY_METADATA = {
  icon: Layers,
  iconWrapper: "bg-muted text-muted-foreground",
  accentBar: "from-muted/60 via-muted/0 to-transparent",
  srLabel: "Catégorie inconnue",
} as const;

const Projects = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { currentOrgId } = useOrg();
  const { data: members = [], isLoading: membersLoading } = useMembers(currentOrgId);
  const projectStatuses = useProjectStatuses();
  const { primeBonification } = useOrganizationPrimeSettings();
  const [searchTerm, setSearchTerm] = useState("");
  const [assignedFilter, setAssignedFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilterValue>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>(() => {
    const statusParam = searchParams.get("status");
    return statusParam === "all" ? "all" : "active";
  });
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [quoteInitialValues, setQuoteInitialValues] =
    useState<Partial<QuoteFormValues>>({});
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === "undefined") {
      return "card";
    }
    const stored = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    return stored === "list" ? "list" : "card";
  });

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
  }, [viewMode]);

  const currentMember = members.find((member) => member.user_id === user?.id);
  const isAdmin = currentMember?.role === "admin" || currentMember?.role === "owner";

  const { data: projects = [], isLoading, refetch } = useQuery<ProjectWithRelations[]>({
    queryKey: ["projects", user?.id, currentOrgId, isAdmin],
    queryFn: async () => {
      if (!user) return [];

      let query = supabase
        .from("projects")
        .select(
          "*, delegate:delegates(id, name, price_eur_per_mwh), lead:leads(email), project_products(id, product_id, quantity, dynamic_params, product:product_catalog(id, code, name, category, params_schema, cee_config, kwh_cumac_values:product_kwh_cumac(id, building_type, kwh_cumac)))"
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

      const sanitized = (data ?? []).map((project) => ({
        ...project,
        project_products: (project.project_products ?? []).map((pp) => ({
          ...pp,
          product: pp.product
            ? withDefaultProductCeeConfig(pp.product)
            : null,
        })),
      }));

      return sanitized as ProjectWithRelations[];
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
    const statusParam = searchParams.get("status");
    const nextStatus: StatusFilterValue = statusParam === "all" ? "all" : "active";
    setStatusFilter((previous) => (previous === nextStatus ? previous : nextStatus));
  }, [searchParams]);

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
    totalValorisationEur: number;
    delegatePrice: number;
    products: PrimeCeeProductResult[];
    displayedPrimeEntries: PrimeCeeValorisationEntry[];
    fallbackPrimeEntries: PrimeCeeValorisationEntry[];
    valorisationProductEntries: PrimeCeeProductResult[];
    fallbackProductEntry?: PrimeCeeProductResult;
  };

  const projectValorisationSummaries = useMemo(() => {
    return projects.reduce<Record<string, ProjectValorisationSummary>>((acc, project) => {
      const displayedProducts = getDisplayedProducts(project.project_products);
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

      const displayedProductMap = buildProjectProductDisplayMap(displayedProducts);
      const fullProductMap = buildProjectProductDisplayMap(project.project_products);

      const result = computePrimeCee({
        products: projectProducts,
        productMap,
        buildingType: project.building_type,
        delegate: project.delegate,
        primeBonification,
      });

      const displayedPrimeEntries = buildPrimeCeeEntries({
        computation: result ?? null,
        productMap: displayedProductMap,
      });

      const fallbackPrimeEntries = displayedPrimeEntries.length
        ? displayedPrimeEntries
        : buildPrimeCeeEntries({
            computation: result ?? null,
            productMap: fullProductMap,
          });

      const valorisationProductEntries = (result?.products ?? []).filter(
        (entry): entry is PrimeCeeProductResult =>
          Boolean(entry && entry.valorisationTotalEur && entry.valorisationTotalEur > 0),
      );

      const fallbackProductEntry =
        valorisationProductEntries[0] ??
        (result?.products ?? []).find(
          (entry) => typeof entry.valorisationTotalMwh === "number" && entry.valorisationTotalMwh > 0,
        );

      acc[project.id] = {
        computation: result ?? null,
        totalPrime: result?.totalPrime ?? 0,
        totalValorisationMwh: result?.totalValorisationMwh ?? 0,
        totalValorisationEur: result?.totalValorisationEur ?? 0,
        delegatePrice: result?.delegatePrice ?? 0,
        products: result?.products ?? [],
        displayedPrimeEntries,
        fallbackPrimeEntries,
        valorisationProductEntries,
        fallbackProductEntry,
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

  type ProcessedProject = {
    project: ProjectWithRelations;
    displayedProducts: ProjectProduct[];
    dynamicFieldEntries: ReturnType<typeof getDynamicFieldEntries>[];
    displayedValorisationEntries: PrimeCeeValorisationEntry[];
    searchableText: string;
    clientName: string;
    projectEmail: string | null;
    surfaceFacturee: number;
    category: ProjectCategoryValue | null;
  };

  const processedProjects = useMemo<ProcessedProject[]>(() => {
    return projects.map((project) => {
      const displayedProducts = getDisplayedProducts(project.project_products);
      const dynamicFieldEntries = displayedProducts.map((item) =>
        getDynamicFieldEntries(item.product?.params_schema ?? null, item.dynamic_params),
      );

      const clientName = getProjectClientName(project);
      const projectEmail =
        (project as Project & { email?: string | null; client_email?: string | null }).email ??
        (project as Project & { email?: string | null; client_email?: string | null }).client_email ??
        project.lead?.email ??
        null;

      const valorisationSummary = projectValorisationSummaries[project.id];
      const dynamicValues = dynamicFieldEntries
        .flatMap((entries) =>
          entries
            .map((entry) => {
              if (entry.value === undefined || entry.value === null) {
                return null;
              }
              return String(entry.value).toLowerCase();
            })
            .filter((value): value is string => Boolean(value)),
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
        displayedProducts.map((item) => item.product?.code ?? "").join(" "),
        project.assigned_to,
        project.source ?? "",
        projectEmail ?? "",
        project.delegate?.name ?? "",
        dynamicValues,
        valorisationSummary?.totalPrime ? String(valorisationSummary.totalPrime) : "",
        valorisationSummary?.totalValorisationMwh
          ? String(valorisationSummary.totalValorisationMwh)
          : "",
      ]
        .join(" ")
        .toLowerCase();

      return {
        project,
        displayedProducts,
        dynamicFieldEntries,
        displayedValorisationEntries: projectValorisationSummaries[project.id]?.displayedPrimeEntries ?? [],
        searchableText: searchable,
        clientName,
        projectEmail,
        surfaceFacturee: surfaceFactureeByProject[project.id] ?? 0,
        category: deriveProjectCategory(project, project.project_products ?? []),
      } satisfies ProcessedProject;
    });
  }, [projects, projectValorisationSummaries, surfaceFactureeByProject]);

  const filteredProjects = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    let base = processedProjects;

    if (statusFilter === "active") {
      base = base.filter((item) => item.project.status !== "LIVRE");
    }

    if (categoryFilter !== "all") {
      base = base.filter((item) => item.category === categoryFilter);
    }

    if (assignedFilter !== "all") {
      base = base.filter((item) => item.project.assigned_to === assignedFilter);
    }

    if (!normalizedSearch) {
      return base;
    }

    return base.filter((item) => item.searchableText.includes(normalizedSearch));
  }, [searchTerm, processedProjects, assignedFilter, statusFilter, categoryFilter]);

  const handleStatusFilterChange = useCallback(
    (value: string) => {
      const next: StatusFilterValue = value === "all" ? "all" : "active";
      setStatusFilter(next);
      setSearchParams(
        (previous) => {
          const params = new URLSearchParams(previous);
          if (next === "all") {
            params.set("status", "all");
          } else {
            params.delete("status");
          }
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const handleCategoryFilterChange = useCallback((value: string) => {
    if (value === "EQ" || value === "EN") {
      setCategoryFilter(value);
      return;
    }
    setCategoryFilter("all");
  }, []);

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
    const valorisationProductEntries = valorisationSummary?.valorisationProductEntries ?? [];
    const fallbackValorisation = valorisationSummary?.fallbackProductEntry;
    const selectedValorisation = valorisationProductEntries[0] ?? fallbackValorisation;
    const valorisationTotalEur =
      selectedValorisation?.valorisationTotalEur ?? selectedValorisation?.totalPrime ?? 0;
    const primeEntries = valorisationSummary?.displayedPrimeEntries ?? [];
    const fallbackPrimeEntries = valorisationSummary?.fallbackPrimeEntries ?? [];
    const selectedPrimeValorisation = (primeEntries.length ? primeEntries : fallbackPrimeEntries)[0];
    const valorisationMwh = selectedPrimeValorisation?.valorisationTotalMwh ?? 0;
    const valorisationBase = selectedPrimeValorisation?.valorisationPerUnitEur ?? 0;
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
    return processedProjects.map(({ project, displayedProducts, clientName, surfaceFacturee }) => {
      const firstProduct = displayedProducts[0]?.product ?? project.project_products?.[0]?.product;
      const productLabel = firstProduct?.code || project.product_name || "";
      const address = (project as Project & { address?: string | null }).address ?? "";

      return {
        id: project.id,
        project_ref: project.project_ref ?? "",
        client_name: clientName,
        product_name: productLabel,
        address,
        city: project.city ?? "",
        postal_code: project.postal_code ?? "",
        surface_facturee: surfaceFacturee > 0 ? surfaceFacturee : undefined,
      } satisfies SiteProjectOption;
    });
  }, [processedProjects]);

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
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-6 xl:flex-1">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher par référence, client, SIREN, ville..."
                    className="pl-10"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                  />
                </div>
                <ToggleGroup
                  type="single"
                  value={viewMode}
                  onValueChange={(value) => {
                    if (value === "card" || value === "list") {
                      setViewMode(value);
                    }
                  }}
                  variant="outline"
                  size="sm"
                  className="rounded-lg border bg-background p-1 shadow-sm"
                  aria-label="Mode d'affichage des projets"
                >
                  <ToggleGroupItem value="card" aria-label="Vue en cartes" className="h-9 w-9">
                    <LayoutGrid className="h-4 w-4" />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="list" aria-label="Vue en liste" className="h-9 w-9">
                    <List className="h-4 w-4" />
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
              <div className="flex flex-col md:flex-row md:items-center gap-4">
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
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Catégorie
                  </span>
                  <ToggleGroup
                    type="single"
                    value={categoryFilter}
                    onValueChange={handleCategoryFilterChange}
                    className="flex-wrap justify-start"
                  >
                    <ToggleGroupItem value="all" className="px-3 py-1 text-xs font-semibold uppercase">
                      ALL
                    </ToggleGroupItem>
                    <ToggleGroupItem value="EQ" className="px-3 py-1 text-xs font-semibold uppercase">
                      EQ
                    </ToggleGroupItem>
                    <ToggleGroupItem value="EN" className="px-3 py-1 text-xs font-semibold uppercase">
                      EN
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Statut
                  </span>
                  <ToggleGroup
                    type="single"
                    value={statusFilter}
                    onValueChange={handleStatusFilterChange}
                    className="flex-wrap justify-start"
                  >
                    <ToggleGroupItem value="active" className="px-3 py-1 text-xs font-medium">
                      Actifs
                    </ToggleGroupItem>
                    <ToggleGroupItem value="all" className="px-3 py-1 text-xs font-medium">
                      Inclure LIVRÉ
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {filteredProjects.length > 0 ? (
          viewMode === "card" ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
              {filteredProjects.map(
                ({
                  project,
                  displayedProducts,
                  dynamicFieldEntries,
                  displayedValorisationEntries,
                  clientName,
                  projectEmail,
                  surfaceFacturee,
                }) => {
                  const statusConfig = statusMap[project.status ?? ""];
                  const badgeStyle = getProjectStatusBadgeStyle(statusConfig?.color);
                  const statusLabel = statusConfig?.label ?? project.status ?? "Statut";
                  const category =
                    displayedProducts[0]?.product?.category ??
                    project.project_products?.[0]?.product?.category ??
                    null;
                  const categoryKey = (category ?? "") as keyof typeof CATEGORY_METADATA;
                  const categoryMetadata = CATEGORY_METADATA[categoryKey] ?? DEFAULT_CATEGORY_METADATA;
                  const CategoryIcon = categoryMetadata.icon;
                  const totalPrime =
                    projectValorisationSummaries[project.id]?.totalPrime ?? project.prime_cee ?? 0;
                  const totalValorisationMwh =
                    projectValorisationSummaries[project.id]?.totalValorisationMwh ?? 0;
                  const externalReference = project.external_reference?.trim();
                  const sourceLabel = project.source?.trim();
                  const assignedTo = project.assigned_to?.trim();
                  const delegateName = project.delegate?.name?.trim();
                  const delegatePrice = project.delegate?.price_eur_per_mwh;
                  const formattedDelegatePrice =
                    typeof delegatePrice === "number" ? formatCurrency(delegatePrice) : null;
                  const trimmedClientName = clientName?.trim() ?? "";
                  const trimmedCompany = project.company?.trim() ?? "";
                  const trimmedFallbackClient = project.client_name?.trim() ?? "";
                  const contactDisplay =
                    trimmedClientName || trimmedFallbackClient || trimmedCompany || "Client non renseigné";
                  const companyDisplay =
                    trimmedCompany && trimmedCompany.toLowerCase() !== contactDisplay.toLowerCase()
                      ? trimmedCompany
                      : "";
                  const productName =
                    project.product_name?.trim() ||
                    displayedProducts[0]?.product?.name ||
                    displayedProducts[0]?.product?.code ||
                    null;
                  const addressValue = (project as Project & { address?: string | null }).address?.trim();
                  const cityParts = [project.postal_code, project.city].filter((part) => part && part.length > 0);
                  const cityDisplay = cityParts.join(" ");
                  const formattedAddress = addressValue
                    ? cityDisplay
                      ? `${addressValue} • ${cityDisplay}`
                      : addressValue
                    : cityDisplay;
                  const dynamicFieldItems = dynamicFieldEntries.flatMap((entries, index) =>
                    entries.map((field) => {
                      const value = formatDynamicFieldValue(field);
                      return {
                        key: `${project.id}-${displayedProducts[index]?.product?.code ?? index}-${field.name}`,
                        label: field.label,
                        value: String(value),
                      };
                    }),
                  );
                  const startDate = project.date_debut_prevue ? new Date(project.date_debut_prevue) : null;
                  const endDate = project.date_fin_prevue ? new Date(project.date_fin_prevue) : null;
                  const projectCostValue = project.estimated_value ?? null;
                  const primeCeeEuro = resolvePrimeCeeEuro(project);
                  const projectProductsForForm = (project.project_products ?? []).map((item) => ({
                    product_id: item.product_id ?? "",
                    quantity:
                      typeof item.quantity === "number" && Number.isFinite(item.quantity)
                        ? item.quantity
                        : 1,
                    dynamic_params: (item.dynamic_params ?? {}) as Record<string, any>,
                  }));

                  const editInitialValues: Partial<ProjectFormValues> = {
                    client_first_name: project.client_first_name ?? "",
                    client_last_name: project.client_last_name ?? "",
                    company: project.company ?? "",
                    phone: project.phone ?? "",
                    hq_address: project.hq_address ?? "",
                    hq_city: project.hq_city ?? "",
                    hq_postal_code: project.hq_postal_code ?? "",
                    same_address: project.same_address ?? false,
                    address: (project as Project & { address?: string }).address ?? "",
                    city: project.city ?? "",
                    postal_code: project.postal_code ?? "",
                    siren: project.siren ?? "",
                    external_reference: project.external_reference ?? "",
                    products: projectProductsForForm.length > 0 ? projectProductsForForm : undefined,
                    building_type: project.building_type ?? "",
                    usage: project.usage ?? "",
                    delegate_id: project.delegate_id ?? project.delegate?.id ?? undefined,
                    signatory_name: project.signatory_name ?? "",
                    signatory_title: project.signatory_title ?? "",
                    surface_batiment_m2: project.surface_batiment_m2 ?? undefined,
                    status: project.status ?? "",
                    assigned_to: project.assigned_to ?? "",
                    source: project.source ?? "",
                    date_debut_prevue: project.date_debut_prevue ?? undefined,
                    date_fin_prevue: project.date_fin_prevue ?? undefined,
                    estimated_value: project.estimated_value ?? undefined,
                    lead_id: project.lead_id ?? undefined,
                  };

                  return (
                    <Card
                      key={project.id}
                      className={cn(
                        "relative overflow-hidden border border-border/60 bg-card shadow-card transition-shadow duration-300",
                        "hover:shadow-elevated focus-within:ring-2 focus-within:ring-primary/40 focus-within:ring-offset-2",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r",
                          categoryMetadata.accentBar,
                        )}
                      />
                      <CardHeader className="flex flex-col gap-4 pb-4">
                        <div className="flex flex-col gap-3">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                              <span
                                className={cn(
                                  "flex h-10 w-10 items-center justify-center rounded-full",
                                  categoryMetadata.iconWrapper,
                                )}
                              >
                                <CategoryIcon aria-hidden="true" className="h-5 w-5" />
                                <span className="sr-only">{categoryMetadata.srLabel}</span>
                              </span>
                              <div className="space-y-1">
                                <CardTitle className="text-lg font-semibold text-foreground">
                                  {project.project_ref || "Sans référence"}
                                </CardTitle>
                                {productName ? (
                                  <p className="text-sm font-medium text-muted-foreground">{productName}</p>
                                ) : null}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" style={badgeStyle}>
                                {statusLabel}
                              </Badge>
                              <AddProjectDialog
                                mode="edit"
                                projectId={project.id}
                                projectRef={project.project_ref}
                                initialValues={editInitialValues}
                                onProjectUpdated={() => void refetch()}
                                trigger={(
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="gap-1 text-muted-foreground hover:text-primary"
                                  >
                                    <Pencil className="h-4 w-4" />
                                    Modifier
                                  </Button>
                                )}
                              />
                            </div>
                          </div>
                          <div className="space-y-1 text-sm text-muted-foreground">
                            <p className="font-medium text-foreground">{contactDisplay}</p>
                            {companyDisplay ? <p>{companyDisplay}</p> : null}
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              {project.siren ? <span>SIREN : {project.siren}</span> : null}
                              {sourceLabel ? <span>Source : {sourceLabel}</span> : null}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              {project.phone ? (
                                <span className="flex items-center gap-1">
                                  <Phone aria-hidden="true" className="h-4 w-4" />
                                  {project.phone}
                                </span>
                              ) : null}
                              {projectEmail ? (
                                <span className="flex items-center gap-1">
                                  <Mail aria-hidden="true" className="h-4 w-4" />
                                  {projectEmail}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div className="space-y-3">
                          {displayedProducts.length ? (
                            <div className="flex flex-wrap gap-2">
                              {displayedProducts.map((item, index) => (
                                <Badge
                                  key={`${project.id}-${item.product?.code ?? index}`}
                                  variant="secondary"
                                  className="text-xs font-medium"
                                >
                                  {item.product?.code ?? "Produit"}
                                </Badge>
                              ))}
                            </div>
                          ) : null}
                          {formattedAddress ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <MapPin aria-hidden="true" className="h-4 w-4" />
                              <span>{formattedAddress}</span>
                            </div>
                          ) : null}
                          {dynamicFieldItems.length > 0 ? (
                            <dl className="grid gap-3 text-sm sm:grid-cols-2">
                              {dynamicFieldItems.map((item) => (
                                <div key={item.key} className="flex items-center justify-between gap-3">
                                  <dt className="text-muted-foreground">{item.label}</dt>
                                  <dd className="font-medium text-right text-foreground">{item.value}</dd>
                                </div>
                              ))}
                            </dl>
                          ) : null}
                        </div>
                        {(project.surface_batiment_m2 ||
                          project.surface_isolee_m2 ||
                          surfaceFacturee ||
                          startDate ||
                          endDate) && (
                          <div className="grid gap-4 text-sm sm:grid-cols-2">
                            {project.surface_batiment_m2 ? (
                              <div className="space-y-1">
                                <span className="text-muted-foreground">Surface bâtiment</span>
                                <span className="font-medium text-foreground">
                                  {formatDecimal(project.surface_batiment_m2)} m²
                                </span>
                              </div>
                            ) : null}
                            {project.surface_isolee_m2 ? (
                              <div className="space-y-1">
                                <span className="text-muted-foreground">Surface isolée</span>
                                <span className="font-medium text-foreground">
                                  {formatDecimal(project.surface_isolee_m2)} m²
                                </span>
                              </div>
                            ) : null}
                            {surfaceFacturee ? (
                              <div className="space-y-1">
                                <span className="text-muted-foreground">Surface facturée</span>
                                <span className="font-medium text-foreground">
                                  {formatDecimal(surfaceFacturee)} m²
                                </span>
                              </div>
                            ) : null}
                            {startDate ? (
                              <div className="space-y-1">
                                <span className="flex items-center gap-2 text-muted-foreground">
                                  <Calendar aria-hidden="true" className="h-4 w-4" />
                                  Début
                                </span>
                                <span className="font-medium text-foreground">
                                  {startDate.toLocaleDateString("fr-FR")}
                                </span>
                              </div>
                            ) : null}
                            {endDate ? (
                              <div className="space-y-1">
                                <span className="flex items-center gap-2 text-muted-foreground">
                                  <Calendar aria-hidden="true" className="h-4 w-4" />
                                  Fin prévue
                                </span>
                                <span className="font-medium text-foreground">
                                  {endDate.toLocaleDateString("fr-FR")}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        )}
                        <dl className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <dt className="text-sm font-medium text-muted-foreground">Prime CEE totale</dt>
                            <dd className="mt-1 text-base font-semibold text-emerald-600">
                              {formatCurrency(totalPrime)}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-sm font-medium text-muted-foreground">Référence externe</dt>
                            <dd className="mt-1 text-base text-foreground">
                              {externalReference && externalReference.length > 0
                                ? externalReference
                                : "Non renseignée"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-sm font-medium text-muted-foreground">MWh généré par projet</dt>
                            <dd className="mt-1 text-base font-semibold text-foreground">
                              {formatDecimal(totalValorisationMwh)} MWh
                            </dd>
                          </div>
                          <div>
                            <dt className="text-sm font-medium text-muted-foreground">Assigné à</dt>
                            <dd className="mt-1 text-base text-foreground">
                              {assignedTo && assignedTo.length > 0 ? assignedTo : "Non assigné"}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-sm font-medium text-muted-foreground">Source</dt>
                            <dd className="mt-1 text-base text-foreground">
                              {sourceLabel && sourceLabel.length > 0 ? sourceLabel : "Non renseignée"}
                            </dd>
                          </div>
                          {delegateName ? (
                            <div>
                              <dt className="text-sm font-medium text-muted-foreground">Délégataire</dt>
                              <dd className="mt-1 text-base text-foreground">
                                <span className="flex items-center gap-1">
                                  <UserRound aria-hidden="true" className="h-4 w-4" />
                                  <span>{delegateName}</span>
                                  {formattedDelegatePrice ? (
                                    <span className="text-xs text-muted-foreground">
                                      ({formattedDelegatePrice} / MWh)
                                    </span>
                                  ) : null}
                                </span>
                              </dd>
                            </div>
                          ) : null}
                          {typeof projectCostValue === "number" ? (
                            <div>
                              <dt className="text-sm font-medium text-muted-foreground">Coût du chantier</dt>
                              <dd className="mt-1 text-base font-semibold text-primary">
                                {formatCurrency(projectCostValue)}
                              </dd>
                            </div>
                          ) : null}
                          {primeCeeEuro !== null ? (
                            <div>
                              <dt className="text-sm font-medium text-muted-foreground">Prime CEE estimée</dt>
                              <dd className="mt-1 text-base font-semibold text-emerald-600">
                                {formatCurrency(primeCeeEuro)}
                              </dd>
                            </div>
                          ) : null}
                        </dl>
                        {displayedValorisationEntries.length > 0 ? (
                          <div className="space-y-3 text-sm">
                            {displayedValorisationEntries.map((entry) => {
                              const valorisationLabel = (entry.valorisationLabel || "Valorisation m²/LED").trim();
                              return (
                                <div
                                  key={`${project.id}-valorisation-${entry.projectProductId}`}
                                  className="space-y-1 rounded-md border border-border/60 bg-muted/30 p-3"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                                      {valorisationLabel}
                                      {entry.productCode ? ` (${entry.productCode})` : ""}
                                    </span>
                                    <span className="text-sm font-semibold text-amber-600 text-right">
                                      {formatCurrency(entry.valorisationTotalEur ?? entry.totalPrime ?? 0)}
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                                    <span>
                                      {`${formatDecimal(entry.valorisationPerUnitMwh)} MWh × ${entry.multiplierLabel}`}
                                    </span>
                                    <span className="font-semibold text-emerald-600">
                                      {formatCurrency(entry.valorisationPerUnitEur ?? 0)} / {entry.multiplierLabel}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                        <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full sm:w-auto"
                            onClick={() => handleViewProject(project.id)}
                          >
                            <Eye aria-hidden="true" className="mr-2 h-4 w-4" />
                            Voir
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full sm:w-auto"
                            onClick={() => handleCreateQuote(project)}
                          >
                            <FileText aria-hidden="true" className="mr-2 h-4 w-4" />
                            Devis
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="w-full sm:w-auto"
                            onClick={() => handleCreateSite(project)}
                          >
                            <Hammer aria-hidden="true" className="mr-2 h-4 w-4" />
                            Créer chantier
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                },
              )}
            </div>
          ) : (
            <Card className="shadow-card bg-gradient-card border border-black/10">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="w-[160px]">Référence</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Produits</TableHead>
                      <TableHead>Localisation</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Finances</TableHead>
                      <TableHead>Assigné</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProjects.map(
                      ({
                        project,
                        displayedProducts,
                        displayedValorisationEntries,
                        clientName,
                        projectEmail,
                        surfaceFacturee,
                        category,
                      }) => {
                        const statusConfig = statusMap[project.status ?? ""];
                        const badgeStyle = getProjectStatusBadgeStyle(statusConfig?.color);
                        const statusLabel = statusConfig?.label ?? project.status ?? "Statut";
                        const projectCostValue = project.estimated_value ?? null;
                        const valorisationSummary = displayedValorisationEntries[0];
                        const categoryLabel =
                          category === "EQ"
                            ? "Éclairage"
                            : category === "EN"
                              ? "Isolation"
                              : null;

                        return (
                          <TableRow
                            key={project.id}
                            className="bg-background/60 transition-colors hover:bg-muted/40"
                          >
                            <TableCell className="align-top">
                              <div className="font-semibold text-primary">{project.project_ref}</div>
                            </TableCell>
                            <TableCell className="align-top">
                              <div className="font-medium text-foreground">{clientName}</div>
                              {project.company && (
                                <div className="text-xs text-muted-foreground">{project.company}</div>
                              )}
                              {(project.phone || projectEmail) && (
                                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                                  {project.phone && (
                                    <div className="flex items-center gap-1">
                                      <Phone className="h-3.5 w-3.5" />
                                      {project.phone}
                                    </div>
                                  )}
                                  {projectEmail && (
                                    <div className="flex items-center gap-1">
                                      <Mail className="h-3.5 w-3.5" />
                                      {projectEmail}
                                    </div>
                                  )}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="align-top">
                              {displayedProducts.length ? (
                                <div className="flex flex-wrap gap-1">
                                  {displayedProducts.map((item, index) => (
                                    <Badge
                                      key={`${project.id}-${item.product?.code}-${index}`}
                                      variant="secondary"
                                      className="text-xs font-medium"
                                    >
                                      {item.product?.code}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">Aucun produit</span>
                              )}
                            </TableCell>
                            <TableCell className="align-top">
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <MapPin className="h-4 w-4" />
                                {(project as Project & { address?: string }).address
                                  ? `${(project as Project & { address?: string }).address} • ${project.postal_code} ${project.city}`
                                  : `${project.city} (${project.postal_code})`}
                              </div>
                              {surfaceFacturee > 0 && (
                                <div className="mt-2 text-xs text-muted-foreground">
                                  Surface facturée :{" "}
                                  <span className="font-medium text-foreground">
                                    {formatDecimal(surfaceFacturee)} m²
                                  </span>
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="align-top space-y-1">
                              {categoryLabel && (
                                <div className="text-sm font-medium text-foreground">
                                  {categoryLabel}
                                </div>
                              )}
                              <Badge variant="outline" style={badgeStyle}>
                                {statusLabel}
                              </Badge>
                            </TableCell>
                            <TableCell className="align-top space-y-2">
                              {typeof projectCostValue === "number" && (
                                <div className="flex items-center gap-1 text-sm font-semibold text-primary">
                                  <Euro className="h-4 w-4" />
                                  {formatCurrency(projectCostValue)}
                                </div>
                              )}
                              {typeof project.prime_cee === "number" && (
                                <div className="flex items-center gap-1 text-sm font-semibold text-emerald-600">
                                  <HandCoins className="h-4 w-4" />
                                  {formatCurrency(project.prime_cee)}
                                </div>
                              )}
                              {valorisationSummary && (
                                <div className="text-xs text-muted-foreground">
                                  Valorisation :{" "}
                                  <span className="font-semibold text-amber-600">
                                    {formatCurrency(
                                      valorisationSummary.valorisationTotalEur ??
                                        valorisationSummary.totalPrime ??
                                        0,
                                    )}
                                  </span>
                                  {valorisationSummary.productCode && (
                                    <span className="block text-muted-foreground/80">
                                      {valorisationSummary.productCode}
                                    </span>
                                  )}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="align-top text-sm font-medium text-foreground">
                              {project.assigned_to || "—"}
                            </TableCell>
                            <TableCell className="align-top min-w-[220px] text-right">
                              <div className="flex flex-wrap justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleViewProject(project.id)}
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  Voir
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleCreateQuote(project)}
                                >
                                  <FileText className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => handleCreateSite(project)}
                                >
                                  <Hammer className="h-4 w-4 mr-1" />
                                  Chantier
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      },
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )
        ) : (
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
