import { useCallback, useEffect, useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
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
  HandCoins,
  LayoutGrid,
  List,
  HardHat,
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
type StatusFilterValue = "active" | "all" | ProjectStatusSetting["value"];

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

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());

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
    if (!statusParam) {
      return "active";
    }

    if (statusParam === "all" || statusParam === "active") {
      return statusParam;
    }

    return statusParam as StatusFilterValue;
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

  const inactiveProjectStatuses = useMemo(() => {
    const inactiveValues = projectStatuses
      .map((status) => status.value)
      .filter((status) => ["LIVRE", "ANNULE"].includes(status));
    return new Set(inactiveValues);
  }, [projectStatuses]);

  const memberNameById = useMemo(() => {
    const result: Record<string, string> = {};
    members.forEach((member) => {
      if (!member?.user_id) {
        return;
      }

      const fullName = member.profiles?.full_name?.trim();
      result[member.user_id] = fullName && fullName.length > 0 ? fullName : "Utilisateur";
    });
    return result;
  }, [members]);

  const memberIdByName = useMemo(() => {
    const result: Record<string, string> = {};
    Object.entries(memberNameById).forEach(([id, name]) => {
      const normalized = name.trim().toLowerCase();
      if (normalized.length > 0 && !result[normalized]) {
        result[normalized] = id;
      }
    });
    return result;
  }, [memberNameById]);

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

  const statusValues = useMemo(() => projectStatuses.map((status) => status.value), [projectStatuses]);

  useEffect(() => {
    const statusParam = searchParams.get("status");

    let nextStatus: StatusFilterValue = "active";

    if (!statusParam) {
      nextStatus = "active";
    } else if (statusParam === "all" || statusParam === "active") {
      nextStatus = statusParam;
    } else if (statusValues.includes(statusParam)) {
      nextStatus = statusParam as StatusFilterValue;
    } else {
      nextStatus = "all";
    }

    setStatusFilter((previous) => (previous === nextStatus ? previous : nextStatus));

    if (
      statusParam &&
      nextStatus === "all" &&
      statusParam !== "all"
    ) {
      setSearchParams(
        (previous) => {
          const params = new URLSearchParams(previous);
          params.set("status", "all");
          return params;
        },
        { replace: true },
      );
    }
  }, [searchParams, statusValues, setSearchParams]);

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
    shouldHideSurfaceFactureeRow: boolean;
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

      const surfaceFactureeValue = surfaceFactureeByProject[project.id] ?? 0;
      const category = deriveProjectCategory(project, project.project_products ?? []);
      const hasEnCode = displayedProducts.some((item) =>
        (item.product?.code ?? "").toUpperCase().includes("EN"),
      );
      const hasSurfaceIsolee =
        typeof project.surface_isolee_m2 === "number" && Number.isFinite(project.surface_isolee_m2);
      const surfaceIsoleeValue = hasSurfaceIsolee ? (project.surface_isolee_m2 as number) : null;
      const hasSurfaceFacturee =
        typeof surfaceFactureeValue === "number" &&
        Number.isFinite(surfaceFactureeValue) &&
        surfaceFactureeValue > 0;
      const shouldHideSurfaceFactureeRow =
        (category === "EN" || hasEnCode) &&
        hasSurfaceIsolee &&
        hasSurfaceFacturee &&
        surfaceIsoleeValue !== null &&
        Math.round(surfaceIsoleeValue) === Math.round(surfaceFactureeValue);

      return {
        project,
        displayedProducts,
        dynamicFieldEntries,
        displayedValorisationEntries: projectValorisationSummaries[project.id]?.displayedPrimeEntries ?? [],
        searchableText: searchable,
        clientName,
        projectEmail,
        surfaceFacturee: surfaceFactureeValue,
        category,
        shouldHideSurfaceFactureeRow,
      } satisfies ProcessedProject;
    });
  }, [projects, projectValorisationSummaries, surfaceFactureeByProject]);

  const filteredProjects = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    let base = processedProjects;

    if (statusFilter === "active") {
      base = base.filter((item) => !inactiveProjectStatuses.has(item.project.status ?? ""));
    } else if (statusFilter !== "all") {
      base = base.filter((item) => (item.project.status ?? "") === statusFilter);
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
  }, [
    searchTerm,
    processedProjects,
    assignedFilter,
    statusFilter,
    categoryFilter,
    inactiveProjectStatuses,
  ]);

  const handleStatusFilterChange = useCallback(
    (value: string) => {
      let next: StatusFilterValue;

      if (value === "all" || value === "active") {
        next = value;
      } else {
        next = value as StatusFilterValue;
      }

      setStatusFilter(next);
      setSearchParams(
        (previous) => {
          const params = new URLSearchParams(previous);
          if (next === "active") {
            params.delete("status");
          } else if (next === "all") {
            params.set("status", "all");
          } else {
            params.set("status", next);
          }
          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const handleCategoryFilterChange = useCallback((value: string) => {
    if (value === "all" || value === "EQ" || value === "EN") {
      setCategoryFilter(value);
    }
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
      subcontractor_id: null,
      team_members: [],
      additional_costs: [],
      subcontractor_payment_confirmed: false,
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

    const sanitizedTeam = Array.from(
      new Set(
        (values.team_members ?? [])
          .map((member) => {
            if (!member) return null;

            const rawId = typeof member.id === "string" ? member.id.trim() : "";
            if (rawId && (isUuid(rawId) || memberNameById[rawId])) {
              return rawId;
            }

            const rawName = typeof member.name === "string" ? member.name.trim() : "";
            if (rawName.length > 0) {
              const matchedId = memberIdByName[rawName.toLowerCase()];
              if (matchedId) {
                return matchedId;
              }
            }

            return null;
          })
          .filter((value): value is string => Boolean(value)),
      ),
    );
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

    const projectRef = values.project_ref?.trim?.() ?? "";
    const clientName = values.client_name?.trim?.() ?? "";
    const matchedProject = projectOptions.find(
      (option) => option.project_ref === projectRef,
    );
    const projectId = typeof matchedProject?.id === "string" ? matchedProject.id : null;

    const siteData = {
      site_ref: values.site_ref,
      project_ref: projectRef,
      client_name: clientName,
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
      subcontractor_payment_confirmed: values.subcontractor_payment_confirmed,
      notes: values.notes?.trim() || null,
      team_members: sanitizedTeam.length > 0 ? sanitizedTeam : null,
      additional_costs: sanitizedCosts.length > 0 ? sanitizedCosts : [],
      subcontractor_id: values.subcontractor_id ?? null,
      user_id: user.id,
      created_by: user.id,
      org_id: currentOrgId,
      project_id: projectId,
    };

    try {
      const { error } = await supabase.from("sites").insert([siteData]);

      if (error) throw error;

      showToast("Chantier créé", {
        description: `${siteData.site_ref} a été ajouté à la liste des chantiers.`,
      });

      setSiteDialogOpen(false);
      setSiteInitialValues(undefined);
    } catch (error) {
      console.error("Error saving site:", error);
      showToast("Erreur", {
        description: "Impossible de créer le chantier.",
      });
    }
  }, [
    user,
    currentOrgId,
    projectOptions,
    memberIdByName,
    memberNameById,
  ]);

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
                <div className="flex flex-col gap-2 md:w-[220px]">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Catégorie
                  </span>
                  <Select value={categoryFilter} onValueChange={handleCategoryFilterChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Toutes les catégories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes les catégories</SelectItem>
                      <SelectItem value="EQ">Éclairage</SelectItem>
                      <SelectItem value="EN">Isolation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2 md:w-[220px]">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Statut
                  </span>
                  <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Tous les statuts" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les statuts</SelectItem>
                      <SelectItem value="active">Statuts actifs</SelectItem>
                      {projectStatuses.map((status) => (
                        <SelectItem key={status.value} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  shouldHideSurfaceFactureeRow,
                  category,
                }) => {
                  const statusConfig = statusMap[project.status ?? ""];
                  const badgeStyle = getProjectStatusBadgeStyle(statusConfig?.color);
                  const statusLabel = statusConfig?.label ?? project.status ?? "Statut";
                  const categoryMetadata =
                    (category ? CATEGORY_METADATA[category] : null) ?? DEFAULT_CATEGORY_METADATA;
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
                  const showSurfaceFacturee = surfaceFacturee > 0 && !shouldHideSurfaceFactureeRow;
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

                  const handleCardActivation = () => {
                    handleViewProject(project.id);
                  };

                  const handleCardKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleCardActivation();
                    }
                  };

                  return (
                    <Card
                      key={project.id}
                      className={cn(
                        "group relative overflow-hidden border bg-card shadow-sm transition-all duration-300",
                        "hover:shadow-md hover:border-primary/20 cursor-pointer",
                      )}
                      role="button"
                      tabIndex={0}
                      onClick={handleCardActivation}
                      onKeyDown={handleCardKeyDown}
                    >
                      {/* Top accent bar */}
                      <div
                        aria-hidden="true"
                        className={cn(
                          "absolute inset-x-0 top-0 h-1 bg-gradient-to-r transition-opacity",
                          categoryMetadata.accentBar,
                        )}
                      />
                      
                      <CardHeader className="space-y-4 pb-3">
                        {/* Header: Category Icon, Ref, Status, Edit */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div
                              className={cn(
                                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                                categoryMetadata.iconWrapper,
                              )}
                            >
                              <CategoryIcon className="h-4 w-4" aria-hidden="true" />
                              <span className="sr-only">{categoryMetadata.srLabel}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-base font-semibold text-foreground truncate">
                                {project.project_ref || "Sans référence"}
                              </h3>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" style={badgeStyle} className="text-xs">
                                  {statusLabel}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          
                          <AddProjectDialog
                            mode="edit"
                            projectId={project.id}
                            projectRef={project.project_ref}
                            initialValues={editInitialValues}
                            onProjectUpdated={() => void refetch()}
                            trigger={
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="shrink-0 h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                                onClick={(event) => event.stopPropagation()}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                <span className="sr-only">Modifier</span>
                              </Button>
                            }
                          />
                        </div>

                        {/* Contact Info */}
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-foreground">{contactDisplay}</p>
                          {companyDisplay && (
                            <p className="text-xs text-muted-foreground">{companyDisplay}</p>
                          )}
                          
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                            {project.siren && (
                              <span className="flex items-center gap-1">
                                <span className="font-medium">SIREN:</span> {project.siren}
                              </span>
                            )}
                            {project.phone && (
                              <a
                                href={`tel:${project.phone}`}
                                className="flex items-center gap-1 hover:text-primary transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Phone className="h-3 w-3" />
                                {project.phone}
                              </a>
                            )}
                            {projectEmail && (
                              <a
                                href={`mailto:${projectEmail}`}
                                className="flex items-center gap-1 hover:text-primary transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Mail className="h-3 w-3" />
                                {projectEmail}
                              </a>
                            )}
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-4 pb-4">
                        {/* Products & Address */}
                        <div className="space-y-2.5">
                          {displayedProducts.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                              {displayedProducts.map((item, index) => (
                                <Badge
                                  key={`${project.id}-${item.product?.code ?? index}`}
                                  variant="secondary"
                                  className="text-[10px] font-medium px-2 py-0.5"
                                >
                                  {item.product?.code ?? "Produit"}
                                </Badge>
                              ))}
                            </div>
                          )}
                          
                          {formattedAddress && (
                            <div className="flex items-start gap-2 text-xs text-muted-foreground">
                              <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                              <span className="line-clamp-2">{formattedAddress}</span>
                            </div>
                          )}
                        </div>

                        {/* Dynamic Fields */}
                        {dynamicFieldItems.length > 0 && (
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                            {dynamicFieldItems.map((item) => (
                              <div key={item.key} className="flex justify-between gap-2">
                                <span className="text-muted-foreground truncate">{item.label}</span>
                                <span className="font-medium text-foreground shrink-0">{item.value}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Surfaces & Dates */}
                        {(project.surface_batiment_m2 || project.surface_isolee_m2 || showSurfaceFacturee || startDate || endDate) && (
                          <div className="rounded-lg bg-muted/30 p-3 space-y-2">
                            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                              {project.surface_batiment_m2 && (
                                <div>
                                  <div className="text-muted-foreground">Surface bâtiment</div>
                                  <div className="font-medium text-foreground mt-0.5">
                                    {formatDecimal(project.surface_batiment_m2)} m²
                                  </div>
                                </div>
                              )}
                              {project.surface_isolee_m2 && (
                                <div>
                                  <div className="text-muted-foreground">Surface isolée</div>
                                  <div className="font-medium text-foreground mt-0.5">
                                    {formatDecimal(project.surface_isolee_m2)} m²
                                  </div>
                                </div>
                              )}
                              {showSurfaceFacturee && (
                                <div>
                                  <div className="text-muted-foreground">Surface facturée</div>
                                  <div className="font-medium text-foreground mt-0.5">
                                    {formatDecimal(surfaceFacturee)} m²
                                  </div>
                                </div>
                              )}
                            </div>
                            
                            {(startDate || endDate) && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t border-border/40">
                                <Calendar className="h-3.5 w-3.5 shrink-0" />
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                  {startDate && (
                                    <span>
                                      Début: <span className="font-medium text-foreground">{startDate.toLocaleDateString("fr-FR")}</span>
                                    </span>
                                  )}
                                  {startDate && endDate && <span>•</span>}
                                  {endDate && (
                                    <span>
                                      Fin: <span className="font-medium text-foreground">{endDate.toLocaleDateString("fr-FR")}</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Financial Info - Compact Grid */}
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="space-y-1">
                            <div className="text-muted-foreground">Prime CEE totale</div>
                            <div className="text-sm font-semibold text-emerald-600">
                              {formatCurrency(totalPrime)}
                            </div>
                          </div>
                          
                          <div className="space-y-1">
                            <div className="text-muted-foreground">MWh généré</div>
                            <div className="text-sm font-semibold text-foreground">
                              {formatDecimal(totalValorisationMwh)} MWh
                            </div>
                          </div>
                          
                          {typeof projectCostValue === "number" && (
                            <div className="space-y-1">
                              <div className="text-muted-foreground">Coût chantier</div>
                              <div className="text-sm font-semibold text-primary">
                                {formatCurrency(projectCostValue)}
                              </div>
                            </div>
                          )}
                          
                          {primeCeeEuro !== null && primeCeeEuro !== totalPrime && (
                            <div className="space-y-1">
                              <div className="text-muted-foreground">Prime CEE estimée</div>
                              <div className="text-sm font-semibold text-emerald-600">
                                {formatCurrency(primeCeeEuro)}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Assignment & References - Compact */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground border-t border-border/40 pt-3">
                          {assignedTo && (
                            <span className="flex items-center gap-1">
                              <span className="font-medium">Assigné:</span> {assignedTo}
                            </span>
                          )}
                          {externalReference && (
                            <span className="flex items-center gap-1">
                              <span className="font-medium">Réf. ext:</span> {externalReference}
                            </span>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2 pt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 h-8 text-xs"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleCreateQuote(project);
                            }}
                          >
                            <FileText className="mr-1.5 h-3.5 w-3.5" />
                            Devis
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="flex-1 h-8 text-xs"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleCreateSite(project);
                            }}
                          >
                            <HardHat className="mr-1.5 h-3.5 w-3.5" />
                            Chantier
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
                      <TableHead>Prime CEE</TableHead>
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
                        shouldHideSurfaceFactureeRow,
                      }) => {
                        const statusConfig = statusMap[project.status ?? ""];
                        const badgeStyle = getProjectStatusBadgeStyle(statusConfig?.color);
                        const statusLabel = statusConfig?.label ?? project.status ?? "Statut";
                        const primeCeeEuro = resolvePrimeCeeEuro(project);
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
                                    <a
                                      href={`tel:${project.phone}`}
                                      className="flex items-center gap-1"
                                    >
                                      <Phone className="h-3.5 w-3.5" />
                                      {project.phone}
                                    </a>
                                  )}
                                  {projectEmail && (
                                    <a
                                      href={`mailto:${projectEmail}`}
                                      className="flex items-center gap-1"
                                    >
                                      <Mail className="h-3.5 w-3.5" />
                                      {projectEmail}
                                    </a>
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
                              {surfaceFacturee > 0 && !shouldHideSurfaceFactureeRow && (
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
                            <TableCell className="align-top">
                              {typeof primeCeeEuro === "number" ? (
                                <div className="flex items-center gap-1 text-sm font-semibold text-emerald-600">
                                  <HandCoins className="h-4 w-4" />
                                  {formatCurrency(primeCeeEuro)}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
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
