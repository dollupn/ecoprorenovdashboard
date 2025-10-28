import { useCallback, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "lucide-react";
import { useOrg } from "@/features/organizations/OrgContext";
import { useMembers } from "@/features/members/api";
import {
  AddQuoteDialog,
  type QuoteFormValues,
} from "@/components/quotes/AddQuoteDialog";
import {
  SiteDialog,
  type SiteFormValues,
  type SiteProjectOption,
} from "@/components/sites/SiteDialog";
import {
  getDynamicFieldEntries,
  getDynamicFieldNumericValue,
  formatDynamicFieldValue,
} from "@/lib/product-params";
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
  formatFormulaCoefficient,
  getCategoryDefaultMultiplierKey,
  LEGACY_QUANTITY_KEY,
  resolveMultiplierKeyForCategory,
  FORMULA_QUANTITY_KEY,
} from "@/lib/valorisation-formula";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

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

const SURFACE_FACTUREE_TARGETS = ["surface_facturee", "surface facturée"] as const;

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

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());

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

  if (typeof project.prime_cee === "number" && Number.isFinite(project.prime_cee)) {
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
    const fieldName = normalizeKey(typeof field.name === "string" ? field.name : null);
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
    product.kwh_cumac_values.find((entry) => normalizeKey(entry.building_type) === normalized) ??
    null
  );
};

const resolveBonificationValue = (
  primeBonification: number | null | undefined,
) =>
  toPositiveNumber(primeBonification) ?? 2;

const resolveCoefficientValue = () => 1;

