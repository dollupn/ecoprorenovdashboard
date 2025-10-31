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
  type SiteFormValues,
  type SiteSubmitValues,
} from "@/components/sites/SiteDialog";
import { toast as showToast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import type { ProjectStatus } from "@/integrations/supabase/types";
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
  Loader2,
  NotebookPen,
  Images,
  CheckCircle2,
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

type ProjectsProps = {
  title?: string;
  description?: string;
  allowedProjectIds?: string[] | null;
  isRestrictionLoading?: boolean;
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
type StatusFilterValue = "active" | "archived" | "all" | ProjectStatusSetting["value"];

const ARCHIVED_STATUS_VALUES = ["ARCHIVE", "ARCHIVED"] as const;
const ARCHIVED_STATUS_SET = new Set<string>(ARCHIVED_STATUS_VALUES);

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

const Projects = ({
  title = "Gestion des Projets",
  description = "Suivi et gestion de vos projets de rénovation énergétique",
  allowedProjectIds,
  isRestrictionLoading = false,
}: ProjectsProps = {}) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { currentOrgId } = useOrg();
  const { data: members = [], isLoading: membersLoading } = useMembers(currentOrgId);
  const {
    statuses: projectStatuses,
    isLoading: projectStatusesLoading,
    isFetching: projectStatusesFetching,
    error: projectStatusesError,
  } = useProjectStatuses();
  const projectStatusQueriesBusy = projectStatusesLoading || projectStatusesFetching;
  const { primeBonification } = useOrganizationPrimeSettings();
  const restrictionNotReady = allowedProjectIds === null;
  const normalizedAllowedProjectIds = useMemo(() => {
    if (!Array.isArray(allowedProjectIds)) {
      return null;
    }

    const uniqueIds = new Set<string>();
    allowedProjectIds.forEach((id) => {
      if (typeof id === "string") {
        const trimmed = id.trim();
        if (trimmed.length > 0) {
          uniqueIds.add(trimmed);
        }
      }
    });

    return Array.from(uniqueIds).sort();
  }, [allowedProjectIds]);
  const hasRestriction = Array.isArray(allowedProjectIds);
  const [searchTerm, setSearchTerm] = useState("");
  const [assignedFilter, setAssignedFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilterValue>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>(() => {
    const statusParam = searchParams.get("status");
    if (!statusParam) {
      return "active";
    }

    if (statusParam === "all" || statusParam === "active" || statusParam === "archived") {
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

  useEffect(() => {
    if (!projectStatusesError) return;

    console.error("Erreur lors du chargement des statuts projets", projectStatusesError);
    showToast("Statuts projets indisponibles", {
      description: "Les statuts ont été chargés avec les valeurs par défaut.",
    });
  }, [projectStatusesError]);

  const currentMember = members.find((member) => member.user_id === user?.id);
  const isAdmin = currentMember?.role === "admin" || currentMember?.role === "owner";

  const inactiveProjectStatuses = useMemo(() => {
    const inactiveValues = new Set(
      projectStatuses
        .filter((status) => status.isActive === false)
        .map((status) => status.value),
    );
    ARCHIVED_STATUS_VALUES.forEach((status) => inactiveValues.add(status));
    return inactiveValues;
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
    queryKey: [
      "projects",
      user?.id,
      currentOrgId,
      isAdmin,
      hasRestriction ? normalizedAllowedProjectIds : "all",
      statusFilter,
    ],
    queryFn: async () => {
      if (!user) return [];

      if (hasRestriction && (normalizedAllowedProjectIds?.length ?? 0) === 0) {
        return [];
      }

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

      if (hasRestriction && normalizedAllowedProjectIds && normalizedAllowedProjectIds.length > 0) {
        query = query.in("id", normalizedAllowedProjectIds);
      }

      const archivedStatuses = [...ARCHIVED_STATUS_VALUES];

      if (statusFilter === "archived") {
        query = query.in("status", archivedStatuses);
      } else if (statusFilter === "active") {
        const archivedFilter = `(${archivedStatuses.join(",")})`;
        query = query.not("status", "in", archivedFilter);
      } else if (statusFilter !== "all") {
        query = query.eq("status", statusFilter as ProjectStatus);
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
    enabled:
      !!user &&
      (!currentOrgId || !membersLoading) &&
      !isRestrictionLoading &&
      !restrictionNotReady,
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
    } else if (statusParam === "all" || statusParam === "active" || statusParam === "archived") {
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

  const [statusUpdating, setStatusUpdating] = useState<Record<string, boolean>>({});

  const handleProjectStatusChange = useCallback(
    async (projectId: string, status: ProjectStatusSetting["value"]) => {
      if (!currentOrgId) {
        showToast("Organisation introuvable", {
          description: "Impossible de mettre à jour le statut du projet.",
        });
        return;
      }

      setStatusUpdating((previous) => ({ ...previous, [projectId]: true }));

      try {
        const response = await fetch(`/api/projects/${projectId}/status`, {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          const message =
            (typeof payload?.message === "string" && payload.message) ||
            "Impossible de mettre à jour le statut du projet.";
          throw new Error(message);
        }

        const statusLabel = statusMap[status]?.label ?? status;
        showToast("Statut mis à jour", {
          description: statusLabel,
        });

        await refetch();
      } catch (error) {
        console.error(error);
        showToast("Erreur lors de la mise à jour du statut", {
          description: error instanceof Error ? error.message : undefined,
        });
      } finally {
        setStatusUpdating((previous) => ({ ...previous, [projectId]: false }));
      }
    },
    [currentOrgId, refetch, statusMap],
  );

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
    } else if (statusFilter === "archived") {
      base = base.filter((item) => ARCHIVED_STATUS_SET.has(item.project.status ?? ""));
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
      if (value === "__divider") {
        return;
      }

      let next: StatusFilterValue;

      if (value === "all" || value === "active" || value === "archived") {
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
          } else if (next === "all" || next === "archived") {
            params.set("status", next);
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

  const handleViewProject = useCallback(
    (projectId: string) => {
      navigate(`/projects/${projectId}`);
    },
    [navigate],
  );

  const handleOpenProjectTab = useCallback(
    (projectId: string, tab: "journal" | "media") => {
      navigate(`/projects/${projectId}?tab=${tab}`);
    },
    [navigate],
  );

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
      travaux_non_subventionnes: 0,
      valorisation_cee: valorisationTotalEur,
      travaux_non_subventionnes: "NA",
      travaux_non_subventionnes_description: "",
      travaux_non_subventionnes_montant: 0,
      travaux_non_subventionnes_financement: false,
      commission_commerciale_ht: false,
      commission_commerciale_ht_montant: 0,
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

  const handleSubmitSite = useCallback(async (values: SiteSubmitValues) => {
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
            const montantTVA = Number.isFinite(cost.montant_tva) ? cost.montant_tva : 0;
            const amountHT = Number.isFinite(cost.amount_ht) ? cost.amount_ht : 0;
            const amountTTC = Number.isFinite(cost.amount_ttc)
              ? cost.amount_ttc
              : Math.round((amountHT + montantTVA) * 100) / 100;

            return {
              label: cost.label.trim(),
              amount_ht: amountHT,
              montant_tva: montantTVA,
              amount_ttc: amountTTC,
              attachment: attachment.length > 0 ? attachment : null,
            };
          })
      : [];

    const projectRef = values.project_ref?.trim?.() ?? "";
    const clientName = values.client_name?.trim?.() ?? "";
    const travauxChoice = values.travaux_non_subventionnes ?? "NA";
    const shouldResetTravaux = travauxChoice === "NA";
    const travauxDescription = shouldResetTravaux
      ? ""
      : values.travaux_non_subventionnes_description?.trim() ?? "";
    const travauxMontant = shouldResetTravaux
      ? 0
      : Number.isFinite(values.travaux_non_subventionnes_montant)
        ? values.travaux_non_subventionnes_montant
        : 0;
    const travauxFinancement = shouldResetTravaux
      ? false
      : Boolean(values.travaux_non_subventionnes_financement);
    const commissionActive = Boolean(values.commission_commerciale_ht);
    const commissionMontant = commissionActive
      ? Number.isFinite(values.commission_commerciale_ht_montant)
        ? values.commission_commerciale_ht_montant
        : 0
      : 0;
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
      profit_margin: values.rentability_margin_rate,
      surface_facturee: values.surface_facturee,
      cout_main_oeuvre_m2_ht: values.cout_main_oeuvre_m2_ht,
      cout_isolation_m2: values.cout_isolation_m2,
      isolation_utilisee_m2: values.isolation_utilisee_m2,
      montant_commission: values.montant_commission,
      travaux_non_subventionnes: values.travaux_non_subventionnes,
      valorisation_cee: values.valorisation_cee,
      subcontractor_payment_confirmed: values.subcontractor_payment_confirmed,
      travaux_non_subventionnes: travauxChoice,
      travaux_non_subventionnes_description: travauxDescription,
      travaux_non_subventionnes_montant: travauxMontant,
      travaux_non_subventionnes_financement: travauxFinancement,
      commission_commerciale_ht: commissionActive,
      commission_commerciale_ht_montant: commissionMontant,
      notes: values.notes?.trim() || null,
      team_members: (sanitizedTeam.length > 0 ? sanitizedTeam : []) as string[],
      additional_costs: sanitizedCosts.length > 0 ? sanitizedCosts : [],
      subcontractor_id: values.subcontractor_id ?? null,
      user_id: user.id,
      org_id: currentOrgId,
      project_id: projectId,
      rentability_total_costs: values.rentability_total_costs,
      rentability_margin_total: values.rentability_margin_total,
      rentability_margin_per_unit: values.rentability_margin_per_unit,
      rentability_margin_rate: values.rentability_margin_rate,
      rentability_unit_label: values.rentability_unit_label,
      rentability_unit_count: values.rentability_unit_count,
      rentability_additional_costs_total: values.rentability_additional_costs_total,
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

  if (isLoading || membersLoading || isRestrictionLoading || restrictionNotReady) {
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
              {title}
            </h1>
            {description ? (
              <p className="text-muted-foreground mt-1">{description}</p>
            ) : null}
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
                    Afficher
                  </span>
                  <Select
                    value={statusFilter}
                    onValueChange={handleStatusFilterChange}
                    disabled={projectStatusQueriesBusy && projectStatuses.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Filtrer les projets" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Actifs</SelectItem>
                      <SelectItem value="archived">Archivés</SelectItem>
                      <SelectItem value="all">Tous</SelectItem>
                      {projectStatuses.length > 0 && (
                        <SelectItem
                          value="__divider"
                          disabled
                          className="pointer-events-none text-xs font-semibold text-muted-foreground"
                        >
                          Statuts personnalisés
                        </SelectItem>
                      )}
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
                    const isStatusUpdating = statusUpdating[project.id] ?? false;
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

                  return (
                    <Card
                      key={project.id}
                      className={cn(
                        "group relative overflow-hidden border border-border/50 bg-card shadow-sm",
                        "transition-all duration-300 hover:shadow-lg hover:shadow-primary/5",
                        "hover:border-primary/30 hover:-translate-y-0.5",
                      )}
                    >
                      {/* Top accent bar with gradient */}
                      <div
                        aria-hidden="true"
                        className={cn(
                          "absolute inset-x-0 top-0 h-1 bg-gradient-to-r transition-all duration-300",
                          "group-hover:h-1.5",
                          categoryMetadata.accentBar,
                        )}
                      />
                      
                      <CardHeader className="space-y-4 pb-4">
                        {/* Header: Category Icon, Ref, Status, Edit */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div
                              className={cn(
                                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                                "transition-transform duration-300 group-hover:scale-110",
                                categoryMetadata.iconWrapper,
                              )}
                            >
                              <CategoryIcon className="h-5 w-5" aria-hidden="true" />
                              <span className="sr-only">{categoryMetadata.srLabel}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleViewProject(project.id);
                                }}
                                className="text-left w-full group/title"
                              >
                                <h3 className="text-base font-semibold text-foreground truncate transition-colors group-hover/title:text-primary">
                                  {project.project_ref || "Sans référence"}
                                </h3>
                              </button>
                              <div className="flex items-center gap-2 mt-1.5">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild disabled={isStatusUpdating}>
                                    <button
                                      type="button"
                                      onClick={(event) => event.stopPropagation()}
                                      className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
                                      aria-label="Changer le statut du projet"
                                    >
                                      <Badge
                                        variant="outline"
                                        style={badgeStyle}
                                        className={cn(
                                          "text-xs font-medium px-2.5 py-0.5 transition",
                                          isStatusUpdating
                                            ? "cursor-not-allowed opacity-70"
                                            : "cursor-pointer hover:shadow",
                                        )}
                                      >
                                        {isStatusUpdating ? (
                                          <>
                                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                                            Mise à jour...
                                          </>
                                        ) : (
                                          statusLabel
                                        )}
                                      </Badge>
                                    </button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="start" className="w-56">
                                    <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                      Changer le statut
                                    </div>
                                    {projectStatuses
                                      .filter((status) => status != null)
                                      .map((status) => {
                                        const isActive = status.value === (project.status ?? "");
                                        return (
                                          <DropdownMenuItem
                                            key={status.value}
                                            onClick={() => {
                                              void handleProjectStatusChange(project.id, status.value);
                                            }}
                                            disabled={isActive || isStatusUpdating}
                                            className="flex items-center justify-between gap-2"
                                          >
                                            <span>{status.label}</span>
                                            {isActive ? (
                                              <CheckCircle2 className="h-4 w-4 text-primary" />
                                            ) : null}
                                          </DropdownMenuItem>
                                        );
                                      })}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="shrink-0 h-8 w-8 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleViewProject(project.id);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                              <span className="sr-only">Voir</span>
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="shrink-0 h-8 w-8 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleOpenProjectTab(project.id, "journal");
                              }}
                            >
                              <NotebookPen className="h-4 w-4" />
                              <span className="sr-only">Journal</span>
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="shrink-0 h-8 w-8 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleOpenProjectTab(project.id, "media");
                              }}
                            >
                              <Images className="h-4 w-4" />
                              <span className="sr-only">Médias</span>
                            </Button>
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
                                  className="shrink-0 h-8 w-8 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <Pencil className="h-4 w-4" />
                                  <span className="sr-only">Modifier</span>
                                </Button>
                              }
                            />
                          </div>
                        </div>

                        {/* Contact Info */}
                        <div className="space-y-2.5">
                          <p className="text-sm font-semibold text-foreground">{contactDisplay}</p>
                          {companyDisplay && (
                            <p className="text-xs text-muted-foreground/90">{companyDisplay}</p>
                          )}
                          
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                            {project.siren && (
                              <span className="flex items-center gap-1.5 bg-muted/40 px-2 py-1 rounded-md">
                                <span className="font-medium text-foreground">SIREN:</span> {project.siren}
                              </span>
                            )}
                            {project.phone && (
                              <a
                                href={`tel:${project.phone}`}
                                className="flex items-center gap-1.5 hover:text-primary transition-colors bg-muted/40 px-2 py-1 rounded-md"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Phone className="h-3.5 w-3.5" />
                                {project.phone}
                              </a>
                            )}
                            {projectEmail && (
                              <a
                                href={`mailto:${projectEmail}`}
                                className="flex items-center gap-1.5 hover:text-primary transition-colors bg-muted/40 px-2 py-1 rounded-md"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Mail className="h-3.5 w-3.5" />
                                {projectEmail}
                              </a>
                            )}
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-5 pb-5">
                        {/* Products & Address */}
                        <div className="space-y-3">
                          {displayedProducts.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {displayedProducts.map((item, index) => (
                                <Badge
                                  key={`${project.id}-${item.product?.code ?? index}`}
                                  variant="secondary"
                                  className="text-xs font-semibold px-2.5 py-1 bg-primary/10 text-primary border border-primary/20"
                                >
                                  {item.product?.code ?? "Produit"}
                                </Badge>
                              ))}
                            </div>
                          )}
                          
                          {formattedAddress && (
                            <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg">
                              <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                              <span className="line-clamp-2 leading-relaxed">{formattedAddress}</span>
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
                          <div className="rounded-lg bg-gradient-to-br from-muted/50 to-muted/30 p-4 space-y-3 border border-border/30">
                            <div className="grid grid-cols-2 gap-x-5 gap-y-3 text-xs">
                              {project.surface_batiment_m2 && (
                                <div className="space-y-1">
                                  <div className="text-muted-foreground/80 text-[11px] uppercase tracking-wide">Surface bâtiment</div>
                                  <div className="font-semibold text-foreground text-sm">
                                    {formatDecimal(project.surface_batiment_m2)} m²
                                  </div>
                                </div>
                              )}
                              {project.surface_isolee_m2 && (
                                <div className="space-y-1">
                                  <div className="text-muted-foreground/80 text-[11px] uppercase tracking-wide">Surface isolée</div>
                                  <div className="font-semibold text-foreground text-sm">
                                    {formatDecimal(project.surface_isolee_m2)} m²
                                  </div>
                                </div>
                              )}
                              {showSurfaceFacturee && (
                                <div className="space-y-1">
                                  <div className="text-muted-foreground/80 text-[11px] uppercase tracking-wide">Surface facturée</div>
                                  <div className="font-semibold text-foreground text-sm">
                                    {formatDecimal(surfaceFacturee)} m²
                                  </div>
                                </div>
                              )}
                            </div>
                            
                            {(startDate || endDate) && (
                              <div className="flex items-center gap-2.5 text-xs text-muted-foreground pt-2 border-t border-border/40">
                                <Calendar className="h-4 w-4 shrink-0 text-primary" />
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                  {startDate && (
                                    <span>
                                      Début: <span className="font-semibold text-foreground">{startDate.toLocaleDateString("fr-FR")}</span>
                                    </span>
                                  )}
                                  {startDate && endDate && <span className="text-muted-foreground/40">•</span>}
                                  {endDate && (
                                    <span>
                                      Fin: <span className="font-semibold text-foreground">{endDate.toLocaleDateString("fr-FR")}</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Financial Info - Highlight Grid */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 rounded-lg border border-emerald-200/50 dark:border-emerald-900/30">
                            <div className="text-muted-foreground text-[11px] uppercase tracking-wide">Prime CEE totale</div>
                            <div className="text-base font-bold text-emerald-600 dark:text-emerald-500">
                              {formatCurrency(totalPrime)}
                            </div>
                          </div>
                          
                          <div className="space-y-1.5 bg-blue-50/50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-200/50 dark:border-blue-900/30">
                            <div className="text-muted-foreground text-[11px] uppercase tracking-wide">MWh généré</div>
                            <div className="text-base font-bold text-blue-600 dark:text-blue-500">
                              {formatDecimal(totalValorisationMwh)} MWh
                            </div>
                          </div>
                          
                          {typeof projectCostValue === "number" && (
                            <div className="space-y-1.5 bg-primary/5 p-3 rounded-lg border border-primary/20">
                              <div className="text-muted-foreground text-[11px] uppercase tracking-wide">Coût chantier</div>
                              <div className="text-base font-bold text-primary">
                                {formatCurrency(projectCostValue)}
                              </div>
                            </div>
                          )}
                          
                          {primeCeeEuro !== null && primeCeeEuro !== totalPrime && (
                            <div className="space-y-1.5 bg-amber-50/50 dark:bg-amber-950/20 p-3 rounded-lg border border-amber-200/50 dark:border-amber-900/30">
                              <div className="text-muted-foreground text-[11px] uppercase tracking-wide">Prime CEE estimée</div>
                              <div className="text-base font-bold text-amber-600 dark:text-amber-500">
                                {formatCurrency(primeCeeEuro)}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Assignment & References - Compact */}
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground border-t border-border/30 pt-4">
                          {assignedTo && (
                            <span className="flex items-center gap-1.5 bg-muted/40 px-2.5 py-1.5 rounded-md">
                              <UserRound className="h-3.5 w-3.5 text-primary" />
                              <span className="font-medium text-foreground">{assignedTo}</span>
                            </span>
                          )}
                          {externalReference && (
                            <span className="flex items-center gap-1.5 bg-muted/40 px-2.5 py-1.5 rounded-md">
                              <span className="font-medium text-foreground">Réf. ext:</span> {externalReference}
                            </span>
                          )}
                        </div>

                          {/* Action Buttons */}
                          <div className="flex gap-2 pt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 h-9 text-xs font-medium hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-all"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleCreateQuote(project);
                              }}
                            >
                              <FileText className="mr-1.5 h-4 w-4" />
                              Devis
                            </Button>
                            <Button
                              size="sm"
                              variant="default"
                              className="flex-1 h-9 text-xs font-medium shadow-sm hover:shadow-md transition-all"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleCreateSite(project);
                              }}
                            >
                              <HardHat className="mr-1.5 h-4 w-4" />
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
                        const isStatusUpdating = statusUpdating[project.id] ?? false;
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
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild disabled={isStatusUpdating}>
                                  <button
                                    type="button"
                                    className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
                                    aria-label="Changer le statut du projet"
                                  >
                                    <Badge
                                      variant="outline"
                                      style={badgeStyle}
                                      className={cn(
                                        "transition",
                                        isStatusUpdating
                                          ? "cursor-not-allowed opacity-70"
                                          : "cursor-pointer hover:shadow",
                                      )}
                                    >
                                      {isStatusUpdating ? (
                                        <>
                                          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                          Mise à jour...
                                        </>
                                      ) : (
                                        statusLabel
                                      )}
                                    </Badge>
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-56">
                                  <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Changer le statut
                                  </div>
                                  {projectStatuses
                                    .filter((status) => status != null)
                                    .map((status) => {
                                      const isActive = status.value === (project.status ?? "");
                                      return (
                                        <DropdownMenuItem
                                          key={status.value}
                                          onClick={() => {
                                            void handleProjectStatusChange(project.id, status.value);
                                          }}
                                          disabled={isActive || isStatusUpdating}
                                          className="flex items-center justify-between gap-2"
                                        >
                                          <span>{status.label}</span>
                                          {isActive ? (
                                            <CheckCircle2 className="h-4 w-4 text-primary" />
                                          ) : null}
                                        </DropdownMenuItem>
                                      );
                                    })}
                                </DropdownMenuContent>
                              </DropdownMenu>
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
                                  onClick={() => handleOpenProjectTab(project.id, "journal")}
                                >
                                  <NotebookPen className="h-4 w-4 mr-1" />
                                  Journal
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenProjectTab(project.id, "media")}
                                >
                                  <Images className="h-4 w-4 mr-1" />
                                  Médias
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
