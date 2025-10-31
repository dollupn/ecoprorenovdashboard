import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import type { Database, Tables, ProjectStatus } from "@/integrations/supabase/types";
import { startChantier, updateChantierStatus } from "@/integrations/chantiers";
import { useAuth } from "@/hooks/useAuth";
import {
  getProjectClientName,
  getProjectStatusBadgeStyle,
  type ProjectStatusSetting,
} from "@/lib/projects";
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
  AlertTriangle,
  Pencil,
  Users,
  Plus,
  Loader2,
  Share2,
  FolderOpen,
  UploadCloud,
  CircleDot,
  StickyNote,
  Image as ImageIcon,
  Clock,
  ChevronRight,
  NotebookPen,
  ClipboardList,
  Camera,
  CheckCircle2,
  Archive,
  Zap,
} from "lucide-react";
import { useOrg } from "@/features/organizations/OrgContext";
import { useMembers } from "@/features/members/api";
import {
  AddQuoteDialog,
  type QuoteFormValues,
} from "@/components/quotes/AddQuoteDialog";
import { ProjectScheduleDialog } from "@/components/projects/ProjectScheduleDialog";
import {
  SiteDialog,
  type SiteFormValues,
  type SiteProjectOption,
  type SiteSubmitValues,
} from "@/components/sites/SiteDialog";
import {
  TRAVAUX_NON_SUBVENTIONNES_LABELS,
  TRAVAUX_NON_SUBVENTIONNES_OPTIONS,
  type TravauxNonSubventionnesValue,
} from "@/components/sites/travauxNonSubventionnes";
import {
  getDynamicFieldEntries,
  getDynamicFieldNumericValue,
  formatDynamicFieldValue,
} from "@/lib/product-params";
import { parseSiteNotes } from "@/lib/sites";
import { calculateRentability, buildRentabilityInputFromSite } from "@/lib/rentability";
import { useProjectStatuses } from "@/hooks/useProjectStatuses";
import { useOrganizationPrimeSettings } from "@/features/organizations/useOrganizationPrimeSettings";
import {
  computePrimeCeeEur,
  computeProjectCeeTotals,
  type CeeConfig,
  type DynamicParams,
  type PrimeCeeResult,
} from "@/lib/cee";
import {
  withDefaultProductCeeConfig,
  type ProductCeeConfig,
} from "@/lib/prime-cee-unified";
import {
  normalizeValorisationFormula,
  formatFormulaCoefficient,
  getCategoryDefaultMultiplierKey,
  LEGACY_QUANTITY_KEY,
  resolveMultiplierKeyForCategory,
  FORMULA_QUANTITY_KEY,
  type ValorisationFormulaConfig,
} from "@/lib/valorisation-formula";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import type { PostgrestError } from "@supabase/supabase-js";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  kwh_cumac_values?: Pick<
    Tables<"product_kwh_cumac">,
    "id" | "building_type" | "kwh_cumac"
  >[];
};

type ProjectProduct = Pick<
  Tables<"project_products">,
  "id" | "product_id" | "quantity" | "dynamic_params"
> & {
  product: ProductSummary | null;
};

type ProjectAppointment = Tables<"project_appointments"> & {
  appointment_type?: Pick<Tables<"appointment_types">, "id" | "name"> | null;
};

type DelegateSummary = Pick<
  Tables<"delegates">,
  "id" | "name" | "price_eur_per_mwh"
>;

type UpcomingAppointmentDetail = {
  id: string;
  appointment: ProjectAppointment;
  dateTime: Date;
  formattedDate: string;
  metadata: string | null;
  notes: string | null;
};

type ProjectWithRelations = Project & {
  project_products: ProjectProduct[];
  delegate?: DelegateSummary | null;
  lead?: Pick<Tables<"leads">, "email"> | null;
  project_appointments: ProjectAppointment[];
};

const getDisplayedProducts = (projectProducts?: ProjectProduct[]) =>
  (projectProducts ?? []).filter((item) => {
    const code = (item.product?.code ?? "").toUpperCase();
    // Hide ECO* helper/edge products from display & counts
    return !code.startsWith("ECO");
  });

const currencyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});
const decimalFormatter = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const formatCurrency = (value: number) => currencyFormatter.format(value);
const formatDecimal = (value: number) => decimalFormatter.format(value);
const percentFormatter = new Intl.NumberFormat("fr-FR", {
  style: "percent",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});
const formatPercent = (value: number) => percentFormatter.format(value);

const SURFACE_FACTUREE_TARGETS = [
  "surface_facturee",
  "surface facturée",
] as const;

const ARCHIVED_STATUS_VALUES = new Set(["ARCHIVE", "ARCHIVED"]);
const ARCHIVED_STATUS_VALUE = "ARCHIVED";

type SiteStatus =
  | "PLANIFIE"
  | "EN_PREPARATION"
  | "EN_COURS"
  | "SUSPENDU"
  | "TERMINE"
  | "LIVRE";

type CofracStatus = "EN_ATTENTE" | "CONFORME" | "NON_CONFORME" | "A_PLANIFIER";

type ProjectSite = Tables<"sites"> & {
  subcontractor?: { id: string; name: string } | null;
};

type SiteAdditionalCostFormValue = SiteFormValues["additional_costs"][number];
type SiteTeamMemberFormValue = SiteFormValues["team_members"][number];

type ProjectMediaCategory =
  Database["public"]["Enums"]["project_media_category"];
type ProjectMediaItem = Tables<"project_media">;
type ProjectStatusEvent = Tables<"project_status_events">;
type ProjectNote = Tables<"project_notes">;

const MEDIA_CATEGORIES: { value: ProjectMediaCategory; label: string }[] = [
  { value: "PHOTOS", label: "Photos" },
  { value: "DEVIS", label: "Devis" },
  { value: "FACTURES", label: "Factures" },
  { value: "CONTRATS", label: "Contrats" },
  { value: "PRODUITS", label: "Produits" },
];

const MEDIA_CATEGORY_LABELS: Record<ProjectMediaCategory, string> =
  MEDIA_CATEGORIES.reduce(
    (acc, item) => {
      acc[item.value] = item.label;
      return acc;
    },
    {} as Record<ProjectMediaCategory, string>,
  );

type JournalEntryType = "status" | "rdv" | "note" | "docs" | "chantier";

type JournalEntry = {
  id: string;
  type: JournalEntryType;
  title: string;
  description?: string | null;
  date: string;
  metadata?: string | null;
  actor?: string | null;
  linkUrl?: string | null;
};

type JournalFilter = "all" | "status" | "rdv" | "notes" | "docs" | "chantiers";
type ProjectUpdateRecord = {
  id: string;
  project_id: string;
  content?: string | null;
  status?: string | null;
  next_step?: string | null;
  created_at: string;
  author_id?: string | null;
  org_id?: string | null;
};

type ProjectUpdatesQueryResult = {
  updates: ProjectUpdateRecord[];
  tableAvailable: boolean;
  error?: PostgrestError | null;
};

type HistoryEntry = {
  text: string;
  createdAt?: string | null;
};
type ProjectTabValue = "details" | "chantiers" | "media" | "journal";

const DEFAULT_PROJECT_TAB: ProjectTabValue = "details";

const isValidProjectTab = (
  value: string | null | undefined,
): value is ProjectTabValue =>
  value === "details" ||
  value === "chantiers" ||
  value === "media" ||
  value === "journal";

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );

const createEmptyAdditionalCost = (): SiteAdditionalCostFormValue => ({
  label: "",
  amount_ht: 0,
  montant_tva: 0,
  amount_ttc: 0,
  attachment: null,
});

const computeAdditionalCostTTC = (amountHT: number, montantTVA: number) =>
  Math.round((amountHT + montantTVA) * 100) / 100;

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

type ProductImage = { url: string; alt?: string | null };

const normalizeImageEntry = (value: unknown): ProductImage | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? { url: trimmed, alt: null } : null;
  }

  if (!isRecord(value)) {
    return null;
  }

  const rawUrl =
    typeof value.url === "string"
      ? value.url
      : typeof value.src === "string"
        ? value.src
        : typeof value.href === "string"
          ? value.href
          : null;

  if (!rawUrl) {
    return null;
  }

  const alt =
    typeof value.alt === "string"
      ? value.alt
      : typeof value.label === "string"
        ? value.label
        : typeof value.name === "string"
          ? value.name
          : null;

  return { url: rawUrl, alt };
};

const extractImagesFromValue = (value: unknown, depth = 0): ProductImage[] => {
  if (!value || depth > 3) {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeImageEntry(entry))
      .filter((entry): entry is ProductImage => Boolean(entry));
  }

  if (typeof value === "string") {
    const normalized = normalizeImageEntry(value);
    return normalized ? [normalized] : [];
  }

  if (isRecord(value)) {
    if (Array.isArray(value.images)) {
      return extractImagesFromValue(value.images, depth + 1);
    }

    if (Array.isArray(value.items)) {
      return extractImagesFromValue(value.items, depth + 1);
    }

    const normalized = normalizeImageEntry(value);
    if (normalized) {
      return [normalized];
    }

    const nested: ProductImage[] = [];
    for (const nestedValue of Object.values(value)) {
      if (
        typeof nestedValue === "string" ||
        Array.isArray(nestedValue) ||
        isRecord(nestedValue)
      ) {
        nested.push(...extractImagesFromValue(nestedValue, depth + 1));
      }
    }
    return nested;
  }

  return [];
};

const getProductImages = (
  product: ProductSummary | null | undefined,
): ProductImage[] => {
  if (!product) {
    return [];
  }

  const defaults = isRecord(product.default_params)
    ? (product.default_params as Record<string, unknown>)
    : undefined;

  const sources: unknown[] = [];

  const rawImages = (product as unknown as { images?: unknown }).images;
  if (rawImages) {
    sources.push(rawImages);
  }

  if (defaults && defaults["images"]) {
    sources.push(defaults["images"]);
  }

  if (defaults && defaults["medias"]) {
    sources.push(defaults["medias"]);
  }

  const images: ProductImage[] = [];
  const seen = new Set<string>();

  sources.forEach((source) => {
    const entries = extractImagesFromValue(source);
    entries.forEach((entry) => {
      const url = entry.url?.trim?.();
      if (url && !seen.has(url)) {
        seen.add(url);
        images.push({ url, alt: entry.alt ?? null });
      }
    });
  });

  return images;
};

const getProductValorisationFormula = (
  product: ProductSummary | null | undefined,
): ValorisationFormulaConfig | null => {
  if (!product) {
    return null;
  }

  const defaults = isRecord(product.default_params)
    ? (product.default_params as Record<string, unknown>)
    : undefined;

  const ceeDefaults = isRecord(
    (product.cee_config as unknown as Record<string, unknown>)?.defaults,
  )
    ? ((product.cee_config as unknown as Record<string, unknown>)
        .defaults as Record<string, unknown>)
    : undefined;

  const candidates: unknown[] = [];

  if (defaults) {
    candidates.push(defaults["valorisation_formula"]);
    candidates.push(defaults["valorisationFormula"]);
    candidates.push(defaults["valorisation"]);
  }

  if (ceeDefaults) {
    candidates.push(ceeDefaults["valorisation_formula"]);
    candidates.push(ceeDefaults["valorisationFormula"]);
    candidates.push(ceeDefaults["valorisation"]);
  }

  for (const candidate of candidates) {
    const normalized = normalizeValorisationFormula(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return null;
};

const normalizeAdditionalCosts = (
  costs: unknown,
): SiteAdditionalCostFormValue[] => {
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
        parseNumber(raw.amount_ht) ??
        parseNumber(raw.amount) ??
        parseNumber(raw.amount_ttc) ??
        0;
      const montantTvaValue =
        parseNumber(raw.montant_tva) ??
        parseNumber(raw.taxes) ??
        0;
      const amountTTCValue =
        parseNumber(raw.amount_ttc) ??
        parseNumber(raw.total_ttc) ??
        parseNumber(raw.amount) ??
        computeAdditionalCostTTC(amountHTValue, montantTvaValue);
      const attachmentValue =
        typeof raw.attachment === "string" && raw.attachment.trim().length > 0
          ? raw.attachment.trim()
          : null;

      return {
        label,
        amount_ht: amountHTValue,
        montant_tva: montantTvaValue,
        amount_ttc: amountTTCValue,
        attachment: attachmentValue,
      } as SiteAdditionalCostFormValue;
    })
    .filter((cost) => cost !== null) as SiteAdditionalCostFormValue[];

  return normalized.length > 0 ? normalized : [createEmptyAdditionalCost()];
};

const isTableUnavailableError = (error: PostgrestError | null | undefined) => {
  if (!error) return false;
  return error.code === "42P01" || error.code === "42501";
};

const normalizeHistoryEntries = (raw: unknown): HistoryEntry[] => {
  if (!raw) return [];

  if (Array.isArray(raw)) {
    return raw
      .map((entry) => {
        if (typeof entry === "string") {
          const text = entry.trim();
          return text.length > 0 ? { text } : null;
        }

        if (entry && typeof entry === "object") {
          const value = entry as Record<string, unknown>;
          const candidate =
            typeof value.text === "string"
              ? value.text
              : typeof value.message === "string"
                ? value.message
                : null;

          if (!candidate) {
            return null;
          }

          const createdAt =
            typeof value.created_at === "string"
              ? value.created_at
              : typeof value.date === "string"
                ? value.date
                : undefined;

          return { text: candidate.trim(), createdAt } satisfies HistoryEntry;
        }

        return null;
      })
      .filter((entry) => entry !== null && typeof entry === 'object') as HistoryEntry[];
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed.length === 0) return [];

    try {
      const parsed = JSON.parse(trimmed);
      return normalizeHistoryEntries(parsed);
    } catch (error) {
      const segments = trimmed
        .split(/\r?\n|•|·|\|/)
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 0);
      return segments.map((segment) => ({ text: segment }));
    }
  }

  if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    if (Array.isArray(record.entries)) {
      return normalizeHistoryEntries(record.entries);
    }
    if (Array.isArray(record.items)) {
      return normalizeHistoryEntries(record.items);
    }
  }

  return [];
};

const formatDateTimeLabel = (
  value: string | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): string | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString(
    "fr-FR",
    options ?? {
      dateStyle: "long",
      timeStyle: "short",
    },
  );
};

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

const getCofracStatusLabel = (status: CofracStatus) => {
  const labels: Record<CofracStatus, string> = {
    EN_ATTENTE: "En attente",
    CONFORME: "Conforme",
    NON_CONFORME: "Non conforme",
    A_PLANIFIER: "Audit à planifier",
  };
  return labels[status];
};

const resolvePrimeCeeEuro = (project: Project | null | undefined) => {
  if (!project) return null;

  if (
    typeof project.prime_cee_total_cents === "number" &&
    Number.isFinite(project.prime_cee_total_cents)
  ) {
    return project.prime_cee_total_cents / 100;
  }

  if (
    typeof project.prime_cee === "number" &&
    Number.isFinite(project.prime_cee)
  ) {
    return project.prime_cee;
  }

  return null;
};

type ProjectProductCeeEntry = {
  projectProductId: string;
  productCode: string | null;
  productName: string | null;
  multiplierLabel: string | null;
  multiplierValue: number | null;
  result: PrimeCeeResult | null;
  warnings: {
    missingDynamicParams: boolean;
    missingKwh: boolean;
  };
};

type PrimeCeeLightingDetails = {
  per_led_mwh?: number | string | null;
  per_led_eur?: number | string | null;
  total_mwh?: number | string | null;
  total_eur?: number | string | null;
  missing_base?: boolean | null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(/\s+/g, "").replace(",", "."));
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const toPositiveNumber = (value: unknown): number | null => {
  const numeric = toNumber(value);
  return numeric !== null && numeric > 0 ? numeric : null;
};

const normalizeKey = (value: string | null | undefined) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const getSchemaFieldLabel = (
  paramsSchema: ProductSummary["params_schema"],
  key: string,
) => {
  if (!paramsSchema || !key) return null;

  const normalizedKey = normalizeKey(key);
  if (!normalizedKey) return null;

  const fields = Array.isArray(paramsSchema)
    ? paramsSchema
    : isRecord(paramsSchema) && Array.isArray(paramsSchema.fields)
      ? paramsSchema.fields
      : [];

  for (const field of fields as Array<Record<string, unknown>>) {
    if (!isRecord(field)) continue;
    const fieldName = normalizeKey(
      typeof field.name === "string" ? field.name : null,
    );
    if (!fieldName) continue;

    if (fieldName === normalizedKey) {
      if (typeof field.label === "string" && field.label.trim().length > 0) {
        return field.label;
      }

      if (typeof field.name === "string" && field.name.trim().length > 0) {
        return field.name;
      }
    }
  }

  return null;
};

