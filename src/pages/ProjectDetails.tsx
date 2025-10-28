import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
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
  const index = statuses.findIndex((status) => status.value === normalized);
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

  const statusConfig = projectStatuses.find((status) => status.value === project.status);
  const badgeStyle = getProjectStatusBadgeStyle(statusConfig?.color);
  const statusLabel = statusConfig?.label ?? project.status ?? "Statut";

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

  const [activeTab, setActiveTab] = useState("informations");

  const statusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      if (!project) {
        throw new Error("Projet introuvable");
      }

      let query = supabase.from("projects").update({ status: newStatus }).eq("id", project.id);
      if (currentOrgId) {
        query = query.eq("org_id", currentOrgId);
      }

      const { error: updateError } = await query;
      if (updateError) {
        throw updateError;
      }
    },
    onSuccess: () => {
      toast({
        title: "Statut mis à jour",
        description: "Le statut du projet a été modifié avec succès.",
      });
      void refetch();
    },
    onError: (updateError) => {
      const message =
        updateError instanceof Error
          ? updateError.message
          : "Impossible de mettre à jour le statut du projet.";
      toast({
        title: "Erreur",
        description: message,
        variant: "destructive",
      });
    },
  });

  const startChantierMutation = useMutation({
    mutationFn: async (values: AvantChantierFormValues) => {
      if (!project) {
        throw new Error("Projet introuvable");
      }

      const response = await fetch(`/api/projects/${project.id}/start-chantier`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId: project.id,
          siteRef: values.siteRef,
          startDate: values.startDate,
          expectedEndDate: values.expectedEndDate || null,
          teamLead: values.teamLead?.trim() || null,
          notes: values.notes?.trim() || null,
        }),
      });

      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch (parseError) {
        payload = null;
      }

      if (!response.ok) {
        const errorMessage =
          payload && typeof payload === "object" && payload !== null && "error" in payload
            ? String((payload as { error?: string }).error)
            : "Impossible de démarrer le chantier.";
        throw new Error(errorMessage);
      }

      return payload;
    },
    onSuccess: () => {
      toast({
        title: "Chantier initialisé",
        description: "Le chantier a été créé avec succès à partir du projet.",
      });
      setActiveTab("apres");
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Impossible de démarrer le chantier.";
      toast({
        title: "Erreur",
        description: message,
        variant: "destructive",
      });
    },
  });

  const handleStatusChange = (value: string) => {
    statusMutation.mutate(value);
  };

  const handleAvantChantierSubmit = async (values: AvantChantierFormValues) => {
    await startChantierMutation.mutateAsync(values);
  };

  const handleShareProject = async () => {
    if (!project) return;

    const shareData = {
      title: project.project_ref,
      text: `Projet ${project.project_ref} – ${project.city}`,
      url: typeof window !== "undefined" ? window.location.href : "",
    };

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share(shareData);
        return;
      } catch (shareError) {
        if (shareError instanceof Error && shareError.name === "AbortError") {
          return;
        }
      }
    }

    if (shareData.url && typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareData.url);
        toast({
          title: "Lien copié",
          description: "Le lien du projet a été copié dans le presse-papiers.",
        });
        return;
      } catch (clipboardError) {
        console.error("Clipboard error", clipboardError);
      }
    }

    toast({
      title: "Partage indisponible",
      description: "Impossible de partager automatiquement ce projet depuis ce navigateur.",
      variant: "destructive",
    });
  };

  const progressValue = computeStatusProgress(project?.status ?? null, projectStatuses);
  const canDeleteProject = !!project && (isAdmin || project.user_id === user?.id);

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

  return (
    <Layout>
      <div className="space-y-6">
        <ProjectHeader
          project={project}
          statusOptions={projectStatuses}
          badgeStyle={badgeStyle}
          statusLabel={statusLabel}
          onBack={() => navigate(-1)}
          onStatusChange={handleStatusChange}
          isStatusUpdating={statusMutation.isPending}
          onOpenQuote={handleOpenQuote}
          onDelete={() => setDeleteDialogOpen(true)}
          onShare={handleShareProject}
          onOpenDocuments={() => setActiveTab("documents")}
          canDelete={canDeleteProject}
          isDeleting={isDeleting}
          progressValue={progressValue}
          productCodes={productCodes}
        />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="informations" className="flex-1 sm:flex-none">
              Informations générales
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex-1 sm:flex-none">
              Documents
            </TabsTrigger>
            <TabsTrigger value="apres" className="flex-1 sm:flex-none">
              Après chantier
            </TabsTrigger>
          </TabsList>

          <TabsContent value="informations" className="mt-6 space-y-6">
            <InformationsGeneralesTab
              project={project}
              projectEmail={projectEmail}
              projectCostValue={projectCostValue}
              displayedPrimeValue={displayedPrimeValue}
              onSubmitAvantChantier={handleAvantChantierSubmit}
              isStartingChantier={startChantierMutation.isPending}
            />
          </TabsContent>

          <TabsContent value="documents" className="mt-6 space-y-6">
            <DocumentsTab project={project} />
          </TabsContent>

          <TabsContent value="apres" className="mt-6 space-y-6">
            <ApresChantierTab
              project={project}
              ceeEntryMap={ceeEntryMap}
              projectProducts={projectProducts}
              hasComputedCeeTotals={hasComputedCeeTotals}
              ceeTotals={ceeTotals}
            />
          </TabsContent>
        </Tabs>
      </div>

      {canDeleteProject ? (
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
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
      ) : null}

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
