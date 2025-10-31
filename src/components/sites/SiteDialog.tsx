import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  useForm,
  useFieldArray,
  useFormContext,
  useWatch,
  type Control,
  type FieldArrayWithId,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQuery } from "@tanstack/react-query";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { DEFAULT_PROJECT_STATUSES, getProjectClientName } from "@/lib/projects";
import { parseSiteNotes, serializeSiteNotes } from "@/lib/sites";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DriveFileUploader } from "@/components/integrations/DriveFileUploader";
import type { DriveFileMetadata } from "@/integrations/googleDrive";
import { GripVertical, Info, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMembers } from "@/features/members/api";
import { useProjectStatuses } from "@/hooks/useProjectStatuses";
import { calculateRentability, buildRentabilityInputFromSite } from "@/lib/rentability";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  TRAVAUX_NON_SUBVENTIONNES_OPTIONS,
  type TravauxNonSubventionnesValue,
} from "./travauxNonSubventionnes";

const teamMemberSchema = z.object({
  id: z.string().min(1, "Sélection invalide"),
  name: z.string().optional().nullable(),
});

type TeamMemberFormValue = z.infer<typeof teamMemberSchema>;

const normalizeTeamMembers = (
  rawTeamMembers: unknown,
  nameLookup: Record<string, string>,
): TeamMemberFormValue[] => {
  if (!Array.isArray(rawTeamMembers)) {
    return [];
  }

  const uniqueMembers = new Map<string, TeamMemberFormValue>();

  for (const rawMember of rawTeamMembers) {
    if (!rawMember) continue;

    if (typeof rawMember === "string") {
      const trimmed = rawMember.trim();
      if (trimmed.length === 0) continue;

      if (!uniqueMembers.has(trimmed)) {
        uniqueMembers.set(trimmed, {
          id: trimmed,
          name: nameLookup[trimmed] ?? trimmed,
        });
      }
      continue;
    }

    if (typeof rawMember === "object") {
      const candidate = rawMember as Record<string, unknown>;
      const rawId = typeof candidate.id === "string" ? candidate.id.trim() : "";
      const rawName = typeof candidate.name === "string" ? candidate.name.trim() : "";
      const fallbackName = rawName.length > 0 ? rawName : nameLookup[rawId] ?? rawId;

      if (rawId.length > 0) {
        if (!uniqueMembers.has(rawId)) {
          uniqueMembers.set(rawId, {
            id: rawId,
            name: fallbackName.length > 0 ? fallbackName : undefined,
          });
        }
        continue;
      }

      if (rawName.length > 0 && !uniqueMembers.has(rawName)) {
        uniqueMembers.set(rawName, {
          id: rawName,
          name: rawName,
        });
      }
    }
  }

  return Array.from(uniqueMembers.values());
};

const additionalCostSchema = z.object({
  label: z.string().min(1, "Intitulé requis"),
  amount_ht: z.coerce
    .number({ invalid_type_error: "Montant HT invalide" })
    .min(0, "Le montant HT doit être positif"),
  montant_tva: z.coerce
    .number({ invalid_type_error: "Montant TVA invalide" })
    .min(0, "Le montant de TVA doit être positif"),
  amount_ttc: z.coerce
    .number({ invalid_type_error: "Montant TTC invalide" })
    .min(0, "Le montant TTC doit être positif"),
  attachment: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((value) => (value && value.length > 0 ? value : null)),
});

const computeAmountTTC = (amountHT: unknown, montantTVA: unknown) => {
  const ht = typeof amountHT === "number" && Number.isFinite(amountHT) ? amountHT : 0;
  const tva = typeof montantTVA === "number" && Number.isFinite(montantTVA) ? montantTVA : 0;

  const total = ht + tva;
  return Math.round(total * 100) / 100;
};

const getDriveFileKey = (file: DriveFileMetadata | null | undefined) =>
  file?.id ?? file?.webViewLink ?? file?.webContentLink ?? file?.name ?? null;

const fallbackProjectStatusValues = DEFAULT_PROJECT_STATUSES.map((status) => status.value);

const createBaseSiteSchema = (statusOptions: readonly string[]) => {
  const allowedStatuses = statusOptions.length > 0 ? [...statusOptions] : fallbackProjectStatusValues;

  return z.object({
    site_ref: z.string().min(3, "Référence requise"),
    project_ref: z.string(),
    client_name: z.string(),
    product_name: z.string().optional().nullable(),
    address: z.string().min(3, "Adresse requise"),
    city: z.string().min(2, "Ville requise"),
    postal_code: z.string().min(4, "Code postal invalide"),
    status: z.enum(allowedStatuses as [string, ...string[]]),
    cofrac_status: z.enum(["EN_ATTENTE", "CONFORME", "NON_CONFORME", "A_PLANIFIER"]),
    date_debut: z.string().min(1, "Date de début requise"),
    date_fin_prevue: z.string().optional(),
    progress_percentage: z.coerce.number({ invalid_type_error: "Avancement invalide" }).min(0).max(100),
    revenue: z.coerce.number({ invalid_type_error: "CA invalide" }).min(0, "Le CA doit être positif"),
    profit_margin: z.coerce.number({ invalid_type_error: "Marge invalide" }).min(-100).max(100),
    surface_facturee: z.coerce.number({ invalid_type_error: "Surface invalide" }).min(0),
    cout_main_oeuvre_m2_ht: z.coerce.number({ invalid_type_error: "Coût invalide" }).min(0),
    cout_isolation_m2: z.coerce.number({ invalid_type_error: "Coût invalide" }).min(0),
    isolation_utilisee_m2: z.coerce.number({ invalid_type_error: "Quantité invalide" }).min(0),
    montant_commission: z.coerce.number({ invalid_type_error: "Montant invalide" }).min(0),
    valorisation_cee: z.coerce.number({ invalid_type_error: "Montant invalide" }).min(0),
    travaux_non_subventionnes: z.enum(
      TRAVAUX_NON_SUBVENTIONNES_OPTIONS.map((option) => option.value) as [
        TravauxNonSubventionnesValue,
        ...TravauxNonSubventionnesValue[],
      ],
    ),
    travaux_non_subventionnes_description: z
      .string()
      .optional()
      .nullable()
      .transform((value) => (value ?? "")),
    travaux_non_subventionnes_montant: z.coerce
      .number({ invalid_type_error: "Montant invalide" })
      .min(0),
    travaux_non_subventionnes_financement: z.boolean().default(false),
    commission_commerciale_ht: z.boolean().default(false),
    commission_commerciale_ht_montant: z.coerce
      .number({ invalid_type_error: "Montant invalide" })
      .min(0),
    notes: z.string().optional(),
    subcontractor_id: z
      .string({ invalid_type_error: "Sélection invalide" })
      .uuid("Sélection invalide")
      .optional()
      .nullable(),
    team_members: z.array(teamMemberSchema).optional().default([]),
    additional_costs: z.array(additionalCostSchema).optional().default([]),
    subcontractor_payment_confirmed: z.boolean().default(false),
  });
};