const resolveMultiplierDetails = (
  product: ProductSummary,
  projectProduct: ProjectProduct,
): { value: number | null; label: string | null; missingDynamicParams: boolean } => {
  const rawMultiplierParam = product.cee_config.primeMultiplierParam;
  const multiplierCoefficient = product.cee_config.primeMultiplierCoefficient;
  const ceeCategory = product.cee_config.category ?? product.category ?? null;
  const defaultMultiplierKey =
    getCategoryDefaultMultiplierKey(ceeCategory) ?? getCategoryDefaultMultiplierKey(product.category) ?? null;

  const multiplierParam = resolveMultiplierKeyForCategory(rawMultiplierParam, ceeCategory);
  const effectiveMultiplierKey =
    multiplierParam === LEGACY_QUANTITY_KEY && defaultMultiplierKey ? defaultMultiplierKey : multiplierParam;

  if (effectiveMultiplierKey && effectiveMultiplierKey !== LEGACY_QUANTITY_KEY) {
    const schemaLabel = getSchemaFieldLabel(product.params_schema, effectiveMultiplierKey);
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
        coefficient !== 1
          ? `${labelBase} × ${formatFormulaCoefficient(coefficient)}`
          : labelBase;

      return {
        value: dynamicValue * coefficient,
        label,
        missingDynamicParams: false,
      };
    }

    return {
      value: null,
      label: schemaLabel ?? effectiveMultiplierKey,
      missingDynamicParams: true,
    };
  }

  const quantityValue = toPositiveNumber(projectProduct.quantity);
  if (quantityValue !== null) {
    return { value: quantityValue, label: "Quantité", missingDynamicParams: false };
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

type ProjectHeaderProps = {
  project: ProjectWithRelations;
  statusOptions: ProjectStatusSetting[];
  badgeStyle: CSSProperties;
  statusLabel: string;
  onBack: () => void;
  onStatusChange: (status: string) => void;
  isStatusUpdating: boolean;
  onOpenQuote: () => void;
  onDelete: () => void;
  onShare: () => void;
  onOpenDocuments: () => void;
  canDelete: boolean;
  isDeleting: boolean;
  progressValue: number;
  productCodes: string[];
};

const ProjectHeader = ({
  project,
  statusOptions,
  badgeStyle,
  statusLabel,
  onBack,
  onStatusChange,
  isStatusUpdating,
  onOpenQuote,
  onDelete,
  onShare,
  onOpenDocuments,
  canDelete,
  isDeleting,
  progressValue,
  productCodes,
}: ProjectHeaderProps) => {
  return (
    <Card className="shadow-card bg-gradient-card border-0">
      <CardContent className="p-6 sm:p-8 space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={onBack} className="px-2">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Retour
              </Button>
              <Badge variant="outline" style={badgeStyle} className="font-semibold">
                {statusLabel}
              </Badge>
              <Select
                onValueChange={(value) => onStatusChange(value)}
                value={project.status ?? undefined}
                disabled={isStatusUpdating}
              >
                <SelectTrigger className="w-[180px] bg-background/80">
                  <SelectValue placeholder="Changer le statut" />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-3 text-primary">
                <Hammer className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
                  {project.project_ref}
                </h1>
                <p className="text-muted-foreground text-sm sm:text-base">
                  {productCodes.length > 0 ? productCodes.join(", ") : "Aucun code produit"} · {project.city} (
                  {project.postal_code})
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs uppercase tracking-wide text-muted-foreground">
                <span>Progression</span>
                <span>{Math.round(progressValue)}%</span>
              </div>
              <Progress value={progressValue} className="h-2" />
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Button variant="outline" onClick={onOpenQuote} className="justify-start sm:justify-center">
              <FileText className="w-4 h-4 mr-2" />
              Générer un devis
            </Button>
            <Button variant="secondary" className="justify-start sm:justify-center" onClick={onShare}>
              <Share2 className="w-4 h-4 mr-2" />
              Partager le projet
            </Button>
            <Button variant="outline" className="justify-start sm:justify-center" onClick={onOpenDocuments}>
              <FolderOpen className="w-4 h-4 mr-2" />
              Voir les documents
            </Button>
            {canDelete ? (
              <Button
                variant="destructive"
                onClick={onDelete}
                disabled={isDeleting}
                className="justify-start sm:justify-center"
              >
                {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                {isDeleting ? "Suppression..." : "Supprimer"}
              </Button>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

type AvantChantierFormProps = {
  project: ProjectWithRelations;
  onSubmit: (values: AvantChantierFormValues) => Promise<void> | void;
  isSubmitting: boolean;
};

const AvantChantierForm = ({ project, onSubmit, isSubmitting }: AvantChantierFormProps) => {
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
                <Textarea rows={4} placeholder="Décrivez les points importants avant le démarrage..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Hammer className="mr-2 h-4 w-4" />}
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
  onSubmitAvantChantier: (values: AvantChantierFormValues) => Promise<void> | void;
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
              {project.company && <p className="text-sm text-muted-foreground">{project.company}</p>}
              {project.siren && (
                <p className="text-xs text-muted-foreground uppercase tracking-wide">SIREN : {project.siren}</p>
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
                {project.source && project.source.trim().length > 0 ? project.source : "Non renseigné"}
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
                {typeof project.surface_batiment_m2 === "number" ? `${project.surface_batiment_m2} m²` : "Non renseigné"}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Surface isolée</p>
              <p className="font-medium">
                {typeof project.surface_isolee_m2 === "number" ? `${project.surface_isolee_m2} m²` : "Non renseigné"}
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
            Initialisez le chantier directement depuis le projet. Les informations du projet seront synchronisées avec le
            suivi opérationnel.
          </p>
          <AvantChantierForm project={project} onSubmit={onSubmitAvantChantier} isSubmitting={isStartingChantier} />
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
              {typeof projectCostValue === "number" ? formatCurrency(projectCostValue) : "Non défini"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <HandCoins className="w-4 h-4 text-emerald-600" />
            <span className="text-muted-foreground">Prime CEE:</span>
            <span className="font-medium">
              {typeof displayedPrimeValue === "number" ? formatCurrency(displayedPrimeValue) : "Non définie"}
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
              {project.date_debut_prevue ? new Date(project.date_debut_prevue).toLocaleDateString("fr-FR") : "Non défini"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            <span className="text-muted-foreground">Fin prévue:</span>
            <span className="font-medium">
              {project.date_fin_prevue ? new Date(project.date_fin_prevue).toLocaleDateString("fr-FR") : "Non définie"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Créé le:</span>
            <span className="font-medium">{new Date(project.created_at).toLocaleDateString("fr-FR")}</span>
          </div>
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
            Centralisez les documents administratifs, techniques et financiers liés au chantier {project.project_ref}. Les
            fichiers déposés sont accessibles à toute l'équipe depuis l'espace Documents.
          </p>
          <div className="rounded-lg border border-dashed border-primary/30 bg-background/60 p-6 text-sm text-muted-foreground">
            Connectez Google Drive dans les paramètres pour activer le dépôt automatique des documents chantier.
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
              ceeEntry.multiplierLabel && ceeEntry.multiplierLabel.trim().length > 0
                ? ceeEntry.multiplierLabel
                : "Valorisation CEE";
            const summaryLabel = item.product?.code ? `${labelBase} (${item.product.code})` : labelBase;

            const productCategory = (item.product?.category ?? "").toLowerCase();
            const isLightingProduct = productCategory === "lighting";
            const lightingDetails = (
              (ceeEntry.result as (PrimeCeeResult & { lighting?: PrimeCeeLightingDetails }) | null)?.lighting ?? null
            );
            const lightingPerLedEur = toNumber(lightingDetails?.per_led_eur);
            const lightingPerLedMwh = toNumber(lightingDetails?.per_led_mwh);
            const lightingTotalMwh = toNumber(lightingDetails?.total_mwh);
            const lightingTotalEur = toNumber(lightingDetails?.total_eur);
            const lightingMissingBase = Boolean(lightingDetails?.missing_base);

            let summaryDetails: string;
            if (ceeEntry.result && typeof ceeEntry.multiplierValue === "number" && ceeEntry.multiplierValue > 0) {
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
              isLightingProduct && lightingPerLedMwh !== null && lightingTotalMwh !== null
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
              <div key={`valorisation-summary-${entryId}`} className="flex items-start gap-3 border rounded-lg p-4">
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
                        <TooltipContent side="top" align="center" className="text-xs">
                          kWh cumac manquant pour cette typologie
                        </TooltipContent>
                      </Tooltip>
                    ) : null}
                  </div>
                  <span className="font-medium text-emerald-600 text-sm">{valorisationLine}</span>
                  {lightingCalculationLine ? (
                    <span className="text-xs text-muted-foreground">{lightingCalculationLine}</span>
                  ) : null}
                  <span className="text-xs text-muted-foreground">{summaryDetails}</span>
                  <span className="text-xs font-semibold text-amber-600">
                    {primeValue !== null ? `Prime calculée : ${formatCurrency(primeValue)}` : "Prime non calculée"}
                  </span>
                </div>
              </div>
            );
          })}

          {projectProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun produit n'est associé à ce projet pour le moment.</p>
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
            projectProducts.map((item, index) => {
              const dynamicFields = getDynamicFieldEntries(
                item.product?.params_schema ?? null,
                item.dynamic_params,
              );
              const entryId = item.id ?? item.product_id ?? `product-${index}`;
              const ceeEntry = ceeEntryMap[entryId];
              const hasWarnings =
                Boolean(ceeEntry?.warnings.missingDynamicParams) || Boolean(ceeEntry?.warnings.missingKwh);

              const multiplierDisplay = (() => {
                if (!ceeEntry) return "Non renseigné";
                if (typeof ceeEntry.multiplierValue === "number" && ceeEntry.multiplierValue > 0) {
                  const value = formatDecimal(ceeEntry.multiplierValue);
                  return ceeEntry.multiplierLabel ? `${value} (${ceeEntry.multiplierLabel})` : value;
                }
                if (ceeEntry.warnings.missingDynamicParams) {
                  return "Paramètres dynamiques manquants";
                }
                return "Non renseigné";
              })();

              const valorisationTotalDisplay = (() => {
                if (!ceeEntry) return "Non calculée";
                if (ceeEntry.result) {
                  return `${formatCurrency(ceeEntry.result.valorisationTotalEur)} · ${formatDecimal(
                    ceeEntry.result.valorisationTotalMwh,
                  )} MWh`;
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
                <div key={item.id ?? entryId} className="border border-border/60 rounded-lg p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs font-semibold">
                        {item.product?.code ?? "Code inconnu"}
                      </Badge>
                      <span className="text-sm text-muted-foreground">{item.product?.name ?? "Produit"}</span>
                    </div>
                    {typeof item.quantity === "number" && (
                      <span className="text-sm font-medium">Quantité : {item.quantity}</span>
                    )}
                  </div>
                  {hasWarnings ? (
                    <div className="flex flex-wrap gap-2">
                      {ceeEntry?.warnings.missingKwh ? (
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200" variant="outline">
                          kWh manquant pour ce bâtiment
                        </Badge>
                      ) : null}
                      {ceeEntry?.warnings.missingDynamicParams ? (
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200" variant="outline">
                          Paramètres dynamiques manquants
                        </Badge>
                      ) : null}
                    </div>
                  ) : null}
                  {dynamicFields.length > 0 && (
                    <div className="grid gap-2 md:grid-cols-2 text-sm">
                      {dynamicFields.map((field) => (
                        <div key={`${item.id}-${field.label}`} className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground">{field.label}</span>
                          <span className="font-medium">{String(formatDynamicFieldValue(field))}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {ceeEntry ? (
                    <div className="space-y-2 text-sm pt-2 border-t border-border/40">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Multiplicateur</span>
                        <span className="font-medium text-right">{multiplierDisplay}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Valorisation / unité</span>
                        <span className="font-medium text-emerald-600 text-right">
                          {ceeEntry.result
                            ? `${formatCurrency(ceeEntry.result.valorisationPerUnitEur)}${
                                ceeEntry.multiplierLabel ? ` / ${ceeEntry.multiplierLabel}` : ""
                              }`
                            : "Non calculée"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Valorisation totale</span>
                        <span className="font-semibold text-amber-600 text-right">{valorisationTotalDisplay}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Prime calculée</span>
                        <span className="font-semibold text-emerald-600 text-right">
                          {ceeEntry.result ? formatCurrency(ceeEntry.result.totalPrime) : "Non calculée"}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card className="shadow-card border border-dashed border-primary/20">
        <CardHeader>
          <CardTitle>Suivi post-chantier</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Renseignez les informations finales (PV de réception, photos, levée des réserves) directement depuis le chantier
            pour compléter le dossier du projet {project.project_ref}.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

const computeStatusProgress = (statusValue: string | null | undefined, statuses: ProjectStatusSetting[]) => {
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
  const { data: members = [], isLoading: membersLoading } = useMembers(currentOrgId);
  const projectStatuses = useProjectStatuses();
  const { primeBonification } = useOrganizationPrimeSettings();

  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [quoteInitialValues, setQuoteInitialValues] = useState<Partial<QuoteFormValues>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [siteDialogOpen, setSiteDialogOpen] = useState(false);
  const [siteDialogMode, setSiteDialogMode] = useState<"create" | "edit">("create");
  const [siteInitialValues, setSiteInitialValues] = useState<Partial<SiteFormValues>>();
  const [activeSite, setActiveSite] = useState<ProjectSite | null>(null);

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

  const currentMember = members.find((member) => member.user_id === user?.id);
  const isAdmin = currentMember?.role === "admin" || currentMember?.role === "owner";

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
          "*, delegate:delegates(id, name, price_eur_per_mwh), project_products(id, product_id, quantity, dynamic_params, product:product_catalog(id, code, name, category, params_schema, cee_config, kwh_cumac_values:product_kwh_cumac(id, building_type, kwh_cumac)))"
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
    [project?.project_products]
  );

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
      projectProducts[0]?.product ?? project.project_products?.[0]?.product ?? null;
    const productLabel =
      primaryProduct?.code ||
      (project as Project & { product_name?: string | null }).product_name ||
      "";
    const address = (project as Project & { address?: string | null }).address ?? "";

    return [
      {
        id: project.id,
        project_ref: project.project_ref ?? "",
        client_name: getProjectClientName(project),
        product_name: productLabel ?? "",
        address,
        city: project.city ?? "",
        postal_code: project.postal_code ?? "",
        surface_facturee: projectSurfaceFacturee > 0 ? projectSurfaceFacturee : undefined,
      },
    ];
  }, [project, projectProducts, projectSurfaceFacturee]);

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
      typeof project.building_type === "string" ? project.building_type.trim() : "";
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

        const config: CeeConfig = {
          kwhCumac: kwhValue,
          bonification: bonification ?? undefined,
          coefficient: coefficient ?? undefined,
          multiplier: multiplierValue,
          quantity: quantityValue ?? null,
          delegatePriceEurPerMwh: delegatePrice ?? null,
          dynamicParams,
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

    const totals = computeProjectCeeTotals(entries.map((entry) => entry.result));

    return { entries, totals };
  }, [project, projectProducts, primeBonification]);

  const ceeEntryMap = useMemo(() => {
    return ceeEntries.reduce<Record<string, ProjectProductCeeEntry>>((acc, entry) => {
      if (entry.projectProductId) {
        acc[entry.projectProductId] = entry;
      }
      return acc;
    }, {});
  }, [ceeEntries]);

  const hasComputedCeeTotals = useMemo(
    () => ceeEntries.some((entry) => entry.result !== null),
    [ceeEntries],
  );

  const statusConfig = projectStatuses.find((status) => status?.value === project.status);
  const badgeStyle = getProjectStatusBadgeStyle(statusConfig?.color);
  const statusLabel = statusConfig?.label ?? project.status ?? "Statut";

  const handleCreateSite = async () => {
    if (!project || !currentOrgId) return;

    const displayedProducts = getDisplayedProducts(project.project_products);
    const firstProduct =
      displayedProducts[0]?.product ?? project.project_products?.[0]?.product ?? null;
    const productLabel =
      firstProduct?.code ||
      (project as Project & { product_name?: string | null }).product_name ||
      "";
    const clientName = getProjectClientName(project);
    const address = (project as Project & { address?: string | null }).address ?? "";

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
      : ceeTotals.totalPrime ?? 0;

    setSiteDialogMode("create");
    setActiveSite(null);
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

  const handleEditSite = (site: ProjectSite) => {
      setSiteDialogMode("edit");
      setActiveSite(site);
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
        notes: site.notes ?? "",
        subcontractor_payment_confirmed: Boolean(site.subcontractor_payment_confirmed),
        subcontractor_id: site.subcontractor_id ?? null,
        team_members: mapTeamMembersToFormValues(site.team_members ?? []),
        additional_costs: normalizeAdditionalCosts(site.additional_costs ?? []),
      });
      setSiteDialogOpen(true);
    };

  const handleSubmitSite = async (values: SiteFormValues) => {
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
      const matchedProject = projectSiteOptions.find(
        (option) => option.project_ref === projectRef,
      );
      const resolvedProjectId =
        typeof matchedProject?.id === "string" && matchedProject.id.length > 0
          ? matchedProject.id
          : typeof activeSite?.project_id === "string" && activeSite.project_id.length > 0
            ? activeSite.project_id
            : project.id;

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
        project_id: resolvedProjectId,
      };

      try {
        if (siteDialogMode === "edit" && activeSite) {
          const { error } = await supabase
            .from("sites")
            .update(siteData)
            .eq("id", activeSite.id);

          if (error) throw error;

          toast({
            title: "Chantier mis à jour",
            description: `${values.site_ref} a été mis à jour avec succès.`,
          });
        } else {
          const { error } = await supabase.from("sites").insert([siteData]);

          if (error) throw error;

          toast({
            title: "Chantier créé",
            description: `${siteData.site_ref} a été ajouté à la liste des chantiers.`,
          });
        }

        await refetchProjectSites();
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

  const projectCostValue = project?.estimated_value ?? null;
  const projectEmail = (project as Project & { email?: string })?.email ?? null;

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
            <Button
              variant="secondary"
              onClick={() => {
                void handleCreateSite();
              }}
            >
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

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="overview">Aperçu</TabsTrigger>
            <TabsTrigger value="chantiers">Chantiers</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="space-y-6">
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
                  <div className="flex items-center gap-2">
                    <HandCoins className="w-4 h-4 text-amber-600" />
                    <span className="text-muted-foreground">Valorisation totale:</span>
                    <span className="font-medium text-amber-600">
                      {hasComputedCeeTotals
                        ? `${formatCurrency(ceeTotals.totalValorisationEur)} (${formatDecimal(
                            ceeTotals.totalValorisationMwh,
                          )} MWh)`
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
                      typeof ceeEntry.result?.valorisationTotalEur === "number"
                        ? formatCurrency(ceeEntry.result.valorisationTotalEur)
                        : null;
                    const entryHasWarnings =
                      Boolean(ceeEntry.warnings.missingDynamicParams) ||
                      Boolean(ceeEntry.warnings.missingKwh);

                    return (
                      <div
                        key={entryId}
                        className="rounded-lg border border-border/50 bg-background/60 p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {item.product?.name ?? "Produit"}
                            </p>
                            <p className="text-xs text-muted-foreground">{item.product?.code ?? "—"}</p>
                          </div>
                          {typeof item.quantity === "number" && (
                            <Badge variant="outline">x{item.quantity}</Badge>
                          )}
                        </div>
                        <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                          <span>
                            Multiplicateur :{" "}
                            {ceeEntry.multiplierValue && ceeEntry.multiplierValue > 0
                              ? `${formatDecimal(ceeEntry.multiplierValue)}${
                                  ceeEntry.multiplierLabel ? ` (${ceeEntry.multiplierLabel})` : ""
                                }`
                              : ceeEntry.warnings.missingDynamicParams
                                ? "Paramètres manquants"
                                : "Non calculé"}
                          </span>
                          <span>
                            Valorisation / unité :{" "}
                            {ceeEntry.result
                              ? formatCurrency(ceeEntry.result.valorisationPerUnitEur)
                              : "Non calculée"}
                          </span>
                          <span>
                            Valorisation totale : {labelBase ?? "Non calculée"}
                          </span>
                        </div>
                        {entryHasWarnings ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {ceeEntry.warnings.missingKwh ? (
                              <Badge variant="outline" className="bg-amber-50 text-amber-700">
                                kWh manquant pour ce bâtiment
                              </Badge>
                            ) : null}
                            {ceeEntry.warnings.missingDynamicParams ? (
                              <Badge variant="outline" className="bg-amber-50 text-amber-700">
                                Paramètres dynamiques manquants
                              </Badge>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                  <div className="grid gap-2">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-primary" />
                      <span className="text-muted-foreground">Début estimé:</span>
                      <span className="font-medium">
                        {project.date_debut_prevue
                          ? new Date(project.date_debut_prevue).toLocaleDateString("fr-FR")
                          : "Non défini"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-primary" />
                      <span className="text-muted-foreground">Fin estimée:</span>
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
                  projectProducts.map((item, index) => {
                    const dynamicFields = getDynamicFieldEntries(
                      item.product?.params_schema ?? null,
                      item.dynamic_params
                    );
                    const entryId = item.id ?? item.product_id ?? `product-${index}`;
                    const ceeEntry = ceeEntryMap[entryId];
                    const hasWarnings =
                      Boolean(ceeEntry?.warnings.missingDynamicParams) ||
                      Boolean(ceeEntry?.warnings.missingKwh);

                    const multiplierDisplay = (() => {
                      if (!ceeEntry) return "Non renseigné";
                      if (typeof ceeEntry.multiplierValue === "number" && ceeEntry.multiplierValue > 0) {
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

                    const valorisationTotalDisplay = (() => {
                      if (!ceeEntry) return "Non calculée";
                      if (ceeEntry.result) {
                        return `${formatCurrency(ceeEntry.result.valorisationTotalEur)} · ${formatDecimal(
                          ceeEntry.result.valorisationTotalMwh,
                        )} MWh`;
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
                      <div
                        key={item.id ?? entryId}
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
                        {hasWarnings ? (
                          <div className="flex flex-wrap gap-2">
                            {ceeEntry?.warnings.missingKwh ? (
                              <Badge className="bg-amber-100 text-amber-700 border-amber-200" variant="outline">
                                kWh manquant pour ce bâtiment
                              </Badge>
                            ) : null}
                            {ceeEntry?.warnings.missingDynamicParams ? (
                              <Badge className="bg-amber-100 text-amber-700 border-amber-200" variant="outline">
                                Paramètres dynamiques manquants
                              </Badge>
                            ) : null}
                          </div>
                        ) : null}
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
                        {ceeEntry ? (
                          <div className="space-y-2 text-sm pt-2 border-t border-border/40">
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Multiplicateur</span>
                              <span className="font-medium text-right">{multiplierDisplay}</span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Valorisation / unité</span>
                              <span className="font-medium text-emerald-600 text-right">
                                {ceeEntry.result
                                  ? `${formatCurrency(ceeEntry.result.valorisationPerUnitEur)}${
                                      ceeEntry.multiplierLabel ? ` / ${ceeEntry.multiplierLabel}` : ""
                                    }`
                                  : "Non calculée"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Valorisation totale</span>
                              <span className="font-semibold text-amber-600 text-right">
                                {valorisationTotalDisplay}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground">Prime calculée</span>
                              <span className="font-semibold text-emerald-600 text-right">
                                {ceeEntry.result ? formatCurrency(ceeEntry.result.totalPrime) : "Non calculée"}
                              </span>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
        </TabsContent>
        <TabsContent value="chantiers" className="space-y-6">
          <Card className="shadow-card bg-gradient-card border-0">
            <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-1">
                  <CardTitle>Chantiers du projet</CardTitle>
                  <CardDescription>
                    Créez, éditez et suivez les chantiers rattachés à {project.project_ref}.
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
                  <div className="py-10 text-center space-y-4">
                    <div className="space-y-2">
                      <CardTitle className="text-lg">Aucun chantier lié</CardTitle>
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
                      const cofracStatus = (site.cofrac_status ?? "EN_ATTENTE") as CofracStatus;
                      const teamMembersLabel = formatTeamMembers(site.team_members);
                      const progressValue =
                        typeof site.progress_percentage === "number"
                          ? Math.min(Math.max(site.progress_percentage, 0), 100)
                          : 0;

                      return (
                        <div
                          key={site.id}
                          className="space-y-4 rounded-lg border border-border/60 bg-background/60 p-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h3 className="text-base font-semibold text-foreground">{site.site_ref}</h3>
                              <p className="text-sm text-muted-foreground">
                                {site.address
                                  ? `${site.address} · ${site.postal_code} ${site.city}`
                                  : `${site.city} (${site.postal_code})`}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="outline" className={getStatusColor(status)}>
                                {getStatusLabel(status)}
                              </Badge>
                              <Badge variant="outline">{getCofracStatusLabel(cofracStatus)}</Badge>
                            </div>
                          </div>

                          <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2 xl:grid-cols-4">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-primary" />
                              <span>
                                Début :{" "}
                                <span className="font-medium text-foreground">
                                  {new Date(site.date_debut).toLocaleDateString("fr-FR")}
                                </span>
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-primary" />
                              <span>
                                Fin prévue :{" "}
                                <span className="font-medium text-foreground">
                                  {site.date_fin_prevue
                                    ? new Date(site.date_fin_prevue).toLocaleDateString("fr-FR")
                                    : "—"}
                                </span>
                              </span>
                            </div>
                            <div>
                              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                                <span>Avancement</span>
                                <span className="font-medium text-foreground">{progressValue}%</span>
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
                            {typeof site.valorisation_cee === "number" && (
                              <div className="flex items-center gap-2">
                                <HandCoins className="h-4 w-4 text-amber-600" />
                                <span>
                                  Valorisation :{" "}
                                  <span className="font-medium text-foreground">
                                    {formatCurrency(site.valorisation_cee)}
                                  </span>
                                </span>
                              </div>
                            )}
                            {site.subcontractor && (
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-primary" />
                                <span>
                                  Sous-traitant :{" "}
                                  <span className="font-medium text-foreground">{site.subcontractor.name}</span>
                                </span>
                              </div>
                            )}
                            {teamMembersLabel && (
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-primary" />
                                <span>
                                  Équipe :{" "}
                                  <span className="font-medium text-foreground">{teamMembersLabel}</span>
                                </span>
                              </div>
                            )}
                          </div>

                          {site.notes && (
                            <p className="border-t border-border/40 pt-3 text-sm text-muted-foreground">
                              {site.notes}
                            </p>
                          )}

                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                handleEditSite(site);
                              }}
                              className="inline-flex items-center gap-2"
                            >
                              <Pencil className="h-4 w-4" />
                              Modifier
                            </Button>
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

      </div>
    </Layout>
  );

};

export default ProjectDetails;