const findKwhEntry = (
  product: ProductSummary | null | undefined,
  buildingType: string | null | undefined,
) => {
  if (!product || !Array.isArray(product.kwh_cumac_values)) return null;

  const normalized = normalizeKey(buildingType);
  if (!normalized) return null;

  return (
    product.kwh_cumac_values.find(
      (entry) => normalizeKey(entry.building_type) === normalized,
    ) ?? null
  );
};

const resolveBonificationValue = (
  primeBonification: number | null | undefined,
) => toPositiveNumber(primeBonification) ?? 2;

const resolveCoefficientValue = () => 1;

const resolveMultiplierDetails = (
  product: ProductSummary,
  projectProduct: ProjectProduct,
): {
  value: number | null;
  label: string | null;
  missingDynamicParams: boolean;
} => {
  const rawMultiplierParam = product.cee_config.primeMultiplierParam;
  const multiplierCoefficient = product.cee_config.primeMultiplierCoefficient;
  const ceeCategory = product.cee_config.category ?? product.category ?? null;
  const defaultMultiplierKey =
    getCategoryDefaultMultiplierKey(ceeCategory) ??
    getCategoryDefaultMultiplierKey(product.category) ??
    null;

  const multiplierParam = resolveMultiplierKeyForCategory(
    rawMultiplierParam,
    ceeCategory,
  );
  const effectiveMultiplierKey =
    multiplierParam === LEGACY_QUANTITY_KEY && defaultMultiplierKey
      ? defaultMultiplierKey
      : multiplierParam;

  const formatLabelWithCoefficient = (
    label: string | null | undefined,
    coefficient: number,
  ) => {
    const normalized =
      typeof label === "string" && label.trim().length > 0
        ? label.trim()
        : null;
    if (!Number.isFinite(coefficient) || coefficient === 1) {
      return normalized ?? null;
    }
    return `${normalized ?? "Multiplicateur"} × ${formatFormulaCoefficient(coefficient)}`;
  };

  if (
    effectiveMultiplierKey &&
    effectiveMultiplierKey !== LEGACY_QUANTITY_KEY
  ) {
    const schemaLabel = getSchemaFieldLabel(
      product.params_schema,
      effectiveMultiplierKey,
    );
    const coefficient = toPositiveNumber(multiplierCoefficient) ?? 1;
    const targets = schemaLabel
      ? [effectiveMultiplierKey, schemaLabel]
      : [effectiveMultiplierKey];
    const dynamicValue = getDynamicFieldNumericValue(
      product.params_schema,
      projectProduct.dynamic_params,
      targets,
    );

    if (dynamicValue !== null && dynamicValue > 0) {
      const labelBase = schemaLabel ?? multiplierParam;
      const label =
        formatLabelWithCoefficient(labelBase, coefficient) ?? labelBase;

      return {
        value: dynamicValue * coefficient,
        label,
        missingDynamicParams: false,
      };
    }

    return {
      value: null,
      label:
        formatLabelWithCoefficient(
          schemaLabel ?? effectiveMultiplierKey,
          coefficient,
        ) ??
        schemaLabel ??
        effectiveMultiplierKey,
      missingDynamicParams: true,
    };
  }

  const formulaConfig = getProductValorisationFormula(product);
  if (formulaConfig) {
    const coefficient = Number.isFinite(formulaConfig.coefficient ?? null)
      ? (formulaConfig.coefficient as number)
      : 1;
    const baseLabel =
      formulaConfig.variableLabel ?? formulaConfig.variableKey ?? null;
    const formattedLabel = formatLabelWithCoefficient(baseLabel, coefficient);

    if (formulaConfig.variableKey === FORMULA_QUANTITY_KEY) {
      const quantityValue = toPositiveNumber(projectProduct.quantity);
      if (quantityValue !== null) {
        return {
          value: quantityValue * (coefficient || 1),
          label: formattedLabel ?? "Quantité",
          missingDynamicParams: false,
        };
      }

      return {
        value: null,
        label: formattedLabel ?? "Quantité",
        missingDynamicParams: true,
      };
    }

    const targets = [formulaConfig.variableKey];
    if (formulaConfig.variableLabel) {
      targets.push(formulaConfig.variableLabel);
    }

    const dynamicValue = getDynamicFieldNumericValue(
      product.params_schema,
      projectProduct.dynamic_params,
      targets,
    );

    if (dynamicValue !== null && dynamicValue > 0) {
      return {
        value: dynamicValue * (coefficient || 1),
        label: formattedLabel ?? formulaConfig.variableKey ?? null,
        missingDynamicParams: false,
      };
    }

    if (
      typeof formulaConfig.variableValue === "number" &&
      formulaConfig.variableValue > 0
    ) {
      return {
        value: formulaConfig.variableValue * (coefficient || 1),
        label: formattedLabel ?? formulaConfig.variableKey ?? null,
        missingDynamicParams: false,
      };
    }

    return {
      value: null,
      label: formattedLabel ?? formulaConfig.variableKey ?? null,
      missingDynamicParams: true,
    };
  }

  const quantityValue = toPositiveNumber(projectProduct.quantity);
  if (quantityValue !== null) {
    return {
      value: quantityValue,
      label: "Quantité",
      missingDynamicParams: false,
    };
  }

  return { value: null, label: null, missingDynamicParams: false };
};

const resolveDelegatePrice = (delegate?: DelegateSummary | null) =>
  toNumber(delegate?.price_eur_per_mwh);

const avantChantierSchema = z.object({
  siteRef: z
    .string()
    .min(3, "La référence chantier doit contenir au moins 3 caractères")
    .max(120, "La référence chantier est trop longue"),
  startDate: z.string().min(1, "La date de début est requise"),
  expectedEndDate: z.string().optional(),
  teamLead: z.string().optional(),
  notes: z.string().optional(),
});

type AvantChantierFormValues = z.infer<typeof avantChantierSchema>;

type AvantChantierFormProps = {
  project: ProjectWithRelations;
  onSubmit: (values: AvantChantierFormValues) => Promise<void> | void;
  isSubmitting: boolean;
};

const AvantChantierForm = ({
  project,
  onSubmit,
  isSubmitting,
}: AvantChantierFormProps) => {
  const form = useForm<AvantChantierFormValues>({
    resolver: zodResolver(avantChantierSchema),
    defaultValues: {
      siteRef: project.project_ref ? `${project.project_ref}-CHANTIER` : "",
      startDate: new Date().toISOString().slice(0, 10),
      expectedEndDate: project.date_fin_prevue ?? undefined,
      teamLead: project.assigned_to ?? "",
      notes: "",
    },
  });

  const handleSubmit = (values: AvantChantierFormValues) => {
    return Promise.resolve(onSubmit(values)).then(() => {
      form.reset({
        ...values,
        notes: "",
      });
    });
  };

  return (
    <Form {...form}>
      <form className="space-y-6" onSubmit={form.handleSubmit(handleSubmit)}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="siteRef"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Référence chantier</FormLabel>
                <FormControl>
                  <Input placeholder="CHANTIER-2024-001" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="teamLead"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Responsable chantier</FormLabel>
                <FormControl>
                  <Input placeholder="Nom du responsable" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="startDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date de démarrage</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="expectedEndDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date de fin estimée</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Instructions & notes</FormLabel>
              <FormControl>
                <Textarea
                  rows={4}
                  placeholder="Décrivez les points importants avant le démarrage..."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Hammer className="mr-2 h-4 w-4" />
            )}
            {isSubmitting ? "Initialisation..." : "Démarrer le chantier"}
          </Button>
        </div>
      </form>
    </Form>
  );
};

type InformationsGeneralesTabProps = {
  project: ProjectWithRelations;
  projectEmail: string | null;
  projectCostValue: number | null;
  displayedPrimeValue: number | null;
  onSubmitAvantChantier: (
    values: AvantChantierFormValues,
  ) => Promise<void> | void;
  isStartingChantier: boolean;
};