type SiteFormSchema = ReturnType<typeof createBaseSiteSchema>;

export type SiteFormValues = z.infer<SiteFormSchema>;

export type SiteSubmitValues = SiteFormValues & {
  rentability_total_costs: number;
  rentability_margin_total: number;
  rentability_margin_per_unit: number;
  rentability_margin_rate: number;
  rentability_unit_label: string;
  rentability_unit_count: number;
  rentability_additional_costs_total: number;
};

const createSiteSchema = (statusValues: readonly string[], requiresProjectAssociation: boolean) =>
  createBaseSiteSchema(statusValues).superRefine((data, ctx) => {
    const projectRef = data.project_ref?.trim?.() ?? "";
    const clientName = data.client_name?.trim?.() ?? "";

    if (requiresProjectAssociation || projectRef.length > 0) {
      if (projectRef.length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["project_ref"],
          message: "Référence projet requise",
        });
      }
    }

    if (requiresProjectAssociation || clientName.length > 0) {
      if (clientName.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["client_name"],
          message: "Client requis",
        });
      }
    }
  });

export type SiteProjectOption = {
  id?: string;
  project_ref: string;
  client_name: string;
  product_name: string;
  address?: string | null;
  city: string;
  postal_code: string;
  surface_facturee?: number | null;
};

type SubcontractorOption = {
  id: string;
  name: string;
};

interface SiteDialogProps {
  open: boolean;
  mode: "create" | "edit";
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: SiteSubmitValues) => void;
  initialValues?: (Partial<SiteFormValues> & { org_id?: string | null }) | undefined;
  orgId?: string | null;
  projects?: SiteProjectOption[];
  defaultTab?: "avant-chantier" | "apres-chantier";
  readOnly?: boolean;
}

const defaultValues: SiteFormValues = {
  site_ref: "",
  project_ref: "",
  client_name: "",
  product_name: "",
  address: "",
  city: "",
  postal_code: "",
  status: fallbackProjectStatusValues[0] ?? "",
  cofrac_status: "EN_ATTENTE",
  date_debut: "",
  date_fin_prevue: "",
  progress_percentage: 0,
  revenue: 0,
  profit_margin: 0,
  surface_facturee: 0,
  cout_main_oeuvre_m2_ht: 0,
  cout_isolation_m2: 0,
  isolation_utilisee_m2: 0,
  montant_commission: 0,
  valorisation_cee: 0,
  travaux_non_subventionnes: "NA",
  travaux_non_subventionnes_description: "",
  travaux_non_subventionnes_montant: 0,
  travaux_non_subventionnes_financement: false,
  commission_commerciale_ht: false,
  commission_commerciale_ht_montant: 0,
  notes: "",
  subcontractor_id: null,
  additional_costs: [],
  subcontractor_payment_confirmed: false,
};

const currencyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("fr-FR", {
  style: "percent",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

interface SortableAdditionalCostRowProps {
  field: FieldArrayWithId<SiteFormValues, "additional_costs">;
  index: number;
  control: Control<SiteFormValues>;
  remove: (index: number) => void;
  canRemove: boolean;
  orgId?: string | null;
  siteRef?: string;
  disabled?: boolean;
}

interface AdditionalCostAttachmentInputProps {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  onBlur: () => void;
  orgId?: string | null;
  siteRef?: string;
  title: string;
  disabled?: boolean;
}

const AdditionalCostAttachmentInput = ({
  value,
  onChange,
  onBlur,
  orgId,
  siteRef,
  title,
  disabled,
}: AdditionalCostAttachmentInputProps) => {
  const [driveFile, setDriveFile] = useState<DriveFileMetadata | null>(null);

  useEffect(() => {
    if (!value || value.trim().length === 0) {
      setDriveFile(null);
      return;
    }

    setDriveFile((previous) => {
      if (previous && (previous.webViewLink === value || previous.id === value)) {
        return previous;
      }

      let fallbackName = value;
      if (value.startsWith("http")) {
        try {
          const url = new URL(value);
          const pathnamePart = url.pathname.split("/").filter(Boolean).pop();
          fallbackName = decodeURIComponent(pathnamePart ?? url.hostname ?? value);
        } catch {
          fallbackName = value;
        }
      }

      return {
        id: value,
        name: fallbackName || "Pièce jointe",
        webViewLink: value.startsWith("http") ? value : undefined,
      };
    });
  }, [value]);

  const handleDriveChange = (file: DriveFileMetadata | null) => {
    setDriveFile(file);
    if (!file) {
      onChange(null);
      return;
    }

    onChange(file.webViewLink ?? file.id ?? null);
  };

  return (
    <div className="space-y-3">
      <Input
        value={value ?? ""}
        onChange={(event) => {
          const next = event.target.value;
          onChange(next.length > 0 ? next : null);
        }}
        onBlur={onBlur}
        placeholder="Lien Drive ou identifiant"
        disabled={disabled}
      />
      <DriveFileUploader
        orgId={orgId}
        value={driveFile}
        onChange={handleDriveChange}
        accept="application/pdf,image/*"
        entityType="site"
        entityId={siteRef}
        description={`Pièce jointe associée à ${title.toLowerCase()}`}
        helperText="Le document sera stocké dans Google Drive."
        emptyLabel="Déposer ou sélectionner un fichier"
        className="border border-dashed border-muted-foreground/40 bg-muted/30"
        disabled={disabled}
      />
    </div>
  );
};

const SortableAdditionalCostRow = ({
  field,
  index,
  control,
  remove,
  canRemove,
  orgId,
  siteRef,
  disabled,
}: SortableAdditionalCostRowProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
    disabled: disabled ?? false,
  });
  const formContext = useFormContext<SiteFormValues>();
  const watchedAmountHT = useWatch({
    control,
    name: `additional_costs.${index}.amount_ht`,
  });
  const watchedMontantTVA = useWatch({
    control,
    name: `additional_costs.${index}.montant_tva`,
  });
  const computedAmountTTC = useMemo(
    () => computeAmountTTC(watchedAmountHT, watchedMontantTVA),
    [watchedAmountHT, watchedMontantTVA],
  );

  useEffect(() => {
    if (!formContext) return;

    const currentValue = formContext.getValues(`additional_costs.${index}.amount_ttc`);
    const normalizedCurrent =
      typeof currentValue === "number" && Number.isFinite(currentValue) ? currentValue : 0;

    if (Math.abs(normalizedCurrent - computedAmountTTC) > 0.005) {
      formContext.setValue(`additional_costs.${index}.amount_ttc`, computedAmountTTC, {
        shouldDirty: true,
        shouldValidate: false,
      });
    }
  }, [computedAmountTTC, formContext, index]);

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  };
  const costTitle = `Frais de chantier ${index + 1}`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border border-border/60 bg-card/70 p-4 shadow-sm transition-all ${
        isDragging ? "ring-2 ring-primary/40 shadow-md" : disabled ? "" : "hover:border-border"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-dashed border-border/60 pb-3">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={`rounded-full border border-border/50 bg-background/80 ${
              disabled
                ? "cursor-default opacity-70"
                : "cursor-grab hover:bg-background active:cursor-grabbing"
            }`}
            aria-label="Réorganiser le frais de chantier"
            disabled={disabled}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </Button>
          <div>
            <p className="text-sm font-medium text-foreground">{costTitle}</p>
            <p className="text-xs text-muted-foreground">
              Décrivez le poste, son montant et joignez les justificatifs.
            </p>
          </div>
        </div>
        {canRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => remove(index)}
            aria-label="Supprimer le frais"
            disabled={disabled}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        ) : null}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <FormField
          control={control}
          name={`additional_costs.${index}.label`}
          render={({ field: labelField }) => (
            <FormItem className="space-y-2 md:col-span-2">
              <FormLabel>Intitulé</FormLabel>
              <FormControl>
                <Input
                  placeholder="Intitulé du coût"
                  title={typeof labelField.value === "string" ? labelField.value : undefined}
                  {...labelField}
                  disabled={disabled}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`additional_costs.${index}.amount_ht`}
          render={({ field: amountHTField }) => (
            <FormItem className="space-y-2">
              <FormLabel>Montant HT (€)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  placeholder="0,00"
                  name={amountHTField.name}
                  ref={amountHTField.ref}
                  value={
                    amountHTField.value === undefined || amountHTField.value === null
                      ? ""
                      : amountHTField.value
                  }
                  onChange={(event) => {
                    const newValue = event.target.value;
                    amountHTField.onChange(newValue === "" ? "" : Number(newValue));
                  }}
                  onBlur={amountHTField.onBlur}
                  disabled={disabled}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`additional_costs.${index}.montant_tva`}
          render={({ field: montantTvaField }) => (
            <FormItem className="space-y-2">
              <FormLabel>Montant TVA (€)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  placeholder="0,00"
                  name={montantTvaField.name}
                  ref={montantTvaField.ref}
                  value={
                    montantTvaField.value === undefined || montantTvaField.value === null
                      ? ""
                      : montantTvaField.value
                  }
                  onChange={(event) => {
                    const newValue = event.target.value;
                    montantTvaField.onChange(newValue === "" ? "" : Number(newValue));
                  }}
                  onBlur={montantTvaField.onBlur}
                  disabled={disabled}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`additional_costs.${index}.amount_ttc`}
          render={({ field: amountTTCField }) => (
            <FormItem className="space-y-2">
              <FormLabel>Montant TTC (€)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  placeholder="0,00"
                  name={amountTTCField.name}
                  ref={amountTTCField.ref}
                  value={
                    amountTTCField.value === undefined || amountTTCField.value === null
                      ? computedAmountTTC
                      : amountTTCField.value
                  }
                  readOnly
                  disabled
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`additional_costs.${index}.attachment`}
          render={({ field: attachmentField }) => (
            <FormItem className="space-y-2 md:col-span-2">
              <FormLabel>Pièce jointe</FormLabel>
              <FormControl>
                <AdditionalCostAttachmentInput
                  value={attachmentField.value}
                  onChange={(next) => attachmentField.onChange(next)}
                  onBlur={attachmentField.onBlur}
                  orgId={orgId}
                  siteRef={siteRef}
                  title={costTitle}
                  disabled={disabled}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
};

const cofracStatusOptions = [
  { value: "EN_ATTENTE", label: "En attente" },
  { value: "CONFORME", label: "Conforme" },
  { value: "NON_CONFORME", label: "Non conforme" },
  { value: "A_PLANIFIER", label: "Audit à planifier" },
] as const;

const POST_DELIVERY_STATUS_VALUES = new Set([
  "FACTURE_ENVOYEE",
  "AH",
  "AAF",
  "CLOTURE",
  "ANNULE",
  "ABANDONNE",
]);

export const SiteDialog = ({
  open,
  mode,
  onOpenChange,
  onSubmit,
  initialValues,
  orgId,
  projects,
  defaultTab = "avant-chantier",
  readOnly = false,
}: SiteDialogProps) => {
  const { statuses: projectStatuses } = useProjectStatuses();
  const parsedNotes = useMemo(() => parseSiteNotes(initialValues?.notes), [initialValues?.notes]);

  const [siteDriveFile, setSiteDriveFile] = useState<DriveFileMetadata | null>(parsedNotes.driveFile);
  const [siteDriveAttachments, setSiteDriveAttachments] = useState<DriveFileMetadata[]>(
    parsedNotes.attachments,
  );
  const [activeTab, setActiveTab] = useState<"avant-chantier" | "apres-chantier">(defaultTab);
  const isReadOnly = Boolean(readOnly);
  const resolvedOrgId = orgId ?? initialValues?.org_id ?? null;
  const { data: members = [], isLoading: membersLoading } = useMembers(resolvedOrgId);
  const statusValues = useMemo(() => projectStatuses.map((status) => status.value), [projectStatuses]);
  const memberNameById = useMemo(() => {
    const result: Record<string, string> = {};
    members.forEach((member) => {
      const name = member.profiles?.full_name?.trim();
      if (member.user_id) {
        result[member.user_id] = name && name.length > 0 ? name : "Utilisateur";
      }
    });
    return result;
  }, [members]);
  const memberOptions = useMemo(
    () =>
      members.map((member) => ({
        id: member.user_id,
        name: memberNameById[member.user_id] ?? "Utilisateur",
      })),
    [members, memberNameById],
  );
  const resolvedStatusOptions = useMemo(
    () => (statusValues.length > 0 ? statusValues : fallbackProjectStatusValues),
    [statusValues],
  );
  const statusDisplayOptions = useMemo(
    () => (projectStatuses.length > 0 ? projectStatuses : DEFAULT_PROJECT_STATUSES),
    [projectStatuses],
  );
  useEffect(() => {
    if (open) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab, open]);

  const { data: subcontractors = [], isLoading: subcontractorsLoading } = useQuery({
    queryKey: ["subcontractors", resolvedOrgId],
    queryFn: async () => {
      if (!resolvedOrgId) return [] as SubcontractorOption[];

      const { data, error } = await supabase
        .from("subcontractors")
        .select("id, name")
        .eq("org_id", resolvedOrgId)
        .eq("is_active", true)
        .order("name");

      if (error) throw error;

      return (data ?? []) as SubcontractorOption[];
    },
    enabled: !!resolvedOrgId,
  });

  const mergedDefaults = useMemo(() => {
    const normalizedAdditionalCosts =
      initialValues?.additional_costs && initialValues.additional_costs.length > 0
        ? initialValues.additional_costs.map((cost) => {
            const rawCost = cost as unknown as Record<string, unknown>;
            const label =
              typeof rawCost.label === "string" && rawCost.label.trim().length > 0
                ? rawCost.label.trim()
                : "";
            const amountHT =
              typeof rawCost.amount_ht === "number" && Number.isFinite(rawCost.amount_ht)
                ? rawCost.amount_ht
                : 0;
            const montantTVAValue = (() => {
              if (typeof rawCost.montant_tva === "number" && Number.isFinite(rawCost.montant_tva)) {
                return rawCost.montant_tva;
              }
              if (typeof rawCost.taxes === "number" && Number.isFinite(rawCost.taxes)) {
                return rawCost.taxes;
              }
              return 0;
            })();
            const amountTTC =
              typeof rawCost.amount_ttc === "number" && Number.isFinite(rawCost.amount_ttc)
                ? rawCost.amount_ttc
                : computeAmountTTC(amountHT, montantTVAValue);
            const attachmentValue =
              typeof rawCost.attachment === "string" && rawCost.attachment.trim().length > 0
                ? rawCost.attachment.trim()
                : null;

            return {
              label,
              amount_ht: amountHT,
              montant_tva: montantTVAValue,
              amount_ttc: amountTTC,
              attachment: attachmentValue,
            } satisfies SiteFormValues["additional_costs"][number];
          })
        : defaultValues.additional_costs;

    const normalizedTeamMembers = normalizeTeamMembers(initialValues?.team_members, memberNameById);

    const resolvedStatus =
      initialValues?.status && statusValues.includes(initialValues.status)
        ? initialValues.status
        : statusValues[0] ?? defaultValues.status;

    const values: SiteFormValues = {
      ...defaultValues,
      ...initialValues,
      status: resolvedStatus,
      subcontractor_id:
        typeof initialValues?.subcontractor_id === "string" && initialValues.subcontractor_id.length > 0
          ? initialValues.subcontractor_id
          : null,
      additional_costs: normalizedAdditionalCosts,
    } as SiteFormValues;

    values.notes = parsedNotes.text;

    const allowedTravauxValues = TRAVAUX_NON_SUBVENTIONNES_OPTIONS.map(
      (option) => option.value,
    );
    if (!allowedTravauxValues.includes(values.travaux_non_subventionnes)) {
      values.travaux_non_subventionnes = defaultValues.travaux_non_subventionnes;
    }

    if (
      values.travaux_non_subventionnes_montant === null ||
      values.travaux_non_subventionnes_montant === undefined ||
      Number.isNaN(values.travaux_non_subventionnes_montant)
    ) {
      values.travaux_non_subventionnes_montant = 0;
    }

    values.travaux_non_subventionnes_description =
      values.travaux_non_subventionnes_description?.trim() ?? "";
    values.travaux_non_subventionnes_financement = Boolean(
      values.travaux_non_subventionnes_financement,
    );
    values.commission_commerciale_ht = Boolean(values.commission_commerciale_ht);

    if (
      values.commission_commerciale_ht_montant === null ||
      values.commission_commerciale_ht_montant === undefined ||
      Number.isNaN(values.commission_commerciale_ht_montant)
    ) {
      values.commission_commerciale_ht_montant = 0;
    }

    if (
      values.valorisation_cee === null ||
      values.valorisation_cee === undefined ||
      Number.isNaN(values.valorisation_cee)
    ) {
      values.valorisation_cee = 0;
    }

    if (!resolvedStatusOptions.includes(values.status)) {
      values.status = resolvedStatusOptions[0] ?? "";
    }

    return values;
  }, [initialValues, parsedNotes.text]);

  const availableProjects = useMemo<SiteProjectOption[]>(() => {
    const base = [...(projects ?? [])];
    const currentRef = mergedDefaults.project_ref;

    if (currentRef && !base.some((project) => project.project_ref === currentRef)) {
      base.push({
        id: currentRef,
        project_ref: currentRef,
        client_name: mergedDefaults.client_name,
        product_name: mergedDefaults.product_name,
        address: mergedDefaults.address,
        city: mergedDefaults.city,
        postal_code: mergedDefaults.postal_code,
        surface_facturee: mergedDefaults.surface_facturee,
      });
    }

    return base;
  }, [projects, mergedDefaults]);

  const hasAvailableProjects = availableProjects.length > 0;

 const schema = useMemo(
  () => createSiteSchema(resolvedStatusOptions, hasAvailableProjects),
  [resolvedStatusOptions, hasAvailableProjects]
);

  const resolver = useMemo(() => zodResolver(schema), [schema]);

  const form = useForm<SiteFormValues>({
    resolver,
    defaultValues: mergedDefaults,
  });

  const applyProjectDetails = useCallback(
    (projectRef: string) => {
      if (!projectRef) return;

      const selectedProject = availableProjects.find(
        (project) => project.project_ref === projectRef,
      );

      if (!selectedProject) return;

      form.setValue("client_name", selectedProject.client_name ?? "", {
        shouldDirty: true,
        shouldValidate: true,
      });
      form.setValue("product_name", selectedProject.product_name ?? "", {
        shouldDirty: true,
      });
      form.setValue("address", selectedProject.address ?? "", {
        shouldDirty: true,
        shouldValidate: true,
      });
      form.setValue("city", selectedProject.city ?? "", {
        shouldDirty: true,
        shouldValidate: true,
      });
      form.setValue("postal_code", selectedProject.postal_code ?? "", {
        shouldDirty: true,
        shouldValidate: true,
      });
      if (typeof selectedProject.surface_facturee === "number") {
        form.setValue("surface_facturee", selectedProject.surface_facturee, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
    },
    [availableProjects, form],
  );

  const watchedSiteRef = form.watch("site_ref");
  const watchedStartDate = form.watch("date_debut");
  const watchedEndDate = form.watch("date_fin_prevue");
  const watchedRevenue = form.watch("revenue");
  const watchedLaborCost = form.watch("cout_main_oeuvre_m2_ht");
  const watchedMaterialCost = form.watch("cout_isolation_m2");
  const watchedIsolationUsed = form.watch("isolation_utilisee_m2");
  const watchedSurfaceFacturee = form.watch("surface_facturee");
  const watchedCommission = form.watch("montant_commission");
  const watchedNonSubsidizedAmount = form.watch("travaux_non_subventionnes_montant");
  const watchedAdditionalCosts = form.watch("additional_costs");
  const watchedProductName = form.watch("product_name");

  const rentability = useMemo(
    () =>
      calculateRentability(
        buildRentabilityInputFromSite({
          revenue: watchedRevenue,
          cout_main_oeuvre_m2_ht: watchedLaborCost,
          cout_isolation_m2: watchedMaterialCost,
          isolation_utilisee_m2: watchedIsolationUsed,
          surface_facturee: watchedSurfaceFacturee,
          montant_commission: watchedCommission,
          travaux_non_subventionnes_montant: watchedNonSubsidizedAmount,
          additional_costs: watchedAdditionalCosts ?? [],
          product_name: watchedProductName,
        }),
      ),
    [
      watchedAdditionalCosts,
      watchedCommission,
      watchedLaborCost,
      watchedMaterialCost,
      watchedNonSubsidizedAmount,
      watchedProductName,
      watchedRevenue,
      watchedIsolationUsed,
      watchedSurfaceFacturee,
    ],
  );

  const rentabilityMarginPerUnitLabel =
    rentability.measurementMode === "luminaire"
      ? "Marge (€ / luminaire)"
      : "Marge (€ / m²)";

  const formattedAdditionalCosts = currencyFormatter.format(rentability.additionalCostsTotal);
  const formattedTotalCosts = currencyFormatter.format(rentability.totalCosts);
  const formattedMarginTotal = currencyFormatter.format(rentability.marginTotal);
  const formattedMarginRate = Number.isFinite(rentability.marginRate)
    ? percentFormatter.format(rentability.marginRate)
    : "—";
  const formattedMarginPerUnit = Number.isFinite(rentability.marginPerUnit)
    ? `${decimalFormatter.format(rentability.marginPerUnit)} € / ${rentability.unitLabel}`
    : `— / ${rentability.unitLabel}`;
  const watchedTravauxChoice = form.watch("travaux_non_subventionnes");
  const watchedCommissionCommerciale = form.watch("commission_commerciale_ht");
  const shouldShowTravauxDetails =
    (watchedTravauxChoice ?? "NA") !== "NA";
  const commissionCommercialeActive = watchedCommissionCommerciale === true;

  useEffect(() => {
    const currentProgress = form.getValues("progress_percentage");

    if (!watchedStartDate || !watchedEndDate) {
      if (currentProgress !== 0) {
        form.setValue("progress_percentage", 0, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
      return;
    }

    const start = new Date(watchedStartDate);
    const end = new Date(watchedEndDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      if (currentProgress !== 0) {
        form.setValue("progress_percentage", 0, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
      return;
    }

    if (end.getTime() <= start.getTime()) {
      const computed = new Date().getTime() >= end.getTime() ? 100 : 0;
      if (computed !== currentProgress) {
        form.setValue("progress_percentage", computed, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
      return;
    }

    const now = new Date();
    const totalDuration = end.getTime() - start.getTime();
    const elapsed = now.getTime() - start.getTime();

    let computed = 0;
    if (elapsed <= 0) {
      computed = 0;
    } else if (elapsed >= totalDuration) {
      computed = 100;
    } else {
      computed = Math.round((elapsed / totalDuration) * 100);
    }

    computed = Math.max(0, Math.min(100, computed));

    if (computed !== currentProgress) {
      form.setValue("progress_percentage", computed, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }
  }, [form, watchedStartDate, watchedEndDate]);

  useEffect(() => {
    if (open) form.reset(mergedDefaults);
  }, [open, mergedDefaults, form]);

  useEffect(() => {
    if (open) {
      setSiteDriveFile(parsedNotes.driveFile);
      setSiteDriveAttachments(parsedNotes.attachments);
    } else {
      setSiteDriveFile(null);
      setSiteDriveAttachments([]);
    }
  }, [open, parsedNotes.attachments, parsedNotes.driveFile]);

  const handleSiteDriveFileChange = useCallback((file: DriveFileMetadata | null) => {
    setSiteDriveFile(file);
    setSiteDriveAttachments((current) => {
      if (!file) {
        return current.slice(1);
      }

      const nextKey = getDriveFileKey(file);
      const filtered = current.filter((existing) => getDriveFileKey(existing) !== nextKey);
      return [file, ...filtered];
    });
  }, []);

  const {
    fields: costFields,
    append: appendCost,
    remove: removeCost,
    move: moveCost,
  } = useFieldArray({ control: form.control, name: "additional_costs" });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );
  const costIds = useMemo(() => costFields.map((f) => f.id), [costFields]);

  const handleCostDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const activeIndex = costIds.findIndex((id) => id === active.id);
      const overIndex = costIds.findIndex((id) => id === over.id);
      if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex) return;

      moveCost(activeIndex, overIndex);
    },
    [costIds, moveCost]
  );

  const handleSubmit = (values: SiteFormValues) => {
    if (isReadOnly) {
      return;
    }

    const filteredCosts = (values.additional_costs ?? [])
      .filter((c) => c.label.trim().length > 0)
      .map((c) => {
        const attachment = c.attachment ? c.attachment.trim() : "";
        const montantTVA = Number.isFinite(c.montant_tva) ? c.montant_tva : 0;
        const amountHT = Number.isFinite(c.amount_ht) ? c.amount_ht : 0;
        const amountTTC = Number.isFinite(c.amount_ttc)
          ? c.amount_ttc
          : computeAmountTTC(amountHT, montantTVA);

        return {
          label: c.label.trim(),
          amount_ht: amountHT,
          montant_tva: montantTVA,
          amount_ttc: amountTTC,
          attachment: attachment.length > 0 ? attachment : null,
        };
      });

    const serializedNotes = serializeSiteNotes(values.notes, siteDriveFile, siteDriveAttachments);

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

    const rentabilityResult = calculateRentability(
      buildRentabilityInputFromSite({
        ...values,
        additional_costs: filteredCosts,
      }),
    );

    onSubmit({
      ...values,
      project_ref: projectRef,
      client_name: clientName,
      subcontractor_id: values.subcontractor_id ?? null,
      additional_costs: filteredCosts,
      notes: serializedNotes,
      profit_margin: rentabilityResult.marginRate,
      rentability_total_costs: rentabilityResult.totalCosts,
      rentability_margin_total: rentabilityResult.marginTotal,
      rentability_margin_per_unit: rentabilityResult.marginPerUnit,
      rentability_margin_rate: rentabilityResult.marginRate,
      rentability_unit_label: rentabilityResult.unitLabel,
      rentability_unit_count: rentabilityResult.unitsUsed,
      rentability_additional_costs_total: rentabilityResult.additionalCostsTotal,
      travaux_non_subventionnes: travauxChoice,
      travaux_non_subventionnes_description: travauxDescription,
      travaux_non_subventionnes_montant: travauxMontant,
      travaux_non_subventionnes_financement: travauxFinancement,
      commission_commerciale_ht: commissionActive,
      commission_commerciale_ht_montant: commissionMontant,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isReadOnly
              ? "Détails du chantier"
              : mode === "create"
                ? "Nouveau chantier"
                : "Modifier le chantier"}
          </DialogTitle>
          <DialogDescription>
            {isReadOnly
              ? "Consultez les informations opérationnelles et financières du chantier."
              : "Renseignez les informations financières et opérationnelles du chantier."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <Tabs
              value={activeTab}
              onValueChange={(value) =>
                setActiveTab((value as "avant-chantier" | "apres-chantier") ?? "avant-chantier")
              }
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="avant-chantier">Avant Chantier</TabsTrigger>
                <TabsTrigger value="apres-chantier">Après Chantier</TabsTrigger>
              </TabsList>

              <TabsContent value="avant-chantier" className="space-y-6 mt-6">
                <fieldset disabled={isReadOnly} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Statut</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={isReadOnly || resolvedStatusOptions.length === 0}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner un statut" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {statusDisplayOptions.map((option) => {
                              const showActivity = POST_DELIVERY_STATUS_VALUES.has(option.value);
                              const isActive = option.isActive !== false;
                              const activityLabel = isActive ? "Actif" : "Inactif";
                              const activityClasses = isActive
                                ? "border-emerald-500/40 text-emerald-600"
                                : "border-destructive/40 text-destructive";

                              return (
                                <SelectItem key={option.value} value={option.value}>
                                  <div className="flex items-center justify-between gap-3">
                                    <span>{option.label}</span>
                                    {showActivity ? (
                                      <Badge
                                        variant="outline"
                                        className={`text-[10px] uppercase tracking-wide ${activityClasses}`}
                                      >
                                        {activityLabel}
                                      </Badge>
                                    ) : null}
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="site_ref"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Référence chantier</FormLabel>
                        <FormControl>
                          <Input placeholder="SITE-2024-0001" {...field} disabled={isReadOnly} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="project_ref"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Projet associé</FormLabel>
                        {hasAvailableProjects ? (
                          <Select
                            onValueChange={(value) => {
                              field.onChange(value);
                              applyProjectDetails(value);
                            }}
                            value={field.value ?? ""}
                            disabled={isReadOnly}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Sélectionner un projet" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {availableProjects.map((project) => (
                                <SelectItem
                                  key={project.id ?? project.project_ref}
                                  value={project.project_ref}
                                >
                                  {project.project_ref} • {getProjectClientName(project)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <FormControl>
                            <Input placeholder="Référence projet" {...field} disabled={isReadOnly} />
                          </FormControl>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {hasAvailableProjects
                            ? "Le chantier reprend automatiquement les informations du projet sélectionné."
                            : "Aucun projet disponible. Renseignez manuellement la référence si nécessaire."}
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="client_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Nom du client"
                            {...field}
                            readOnly={hasAvailableProjects || isReadOnly}
                            disabled={isReadOnly}
                            className={hasAvailableProjects || isReadOnly ? "bg-muted" : undefined}
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          {hasAvailableProjects
                            ? "Pré-rempli à partir du projet associé."
                            : "Saisissez manuellement le nom du client."}
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="date_debut"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date de début</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} disabled={isReadOnly} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="date_fin_prevue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date de fin prévue</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} disabled={isReadOnly} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="progress_percentage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Avancement (%)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            step={5}
                            {...field}
                            readOnly
                            className="bg-muted"
                            disabled={isReadOnly}
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          Calculé automatiquement à partir des dates du chantier.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="surface_facturee"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Surface facturée (m²)</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} step={0.1} {...field} disabled={isReadOnly} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="subcontractor_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sous-traitant</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(value === "" ? null : value)}
                        value={field.value ?? ""}
                        disabled={subcontractorsLoading || isReadOnly}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue
                              placeholder={
                                subcontractorsLoading
                                  ? "Chargement..."
                                  : subcontractors.length === 0
                                  ? "Aucun sous-traitant configuré"
                                  : "Sélectionner un sous-traitant"
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {subcontractors.map((option) => (
                            <SelectItem key={option.id} value={option.id}>
                              {option.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Les sous-traitants actifs sont gérés depuis les paramètres de l&apos;organisation.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                  />

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes internes</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Informations complémentaires"
                            {...field}
                            readOnly={isReadOnly}
                            disabled={isReadOnly}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </fieldset>
              </TabsContent>

                <TabsContent value="apres-chantier" className="space-y-6 mt-6">
                  <fieldset disabled={isReadOnly} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="cofrac_status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Statut COFRAC</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value} disabled={isReadOnly}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner un statut" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {cofracStatusOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="subcontractor_payment_confirmed"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(checked) => field.onChange(checked === true)}
                          disabled={isReadOnly}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Paiement sous-traitant effectué</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Confirme que le sous-traitant a bien été réglé.
                        </p>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="travaux_non_subventionnes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Travaux non subventionnés</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={isReadOnly}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner une option" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {TRAVAUX_NON_SUBVENTIONNES_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        Indique comment les travaux complémentaires sont financés.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {shouldShowTravauxDetails ? (
                  <div className="space-y-4 rounded-lg border border-dashed border-border/60 bg-muted/20 p-4">
                    <FormField
                      control={form.control}
                      name="travaux_non_subventionnes_description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Précisez les travaux réalisés et leur contexte"
                              {...field}
                              disabled={isReadOnly}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="travaux_non_subventionnes_montant"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Montant des travaux (€)</FormLabel>
                            <FormControl>
                              <Input type="number" min={0} step={50} {...field} disabled={isReadOnly} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="travaux_non_subventionnes_financement"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={(checked) => field.onChange(checked === true)}
                                disabled={isReadOnly}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Financement externe confirmé</FormLabel>
                              <p className="text-sm text-muted-foreground">
                                Activez si un financement complémentaire est mis en place.
                              </p>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                ) : null}

                <FormField
                  control={form.control}
                  name="commission_commerciale_ht"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(checked) => field.onChange(checked === true)}
                          disabled={isReadOnly}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Commission commerciale (HT)</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Indique si une commission commerciale HT est à prévoir.
                        </p>
                      </div>
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="revenue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Chiffre d'affaires (€)</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} step={100} {...field} disabled={isReadOnly} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="cout_main_oeuvre_m2_ht"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Coût main d'œuvre HT (€/m²)</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} step={0.1} {...field} disabled={isReadOnly} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="cout_isolation_m2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Coût isolation (€/m²)</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} step={0.1} {...field} disabled={isReadOnly} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="isolation_utilisee_m2"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          Surface utilisée (m²)
                          <TooltipProvider delayDuration={150}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info
                                  className="h-4 w-4 cursor-help text-muted-foreground"
                                  aria-hidden="true"
                                />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>incluant les pertes</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </FormLabel>
                        <FormControl>
                          <Input type="number" min={0} step={0.1} {...field} disabled={isReadOnly} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="montant_commission"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Commission commerciale (€)</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} step={50} {...field} disabled={isReadOnly} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="travaux_non_subventionnes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Travaux non subventionnés (€)</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} step={50} {...field} disabled={isReadOnly} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="valorisation_cee"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prime CEE (€)</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} step={50} {...field} disabled={isReadOnly} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {commissionCommercialeActive ? (
                    <FormField
                      control={form.control}
                      name="commission_commerciale_ht_montant"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Montant commission commerciale HT (€)</FormLabel>
                          <FormControl>
                            <Input type="number" min={0} step={50} {...field} disabled={isReadOnly} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : null}
                </div>

                <div className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-4">
                  <div>
                    <h4 className="text-sm font-semibold text-primary">Rentabilité</h4>
                    <p className="text-xs text-muted-foreground">
                      Calculée automatiquement à partir du CA, des coûts et de la surface réelle.
                    </p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-1">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">
                        Frais de chantier (HT+TVA)
                      </span>
                      <span className="text-sm font-semibold text-foreground">
                        {formattedAdditionalCosts}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">Coûts totaux</span>
                      <span className="text-sm font-semibold text-foreground">
                        {formattedTotalCosts}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">
                        {rentabilityMarginPerUnitLabel}
                      </span>
                      <span className="text-sm font-semibold text-foreground">
                        {formattedMarginPerUnit}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">Marge totale (€)</span>
                      <span className="text-sm font-semibold text-foreground">
                        {formattedMarginTotal}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">Marge (%)</span>
                      <span className="text-sm font-semibold text-foreground">
                        {formattedMarginRate}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <FormLabel>Frais de chantier</FormLabel>
                  {costFields.length > 1 ? (
                    <p className="text-xs text-muted-foreground">Réorganisez l&apos;affichage des coûts en les faisant glisser.</p>
                  ) : null}
                  <div className="space-y-3">
                    {costFields.length === 0 ? null : (
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCostDragEnd}>
                        <SortableContext items={costIds} strategy={verticalListSortingStrategy}>
                          {costFields.map((field, index) => (
                            <SortableAdditionalCostRow
                              key={field.id}
                              field={field}
                              index={index}
                              control={form.control}
                              remove={removeCost}
                              canRemove={costFields.length > 0}
                              orgId={resolvedOrgId}
                              siteRef={watchedSiteRef}
                              disabled={isReadOnly}
                            />
                          ))}
                        </SortableContext>
                      </DndContext>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() =>
                      appendCost({
                        label: "",
                        amount_ht: undefined as unknown as number,
                        montant_tva: undefined as unknown as number,
                        amount_ttc: 0,
                        attachment: null,
                      })
                    }
                    disabled={isReadOnly}
                  >
                    <Plus className="w-4 h-4 mr-1" /> Ajouter un frais
                  </Button>
                </div>

                <div className="space-y-2">
                  <FormLabel>Documents chantier</FormLabel>
                  <DriveFileUploader
                    orgId={orgId ?? initialValues?.org_id ?? null}
                    value={siteDriveFile}
                    onChange={handleSiteDriveFileChange}
                    accept="application/pdf,image/*"
                    maxSizeMb={35}
                    entityType="site"
                    entityId={initialValues?.site_ref}
                    description="Documents liés au chantier"
                    helperText="Ajoutez des photos ou des fichiers stockés sur Google Drive."
                    disabled={isReadOnly}
                  />
                </div>
                </fieldset>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {isReadOnly ? "Fermer" : "Annuler"}
              </Button>
              {isReadOnly ? null : (
                <Button type="submit">{mode === "create" ? "Créer le chantier" : "Enregistrer"}</Button>
              )}
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