const InformationsGeneralesTab = ({
  project,
  projectEmail,
  projectCostValue,
  displayedPrimeValue,
  onSubmitAvantChantier,
  isStartingChantier,
}: InformationsGeneralesTabProps) => {
  return (
    <div className="space-y-6">
      <Card className="shadow-card bg-gradient-card border-0">
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
                <p className="text-sm text-muted-foreground">
                  {project.company}
                </p>
              )}
              {project.siren && (
                <p className="flex items-center gap-2 font-medium">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    SIREN
                  </span>
                  <span>{project.siren}</span>
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
                      [project.postal_code, project.city]
                        .filter(Boolean)
                        .join(" "),
                    ]
                      .filter(
                        (part) => part && part.toString().trim().length > 0,
                      )
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

      <Card className="shadow-card border border-dashed border-primary/20">
        <CardHeader>
          <CardTitle>Démarrer le chantier</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-6">
            Initialisez le chantier directement depuis le projet. Les
            informations du projet seront synchronisées avec le suivi
            opérationnel.
          </p>
          <AvantChantierForm
            project={project}
            onSubmit={onSubmitAvantChantier}
            isSubmitting={isStartingChantier}
          />
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
          <div className="flex items-center gap-2">
            <UserRound className="w-4 h-4 text-primary" />
            <span className="text-muted-foreground">Délégataire:</span>
            <span className="font-medium flex items-center gap-2">
              {project.delegate ? (
                <>
                  {project.delegate.name}
                  {typeof project.delegate.price_eur_per_mwh === "number" ? (
                    <span className="text-xs text-muted-foreground">
                      ({formatCurrency(project.delegate.price_eur_per_mwh)} /
                      MWh)
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
                ? new Date(project.date_debut_prevue).toLocaleDateString(
                    "fr-FR",
                  )
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
  );
};

type ProjectMediaTabProps = {
  project: ProjectWithRelations;
  mediaItems: ProjectMediaItem[];
  selectedCategory: ProjectMediaCategory;
  onCategoryChange: (category: ProjectMediaCategory) => void;
  onUpload: (file: File) => Promise<void>;
  isUploading: boolean;
  isLoading: boolean;
  driveFolderUrl?: string | null;
};

const ProjectMediaTab = ({
  project,
  mediaItems,
  selectedCategory,
  onCategoryChange,
  onUpload,
  isUploading,
  isLoading,
  driveFolderUrl,
}: ProjectMediaTabProps) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [lightboxItem, setLightboxItem] = useState<ProjectMediaItem | null>(
    null,
  );

  const filteredItems = useMemo(
    () => mediaItems.filter((item) => item.category === selectedCategory),
    [mediaItems, selectedCategory],
  );

  const { imageItems, documentItems } = useMemo(() => {
    const images: ProjectMediaItem[] = [];
    const documents: ProjectMediaItem[] = [];

    filteredItems.forEach((item) => {
      const mime = item.mime_type?.toLowerCase() ?? "";
      const looksLikeImage =
        mime.startsWith("image/") || Boolean(item.thumbnail_url);
      if (looksLikeImage) {
        images.push(item);
      } else {
        documents.push(item);
      }
    });

    return { imageItems: images, documentItems: documents };
  }, [filteredItems]);

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      for (const file of files) {
        await onUpload(file);
      }
      event.target.value = "";
    },
    [onUpload],
  );

  return (
    <Card className="shadow-card bg-gradient-card border-0">
      <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <CardTitle>Media du projet</CardTitle>
          <CardDescription>
            Gérez les documents et images rattachés à {project.project_ref} par
            catégorie.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          {MEDIA_CATEGORIES.map((category) => (
            <Button
              key={category.value}
              variant={
                category.value === selectedCategory ? "secondary" : "outline"
              }
              size="sm"
              onClick={() => {
                onCategoryChange(category.value);
              }}
            >
              {category.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="inline-flex items-center gap-2"
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UploadCloud className="h-4 w-4" />
            )}
            {isUploading ? "Téléversement..." : "Ajouter un fichier"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(event) => {
              void handleFileChange(event);
            }}
          />
          {driveFolderUrl ? (
            <Button asChild variant="outline" size="sm">
              <a href={driveFolderUrl} target="_blank" rel="noreferrer">
                Ouvrir le dossier Drive
              </a>
            </Button>
          ) : null}
        </div>

        {isLoading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Chargement des fichiers...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Aucun fichier dans la catégorie{" "}
            {MEDIA_CATEGORY_LABELS[selectedCategory]}.
          </div>
        ) : (
          <div className="space-y-6">
            {imageItems.length > 0 ? (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Galerie photo
                </h3>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {imageItems.map((item) => {
                    const previewUrl =
                      item.thumbnail_url ??
                      item.preview_url ??
                      item.file_url ??
                      item.drive_url;
                    if (!previewUrl) {
                      return null;
                    }

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setLightboxItem(item)}
                        className="group relative overflow-hidden rounded-lg border border-border/50 bg-background/60"
                      >
                        <img
                          src={previewUrl}
                          alt={item.file_name ?? "Image du projet"}
                          className="h-40 w-full object-cover transition-transform duration-200 group-hover:scale-105"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-left">
                          <p className="text-xs font-medium text-white line-clamp-1">
                            {item.file_name ??
                              MEDIA_CATEGORY_LABELS[item.category]}
                          </p>
                          <p className="text-[10px] text-white/70">
                            {new Date(item.created_at).toLocaleString("fr-FR", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {documentItems.length > 0 ? (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Documents
                </h3>
                {documentItems.map((item) => {
                  const link = item.file_url ?? item.drive_url;
                  return (
                    <div
                      key={item.id}
                      className="flex flex-col gap-2 rounded-lg border border-border/50 bg-background/60 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-start gap-3">
                        <FileText className="h-5 w-5 text-primary" />
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {item.file_name ??
                              `Document ${MEDIA_CATEGORY_LABELS[item.category]}`}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Ajouté le{" "}
                            {new Date(item.created_at).toLocaleString("fr-FR", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </p>
                          {item.drive_url && !item.file_url ? (
                            <p className="text-xs text-muted-foreground">
                              Stocké dans Google Drive
                            </p>
                          ) : null}
                        </div>
                      </div>
                      {link ? (
                        <Button asChild variant="outline" size="sm">
                          <a href={link} target="_blank" rel="noreferrer">
                            Ouvrir
                          </a>
                        </Button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        )}

        <Dialog
          open={Boolean(lightboxItem)}
          onOpenChange={(open) => setLightboxItem(open ? lightboxItem : null)}
        >
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{lightboxItem?.file_name ?? "Aperçu"}</DialogTitle>
            </DialogHeader>
            {lightboxItem ? (
              <div className="relative w-full overflow-hidden rounded-lg border border-border/40 bg-muted/40">
                <img
                  src={
                    lightboxItem.file_url ??
                    lightboxItem.preview_url ??
                    lightboxItem.thumbnail_url ??
                    lightboxItem.drive_url ??
                    ""
                  }
                  alt={lightboxItem.file_name ?? "Aperçu"}
                  className="h-full w-full object-contain"
                />
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

const journalNoteSchema = z.object({
  content: z
    .string()
    .min(3, "La note doit contenir au moins 3 caractères")
    .max(2000, "La note est trop longue"),
});

type ProjectJournalTabProps = {
  project: ProjectWithRelations;
  statusEvents: ProjectStatusEvent[];
  notes: ProjectNote[];
  mediaItems: ProjectMediaItem[];
  appointments: ProjectAppointment[];
  sites: ProjectSite[];
  memberNameById: Record<string, string>;
  filter: JournalFilter;
  onFilterChange: (filter: JournalFilter) => void;
  onAddNote: (content: string) => Promise<void>;
  isAddingNote: boolean;
  statusOptions: ProjectStatusSetting[];
  feedRef: React.RefObject<HTMLDivElement>;
  isLoading: boolean;
};

const ProjectJournalTab = ({
  project,
  statusEvents,
  notes,
  mediaItems,
  appointments,
  sites,
  memberNameById,
  filter,
  onFilterChange,
  onAddNote,
  isAddingNote,
  statusOptions,
  feedRef,
  isLoading,
}: ProjectJournalTabProps) => {
  const noteForm = useForm<z.infer<typeof journalNoteSchema>>({
    resolver: zodResolver(journalNoteSchema),
    defaultValues: {
      content: "",
    },
  });

  const statusLabelByValue = useMemo(() => {
    const map: Record<string, string> = {};
    statusOptions.forEach((status) => {
      map[status.value] = status.label;
    });
    return map;
  }, [statusOptions]);

  const entries = useMemo(() => {
    const items: JournalEntry[] = [];

    statusEvents.forEach((event) => {
      const actor = event.changed_by
        ? (memberNameById[event.changed_by] ?? null)
        : null;
      items.push({
        id: `status-${event.id}`,
        type: "status",
        title: "Statut mis à jour",
        description: statusLabelByValue[event.status] ?? event.status,
        metadata: event.notes,
        actor,
        date: event.changed_at,
      });
    });

    appointments.forEach((appointment) => {
      if (!appointment.appointment_date || !appointment.appointment_time) {
        return;
      }
      const date = new Date(
        `${appointment.appointment_date}T${appointment.appointment_time}`,
      );
      if (Number.isNaN(date.getTime())) {
        return;
      }
      items.push({
        id: `rdv-${appointment.id}`,
        type: "rdv",
        title: appointment.appointment_type?.name ?? "RDV planifié",
        description: date.toLocaleString("fr-FR", {
          dateStyle: "short",
          timeStyle: "short",
        }),
        metadata: appointment.notes,
        actor: appointment.assignee_id
          ? (memberNameById[appointment.assignee_id] ?? null)
          : null,
        date: date.toISOString(),
      });
    });

    notes.forEach((note) => {
      items.push({
        id: `note-${note.id}`,
        type: "note",
        title: "Note interne",
        description: note.content,
        actor: note.created_by
          ? (memberNameById[note.created_by] ?? null)
          : null,
        date: note.created_at,
      });
    });

    mediaItems.forEach((media) => {
      items.push({
        id: `media-${media.id}`,
        type: "docs",
        title: `Document ${MEDIA_CATEGORY_LABELS[media.category]}`,
        description: media.file_name ?? MEDIA_CATEGORY_LABELS[media.category],
        actor: media.created_by
          ? (memberNameById[media.created_by] ?? null)
          : null,
        metadata:
          media.drive_url && !media.file_url
            ? "Stocké dans Google Drive"
            : null,
        date: media.created_at,
        linkUrl: media.file_url ?? media.drive_url ?? null,
      });
    });

    sites.forEach((site) => {
      const status = (site.status ?? "PLANIFIE") as SiteStatus;
      const eventDate = site.updated_at ?? site.created_at;
      items.push({
        id: `site-${site.id}`,
        type: "chantier",
        title: `Chantier ${site.site_ref}`,
        description: getStatusLabel(status),
        metadata: site.notes,
        actor: site.user_id ? (memberNameById[site.user_id] ?? null) : null,
        date: eventDate,
      });
    });

    return items
      .filter((item) => item.date)
      .sort((a, b) => {
        const timeA = new Date(a.date).getTime();
        const timeB = new Date(b.date).getTime();
        return timeB - timeA;
      });
  }, [
    appointments,
    memberNameById,
    mediaItems,
    notes,
    sites,
    statusEvents,
    statusLabelByValue,
  ]);

  const filterToTypes: Record<JournalFilter, JournalEntryType[]> = {
    all: ["status", "rdv", "note", "docs", "chantier"],
    status: ["status"],
    rdv: ["rdv"],
    notes: ["note"],
    docs: ["docs"],
    chantiers: ["chantier"],
  };

  const filteredEntries = entries.filter((entry) =>
    filterToTypes[filter].includes(entry.type),
  );

  const iconByType: Record<JournalEntryType, JSX.Element> = {
    status: <CircleDot className="h-4 w-4 text-primary" />,
    rdv: <Calendar className="h-4 w-4 text-primary" />,
    note: <StickyNote className="h-4 w-4 text-primary" />,
    docs: <FileText className="h-4 w-4 text-primary" />,
    chantier: <Hammer className="h-4 w-4 text-primary" />,
  };

  const onSubmitNote = noteForm.handleSubmit(async (values) => {
    await onAddNote(values.content);
    noteForm.reset({ content: "" });
  });

  return (
    <div ref={feedRef} tabIndex={-1} className="outline-none">
      <Card className="shadow-card bg-gradient-card border-0">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle>Journal d'activité</CardTitle>
              <CardDescription>
                Historique complet des interactions et documents pour{" "}
                {project.project_ref}.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { value: "all" as JournalFilter, label: "Tout" },
                  { value: "status" as JournalFilter, label: "Statut" },
                  { value: "rdv" as JournalFilter, label: "RDV" },
                  { value: "notes" as JournalFilter, label: "Notes" },
                  { value: "docs" as JournalFilter, label: "Docs" },
                  { value: "chantiers" as JournalFilter, label: "Chantiers" },
                ] satisfies { value: JournalFilter; label: string }[]
              ).map((item) => (
                <Button
                  key={item.value}
                  variant={filter === item.value ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => onFilterChange(item.value)}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </div>

          <Form {...noteForm}>
            <form onSubmit={onSubmitNote} className="space-y-3">
              <FormField
                control={noteForm.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ajouter une note</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Consignez une information importante pour l'équipe"
                        rows={3}
                        disabled={isAddingNote}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end">
                <Button
                  type="submit"
                  size="sm"
                  disabled={isAddingNote}
                  className="inline-flex items-center gap-2"
                >
                  {isAddingNote ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <StickyNote className="h-4 w-4" />
                  )}
                  {isAddingNote ? "Enregistrement..." : "Ajouter la note"}
                </Button>
              </div>
            </form>
          </Form>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Chargement de l'historique...
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Aucun événement correspondant au filtre sélectionné.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-lg border border-border/50 bg-background/60 p-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="mt-1">{iconByType[entry.type]}</div>
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-foreground">
                          {entry.title}
                        </p>
                        {entry.description ? (
                          <p className="text-sm text-muted-foreground whitespace-pre-line">
                            {entry.description}
                          </p>
                        ) : null}
                        {entry.metadata ? (
                          <p className="text-xs text-muted-foreground whitespace-pre-line">
                            {entry.metadata}
                          </p>
                        ) : null}
                        {entry.actor ? (
                          <p className="text-xs text-muted-foreground">
                            Par {entry.actor}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-col items-start gap-2 sm:items-end">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">
                        {new Date(entry.date).toLocaleString("fr-FR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </span>
                      {entry.linkUrl ? (
                        <Button asChild size="sm" variant="outline">
                          <a
                            href={entry.linkUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            Ouvrir
                          </a>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

type DocumentsTabProps = {
  project: ProjectWithRelations;
};

const DocumentsTab = ({ project }: DocumentsTabProps) => {
  return (
    <div className="space-y-6">
      <Card className="shadow-card bg-gradient-card border-0">
        <CardHeader>
          <CardTitle>Documents du projet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Centralisez les documents administratifs, techniques et financiers
            liés au chantier {project.project_ref}. Les fichiers déposés sont
            accessibles à toute l'équipe depuis l'espace Documents.
          </p>
          <div className="rounded-lg border border-dashed border-primary/30 bg-background/60 p-6 text-sm text-muted-foreground">
            Connectez Google Drive dans les paramètres pour activer le dépôt
            automatique des documents chantier.
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

type ApresChantierTabProps = {
  project: ProjectWithRelations;
  ceeEntryMap: Record<string, ProjectProductCeeEntry>;
  projectProducts: ProjectProduct[];
  hasComputedCeeTotals: boolean;
  ceeTotals: ReturnType<typeof computeProjectCeeTotals>;
};

const ApresChantierTab = ({
  project,
  ceeEntryMap,
  projectProducts,
  hasComputedCeeTotals,
  ceeTotals,
}: ApresChantierTabProps) => {
  return (
    <div className="space-y-6">
      <Card className="shadow-card bg-gradient-card border-0">
        <CardHeader>
          <CardTitle>Valorisation après chantier</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <HandCoins className="w-4 h-4 text-amber-600" />
            <span className="text-muted-foreground">Valorisation totale:</span>
            <span className="font-semibold text-amber-600">
              {hasComputedCeeTotals
                ? `${formatCurrency(ceeTotals.totalValorisationEur)} (${formatDecimal(ceeTotals.totalValorisationMwh)} MWh)`
                : "Non calculée"}
            </span>
          </div>
          {projectProducts.map((item, index) => {
            const entryId = item.id ?? item.product_id ?? `product-${index}`;
            const ceeEntry = ceeEntryMap[entryId];
            if (!ceeEntry) {
              return null;
            }

            const labelBase =
              ceeEntry.multiplierLabel &&
              ceeEntry.multiplierLabel.trim().length > 0
                ? ceeEntry.multiplierLabel
                : "Valorisation CEE";
            const summaryLabel = item.product?.code
              ? `${labelBase} (${item.product.code})`
              : labelBase;

            const productCategory = (
              item.product?.category ?? ""
            ).toLowerCase();
            const isLightingProduct = productCategory === "lighting";
            const lightingDetails =
              (
                ceeEntry.result as
                  | (PrimeCeeResult & { lighting?: PrimeCeeLightingDetails })
                  | null
              )?.lighting ?? null;
            const lightingPerLedEur = toNumber(lightingDetails?.per_led_eur);
            const lightingPerLedMwh = toNumber(lightingDetails?.per_led_mwh);
            const lightingTotalMwh = toNumber(lightingDetails?.total_mwh);
            const lightingTotalEur = toNumber(lightingDetails?.total_eur);
            const lightingMissingBase = Boolean(lightingDetails?.missing_base);

            let summaryDetails: string;
            if (
              ceeEntry.result &&
              typeof ceeEntry.multiplierValue === "number" &&
              ceeEntry.multiplierValue > 0
            ) {
              summaryDetails = `${formatDecimal(ceeEntry.result.valorisationPerUnitMwh)} MWh × ${formatDecimal(
                ceeEntry.multiplierValue,
              )} = ${formatDecimal(ceeEntry.result.valorisationTotalMwh)} MWh`;
            } else if (ceeEntry.warnings.missingDynamicParams) {
              summaryDetails = "Paramètres dynamiques manquants";
            } else if (ceeEntry.warnings.missingKwh) {
              summaryDetails = "Aucune valeur kWh pour ce bâtiment";
            } else {
              summaryDetails = "Prime non calculée";
            }

            const valorisationLine = (() => {
              if (isLightingProduct) {
                if (lightingPerLedEur !== null) {
                  return `Valorisation Nombre Led : ${formatCurrency(lightingPerLedEur)} / Nombre Led`;
                }
                if (ceeEntry.result) {
                  return `Valorisation Nombre Led : ${formatCurrency(ceeEntry.result.valorisationPerUnitEur)} / ${
                    ceeEntry.multiplierLabel ?? "Nombre Led"
                  }`;
                }
                return "Valorisation Nombre Led : Non calculée";
              }

              return ceeEntry.result
                ? `${formatCurrency(ceeEntry.result.valorisationPerUnitEur)} / ${ceeEntry.multiplierLabel ?? "unité"}`
                : "Non calculée";
            })();

            const lightingCalculationLine =
              isLightingProduct &&
              lightingPerLedMwh !== null &&
              lightingTotalMwh !== null
                ? `Soit ${formatDecimal(lightingPerLedMwh)} MWh × Nombre Led = ${formatDecimal(lightingTotalMwh)} MWh`
                : null;

            const primeValue = (() => {
              if (isLightingProduct) {
                if (lightingTotalEur !== null) {
                  return lightingTotalEur;
                }
              }

              return ceeEntry.result?.totalPrime ?? null;
            })();

            return (
              <div
                key={`valorisation-summary-${entryId}`}
                className="flex items-start gap-3 border rounded-lg p-4"
              >
                <HandCoins className="w-4 h-4 text-amber-600 mt-0.5" />
                <div className="flex flex-col gap-1 text-xs sm:text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <span>{summaryLabel}</span>
                    {isLightingProduct && lightingMissingBase ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          align="center"
                          className="text-xs"
                        >
                          kWh cumac manquant pour cette typologie
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                  </div>
                  <span className="font-medium text-emerald-600 text-sm">
                    {valorisationLine}
                  </span>
                  {lightingCalculationLine ? (
                    <span className="text-xs text-muted-foreground">
                      {lightingCalculationLine}
                    </span>
                  ) : null}
                  <span className="text-xs text-muted-foreground">
                    {summaryDetails}
                  </span>
                  <span className="text-xs font-semibold text-amber-600">
                    {primeValue !== null
                      ? `Prime calculée : ${formatCurrency(primeValue)}`
                      : "Prime non calculée"}
                  </span>
                </div>
              </div>
            );
          })}

          {projectProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun produit n'est associé à ce projet pour le moment.
            </p>
          ) : null}
        </CardContent>
      </Card>

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
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit</TableHead>
                    <TableHead>Images</TableHead>
                    <TableHead>Multiplicateur</TableHead>
                    <TableHead>Valorisation / unité (€)</TableHead>
                    <TableHead>Valorisation totale (€)</TableHead>
                    <TableHead>Prime calculée (€)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projectProducts.map((item, index) => {
                    const dynamicParams = item.dynamic_params || {};
                    const productCode = item.product?.code ?? "–";
                    const productName = item.product?.name ?? "Produit inconnu";

                    return (
                      <TableRow key={item.id ?? index}>
                        <TableCell className="font-medium">
                          <div className="space-y-1">
                            <div className="text-sm">{productCode}</div>
                            <div className="text-xs text-muted-foreground">
                              {productName}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {Object.keys(dynamicParams)
                              .filter((k) => k.startsWith("image_"))
                              .length || 0}
                          </div>
                        </TableCell>
                        <TableCell>
                          {typeof item.quantity === "number"
                            ? formatDecimal(item.quantity)
                            : "–"}
                        </TableCell>
                        <TableCell>–</TableCell>
                        <TableCell>–</TableCell>
                        <TableCell>–</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-card border border-dashed border-primary/20">
        <CardHeader>
          <CardTitle>Suivi post-chantier</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Renseignez les informations finales (PV de réception, photos, levée
            des réserves) directement depuis le chantier pour compléter le
            dossier du projet {project.project_ref}.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

const computeStatusProgress = (
  statusValue: string | null | undefined,
  statuses: ProjectStatusSetting[],
) => {
  if (!statusValue || statuses.length === 0) {
    return 0;
  }

  const normalized = statusValue.trim().toUpperCase();
  const index = statuses.findIndex((status) => status?.value === normalized);
  if (index === -1) {
    return 0;
  }

  if (statuses.length === 1) {
    return 100;
  }

  return Math.round((index / (statuses.length - 1)) * 100);
};

const ProjectDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { currentOrgId } = useOrg();
  const { data: members = [], isLoading: membersLoading } =
    useMembers(currentOrgId);
  const {
    statuses: projectStatuses,
    isLoading: projectStatusesLoading,
    isFetching: projectStatusesFetching,
    error: projectStatusesError,
  } = useProjectStatuses();
  const projectStatusesBusy = projectStatusesLoading || projectStatusesFetching;
  const { primeBonification } = useOrganizationPrimeSettings();

  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<ProjectTabValue>(() => {
    const currentTab = searchParams.get("tab");
    return isValidProjectTab(currentTab) ? currentTab : DEFAULT_PROJECT_TAB;
  });
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [quoteInitialValues, setQuoteInitialValues] = useState<
    Partial<QuoteFormValues>
  >({});
  const [quickStartOpen, setQuickStartOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [siteDialogOpen, setSiteDialogOpen] = useState(false);
  const [siteDialogMode, setSiteDialogMode] = useState<"create" | "edit">(
    "create",
  );
  const [siteInitialValues, setSiteInitialValues] =
    useState<Partial<SiteFormValues>>();

  useEffect(() => {
    if (!projectStatusesError) return;

    console.error("Erreur lors du chargement des statuts projets", projectStatusesError);
    toast({
      variant: "destructive",
      title: "Statuts indisponibles",
      description: "Les statuts projets n'ont pas pu être synchronisés. Les valeurs par défaut sont utilisées.",
    });
  }, [projectStatusesError, toast]);
  const [activeSite, setActiveSite] = useState<ProjectSite | null>(null);
  const location = useLocation();
  const journalFeedRef = useRef<HTMLDivElement | null>(null);
  const [selectedMediaCategory, setSelectedMediaCategory] =
    useState<ProjectMediaCategory>(MEDIA_CATEGORIES[0]?.value ?? "PHOTOS");
  const [journalFilter, setJournalFilter] = useState<JournalFilter>("all");
  const [quickUpdateText, setQuickUpdateText] = useState("");
  const [siteDialogDefaultTab, setSiteDialogDefaultTab] = useState<
    "avant-chantier" | "apres-chantier"
  >("avant-chantier");
  const [siteDialogReadOnly, setSiteDialogReadOnly] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<ProductImage | null>(null);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);

  const focusJournalFeed = useCallback(() => {
    setTimeout(() => {
      journalFeedRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      journalFeedRef.current?.focus({ preventScroll: true });
    }, 150);
  }, []);

  const handleOpenDocuments = useCallback(() => {
    setActiveTab("media");
    setSelectedMediaCategory(MEDIA_CATEGORIES[0]?.value ?? "PHOTOS");
  }, []);

  const handleViewFullHistory = useCallback(() => {
    setActiveTab("journal");
    setJournalFilter("all");
    focusJournalFeed();
  }, [focusJournalFeed]);

  useEffect(() => {
    const currentTab = searchParams.get("tab");
    if (isValidProjectTab(currentTab)) {
      if (currentTab !== activeTab) {
        setActiveTab(currentTab);
      }
      return;
    }

    if (currentTab !== activeTab) {
      const newParams = new URLSearchParams(searchParams);
      newParams.set("tab", activeTab);
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, activeTab, setSearchParams]);

  const handleTabChange = useCallback(
    (value: string) => {
      if (!isValidProjectTab(value) || value === activeTab) {
        return;
      }

      setActiveTab(value);
      const newParams = new URLSearchParams(searchParams);
      newParams.set("tab", value);
      setSearchParams(newParams, { replace: true });
    },
    [activeTab, searchParams, setSearchParams],
  );

  const memberNameById = useMemo(() => {
    const result: Record<string, string> = {};
    members.forEach((member) => {
      if (!member?.user_id) {
        return;
      }

      const fullName = member.profiles?.full_name?.trim();
      result[member.user_id] =
        fullName && fullName.length > 0 ? fullName : "Utilisateur";
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

  const currentMember = members.find((member) => member.user_id === user?.id);
  const isAdmin =
    currentMember?.role === "admin" || currentMember?.role === "owner";

  const {
    data: project,
    isLoading,
    error,
    refetch,
  } = useQuery<ProjectWithRelations | null>({
    queryKey: ["project", id, user?.id, currentOrgId, isAdmin],
    queryFn: async () => {
      if (!id || !user?.id) return null;

      let query = supabase
        .from("projects")
        .select(
          "*, delegate:delegates(id, name, price_eur_per_mwh), lead:leads(email), project_products(id, product_id, quantity, dynamic_params, product:product_catalog(id, code, name, category, params_schema, cee_config, kwh_cumac_values:product_kwh_cumac(id, building_type, kwh_cumac))), project_appointments(id, project_id, org_id, appointment_date, appointment_time, appointment_type_id, assignee_id, notes, created_at, updated_at, appointment_type:appointment_types(id, name))",
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

      if (!data) {
        return null;
      }

      return {
        ...data,
        project_products: (data.project_products ?? []).map((pp) => ({
          ...pp,
          product: pp.product ? withDefaultProductCeeConfig(pp.product) : null,
        })),
        project_appointments: (data.project_appointments ??
          []) as ProjectAppointment[],
      } as ProjectWithRelations;
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
    [project?.project_products],
  );

  const {
    data: projectUpdatesState,
    isLoading: projectUpdatesLoading,
    refetch: refetchProjectUpdates,
  } = useQuery<ProjectUpdatesQueryResult>({
    queryKey: ["project-updates", id, currentOrgId],
    enabled: !!id && !!user?.id,
    queryFn: async () => {
      if (!id || !user?.id) {
        return {
          updates: [],
          tableAvailable: false,
          error: null,
        } satisfies ProjectUpdatesQueryResult;
      }

      try {
        const { data, error } = await supabase
          .from("project_updates" as any)
          .select(
            "id, project_id, content, status, next_step, created_at, author_id, org_id",
          )
          .eq("project_id", id)
          .order("created_at", { ascending: false })
          .limit(50);

        if (error) {
          if (isTableUnavailableError(error)) {
            return {
              updates: [],
              tableAvailable: false,
              error,
            } satisfies ProjectUpdatesQueryResult;
          }

          console.error(
            "Erreur lors du chargement des mises à jour projet",
            error,
          );
          return {
            updates: [],
            tableAvailable: false,
            error,
          } satisfies ProjectUpdatesQueryResult;
        }

        const validData = (Array.isArray(data) 
          ? data.filter((item) => {
              if (!item || typeof item !== 'object') return false;
              const obj = item as Record<string, unknown>;
              return 'id' in obj && 'project_id' in obj;
            })
          : []) as unknown as ProjectUpdateRecord[];
        
        return {
          updates: validData,
          tableAvailable: true,
          error: null,
        };
      } catch (unknownError) {
        const postgrestError = (unknownError as PostgrestError) ?? null;
        if (isTableUnavailableError(postgrestError)) {
          return {
            updates: [],
            tableAvailable: false,
            error: postgrestError,
          } satisfies ProjectUpdatesQueryResult;
        }

        console.error(
          "Erreur inattendue lors du chargement des mises à jour projet",
          unknownError,
        );
        return {
          updates: [],
          tableAvailable: false,
          error: postgrestError,
        } satisfies ProjectUpdatesQueryResult;
      }
    },
  });

  const projectUpdates = projectUpdatesState?.updates ?? [];
  const projectUpdatesTableAvailable =
    projectUpdatesState?.tableAvailable ?? false;
  const projectUpdatesError = projectUpdatesState?.error ?? null;

  const upcomingAppointmentDetails = useMemo<UpcomingAppointmentDetail[]>(() => {
    if (
      !project?.project_appointments ||
      project.project_appointments.length === 0
    ) {
      return [];
    }

    const now = new Date().getTime();

    return project.project_appointments
      .map((appointment) => {
        if (!appointment.appointment_date || !appointment.appointment_time) {
          return null;
        }

        const dateTime = new Date(
          `${appointment.appointment_date}T${appointment.appointment_time}`,
        );

        if (Number.isNaN(dateTime.getTime()) || dateTime.getTime() < now) {
          return null;
        }

        const formattedDate = dateTime.toLocaleString("fr-FR", {
          dateStyle: "long",
          timeStyle: "short",
        });

        const assigneeName = appointment.assignee_id
          ? memberNameById[appointment.assignee_id] ?? null
          : null;

        const typeLabel = appointment.appointment_type?.name ?? null;
        const rawNotes = appointment.notes?.trim() ?? "";

        const metadataParts = [
          typeLabel ?? undefined,
          assigneeName ? `Assigné à ${assigneeName}` : undefined,
        ].filter((value): value is string => Boolean(value));

        return {
          id: appointment.id,
          appointment,
          dateTime,
          formattedDate,
          metadata: metadataParts.length > 0 ? metadataParts.join(" • ") : null,
          notes: rawNotes.length > 0 ? rawNotes : null,
        } satisfies UpcomingAppointmentDetail;
      })
      .filter(
        (value): value is UpcomingAppointmentDetail => Boolean(value),
      )
      .sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());
  }, [project?.project_appointments, memberNameById]);

  const nextAppointmentDetails =
    upcomingAppointmentDetails.length > 0
      ? upcomingAppointmentDetails[0]
      : null;

  const projectSurfaceFacturee = useMemo(() => {
    if (!project?.project_products) return 0;

    return project.project_products.reduce((sum, projectProduct) => {
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
  }, [project?.project_products]);

  const projectSiteOptions = useMemo<SiteProjectOption[]>(() => {
    if (!project) return [];

    const primaryProduct =
      projectProducts[0]?.product ??
      project.project_products?.[0]?.product ??
      null;
    const productLabel =
      primaryProduct?.code ||
      (project as Project & { product_name?: string | null }).product_name ||
      "";
    const address =
      (project as Project & { address?: string | null }).address ?? "";

    return [
      {
        id: project.id,
        project_ref: project.project_ref ?? "",
        client_name: getProjectClientName(project),
        product_name: productLabel ?? "",
        address,
        city: project.city ?? "",
        postal_code: project.postal_code ?? "",
        surface_facturee:
          projectSurfaceFacturee > 0 ? projectSurfaceFacturee : undefined,
      },
    ];
  }, [project, projectProducts, projectSurfaceFacturee]);

  const {
    data: projectMedia = [],
    isLoading: projectMediaLoading,
    refetch: refetchProjectMedia,
  } = useQuery<ProjectMediaItem[]>({
    queryKey: ["project-media", project?.id, currentOrgId],
    queryFn: async () => {
      if (!project?.id || !currentOrgId) {
        return [] as ProjectMediaItem[];
      }

      const { data, error } = await supabase
        .from("project_media")
        .select("*")
        .eq("project_id", project.id)
        .eq("org_id", currentOrgId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data ?? []) as ProjectMediaItem[];
    },
    enabled: Boolean(project?.id && currentOrgId),
  });

  const {
    data: projectNotes = [],
    isLoading: projectNotesLoading,
    refetch: refetchProjectNotes,
  } = useQuery<ProjectNote[]>({
    queryKey: ["project-notes", project?.id, currentOrgId],
    queryFn: async () => {
      if (!project?.id || !currentOrgId) {
        return [] as ProjectNote[];
      }

      const { data, error } = await supabase
        .from("project_notes")
        .select("*")
        .eq("project_id", project.id)
        .eq("org_id", currentOrgId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return (data ?? []) as ProjectNote[];
    },
    enabled: Boolean(project?.id && currentOrgId),
  });

  useEffect(() => {
    if (!project?.id || !currentOrgId) {
      return undefined;
    }

    const channel = supabase
      .channel(`project-details-${project.id}-realtime`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_updates",
          filter: `project_id=eq.${project.id}`,
        },
        () => {
          void refetchProjectUpdates();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_notes",
          filter: `project_id=eq.${project.id}`,
        },
        () => {
          void refetchProjectNotes();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "project_media",
          filter: `project_id=eq.${project.id}`,
        },
        () => {
          void refetchProjectMedia();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [
    project?.id,
    currentOrgId,
    refetchProjectUpdates,
    refetchProjectNotes,
    refetchProjectMedia,
  ]);

  const {
    data: statusEvents = [],
    isLoading: statusEventsLoading,
    refetch: refetchStatusEvents,
  } = useQuery<ProjectStatusEvent[]>({
    queryKey: ["project-status-events", project?.id, currentOrgId],
    queryFn: async () => {
      if (!project?.id || !currentOrgId) {
        return [] as ProjectStatusEvent[];
      }

      const { data, error } = await supabase
        .from("project_status_events")
        .select("*")
        .eq("project_id", project.id)
        .eq("org_id", currentOrgId)
        .order("changed_at", { ascending: false });

      if (error) throw error;

      return (data ?? []) as ProjectStatusEvent[];
    },
    enabled: Boolean(project?.id && currentOrgId),
  });

  const projectRefFilter = project?.project_ref?.trim() ?? "";

  const { 
    data: projectSites = [],
    isLoading: projectSitesLoading,
    refetch: refetchProjectSites,
  } = useQuery<ProjectSite[]>({
    queryKey: ["project-sites", project?.id, projectRefFilter, currentOrgId],
    queryFn: async () => {
      if (!project?.id || !currentOrgId) return [] as ProjectSite[];

      let query = supabase
        .from("sites")
        .select("*, subcontractor:subcontractors(id, name)")
        .eq("org_id", currentOrgId)
        .order("created_at", { ascending: false });

      const filters = [`project_id.eq.${project.id}`];
      if (projectRefFilter) {
        filters.push(`project_ref.eq.${projectRefFilter}`);
      }

      if (filters.length > 0) {
        query = query.or(filters.join(","));
      }

      const { data, error } = await query;

      if (error) throw error;

      return (data ?? []) as ProjectSite[];
    },
    enabled: Boolean(project?.id && currentOrgId),
  });

  const startChantierMutation = useMutation({
    mutationKey: ["project-start-chantier", project?.id],
    mutationFn: async (values: AvantChantierFormValues) => {
      if (!project) {
        throw new Error("Le projet n'est plus disponible.");
      }

      const primaryProduct =
        projectProducts[0]?.product ?? project.project_products?.[0]?.product ?? null;
      const resolvedProductName =
        primaryProduct?.name ??
        primaryProduct?.code ??
        (project as Project & { product_name?: string | null }).product_name ??
        project.project_ref ??
        null;

      const payload = {
        siteRef: values.siteRef?.trim() ?? undefined,
        dateDebut: values.startDate,
        dateFinPrevue: values.expectedEndDate ?? null,
        notes: values.notes?.trim() ? values.notes.trim() : null,
        productName: resolvedProductName,
        address:
          (project as Project & { address?: string | null }).address ??
          project.hq_address ??
          null,
        city: project.city ?? null,
        postalCode: project.postal_code ?? null,
        teamMembers:
          values.teamLead && values.teamLead.trim().length > 0
            ? [values.teamLead.trim()]
            : [],
      } satisfies Parameters<typeof startChantier>[1];

      return await startChantier(project.id, payload);
    },
    onSuccess: async (result) => {
      setQuickStartOpen(false);
      toast({
        title: "Chantier démarré",
        description: `${result.chantier.site_ref} a été initialisé avec succès.`,
      });
      await Promise.all([refetchProjectSites(), refetch()]);
    },
    onError: (error) => {
      const message =
        error instanceof Error
          ? error.message
          : "Impossible de démarrer le chantier pour le moment.";
      toast({
        title: "Démarrage échoué",
        description: message,
        variant: "destructive",
      });
    },
  });

  const handleQuickStartSubmit = useCallback(
    async (values: AvantChantierFormValues) => {
      await startChantierMutation.mutateAsync(values);
    },
    [startChantierMutation],
  );

  const isStartingChantier = startChantierMutation.isPending;

  const uploadMediaMutation = useMutation({
    mutationKey: ["project-media-upload", project?.id, selectedMediaCategory],
    mutationFn: async (file: File) => {
      if (!project?.id || !currentOrgId || !user?.id) {
        throw new Error("Impossible de téléverser le fichier.");
      }

      const sanitizedName = file.name.replace(/\s+/g, "-");
      const storagePath = `${project.id}/${Date.now()}-${sanitizedName}`;
      const bucket = supabase.storage.from("project-media");

      const { error: uploadError } = await bucket.upload(storagePath, file, {
        upsert: false,
        contentType: file.type || undefined,
      });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicUrlData } = bucket.getPublicUrl(storagePath);
      const fileUrl = publicUrlData?.publicUrl ?? null;

      const { error: insertError } = await supabase
        .from("project_media")
        .insert({
          project_id: project.id,
          org_id: currentOrgId,
          category: selectedMediaCategory,
          file_name: file.name,
          file_url: fileUrl,
          preview_url: fileUrl,
          thumbnail_url: fileUrl,
          storagePath,
          mime_type: file.type || null,
          created_by: user.id,
        });

      if (insertError) {
        throw insertError;
      }
    },
    onSuccess: async () => {
      toast({
        title: "Fichier ajouté",
        description: `Le fichier a été ajouté à ${MEDIA_CATEGORY_LABELS[selectedMediaCategory]}.`,
      });
      await Promise.all([refetchProjectMedia(), refetchStatusEvents()]);
    },
    onError: (error) => {
      const message =
        error instanceof Error
          ? error.message
          : "Impossible de téléverser le fichier.";
      toast({
        title: "Téléversement échoué",
        description: message,
        variant: "destructive",
      });
    },
  });

  const addNoteMutation = useMutation({
    mutationKey: ["project-notes-add", project?.id],
    mutationFn: async (content: string) => {
      if (!project?.id || !currentOrgId || !user?.id) {
        throw new Error("Impossible d'ajouter la note.");
      }

      const trimmed = content.trim();
      if (trimmed.length === 0) {
        throw new Error("Le contenu de la note est vide.");
      }

      const { error: insertError } = await supabase
        .from("project_notes")
        .insert({
          project_id: project.id,
          org_id: currentOrgId,
          content: trimmed,
          created_by: user.id,
        });

      if (insertError) {
        throw insertError;
      }
    },
    onSuccess: async () => {
      toast({
        title: "Note ajoutée",
        description: "La note a été enregistrée dans le journal.",
      });
      await Promise.all([refetchProjectNotes(), refetchStatusEvents()]);
    },
    onError: (error) => {
      const message =
        error instanceof Error
          ? error.message
          : "Impossible d'ajouter la note.";
      toast({
        title: "Erreur lors de l'ajout",
        description: message,
        variant: "destructive",
      });
    },
  });

  const handleUploadMedia = useCallback(
    (file: File) => uploadMediaMutation.mutateAsync(file),
    [uploadMediaMutation],
  );

  const handleAddNote = useCallback(
    (content: string) => addNoteMutation.mutateAsync(content),
    [addNoteMutation],
  );

  const updateProjectStatusMutation = useMutation({
    mutationKey: ["project-status-update", project?.id],
    mutationFn: async (nextStatus: string) => {
      if (!project) {
        throw new Error("Le projet n'est plus disponible.");
      }

      const trimmed = typeof nextStatus === "string" ? nextStatus.trim() : "";
      if (trimmed.length === 0) {
        throw new Error("Statut invalide.");
      }

      const normalized = trimmed.toUpperCase();

      let updateQuery = supabase
        .from("projects")
        .update({ status: normalized as ProjectStatus })
        .eq("id", project.id);

      if (currentOrgId) {
        updateQuery = updateQuery.eq("org_id", currentOrgId);
      }

      const { error: updateError } = await updateQuery;
      if (updateError) {
        throw updateError;
      }

      const statusEventPayload = {
        project_id: project.id,
        org_id: currentOrgId ?? "",
        status: normalized as ProjectStatus,
        changed_at: new Date().toISOString(),
        changed_by: user?.id ?? null,
        notes: null,
      };

      const { error: eventError } = await supabase
        .from("project_status_events")
        .insert([statusEventPayload]);

      if (eventError && !isTableUnavailableError(eventError)) {
        throw eventError;
      }

      return normalized;
    },
  });

  const handleStatusSelect = useCallback(
    async (value: string) => {
      if (!project) {
        return;
      }

      const trimmed = typeof value === "string" ? value.trim() : "";
      if (trimmed.length === 0) {
        setStatusMenuOpen(false);
        return;
      }

      const normalized = trimmed.toUpperCase();
      const currentStatus =
        typeof project.status === "string" ? project.status.toUpperCase() : "";

      if (normalized === currentStatus) {
        setStatusMenuOpen(false);
        return;
      }

      setStatusMenuOpen(false);

      try {
        const newStatus = await updateProjectStatusMutation.mutateAsync(trimmed);
        const nextStatusConfig =
          projectStatuses.find((status) => status?.value === newStatus) ?? null;
        const nextLabel = nextStatusConfig?.label ?? newStatus;

        toast({
          title: "Statut mis à jour",
          description: `Le projet est maintenant ${nextLabel.toLowerCase()}.`,
        });

        await Promise.all([refetch(), refetchStatusEvents()]);
      } catch (mutationError) {
        const message =
          mutationError instanceof Error
            ? mutationError.message
            : "Impossible de mettre à jour le statut pour le moment.";
        toast({
          title: "Mise à jour du statut échouée",
          description: message,
          variant: "destructive",
        });
      }
    },
    [
      project,
      projectStatuses,
      toast,
      updateProjectStatusMutation,
      refetch,
      refetchStatusEvents,
    ],
  );

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (!tabParam) {
      return;
    }
    if (tabParam === activeTab) {
      return;
    }
    handleTabChange(tabParam);
    if (tabParam === "journal") {
      setJournalFilter("all");
    }
  }, [searchParams, activeTab, handleTabChange]);

  useEffect(() => {
    const state = location.state as {
      openTab?: ProjectTabValue;
      focus?: string | null;
    } | null;

    if (!state?.openTab) {
      return;
    }

    handleTabChange(state.openTab);

    if (state.openTab === "journal") {
      setJournalFilter("all");
      if (state.focus === "journal") {
        focusJournalFeed();
      }
    }

    navigate(`${location.pathname}${location.search}`, { replace: true });
  }, [focusJournalFeed, handleTabChange, location, navigate]);

  const mapTeamMembersToFormValues = useCallback(
    (teamMembers: string[] | null | undefined): SiteTeamMemberFormValue[] => {
      if (!Array.isArray(teamMembers)) {
        return [];
      }

      const uniqueMembers = new Map<string, SiteTeamMemberFormValue>();

      for (const rawMember of teamMembers) {
        if (typeof rawMember !== "string") {
          continue;
        }

        const trimmed = rawMember.trim();
        if (trimmed.length === 0) {
          continue;
        }

        if (isUuid(trimmed)) {
          if (!uniqueMembers.has(trimmed)) {
            uniqueMembers.set(trimmed, {
              id: trimmed,
              name: memberNameById[trimmed] ?? trimmed,
            });
          }
          continue;
        }

        const normalized = trimmed.toLowerCase();
        const matchedId = memberIdByName[normalized];
        if (matchedId) {
          if (!uniqueMembers.has(matchedId)) {
            uniqueMembers.set(matchedId, {
              id: matchedId,
              name: memberNameById[matchedId] ?? trimmed,
            });
          }
          continue;
        }

        if (!uniqueMembers.has(trimmed)) {
          uniqueMembers.set(trimmed, { id: trimmed, name: trimmed });
        }
      }

      return Array.from(uniqueMembers.values());
    },
    [memberIdByName, memberNameById],
  );

  const formatTeamMembers = useCallback(
    (teamMembers: string[] | null | undefined) => {
      if (!Array.isArray(teamMembers) || teamMembers.length === 0) {
        return null;
      }

      const names = teamMembers
        .map((member) => {
          if (typeof member !== "string") return null;
          const trimmed = member.trim();
          if (!trimmed) return null;

          if (isUuid(trimmed)) {
            return memberNameById[trimmed] ?? trimmed;
          }

          const normalized = trimmed.toLowerCase();
          const matchedId = memberIdByName[normalized];
          if (matchedId) {
            return memberNameById[matchedId] ?? trimmed;
          }

          return trimmed;
        })
        .filter((value): value is string => Boolean(value));

      const unique = Array.from(new Set(names));
      return unique.length > 0 ? unique.join(", ") : null;
    },
    [memberIdByName, memberNameById],
  );

  const { entries: ceeEntries, totals: ceeTotals } = useMemo(() => {
    if (!project) {
      return {
        entries: [] as ProjectProductCeeEntry[],
        totals: computeProjectCeeTotals([]),
      };
    }

    const buildingType =
      typeof project.building_type === "string"
        ? project.building_type.trim()
        : "";
    const delegatePrice = resolveDelegatePrice(project.delegate);

    const entries = projectProducts.map((item, index) => {
      const product = item.product;
      const entryId = item.id ?? item.product_id ?? `product-${index}`;

      let multiplierLabel: string | null = null;
      let multiplierValue: number | null = null;
      let missingDynamicParams = false;
      let missingKwh = !buildingType;
      let result: PrimeCeeResult | null = null;

      if (!product) {
        return {
          projectProductId: entryId,
          productCode: null,
          productName: null,
          multiplierLabel,
          multiplierValue,
          result,
          warnings: { missingDynamicParams, missingKwh },
        } satisfies ProjectProductCeeEntry;
      }

      const multiplierDetails = resolveMultiplierDetails(product, item);
      multiplierLabel = multiplierDetails.label;
      multiplierValue = multiplierDetails.value;
      missingDynamicParams = multiplierDetails.missingDynamicParams;

      const kwhEntry = findKwhEntry(product, buildingType);
      const kwhValue = toPositiveNumber(kwhEntry?.kwh_cumac);
      missingKwh = !buildingType || !kwhValue;

      if (!missingKwh && multiplierValue && multiplierValue > 0 && kwhValue) {
        const bonification = resolveBonificationValue(primeBonification);
        const coefficient = resolveCoefficientValue();
        const quantityValue = toNumber(item.quantity);
        const dynamicParams = isRecord(item.dynamic_params)
          ? (item.dynamic_params as DynamicParams)
          : null;

        const rawFormulaExpression =
          typeof product.cee_config?.formulaExpression === "string"
            ? product.cee_config.formulaExpression.trim()
            : "";
        const valorisationFormula =
          rawFormulaExpression.length > 0 ? rawFormulaExpression : null;
        const ledWattConstant =
          typeof product.cee_config?.ledWattConstant === "number" &&
          Number.isFinite(product.cee_config.ledWattConstant)
            ? product.cee_config.ledWattConstant
            : null;

        const config: CeeConfig = {
          kwhCumac: kwhValue,
          bonification: bonification ?? undefined,
          coefficient: coefficient ?? undefined,
          multiplier: multiplierValue,
          quantity: quantityValue ?? null,
          delegatePriceEurPerMwh: delegatePrice ?? null,
          dynamicParams,
          ...(valorisationFormula ? { valorisationFormula } : {}),
          ...(ledWattConstant !== null
            ? { overrides: { ledWatt: ledWattConstant } }
            : {}),
        };

        result = computePrimeCeeEur(config);
      }

      return {
        projectProductId: entryId,
        productCode: product.code ?? null,
        productName: product.name ?? null,
        multiplierLabel,
        multiplierValue,
        result,
        warnings: { missingDynamicParams, missingKwh },
      } satisfies ProjectProductCeeEntry;
    });

    const totals = computeProjectCeeTotals(
      entries.map((entry) => entry.result),
    );

    return { entries, totals };
  }, [project, projectProducts, primeBonification]);

  const ceeEntryMap = useMemo(() => {
    return ceeEntries.reduce<Record<string, ProjectProductCeeEntry>>(
      (acc, entry) => {
        if (entry.projectProductId) {
          acc[entry.projectProductId] = entry;
        }
        return acc;
      },
      {},
    );
  }, [ceeEntries]);

  const hasComputedCeeTotals = useMemo(
    () => ceeEntries.some((entry) => entry.result !== null),
    [ceeEntries],
  );

  const projectRecord = (project ?? {}) as Project & Record<string, unknown>;
  const statusValue =
    typeof project?.status === "string" && project.status.length > 0
      ? project.status
      : null;
  const statusConfig = statusValue
    ? projectStatuses.find((status) => status?.value === statusValue)
    : undefined;
  const badgeStyle = getProjectStatusBadgeStyle(statusConfig?.color);
  const statusLabel = statusConfig?.label ?? statusValue ?? "Statut";
  const statusProgress = statusValue
    ? computeStatusProgress(statusValue, projectStatuses)
    : 0;

  const isStatusUpdating = updateProjectStatusMutation.isPending;

  const fallbackLatestUpdateText = (() => {
    const candidates = [
      projectRecord["latest_update_text"],
      projectRecord["last_update_text"],
      projectRecord["status_update_text"],
    ];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }
    return null;
  })();

  const fallbackLatestUpdateAt = (() => {
    const candidates = [
      projectRecord["latest_update_at"],
      projectRecord["last_update_at"],
      projectRecord["status_update_at"],
    ];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim().length > 0) {
        return candidate;
      }
    }
    return null;
  })();

  const fallbackNextStep = (() => {
    const candidates = [
      projectRecord["next_step"],
      projectRecord["prochaine_etape"],
      projectRecord["upcoming_step"],
    ];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }
    return null;
  })();

  const fallbackHistoryRaw =
    projectRecord["history_short"] ??
    projectRecord["update_history"] ??
    projectRecord["status_history"] ??
    projectRecord["history"] ??
    null;
  const fallbackHistoryEntries = normalizeHistoryEntries(fallbackHistoryRaw);

  const latestUpdate = projectUpdates[0] ?? null;
  const latestUpdateText = (() => {
    const candidates = [latestUpdate?.content, fallbackLatestUpdateText];
    for (const candidate of candidates) {
      if (typeof candidate === "string") {
        const trimmed = candidate.trim();
        if (trimmed.length > 0) {
          return trimmed;
        }
      }
    }
    return null;
  })();

  const latestUpdateTimestamp = (() => {
    const candidates = [
      latestUpdate?.created_at,
      fallbackLatestUpdateAt,
      project?.updated_at,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim().length > 0) {
        const date = new Date(candidate);
        if (!Number.isNaN(date.getTime())) {
          return date.toISOString();
        }
      }
    }
    return null;
  })();

  const latestUpdateDisplay = formatDateTimeLabel(latestUpdateTimestamp);

  const nextStepDescription = (() => {
    const candidates = [latestUpdate?.next_step, fallbackNextStep];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }

    if (nextAppointmentDetails) {
      const parts = [
        `Prochain rendez-vous le ${nextAppointmentDetails.formattedDate}`,
        nextAppointmentDetails.metadata ?? undefined,
      ].filter((part): part is string => Boolean(part));
      if (parts.length > 0) {
        return parts.join(" • ");
      }
    }

    return null;
  })();

  const shortHistoryItems = (() => {
    const updateEntries = projectUpdates.slice(0, 3).map((update) => ({
      id: update.id,
      text:
        typeof update.content === "string" && update.content.trim().length > 0
          ? update.content.trim()
          : "Mise à jour enregistrée",
      createdAt: update.created_at,
    }));

    if (updateEntries.length >= 3) {
      return updateEntries;
    }

    const remainingSlots = 3 - updateEntries.length;
    const fallbackEntries = fallbackHistoryEntries
      .slice(0, remainingSlots)
      .map((entry, index) => ({
        id: `fallback-${index}`,
        text: entry.text,
        createdAt: entry.createdAt ?? null,
      }));

    return [...updateEntries, ...fallbackEntries];
  })();

  const fullHistoryItems = projectUpdates.length
    ? projectUpdates.map((update) => ({
        id: update.id,
        text:
          typeof update.content === "string" && update.content.trim().length > 0
            ? update.content.trim()
            : "Mise à jour enregistrée",
        createdAt: update.created_at,
        status: update.status ?? null,
        nextStep: update.next_step ?? null,
      }))
    : fallbackHistoryEntries.map((entry, index) => ({
        id: `fallback-full-${index}`,
        text: entry.text,
        createdAt: entry.createdAt ?? null,
        status: null,
        nextStep: null,
      }));

  const historyTextsForFallback = fallbackHistoryEntries
    .map((entry) => entry.text)
    .filter((text) => text.length > 0);

  const { mutateAsync: saveQuickUpdate, isPending: isSavingQuickUpdate } =
    useMutation({
      mutationFn: async ({ content }: { content: string }) => {
        if (!project) {
          throw new Error("Le projet n'est plus disponible.");
        }

        const trimmed = content.trim();
        if (trimmed.length === 0) {
          throw new Error(
            "Veuillez saisir une mise à jour avant de l'enregistrer.",
          );
        }

        const nowIso = new Date().toISOString();

        if (projectUpdatesTableAvailable) {
          const payload: Record<string, unknown> = {
            project_id: project.id,
            content: trimmed,
            status: project.status ?? null,
            next_step: fallbackNextStep ?? null,
            created_at: nowIso,
          };

          if (currentOrgId) {
            payload.org_id = currentOrgId;
          }

          if (user?.id) {
            payload.author_id = user.id;
          }

          const { error } = await supabase
            .from("project_updates" as any)
            .insert([payload]);
          if (!error) {
            return { usedFallback: false };
          }

          if (!isTableUnavailableError(error)) {
            throw error;
          }
        }

        const fallbackPayload: Record<string, unknown> = {};
        const textFieldCandidates = [
          "latest_update_text",
          "last_update_text",
          "status_update_text",
        ];
        const timestampFieldCandidates = [
          "latest_update_at",
          "last_update_at",
          "status_update_at",
        ];
        const historyFieldCandidates = [
          "history_short",
          "update_history",
          "status_history",
          "history",
        ];

        for (const field of textFieldCandidates) {
          if (Object.prototype.hasOwnProperty.call(projectRecord, field)) {
            fallbackPayload[field] = trimmed;
            break;
          }
        }

        for (const field of timestampFieldCandidates) {
          if (Object.prototype.hasOwnProperty.call(projectRecord, field)) {
            fallbackPayload[field] = nowIso;
            break;
          }
        }

        const newHistoryItems = [trimmed, ...historyTextsForFallback]
          .filter((value) => value.length > 0)
          .slice(0, 3);
        for (const field of historyFieldCandidates) {
          if (Object.prototype.hasOwnProperty.call(projectRecord, field)) {
            const currentValue = projectRecord[field];
            if (Array.isArray(currentValue)) {
              fallbackPayload[field] = newHistoryItems;
            } else if (typeof currentValue === "string") {
              fallbackPayload[field] = JSON.stringify(newHistoryItems);
            } else {
              fallbackPayload[field] = newHistoryItems;
            }
            break;
          }
        }

        if (Object.keys(fallbackPayload).length === 0) {
          throw new Error(
            "Impossible d'enregistrer la mise à jour : aucun champ de sauvegarde n'est disponible sur le projet.",
          );
        }

        const { error: projectError } = await supabase
          .from("projects" as any)
          .update(fallbackPayload)
          .eq("id", project.id)
          .select("id");

        if (projectError) {
          throw projectError;
        }

        return { usedFallback: true };
      },
      onSuccess: async () => {
        setQuickUpdateText("");
        await Promise.all([refetch(), refetchProjectUpdates()]);
        toast({ title: "Mise à jour enregistrée" });
      },
      onError: (mutationError) => {
        const message =
          mutationError instanceof Error
            ? mutationError.message
            : "Impossible d'enregistrer la mise à jour pour le moment.";
        toast({
          title: "Erreur",
          description: message,
          variant: "destructive",
        });
      },
    });

  const handleQuickUpdateSubmit = useCallback(async () => {
    await saveQuickUpdate({ content: quickUpdateText });
  }, [quickUpdateText, saveQuickUpdate]);

  const isQuickUpdateDisabled =
    !project || quickUpdateText.trim().length === 0 || isSavingQuickUpdate;
  const renderProductsTable = useCallback(
    (products: ProjectProduct[], emptyMessage: string) => {
      if (products.length === 0) {
        return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
      }

      return (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produit</TableHead>
                <TableHead>Images</TableHead>
                <TableHead>Multiplicateur</TableHead>
                <TableHead>Valorisation / unité (€)</TableHead>
                <TableHead>Valorisation totale (€)</TableHead>
                <TableHead>Prime calculée (€)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((item, index) => {
                const dynamicFields = getDynamicFieldEntries(
                  item.product?.params_schema ?? null,
                  item.dynamic_params,
                );
                const entryId =
                  item.id ?? item.product_id ?? `product-${index}`;
                const ceeEntry = ceeEntryMap[entryId];
                const hasWarnings =
                  Boolean(ceeEntry?.warnings.missingDynamicParams) ||
                  Boolean(ceeEntry?.warnings.missingKwh);
                const images = getProductImages(item.product);
                const visibleImages = images.slice(0, 3);
                const remainingImages = images.length - visibleImages.length;

                const multiplierDisplay = (() => {
                  if (!ceeEntry) return "Non renseigné";
                  if (
                    typeof ceeEntry.multiplierValue === "number" &&
                    ceeEntry.multiplierValue > 0
                  ) {
                    const value = formatDecimal(ceeEntry.multiplierValue);
                    return ceeEntry.multiplierLabel
                      ? `${value} (${ceeEntry.multiplierLabel})`
                      : value;
                  }
                  if (ceeEntry.warnings.missingDynamicParams) {
                    return "Paramètres dynamiques manquants";
                  }
                  return "Non renseigné";
                })();

                const valorisationPerUnitDisplay = (() => {
                  if (!ceeEntry) return "Non calculée";
                  if (ceeEntry.result) {
                    const perUnit = formatCurrency(
                      ceeEntry.result.valorisationPerUnitEur,
                    );
                    const perUnitMwh = formatDecimal(
                      ceeEntry.result.valorisationPerUnitMwh,
                    );
                    const label = ceeEntry.multiplierLabel ?? "unité";
                    return {
                      primary: `${perUnit}`,
                      secondary: `${perUnitMwh} MWh par ${label}`,
                    };
                  }
                  if (ceeEntry.warnings.missingDynamicParams) {
                    return "Paramètres dynamiques manquants";
                  }
                  if (ceeEntry.warnings.missingKwh) {
                    return "Aucune valeur kWh";
                  }
                  return "Non calculée";
                })();

                const valorisationTotalDisplay = (() => {
                  if (!ceeEntry) return "Non calculée";
                  if (ceeEntry.result) {
                    return {
                      primary: formatCurrency(
                        ceeEntry.result.valorisationTotalEur,
                      ),
                      secondary: `${formatDecimal(ceeEntry.result.valorisationTotalMwh)} MWh`,
                    };
                  }
                  if (ceeEntry.warnings.missingDynamicParams) {
                    return "Paramètres dynamiques manquants";
                  }
                  if (ceeEntry.warnings.missingKwh) {
                    return "Aucune valeur kWh";
                  }
                  return "Non calculée";
                })();

                const primeDisplay = (() => {
                  if (!ceeEntry) return "Non calculée";
                  if (ceeEntry.result) {
                    return formatCurrency(ceeEntry.result.totalPrime);
                  }
                  if (ceeEntry.warnings.missingDynamicParams) {
                    return "Paramètres dynamiques manquants";
                  }
                  if (ceeEntry.warnings.missingKwh) {
                    return "Aucune valeur kWh";
                  }
                  return "Non calculée";
                })();

                return (
                  <TableRow key={item.id ?? entryId} className="align-top">
                    <TableCell>
                      <div className="flex flex-col gap-2 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant="secondary"
                            className="text-xs font-semibold"
                          >
                            {item.product?.code ?? "Code inconnu"}
                          </Badge>
                          <span className="font-medium text-foreground">
                            {item.product?.name ?? "Produit"}
                          </span>
                        </div>
                        {typeof item.quantity === "number" ? (
                          <span className="text-xs text-muted-foreground">
                            Quantité : {formatDecimal(item.quantity)}
                          </span>
                        ) : null}
                        {hasWarnings ? (
                          <div className="flex flex-wrap gap-2">
                            {ceeEntry?.warnings.missingKwh ? (
                              <Badge
                                className="bg-amber-100 text-amber-700 border-amber-200"
                                variant="outline"
                              >
                                kWh manquant pour ce bâtiment
                              </Badge>
                            ) : null}
                            {ceeEntry?.warnings.missingDynamicParams ? (
                              <Badge
                                className="bg-amber-100 text-amber-700 border-amber-200"
                                variant="outline"
                              >
                                Paramètres dynamiques manquants
                              </Badge>
                            ) : null}
                          </div>
                        ) : null}
                        {dynamicFields.length > 0 ? (
                          <div className="grid gap-2 text-xs md:grid-cols-2">
                            {dynamicFields.map((field) => (
                              <div
                                key={`${item.id}-${field.label}`}
                                className="flex items-center justify-between gap-2"
                              >
                                <span className="text-muted-foreground">
                                  {field.label}
                                </span>
                                <span className="font-medium text-foreground">
                                  {String(formatDynamicFieldValue(field))}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {visibleImages.length === 0 ? (
                        <span className="text-xs text-muted-foreground">
                          Aucune image
                        </span>
                      ) : (
                        <div className="flex flex-wrap items-center gap-2">
                          {visibleImages.map((image, imageIndex) => (
                            <button
                              type="button"
                              key={`${entryId}-image-${imageIndex}`}
                              onClick={() =>
                                setLightboxImage({
                                  url: image.url,
                                  alt:
                                    image.alt ??
                                    item.product?.name ??
                                    item.product?.code ??
                                    "Visuel produit",
                                })
                              }
                              className="h-14 w-14 overflow-hidden rounded-md border border-border/60 bg-muted/30 transition hover:ring-2 hover:ring-primary focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                              <img
                                src={image.url}
                                alt={
                                  image.alt ??
                                  item.product?.name ??
                                  "Visuel produit"
                                }
                                className="h-full w-full object-cover"
                              />
                            </button>
                          ))}
                          {remainingImages > 0 ? (
                            <Badge variant="secondary" className="text-xs">
                              +{remainingImages}
                            </Badge>
                          ) : null}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm font-medium text-foreground">
                      {multiplierDisplay}
                    </TableCell>
                    <TableCell>
                      {typeof valorisationPerUnitDisplay === "string" ? (
                        <span className="text-sm text-muted-foreground">
                          {valorisationPerUnitDisplay}
                        </span>
                      ) : (
                        <div className="flex flex-col text-sm">
                          <span className="font-semibold text-emerald-600">
                            {valorisationPerUnitDisplay.primary}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {valorisationPerUnitDisplay.secondary}
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {typeof valorisationTotalDisplay === "string" ? (
                        <span className="text-sm text-muted-foreground">
                          {valorisationTotalDisplay}
                        </span>
                      ) : (
                        <div className="flex flex-col text-sm">
                          <span className="font-semibold text-amber-600">
                            {valorisationTotalDisplay.primary}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {valorisationTotalDisplay.secondary}
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-semibold text-emerald-600">
                        {primeDisplay}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      );
    },
    [ceeEntryMap],
  );

  const isInitialLoading = isLoading || membersLoading;
  const canManageSites = isAdmin || project?.user_id === user?.id;

  if (isInitialLoading) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Une erreur inattendue est survenue.";

    return (
      <Layout>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
          <AlertTriangle className="h-10 w-10 text-destructive" />
          <div className="space-y-2">
            <h1 className="text-xl font-semibold">
              Impossible de charger le projet
            </h1>
            <p className="text-sm text-muted-foreground">{errorMessage}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" onClick={() => navigate(-1)}>
              Retour
            </Button>
            <Button onClick={() => refetch()}>Réessayer</Button>
          </div>
        </div>
      </Layout>
    );
  }

  if (!project) {
    return (
      <Layout>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
          <FolderOpen className="h-10 w-10 text-muted-foreground" />
          <div className="space-y-2">
            <h1 className="text-xl font-semibold">Projet introuvable</h1>
            <p className="text-sm text-muted-foreground">
              Le projet demandé n'existe plus ou vous n'y avez pas accès.
            </p>
          </div>
          <Button onClick={() => navigate("/projects")}>
            Retour aux projets
          </Button>
        </div>
      </Layout>
    );
  }

  const handleCreateSite = async () => {
    if (!project || !currentOrgId) return;

    const displayedProducts = getDisplayedProducts(project.project_products);
    const firstProduct =
      displayedProducts[0]?.product ??
      project.project_products?.[0]?.product ??
      null;
    const productLabel =
      firstProduct?.code ||
      (project as Project & { product_name?: string | null }).product_name ||
      "";
    const clientName = getProjectClientName(project);
    const address =
      (project as Project & { address?: string | null }).address ?? "";

    const today = new Date();
    const datePrefix = `SITE-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(
      today.getDate(),
    ).padStart(2, "0")}`;

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
      const lastNumber = parseInt(lastRef.split("-").pop() || "0", 10);
      nextNumber = Number.isFinite(lastNumber) ? lastNumber + 1 : 1;
    }

    const site_ref = `${datePrefix}-${String(nextNumber).padStart(3, "0")}`;
    const valorisationEur = hasComputedCeeTotals
      ? ceeTotals.totalValorisationEur
      : (ceeTotals.totalPrime ?? 0);

    setSiteDialogMode("create");
    setActiveSite(null);
    setSiteDialogDefaultTab("avant-chantier");
    setSiteDialogReadOnly(false);
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
      surface_facturee: projectSurfaceFacturee > 0 ? projectSurfaceFacturee : 0,
      cout_main_oeuvre_m2_ht: 0,
      cout_isolation_m2: 0,
      isolation_utilisee_m2: 0,
      montant_commission: 0,
      valorisation_cee: valorisationEur ?? 0,
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

  const handleEditSite = (
    site: ProjectSite,
    options?: {
      readOnly?: boolean;
      defaultTab?: "avant-chantier" | "apres-chantier";
    },
  ) => {
    const { readOnly = false, defaultTab = "avant-chantier" } = options ?? {};

    setSiteDialogMode("edit");
    setSiteDialogReadOnly(readOnly);
    setSiteDialogDefaultTab(defaultTab);
    setActiveSite(site);
    const rawTravauxChoice = (site.travaux_non_subventionnes ?? "NA") as
      | TravauxNonSubventionnesValue
      | string;
    const isValidTravauxChoice = TRAVAUX_NON_SUBVENTIONNES_OPTIONS.some(
      (option) => option.value === rawTravauxChoice,
    );
    const resolvedTravauxChoice = isValidTravauxChoice
      ? (rawTravauxChoice as TravauxNonSubventionnesValue)
      : "NA";
    const travauxDescription =
      typeof site.travaux_non_subventionnes_description === "string"
        ? site.travaux_non_subventionnes_description.trim()
        : "";
    const travauxMontant =
      typeof site.travaux_non_subventionnes_montant === "number" &&
      Number.isFinite(site.travaux_non_subventionnes_montant)
        ? site.travaux_non_subventionnes_montant
        : 0;
    const travauxFinancement = Boolean(site.travaux_non_subventionnes_financement);
    const commissionCommercialeActive = Boolean(site.commission_commerciale_ht);
    const commissionCommercialeMontant =
      typeof site.commission_commerciale_ht_montant === "number" &&
      Number.isFinite(site.commission_commerciale_ht_montant)
        ? site.commission_commerciale_ht_montant
        : 0;
    setSiteInitialValues({
      site_ref: site.site_ref,
      project_ref: site.project_ref,
      client_name: site.client_name,
      product_name: site.product_name,
      address: site.address,
      city: site.city,
      postal_code: site.postal_code,
      status: (site.status as SiteStatus) ?? "PLANIFIE",
      cofrac_status: (site.cofrac_status as CofracStatus) ?? "EN_ATTENTE",
      date_debut: site.date_debut,
      date_fin_prevue: site.date_fin_prevue ?? "",
      progress_percentage: site.progress_percentage ?? 0,
      revenue: site.revenue ?? 0,
      profit_margin: site.profit_margin ?? 0,
      surface_facturee: site.surface_facturee ?? 0,
      cout_main_oeuvre_m2_ht: site.cout_main_oeuvre_m2_ht ?? 0,
      cout_isolation_m2: site.cout_isolation_m2 ?? 0,
      isolation_utilisee_m2: site.isolation_utilisee_m2 ?? 0,
      montant_commission: site.montant_commission ?? 0,
      valorisation_cee: site.valorisation_cee ?? 0,
      travaux_non_subventionnes: resolvedTravauxChoice,
      travaux_non_subventionnes_description: travauxDescription,
      travaux_non_subventionnes_montant: travauxMontant,
      travaux_non_subventionnes_financement: travauxFinancement,
      commission_commerciale_ht: commissionCommercialeActive,
      commission_commerciale_ht_montant: commissionCommercialeMontant,
      notes: site.notes ?? "",
      subcontractor_payment_confirmed: Boolean(
        site.subcontractor_payment_confirmed,
      ),
      subcontractor_id: site.subcontractor_id ?? null,
      team_members: mapTeamMembersToFormValues(site.team_members ?? []),
      additional_costs: normalizeAdditionalCosts(site.additional_costs ?? []),
    });
    setSiteDialogOpen(true);
  };

  const handleSubmitSite = async (values: SiteSubmitValues) => {
    if (!user || !currentOrgId || !project) return;

    const sanitizedTeam = Array.from(
      new Set(
        (values.team_members ?? [])
          .map((member) => {
            if (!member) return null;

            const rawId = typeof member.id === "string" ? member.id.trim() : "";
            if (rawId && (isUuid(rawId) || memberNameById[rawId])) {
              return rawId;
            }

            const rawName =
              typeof member.name === "string" ? member.name.trim() : "";
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
              : computeAdditionalCostTTC(amountHT, montantTVA);

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
    const matchedProject = projectSiteOptions.find(
      (option) => option.project_ref === projectRef,
    );
    const resolvedProjectId =
      typeof matchedProject?.id === "string" && matchedProject.id.length > 0
        ? matchedProject.id
        : typeof activeSite?.project_id === "string" &&
            activeSite.project_id.length > 0
          ? activeSite.project_id
          : project.id;

    const baseSiteData = {
      site_ref: values.site_ref,
      project_ref: projectRef,
      client_name: clientName,
      client_first_name: project.client_first_name || null,
      client_last_name: project.client_last_name || null,
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
      project_id: resolvedProjectId,
      rentability_total_costs: values.rentability_total_costs,
      rentability_margin_total: values.rentability_margin_total,
      rentability_margin_per_unit: values.rentability_margin_per_unit,
      rentability_margin_rate: values.rentability_margin_rate,
      rentability_unit_label: values.rentability_unit_label,
      rentability_unit_count: values.rentability_unit_count,
      rentability_additional_costs_total: values.rentability_additional_costs_total,
    };

    const { status: nextStatus, ...siteUpdateData } = baseSiteData;
    const normalizedNextStatus = typeof nextStatus === "string" ? nextStatus : null;
    const statusChanged =
      siteDialogMode === "edit" &&
      activeSite &&
      normalizedNextStatus &&
      normalizedNextStatus !== activeSite.status;

    try {
      if (siteDialogMode === "edit" && activeSite) {
        const { error } = await supabase
          .from("sites")
          .update(siteUpdateData)
          .eq("id", activeSite.id);

        if (error) throw error;

        if (statusChanged) {
          await updateChantierStatus(activeSite.id, normalizedNextStatus);
        }

        toast({
          title: "Chantier mis à jour",
          description: `${values.site_ref} a été mis à jour avec succès.`,
        });
      } else {
        const { error } = await supabase.from("sites").insert([baseSiteData]);

        if (error) throw error;

        toast({
          title: "Chantier créé",
          description: `${baseSiteData.site_ref} a été ajouté à la liste des chantiers.`,
        });
      }

      if (statusChanged) {
        await Promise.all([refetchProjectSites(), refetch()]);
      } else {
        await refetchProjectSites();
      }
      setSiteDialogOpen(false);
      setSiteInitialValues(undefined);
      setActiveSite(null);
      setSiteDialogMode("create");
    } catch (error) {
      console.error("Error saving site:", error);
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder le chantier.",
        variant: "destructive",
      });
    }
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

  const handleArchiveProject = async () => {
    if (!project) return;

    try {
      setIsArchiving(true);
      const projectLabel = project.project_ref || "ce projet";
      const archivedAt = new Date().toISOString();

      let query = supabase
        .from("projects")
        .update({ status: ARCHIVED_STATUS_VALUE, archived_at: archivedAt })
        .eq("id", project.id);

      if (currentOrgId) {
        query = query.eq("org_id", currentOrgId);
      }

      const { error } = await query;

      if (error) {
        throw error;
      }

      setArchiveDialogOpen(false);
      toast({
        title: "Projet archivé",
        description: `${projectLabel} a été archivé avec succès.`,
      });
      navigate({ pathname: "/projects", search: "?status=active" });
    } catch (error) {
      console.error(error);
      toast({
        title: "Erreur lors de l'archivage",
        description:
          error instanceof Error
            ? error.message
            : "Impossible d'archiver le projet.",
        variant: "destructive",
      });
    } finally {
      setIsArchiving(false);
    }
  };

  const projectCostValue = project?.estimated_value ?? null;
  const projectEmail = (() => {
    if (!project) return null;

    const projectWithEmails = project as Project & {
      email?: string | null;
      client_email?: string | null;
    };

    const candidates = [
      projectWithEmails.email,
      projectWithEmails.client_email,
      project.lead?.email ?? null,
    ];

    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }

    return null;
  })();
  const driveFolderUrl = project
    ? ((project as Project & { drive_folder_url?: string | null })
        .drive_folder_url ?? null)
    : null;
  const projectAppointments = project?.project_appointments ?? [];
  const journalLoading =
    projectMediaLoading ||
    projectNotesLoading ||
    statusEventsLoading ||
    projectSitesLoading;

  const displayedPrimeValue = (() => {
    const storedPrime = resolvePrimeCeeEuro(project);
    if (storedPrime !== null) {
      return storedPrime;
    }

    if (hasComputedCeeTotals) {
      return ceeTotals.totalPrime;
    }

    return null;
  })();

  const isProjectArchived = project
    ? ARCHIVED_STATUS_VALUES.has(project.status ?? "")
    : false;

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
              <DropdownMenu
                open={statusMenuOpen}
                onOpenChange={(open) => {
                  if (isStatusUpdating && open) {
                    return;
                  }
                  setStatusMenuOpen(open);
                }}
              >
                <DropdownMenuTrigger asChild disabled={isStatusUpdating}>
                  <button
                    type="button"
                    className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
                    aria-label="Changer le statut du projet"
                  >
                    <Badge
                      variant="outline"
                      style={badgeStyle}
                      className={`font-semibold transition ${
                        isStatusUpdating
                          ? "cursor-not-allowed opacity-70"
                          : "cursor-pointer hover:shadow"
                      } ${statusMenuOpen ? "ring-2 ring-primary/30" : ""}`}
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
                <DropdownMenuContent align="start" className="w-64">
                  <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Changer le statut
                  </div>
                  {projectStatuses
                    .filter((status) => status != null)
                    .map((status) => {
                      const isActive =
                        status?.value === (project.status ?? "");
                      return (
                        <DropdownMenuItem
                          key={status.value}
                          onClick={() => {
                            void handleStatusSelect(status.value);
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
            <h1 className="mt-2 text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              {project.project_ref}
            </h1>
            <p className="text-muted-foreground">
              {productCodes.length > 0
                ? productCodes.join(", ")
                : "Aucun code produit"}{" "}
              – {project.city} ({project.postal_code})
            </p>
            {nextAppointmentDetails ? (
              <Badge
                variant="secondary"
                className="mt-3 inline-flex w-fit items-center gap-2 border-primary/30 bg-primary/10 text-primary"
              >
                <Calendar className="h-3.5 w-3.5" />
                <span className="text-xs font-semibold uppercase tracking-wide">
                  Prochain RDV
                </span>
                <span className="text-sm font-medium normal-case">
                  {nextAppointmentDetails.formattedDate}
                </span>
              </Badge>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <ProjectScheduleDialog
              projectId={project.id}
              members={members}
              isLoadingMembers={membersLoading}
              onScheduled={async () => {
                await refetch();
              }}
            />
            <Button variant="outline" onClick={handleOpenQuote}>
              <FileText className="w-4 h-4 mr-2" />
              Générer un devis
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                void handleCreateSite();
              }}
            >
              <Hammer className="w-4 h-4 mr-2" />
              Créer un chantier
            </Button>
            <Button variant="outline" onClick={handleOpenDocuments}>
              <FolderOpen className="w-4 h-4 mr-2" />
              Voir les media
            </Button>
            {(isAdmin || project.user_id === user?.id) &&
              !isProjectArchived && (
                <AlertDialog
                  open={archiveDialogOpen}
                  onOpenChange={setArchiveDialogOpen}
                >
                  <AlertDialogTrigger asChild>
                    <Button variant="outline">
                      <Archive className="w-4 h-4 mr-2" />
                      Archiver
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Archiver le projet ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Êtes-vous sûr de vouloir archiver ce projet ?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isArchiving}>
                        Annuler
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleArchiveProject}
                        disabled={isArchiving}
                      >
                        {isArchiving ? "Archivage..." : "Confirmer"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            {(isAdmin || project.user_id === user?.id) && (
              <AlertDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
              >
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
                      Cette action est irréversible. Le projet{" "}
                      {project.project_ref || "sélectionné"} sera définitivement
                      supprimé.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>
                      Annuler
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteProject}
                      disabled={isDeleting}
                    >
                      {isDeleting ? "Suppression..." : "Confirmer"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="space-y-6"
        >
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="details">Détails</TabsTrigger>
            <TabsTrigger value="chantiers">Chantiers</TabsTrigger>
            <TabsTrigger value="media">Media</TabsTrigger>
            <TabsTrigger value="journal">Journal</TabsTrigger>
          </TabsList>
          <TabsContent value="details" className="space-y-6">
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
                        <p className="text-sm text-muted-foreground">
                          {project.company}
                        </p>
                      )}
                      {project.siren && (
                        <p className="flex items-center gap-2 font-medium">
                          <span className="text-xs uppercase tracking-wide text-muted-foreground">
                            SIREN
                          </span>
                          <span>{project.siren}</span>
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
                              (project as Project & { address?: string })
                                .address,
                              [project.postal_code, project.city]
                                .filter(Boolean)
                                .join(" "),
                            ]
                              .filter(
                                (part) =>
                                  part && part.toString().trim().length > 0,
                              )
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
                      <p className="text-sm text-muted-foreground">
                        Type de bâtiment
                      </p>
                      <p className="font-medium flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-primary" />
                        {project.building_type ?? "Non renseigné"}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Usage</p>
                      <p className="font-medium">
                        {project.usage ?? "Non renseigné"}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Surface bâtiment
                      </p>
                      <p className="font-medium">
                        {typeof project.surface_batiment_m2 === "number"
                          ? `${project.surface_batiment_m2} m²`
                          : "Non renseigné"}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Surface isolée
                      </p>
                      <p className="font-medium">
                        {typeof project.surface_isolee_m2 === "number"
                          ? `${project.surface_isolee_m2} m²`
                          : "Non renseigné"}
                      </p>
                    </div>
                  </div>
              </CardContent>
            </Card>

            <Card className="shadow-card border border-dashed border-primary/20">
              <CardHeader>
                <CardTitle>Démarrer un chantier</CardTitle>
                <CardDescription>
                  Initialisez rapidement un chantier opérationnel synchronisé avec
                  ce projet.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <p className="text-sm text-muted-foreground">
                  Créez un chantier prérempli avec les informations du projet et
                  mettez à jour automatiquement le statut associé.
                </p>
                <Button
                  onClick={() => setQuickStartOpen(true)}
                  className="inline-flex items-center gap-2"
                  disabled={isStartingChantier}
                >
                  {isStartingChantier ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Initialisation...
                    </>
                  ) : (
                    <>
                      <Hammer className="h-4 w-4" />
                      Démarrer le chantier
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-6">
              <Card className="shadow-card bg-gradient-card border-0">
                <CardHeader>
                  <CardTitle>Finances & planning</CardTitle>
                </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Euro className="w-4 h-4 text-primary" />
                      <span className="text-muted-foreground">
                        Coût du chantier:
                      </span>
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
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-blue-600" />
                      <span className="text-muted-foreground">MWh générés:</span>
                      <span className="font-medium text-blue-600">
                        {hasComputedCeeTotals
                          ? `${formatDecimal(ceeTotals.totalValorisationMwh)} MWh`
                          : "Non calculés"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <HandCoins className="w-4 h-4 text-amber-600" />
                      <span className="text-muted-foreground">
                        Valorisation totale:
                      </span>
                      <span className="font-medium text-amber-600">
                        {hasComputedCeeTotals
                          ? formatCurrency(ceeTotals.totalValorisationEur)
                          : "Non calculée"}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-card border-0">
                  <CardHeader className="space-y-2">
                    <CardTitle className="flex items-center gap-2 text-base font-semibold">
                      <NotebookPen className="w-4 h-4 text-primary" />
                      Progression & Mises à jour
                    </CardTitle>
                    <CardDescription>
                      Suivez l'avancement du dossier et consignez les dernières
                      informations partagées avec le client.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            Statut
                          </span>
                          <Badge
                            variant="outline"
                            style={badgeStyle}
                            className="text-xs font-medium"
                          >
                            {statusLabel}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {statusProgress > 0 ? `${statusProgress}%` : "0%"}
                        </span>
                      </div>
                      <Progress value={statusProgress} className="h-2" />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Clock className="w-4 h-4 text-primary" />
                        Dernière mise à jour
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {latestUpdateDisplay ??
                          "Aucune mise à jour enregistrée"}
                      </p>
                      {latestUpdateText ? (
                        <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                          {latestUpdateText}
                        </p>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm font-medium text-muted-foreground">
                        Prochaine étape
                      </div>
                      <p className="text-sm font-medium">
                        {nextStepDescription ?? "Aucune étape planifiée"}
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="text-sm font-medium text-muted-foreground">
                        Historique récent
                      </div>
                      {projectUpdatesLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      ) : shortHistoryItems.length > 0 ? (
                        <ul className="space-y-3">
                          {shortHistoryItems.map((item) => {
                            const displayDate = formatDateTimeLabel(
                              item.createdAt,
                              {
                                dateStyle: "short",
                                timeStyle: "short",
                              },
                            );
                            return (
                              <li
                                key={item.id}
                                className="rounded-lg border border-border/60 bg-muted/20 p-3"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-sm font-medium leading-tight">
                                    {item.text}
                                  </span>
                                  {displayDate ? (
                                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                                      {displayDate}
                                    </span>
                                  ) : null}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          Aucune note historique pour le moment.
                        </p>
                      )}
                    </div>

                    <div className="space-y-3">
                      <label
                        className="text-sm font-medium text-muted-foreground"
                        htmlFor="quick-update-textarea"
                      >
                        Ajouter une mise à jour rapide
                      </label>
                      <Textarea
                        id="quick-update-textarea"
                        value={quickUpdateText}
                        onChange={(event) =>
                          setQuickUpdateText(event.target.value)
                        }
                        rows={3}
                        placeholder="Note interne, suivi client, information de planning..."
                        className="resize-none"
                      />
                      <div className="flex items-center justify-end">
                        <Button
                          size="sm"
                          onClick={() => {
                            void handleQuickUpdateSubmit();
                          }}
                          disabled={isQuickUpdateDisabled}
                        >
                          {isSavingQuickUpdate ? (
                            <>
                              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                              Enregistrement...
                            </>
                          ) : (
                            "Enregistrer"
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      {!projectUpdatesTableAvailable && projectUpdatesError ? (
                        <span className="text-xs text-muted-foreground italic">
                          Les mises à jour sont sauvegardées directement sur la
                          fiche projet.
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {projectUpdates.length > 0
                            ? `${projectUpdates.length} mise${projectUpdates.length > 1 ? "s" : ""} enregistrée${
                                projectUpdates.length > 1 ? "s" : ""
                              }`
                            : "Aucune mise à jour enregistrée"}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setActiveTab("journal")}
                        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                      >
                        Voir tout l'historique
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="shadow-card border border-dashed border-primary/20">
                  <CardHeader>
                    <CardTitle>Détails & actions</CardTitle>
                    <CardDescription>
                      Accédez rapidement aux documents et à l'historique du
                      projet.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <Calendar className="w-4 h-4 text-primary" />
                        RDV à venir
                      </div>
                      {upcomingAppointmentDetails.length > 0 ? (
                        <div className="space-y-2">
                          {upcomingAppointmentDetails.map((appointment, index) => {
                            const isNext = index === 0;
                            return (
                              <div
                                key={appointment.id}
                                className={`rounded-lg border p-3 transition ${
                                  isNext
                                    ? "border-primary/50 bg-primary/5 shadow-sm"
                                    : "border-border/40 bg-background/60"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-sm font-medium leading-tight text-foreground">
                                    {appointment.formattedDate}
                                  </p>
                                  {isNext ? (
                                    <Badge
                                      variant="secondary"
                                      className="border-transparent bg-primary/15 text-xs font-semibold text-primary"
                                    >
                                      Prochain RDV
                                    </Badge>
                                  ) : null}
                                </div>
                                {appointment.metadata ? (
                                  <p className="text-xs text-muted-foreground leading-tight">
                                    {appointment.metadata}
                                  </p>
                                ) : null}
                                {appointment.notes ? (
                                  <p className="text-xs text-muted-foreground italic leading-tight">
                                    {appointment.notes}
                                  </p>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-background/60 p-3 text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          <span>Aucun RDV planifié</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Button
                        variant="outline"
                        className="w-full justify-start"
                        onClick={handleOpenDocuments}
                      >
                        <ImageIcon className="h-4 w-4 mr-2" />
                        Media du projet
                      </Button>
                      <Button
                        variant="secondary"
                        className="w-full justify-start"
                        onClick={handleViewFullHistory}
                      >
                        <CircleDot className="h-4 w-4 mr-2" />
                        Voir tout l'historique
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            <Card className="shadow-card bg-gradient-card border-0">
              <CardHeader>
                <CardTitle>Produits associés</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {renderProductsTable(
                  projectProducts,
                  "Aucun produit (hors ECO) n'est associé à ce projet.",
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="media" className="space-y-6">
            <ProjectMediaTab
              project={project}
              mediaItems={projectMedia}
              selectedCategory={selectedMediaCategory}
              onCategoryChange={setSelectedMediaCategory}
              onUpload={handleUploadMedia}
              isUploading={uploadMediaMutation.isPending}
              isLoading={projectMediaLoading}
              driveFolderUrl={driveFolderUrl}
            />
          </TabsContent>
          <TabsContent value="journal" className="space-y-6">
            <ProjectJournalTab
              project={project}
              statusEvents={statusEvents}
              notes={projectNotes}
              mediaItems={projectMedia}
              appointments={projectAppointments}
              sites={projectSites}
              memberNameById={memberNameById}
              filter={journalFilter}
              onFilterChange={setJournalFilter}
              onAddNote={handleAddNote}
              isAddingNote={addNoteMutation.isPending}
              statusOptions={projectStatuses}
              feedRef={journalFeedRef}
              isLoading={journalLoading}
            />
          </TabsContent>
          <TabsContent value="chantiers" className="space-y-6">
            <Card className="shadow-card bg-gradient-card border-0">
              <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <CardTitle>Chantiers du projet</CardTitle>
                  <CardDescription>
                    Créez, éditez et suivez les chantiers rattachés à{" "}
                    {project.project_ref}.
                  </CardDescription>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    void handleCreateSite();
                  }}
                  className="inline-flex items-center gap-2"
                >
                  <Hammer className="h-4 w-4" />
                  Nouveau chantier
                </Button>
              </CardHeader>
              <CardContent>
                {projectSitesLoading ? (
                  <div className="py-6 text-sm text-muted-foreground">
                    Chargement des chantiers...
                  </div>
                ) : projectSites.length === 0 ? (
                  <div className="space-y-4 py-10 text-center">
                    <div className="space-y-2">
                      <CardTitle className="text-lg">
                        Aucun chantier lié
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Créez un chantier pour suivre l'exécution de ce projet.
                      </p>
                    </div>
                    <Button
                      onClick={() => {
                        void handleCreateSite();
                      }}
                      size="sm"
                      className="inline-flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Créer un chantier
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {projectSites.map((site) => {
                      const status = (site.status ?? "PLANIFIE") as SiteStatus;
                      const cofracStatus = (site.cofrac_status ??
                        "EN_ATTENTE") as CofracStatus;
                      const teamMembersLabel = formatTeamMembers(
                        site.team_members,
                      );
                      const progressValue =
                        typeof site.progress_percentage === "number"
                          ? Math.min(Math.max(site.progress_percentage, 0), 100)
                          : 0;
                      const parsedSiteNotes = parseSiteNotes(site.notes);
                      const internalNotes = parsedSiteNotes.text?.trim() ?? "";
                      const hasInternalNotes = internalNotes.length > 0;
                      const driveFile = parsedSiteNotes.driveFile;
                      const driveLink = driveFile?.webViewLink ?? null;
                      const driveLabel = driveFile?.name ?? "Document chantier";
                      const hasDriveFile = Boolean(driveLink);
                      const additionalCostCount = Array.isArray(
                        site.additional_costs,
                      )
                        ? site.additional_costs.length
                        : 0;
                      const additionalCostTotal = Array.isArray(site.additional_costs)
                        ? site.additional_costs.reduce((total, rawCost) => {
                            if (!rawCost || typeof rawCost !== "object") {
                              return total;
                            }

                            const cost = rawCost as Record<string, unknown>;
                            const amountHT = parseNumber(cost.amount_ht) ?? 0;
                            const montantTVA =
                              parseNumber(cost.montant_tva) ?? parseNumber(cost.taxes) ?? 0;
                            const amountTTC =
                              parseNumber(cost.amount_ttc) ??
                              computeAdditionalCostTTC(amountHT, montantTVA);

                            return total + amountTTC;
                          }, 0)
                        : 0;
                      const additionalCostDisplay =
                        additionalCostCount > 0
                          ? `${formatCurrency(additionalCostTotal)} (${additionalCostCount})`
                          : "—";
                      const revenueDisplay =
                        typeof site.revenue === "number"
                          ? formatCurrency(site.revenue)
                          : "—";
                      const primeDisplay =
                        typeof site.valorisation_cee === "number"
                          ? formatCurrency(site.valorisation_cee)
                          : "—";
                      const rentabilityInput = buildRentabilityInputFromSite({
                        revenue: site.revenue,
                        cout_main_oeuvre_m2_ht: site.cout_main_oeuvre_m2_ht,
                        cout_isolation_m2: site.cout_isolation_m2,
                        isolation_utilisee_m2: site.isolation_utilisee_m2,
                        surface_facturee: site.surface_facturee,
                        montant_commission: site.montant_commission,
                        travaux_non_subventionnes: site.travaux_non_subventionnes,
                        travaux_non_subventionnes_montant:
                          site.travaux_non_subventionnes_montant,
                        additional_costs: Array.isArray(site.additional_costs)
                          ? (site.additional_costs as SiteFormValues["additional_costs"])
                          : [],
                        product_name: site.product_name,
                      });
                      const computedRentability = calculateRentability(rentabilityInput);
                      const rentabilityUnitLabel =
                        typeof site.rentability_unit_label === "string" &&
                        site.rentability_unit_label.trim().length > 0
                          ? site.rentability_unit_label
                          : computedRentability.unitLabel;
                      const rentabilityMetrics = {
                        additionalCostsTotal:
                          typeof site.rentability_additional_costs_total === "number"
                            ? site.rentability_additional_costs_total
                            : computedRentability.additionalCostsTotal,
                        totalCosts:
                          typeof site.rentability_total_costs === "number"
                            ? site.rentability_total_costs
                            : computedRentability.totalCosts,
                        marginPerUnit:
                          typeof site.rentability_margin_per_unit === "number"
                            ? site.rentability_margin_per_unit
                            : computedRentability.marginPerUnit,
                        marginTotal:
                          typeof site.rentability_margin_total === "number"
                            ? site.rentability_margin_total
                            : computedRentability.marginTotal,
                        marginRate:
                          typeof site.rentability_margin_rate === "number"
                            ? site.rentability_margin_rate
                            : computedRentability.marginRate,
                        unitLabel: rentabilityUnitLabel,
                      };
                      const rentabilityMarginPerUnitLabel =
                        rentabilityMetrics.unitLabel === "luminaire"
                          ? "Marge (€ / luminaire)"
                          : "Marge (€ / m²)";
                      const rentabilityAdditionalCostsDisplay = formatCurrency(
                        rentabilityMetrics.additionalCostsTotal,
                      );
                      const rentabilityTotalCostsDisplay = formatCurrency(
                        rentabilityMetrics.totalCosts,
                      );
                      const rentabilityMarginTotalDisplay = formatCurrency(
                        rentabilityMetrics.marginTotal,
                      );
                      const rentabilityMarginRateDisplay = Number.isFinite(
                        rentabilityMetrics.marginRate,
                      )
                        ? formatPercent(rentabilityMetrics.marginRate)
                        : "—";
                      const rentabilityMarginPerUnitDisplay = Number.isFinite(
                        rentabilityMetrics.marginPerUnit,
                      )
                        ? `${formatDecimal(rentabilityMetrics.marginPerUnit)} € / ${rentabilityMetrics.unitLabel}`
                        : `— / ${rentabilityMetrics.unitLabel}`;
                      const rawTravauxChoice = (site.travaux_non_subventionnes ?? "NA") as
                        | TravauxNonSubventionnesValue
                        | string;
                      const isValidTravauxChoice = TRAVAUX_NON_SUBVENTIONNES_OPTIONS.some(
                        (option) => option.value === rawTravauxChoice,
                      );
                      const travauxChoice = isValidTravauxChoice
                        ? (rawTravauxChoice as TravauxNonSubventionnesValue)
                        : "NA";
                      const travauxLabel =
                        TRAVAUX_NON_SUBVENTIONNES_LABELS[travauxChoice] ?? "N/A";
                      const hasTravauxDetails = travauxChoice !== "NA";
                      const travauxDescription =
                        typeof site.travaux_non_subventionnes_description === "string"
                          ? site.travaux_non_subventionnes_description.trim()
                          : "";
                      const travauxMontant =
                        typeof site.travaux_non_subventionnes_montant === "number" &&
                        Number.isFinite(site.travaux_non_subventionnes_montant)
                          ? site.travaux_non_subventionnes_montant
                          : 0;
                      const travauxFinancement = hasTravauxDetails
                        ? Boolean(site.travaux_non_subventionnes_financement)
                        : false;
                      const commissionCommercialeActive = Boolean(
                        site.commission_commerciale_ht,
                      );
                      const commissionCommercialeMontant =
                        typeof site.commission_commerciale_ht_montant === "number" &&
                        Number.isFinite(site.commission_commerciale_ht_montant)
                          ? site.commission_commerciale_ht_montant
                          : 0;

                      return (
                        <div
                          key={site.id}
                          className="space-y-4 rounded-lg border border-border/60 bg-background/60 p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h3 className="text-base font-semibold text-foreground">
                                {site.site_ref}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                {site.address
                                  ? `${site.address} · ${site.postal_code} ${site.city}`
                                  : `${site.city} (${site.postal_code})`}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Badge
                                variant="outline"
                                className={getStatusColor(status)}
                              >
                                {getStatusLabel(status)}
                              </Badge>
                              <Badge variant="outline">
                                {getCofracStatusLabel(cofracStatus)}
                              </Badge>
                            </div>
                          </div>

                          <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2 xl:grid-cols-4">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-primary" />
                              <span>
                                Début :{" "}
                                <span className="font-medium text-foreground">
                                  {new Date(site.date_debut).toLocaleDateString(
                                    "fr-FR",
                                  )}
                                </span>
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-primary" />
                              <span>
                                Fin prévue :{" "}
                                <span className="font-medium text-foreground">
                                  {site.date_fin_prevue
                                    ? new Date(
                                        site.date_fin_prevue,
                                      ).toLocaleDateString("fr-FR")
                                    : "—"}
                                </span>
                              </span>
                            </div>
                            <div>
                              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                                <span>Avancement</span>
                                <span className="font-medium text-foreground">
                                  {progressValue}%
                                </span>
                              </div>
                              <Progress value={progressValue} />
                            </div>
                            <div className="flex items-center gap-2">
                              <Euro className="h-4 w-4 text-emerald-600" />
                              <span>
                                CA :{" "}
                                <span className="font-medium text-foreground">
                                  {typeof site.revenue === "number"
                                    ? formatCurrency(site.revenue)
                                    : "—"}
                                </span>
                              </span>
                            </div>
                            {typeof site.valorisation_cee === "number" ? (
                              <div className="flex items-center gap-2">
                                <HandCoins className="h-4 w-4 text-amber-600" />
                                <span>
                                  Valorisation :{" "}
                                  <span className="font-medium text-foreground">
                                    {formatCurrency(site.valorisation_cee)}
                                  </span>
                                </span>
                              </div>
                            ) : null}
                            {site.subcontractor ? (
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-primary" />
                                <span>
                                  Sous-traitant :{" "}
                                  <span className="font-medium text-foreground">
                                    {site.subcontractor.name}
                                  </span>
                                </span>
                              </div>
                            ) : null}
                            {teamMembersLabel ? (
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-primary" />
                                <span>
                                  Équipe :{" "}
                                  <span className="font-medium text-foreground">
                                    {teamMembersLabel}
                                  </span>
                                </span>
                              </div>
                            ) : null}
                          </div>

                          <div className="grid gap-4 lg:grid-cols-2">
                            <Card className="border border-border/60 bg-background/60">
                              <CardHeader className="pb-2">
                                <CardTitle className="flex items-center gap-2 text-base">
                                  <ClipboardList className="h-4 w-4 text-primary" />
                                  Avant Chantier
                                </CardTitle>
                                <CardDescription>
                                  Préparation et équipe
                                </CardDescription>
                              </CardHeader>
                              <CardContent className="space-y-3 text-sm">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-muted-foreground">
                                    Statut
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className={getStatusColor(status)}
                                  >
                                    {getStatusLabel(status)}
                                  </Badge>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-muted-foreground">
                                    Début chantier
                                  </span>
                                  <span className="font-medium text-foreground">
                                    {new Date(
                                      site.date_debut,
                                    ).toLocaleDateString("fr-FR")}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-muted-foreground">
                                    Fin prévue
                                  </span>
                                  <span className="font-medium text-foreground">
                                    {site.date_fin_prevue
                                      ? new Date(
                                          site.date_fin_prevue,
                                        ).toLocaleDateString("fr-FR")
                                      : "—"}
                                  </span>
                                </div>
                                {teamMembersLabel ? (
                                  <div className="flex items-start justify-between gap-2">
                                    <span className="text-muted-foreground">
                                      Équipe dédiée
                                    </span>
                                    <span className="text-right font-medium text-foreground">
                                      {teamMembersLabel}
                                    </span>
                                  </div>
                                ) : null}
                                <div className="flex items-center justify-between gap-2">
                                  <span className="flex items-center gap-2 text-muted-foreground">
                                    <Camera className="h-4 w-4" /> Docs & photos
                                  </span>
                                  {hasDriveFile && driveLink ? (
                                    <a
                                      href={driveLink}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                                    >
                                      <FolderOpen className="h-4 w-4" />
                                      <span className="font-medium">
                                        {driveLabel}
                                      </span>
                                    </a>
                                  ) : (
                                    <span className="font-medium text-muted-foreground">
                                      Aucun
                                    </span>
                                  )}
                                </div>
                              </CardContent>
                              <CardFooter className="flex justify-end">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    handleEditSite(site, {
                                      readOnly: !canManageSites,
                                      defaultTab: "avant-chantier",
                                    })
                                  }
                                >
                                  Voir détails
                                </Button>
                              </CardFooter>
                            </Card>

                            <Card className="border border-border/60 bg-background/60">
                              <CardHeader className="pb-2">
                                <CardTitle className="flex items-center gap-2 text-base">
                                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                  Après Chantier
                                </CardTitle>
                                <CardDescription>
                                  Suivi qualité & financier
                                </CardDescription>
                              </CardHeader>
                              <CardContent className="space-y-3 text-sm">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-muted-foreground">
                                    Statut COFRAC
                                  </span>
                                  <Badge variant="outline">
                                    {getCofracStatusLabel(cofracStatus)}
                                  </Badge>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-muted-foreground">
                                    Avancement
                                  </span>
                                  <span className="font-medium text-foreground">
                                    {progressValue}%
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-muted-foreground">
                                    Chiffre d'affaires
                                  </span>
                                  <span className="font-medium text-foreground">
                                    {revenueDisplay}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-muted-foreground">
                                    Prime CEE
                                  </span>
                                  <span className="font-medium text-foreground">
                                    {primeDisplay}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-muted-foreground">
                                    Frais de chantier
                                    Travaux non subventionnés
                                  </span>
                                  <span className="font-medium text-foreground">
                                    {travauxLabel}
                                  </span>
                                </div>
                                {hasTravauxDetails ? (
                                  <>
                                    {travauxDescription ? (
                                      <div>
                                        <span className="text-muted-foreground">Description</span>
                                        <p className="mt-1 text-sm font-medium text-foreground">
                                          {travauxDescription}
                                        </p>
                                      </div>
                                    ) : null}
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-muted-foreground">
                                        Montant travaux
                                      </span>
                                      <span className="font-medium text-foreground">
                                        {formatCurrency(travauxMontant)}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-muted-foreground">
                                        Financement externe
                                      </span>
                                      <span
                                        className={`font-medium ${
                                          travauxFinancement
                                            ? "text-emerald-600"
                                            : "text-muted-foreground"
                                        }`}
                                      >
                                        {travauxFinancement ? "Oui" : "Non"}
                                      </span>
                                    </div>
                                  </>
                                ) : null}
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-muted-foreground">
                                    Commission commerciale HT
                                  </span>
                                  <span
                                    className={`font-medium ${
                                      commissionCommercialeActive
                                        ? "text-foreground"
                                        : "text-muted-foreground"
                                    }`}
                                  >
                                    {commissionCommercialeActive
                                      ? formatCurrency(commissionCommercialeMontant)
                                      : "Non"}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-muted-foreground">
                                    Coûts supplémentaires
                                  </span>
                                  <span className="font-medium text-foreground">
                                    {additionalCostDisplay}
                                  </span>
                                </div>
                                <div className="w-full">
                                  <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
                                    <div className="text-xs font-semibold uppercase tracking-wide text-primary">
                                      Rentabilité
                                    </div>
                                    <dl className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                                      <div className="flex flex-col">
                                        <dt>Frais de chantier (HT+TVA)</dt>
                                        <dd className="text-sm font-semibold text-foreground">
                                          {rentabilityAdditionalCostsDisplay}
                                        </dd>
                                      </div>
                                      <div className="flex flex-col">
                                        <dt>Coûts totaux</dt>
                                        <dd className="text-sm font-semibold text-foreground">
                                          {rentabilityTotalCostsDisplay}
                                        </dd>
                                      </div>
                                      <div className="flex flex-col">
                                        <dt>{rentabilityMarginPerUnitLabel}</dt>
                                        <dd className="text-sm font-semibold text-foreground">
                                          {rentabilityMarginPerUnitDisplay}
                                        </dd>
                                      </div>
                                      <div className="flex flex-col">
                                        <dt>Marge totale (€)</dt>
                                        <dd className="text-sm font-semibold text-foreground">
                                          {rentabilityMarginTotalDisplay}
                                        </dd>
                                      </div>
                                      <div className="flex flex-col">
                                        <dt>Marge (%)</dt>
                                        <dd className="text-sm font-semibold text-foreground">
                                          {rentabilityMarginRateDisplay}
                                        </dd>
                                      </div>
                                    </dl>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-muted-foreground">
                                    Paiement sous-traitant
                                  </span>
                                  <span
                                    className={`font-medium ${
                                      site.subcontractor_payment_confirmed
                                        ? "text-emerald-600"
                                        : "text-muted-foreground"
                                    }`}
                                  >
                                    {site.subcontractor_payment_confirmed
                                      ? "Confirmé"
                                      : "En attente"}
                                  </span>
                                </div>
                              </CardContent>
                              <CardFooter className="flex justify-end">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    handleEditSite(site, {
                                      readOnly: !canManageSites,
                                      defaultTab: "apres-chantier",
                                    })
                                  }
                                >
                                  Voir détails
                                </Button>
                              </CardFooter>
                            </Card>
                          </div>

                          {hasInternalNotes ? (
                            <p className="border-t border-border/40 pt-3 text-sm text-muted-foreground">
                              {internalNotes}
                            </p>
                          ) : null}

                          <div className="flex flex-wrap justify-end gap-2">
                            {canManageSites ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="inline-flex items-center gap-2"
                                onClick={() => {
                                  handleEditSite(site, {
                                    readOnly: false,
                                    defaultTab: "avant-chantier",
                                  });
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                                Modifier
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog
          open={quickStartOpen}
          onOpenChange={(open) => {
            if (startChantierMutation.isPending) {
              return;
            }
            setQuickStartOpen(open);
          }}
        >
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Initialiser un chantier</DialogTitle>
            </DialogHeader>
            {project ? (
              <AvantChantierForm
                project={project}
                onSubmit={handleQuickStartSubmit}
                isSubmitting={isStartingChantier}
              />
            ) : null}
          </DialogContent>
        </Dialog>

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
          mode={siteDialogMode}
          onOpenChange={(open) => {
            setSiteDialogOpen(open);
            if (!open) {
              setSiteInitialValues(undefined);
              setActiveSite(null);
              setSiteDialogMode("create");
              setSiteDialogDefaultTab("avant-chantier");
              setSiteDialogReadOnly(false);
            }
          }}
          onSubmit={handleSubmitSite}
          initialValues={siteInitialValues}
          orgId={currentOrgId}
          projects={projectSiteOptions}
          defaultTab={siteDialogDefaultTab}
          readOnly={siteDialogReadOnly}
        />

        <Dialog
          open={Boolean(lightboxImage)}
          onOpenChange={(open) => {
            if (!open) {
              setLightboxImage(null);
            }
          }}
        >
          <DialogContent className="max-w-3xl">
            {lightboxImage ? (
              <>
                <DialogHeader>
                  <DialogTitle>
                    {lightboxImage.alt ?? "Visuel produit"}
                  </DialogTitle>
                </DialogHeader>
                <div className="flex justify-center">
                  <img
                    src={lightboxImage.url}
                    alt={lightboxImage.alt ?? "Visuel produit"}
                    className="max-h-[70vh] w-full object-contain"
                  />
                </div>
              </>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default ProjectDetails;
