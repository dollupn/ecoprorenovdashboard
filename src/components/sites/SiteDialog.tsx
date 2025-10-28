import { useCallback, useEffect, useMemo, useRef, useState, useId, type CSSProperties } from "react";
import {
  useForm,
  useFieldArray,
  type Control,
  type FieldArrayWithId,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
import { getProjectClientName } from "@/lib/projects";
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
import { GripVertical, Plus, Trash2, Upload } from "lucide-react";
import { useSubcontractorDirectory } from "@/hooks/useSubcontractorDirectory";

const teamMemberSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
});

const additionalCostSchema = z.object({
  label: z.string().min(1, "Intitulé requis"),
  amount_ht: z.coerce
    .number({ invalid_type_error: "Montant HT invalide" })
    .min(0, "Le montant HT doit être positif"),
  taxes: z.coerce
    .number({ invalid_type_error: "Montant des taxes invalide" })
    .min(0, "Le montant des taxes doit être positif"),
  attachment: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((value) => (value && value.length > 0 ? value : null)),
});

const siteSchema = z.object({
  site_ref: z.string().min(3, "Référence requise"),
  project_ref: z.string().min(3, "Référence projet requise"),
  client_name: z.string().min(2, "Client requis"),
  product_name: z.string().optional().nullable(),
  address: z.string().min(3, "Adresse requise"),
  city: z.string().min(2, "Ville requise"),
  postal_code: z.string().min(4, "Code postal invalide"),
  status: z.enum(["PLANIFIE", "EN_PREPARATION", "EN_COURS", "SUSPENDU", "TERMINE", "LIVRE"]),
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
  notes: z.string().optional(),
  team_members: z.array(teamMemberSchema).min(1, "Ajoutez au moins un membre"),
  additional_costs: z.array(additionalCostSchema).optional().default([]),
  subcontractor_payment_confirmed: z.boolean().default(false),
});

export type SiteFormValues = z.infer<typeof siteSchema>;

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

interface SiteDialogProps {
  open: boolean;
  mode: "create" | "edit";
  onOpenChange: (open: boolean) => void;
  onSubmit: (values: SiteFormValues) => void;
  initialValues?: (Partial<SiteFormValues> & { org_id?: string | null }) | undefined;
  orgId?: string | null;
  projects?: SiteProjectOption[];
}

const defaultValues: SiteFormValues = {
  site_ref: "",
  project_ref: "",
  client_name: "",
  product_name: "",
  address: "",
  city: "",
  postal_code: "",
  status: "PLANIFIE",
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
  notes: "",
  team_members: [{ name: "" }],
  additional_costs: [],
  subcontractor_payment_confirmed: false,
};

interface SortableTeamMemberFieldProps {
  field: FieldArrayWithId<SiteFormValues, "team_members">;
  index: number;
  control: Control<SiteFormValues>;
  remove: (index: number) => void;
  canRemove: boolean;
  suggestions: string[];
}

const SortableTeamMemberField = ({
  field,
  index,
  control,
  remove,
  canRemove,
  suggestions,
}: SortableTeamMemberFieldProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  });

  const style: CSSProperties = { transform: CSS.Transform.toString(transform), transition };
  const datalistId = useId();

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-start gap-2 rounded-md border bg-background/60 p-2 transition ${
        isDragging ? "ring-2 ring-primary/40" : ""
      }`}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="mt-1 cursor-grab active:cursor-grabbing"
        aria-label="Réorganiser le membre de l'équipe"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </Button>
      <FormField
        control={control}
        name={`team_members.${index}.name`}
        render={({ field: memberField }) => (
          <FormItem className="flex-1">
            <FormControl>
              <Input
                placeholder="Nom du sous-traitant ou de l'équipe"
                list={suggestions.length > 0 ? datalistId : undefined}
                {...memberField}
              />
            </FormControl>
            <FormMessage />
            {suggestions.length > 0 ? (
              <datalist id={datalistId}>
                {suggestions.map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            ) : null}
          </FormItem>
        )}
      />
      {canRemove ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => remove(index)}
          aria-label="Supprimer le membre"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      ) : null}
    </div>
  );
};

interface SortableAdditionalCostRowProps {
  field: FieldArrayWithId<SiteFormValues, "additional_costs">;
  index: number;
  control: Control<SiteFormValues>;
  remove: (index: number) => void;
  canRemove: boolean;
}

const SortableAdditionalCostRow = ({
  field,
  index,
  control,
  remove,
  canRemove,
}: SortableAdditionalCostRowProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const style: CSSProperties = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-md border bg-background/60 p-3 transition ${
        isDragging ? "ring-2 ring-primary/40" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="mt-1 cursor-grab active:cursor-grabbing"
          aria-label="Réorganiser le coût supplémentaire"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </Button>
        <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-start">
          <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-12 md:items-start">
            <FormField
              control={control}
              name={`additional_costs.${index}.label`}
              render={({ field: labelField }) => (
                <FormItem className="md:col-span-5">
                  <FormControl>
                    <Input
                      placeholder="Intitulé du coût"
                      title={typeof labelField.value === "string" ? labelField.value : undefined}
                      {...labelField}
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
                <FormItem className="md:col-span-2">
                  <FormControl>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      placeholder="Montant HT"
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
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`additional_costs.${index}.taxes`}
              render={({ field: taxesField }) => (
                <FormItem className="md:col-span-2">
                  <FormControl>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      placeholder="Taxes"
                      name={taxesField.name}
                      ref={taxesField.ref}
                      value={
                        taxesField.value === undefined || taxesField.value === null ? "" : taxesField.value
                      }
                      onChange={(event) => {
                        const newValue = event.target.value;
                        taxesField.onChange(newValue === "" ? "" : Number(newValue));
                      }}
                      onBlur={taxesField.onBlur}
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
                <FormItem className="md:col-span-3">
                  <FormControl>
                    <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                      <Input
                        placeholder="Lien ou identifiant"
                        value={attachmentField.value ?? ""}
                        onChange={(event) => attachmentField.onChange(event.target.value)}
                        className="sm:flex-1"
                      />
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          // Replace with actual upload; keeping file name as placeholder
                          attachmentField.onChange(file.name);
                          event.target.value = "";
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={() => fileInputRef.current?.click()}
                        aria-label="Ajouter une pièce jointe"
                      >
                        <Upload className="h-4 w-4 mr-2" /> Joindre
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          {canRemove ? (
            <div className="flex justify-end md:ml-2 md:flex-none md:justify-start md:self-start">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => remove(index)}
                aria-label="Supprimer le coût"
                className="self-start"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

const statusOptions = [
  { value: "PLANIFIE", label: "Planifié" },
  { value: "EN_PREPARATION", label: "En préparation" },
  { value: "EN_COURS", label: "En cours" },
  { value: "SUSPENDU", label: "Suspendu" },
  { value: "TERMINE", label: "Terminé" },
  { value: "LIVRE", label: "Livré" },
] as const;

const cofracStatusOptions = [
  { value: "EN_ATTENTE", label: "En attente" },
  { value: "CONFORME", label: "Conforme" },
  { value: "NON_CONFORME", label: "Non conforme" },
  { value: "A_PLANIFIER", label: "Audit à planifier" },
] as const;

export const SiteDialog = ({
  open,
  mode,
  onOpenChange,
  onSubmit,
  initialValues,
  orgId,
  projects,
}: SiteDialogProps) => {
  const parsedNotes = useMemo(() => {
    if (!initialValues?.notes) {
      return { text: initialValues?.notes ?? "", driveFile: null } as {
        text: string;
        driveFile: DriveFileMetadata | null;
      };
    }

    try {
      const raw = JSON.parse(initialValues.notes);
      if (raw && typeof raw === "object") {
        const record = raw as Record<string, unknown>;
        const text = typeof record.internalNotes === "string" ? record.internalNotes : "";
        const driveUrl = typeof record.driveFileUrl === "string" ? record.driveFileUrl : undefined;
        const driveId = typeof record.driveFileId === "string" ? record.driveFileId : undefined;
        const driveName = typeof record.driveFileName === "string" ? record.driveFileName : undefined;
        const driveFile: DriveFileMetadata | null = driveUrl
          ? {
              id: driveId && String(driveId).trim() ? String(driveId) : driveUrl,
              name: driveName && String(driveName).trim() ? String(driveName) : "Document chantier",
              webViewLink: driveUrl,
            }
          : null;
        return { text, driveFile };
      }
    } catch (error) {
      console.warn("Unable to parse site notes metadata", error);
    }

    return { text: initialValues.notes ?? "", driveFile: null } as {
      text: string;
      driveFile: DriveFileMetadata | null;
    };
  }, [initialValues?.notes]);

  const [siteDriveFile, setSiteDriveFile] = useState<DriveFileMetadata | null>(parsedNotes.driveFile);
  const resolvedOrgId = orgId ?? initialValues?.org_id ?? null;
  const { subcontractors, saveSubcontractors } = useSubcontractorDirectory(resolvedOrgId);

  const mergedDefaults = useMemo(() => {
    const normalizedAdditionalCosts =
      initialValues?.additional_costs && initialValues.additional_costs.length > 0
        ? initialValues.additional_costs.map((cost) => ({
            label: cost.label,
            amount_ht: Number.isFinite(cost.amount_ht) ? cost.amount_ht : 0,
            taxes: Number.isFinite(cost.taxes) ? cost.taxes : 0,
            attachment: cost.attachment ?? null,
          }))
        : defaultValues.additional_costs;

    const values: SiteFormValues = {
      ...defaultValues,
      ...initialValues,
      team_members:
        initialValues?.team_members && initialValues.team_members.length > 0
          ? initialValues.team_members
          : defaultValues.team_members,
      additional_costs: normalizedAdditionalCosts,
    } as SiteFormValues;

    values.notes = parsedNotes.text;

    return values;
  }, [initialValues, parsedNotes.text]);

  const form = useForm<SiteFormValues>({
    resolver: zodResolver(siteSchema),
    defaultValues: mergedDefaults,
  });

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

  const watchedStartDate = form.watch("date_debut");
  const watchedEndDate = form.watch("date_fin_prevue");

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
    if (open) setSiteDriveFile(parsedNotes.driveFile);
    else setSiteDriveFile(null);
  }, [open, parsedNotes.driveFile]);

  const {
    fields: teamMemberFields,
    append: appendTeamMember,
    remove: removeTeamMember,
    move: moveTeamMember,
  } = useFieldArray({ control: form.control, name: "team_members" });

  const {
    fields: costFields,
    append: appendCost,
    remove: removeCost,
    move: moveCost,
  } = useFieldArray({ control: form.control, name: "additional_costs" });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const teamMemberIds = useMemo(() => teamMemberFields.map((f) => f.id), [teamMemberFields]);
  const costIds = useMemo(() => costFields.map((f) => f.id), [costFields]);

  const handleTeamMemberDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const activeIndex = teamMemberIds.findIndex((id) => id === active.id);
      const overIndex = teamMemberIds.findIndex((id) => id === over.id);
      if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex) return;

      moveTeamMember(activeIndex, overIndex);
    },
    [teamMemberIds, moveTeamMember]
  );

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
    const filteredTeamMembers = values.team_members.filter((m) => m.name.trim().length > 0);
    saveSubcontractors(filteredTeamMembers.map((member) => member.name.trim()));

    const filteredCosts = values.additional_costs
      .filter((c) => c.label.trim().length > 0)
      .map((c) => {
        const attachment = c.attachment ? c.attachment.trim() : "";
        return {
          label: c.label.trim(),
          amount_ht: Number.isFinite(c.amount_ht) ? c.amount_ht : 0,
          taxes: Number.isFinite(c.taxes) ? c.taxes : 0,
          attachment: attachment.length > 0 ? attachment : null,
        };
      });

    const driveFileUrl = siteDriveFile?.webViewLink ?? (siteDriveFile as any)?.webContentLink ?? undefined;
    const notesMetadata: Record<string, unknown> = {};

    if (driveFileUrl) {
      notesMetadata.driveFileUrl = driveFileUrl;
      notesMetadata.driveFileId = siteDriveFile?.id;
      notesMetadata.driveFileName = siteDriveFile?.name;
    }
    if (values.notes && values.notes.trim()) {
      notesMetadata.internalNotes = values.notes.trim();
    }

    const serializedNotes = Object.keys(notesMetadata).length > 0 ? JSON.stringify(notesMetadata) : null;

    onSubmit({
      ...values,
      team_members: filteredTeamMembers,
      additional_costs: filteredCosts,
      notes: serializedNotes ?? "",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Nouveau chantier" : "Modifier le chantier"}</DialogTitle>
          <DialogDescription>
            Renseignez les informations financières et opérationnelles du chantier.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <Tabs defaultValue="avant-chantier" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="avant-chantier">Avant Chantier</TabsTrigger>
                <TabsTrigger value="apres-chantier">Après Chantier</TabsTrigger>
              </TabsList>

              <TabsContent value="avant-chantier" className="space-y-6 mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Statut</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner un statut" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {statusOptions.map((option) => (
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="site_ref"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Référence chantier</FormLabel>
                        <FormControl>
                          <Input placeholder="SITE-2024-0001" {...field} />
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
                        <Select
                          onValueChange={(value) => {
                            field.onChange(value);
                            applyProjectDetails(value);
                          }}
                          value={field.value ?? ""}
                        >
                          <FormControl>
                            <SelectTrigger disabled={availableProjects.length === 0}>
                              <SelectValue placeholder="Sélectionner un projet" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {availableProjects.length > 0 ? (
                              availableProjects.map((project) => (
                                <SelectItem
                                  key={project.id ?? project.project_ref}
                                  value={project.project_ref}
                                >
                                {project.project_ref} • {getProjectClientName(project)}
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="" disabled>
                                Aucun projet disponible
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Le chantier reprend automatiquement les informations du projet sélectionné.
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
                            readOnly
                            className="bg-muted"
                          />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">
                          Pré-rempli à partir du projet associé.
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
                          <Input type="date" {...field} />
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
                          <Input type="date" {...field} />
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
                          <Input type="number" min={0} step={0.1} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <FormLabel>Équipe chantier</FormLabel>
                  {teamMemberFields.length > 1 ? (
                    <p className="text-xs text-muted-foreground">Faites glisser les membres pour définir l&apos;ordre de votre équipe.</p>
                  ) : null}
                  {subcontractors.length > 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Sélectionnez un sous-traitant habituel dans la liste ou saisissez un nouveau nom pour l&apos;enregistrer.
                    </p>
                  ) : null}
                  <div className="space-y-3">
                    {teamMemberFields.length === 0 ? (
                      <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                        Ajoutez les membres composant l&apos;équipe chantier.
                      </div>
                    ) : (
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTeamMemberDragEnd}>
                        <SortableContext items={teamMemberIds} strategy={verticalListSortingStrategy}>
                          {teamMemberFields.map((field, index) => (
                            <SortableTeamMemberField
                              key={field.id}
                              field={field}
                              index={index}
                              control={form.control}
                              remove={removeTeamMember}
                              canRemove={teamMemberFields.length > 1}
                              suggestions={subcontractors}
                            />
                          ))}
                        </SortableContext>
                      </DndContext>
                    )}
                  </div>
                  <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => appendTeamMember({ name: "" })}>
                    <Plus className="w-4 h-4 mr-1" /> Ajouter un membre
                  </Button>
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes internes</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Informations complémentaires" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="apres-chantier" className="space-y-6 mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="cofrac_status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Statut COFRAC</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="revenue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Chiffre d'affaires (€)</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} step={100} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="profit_margin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Marge (%)</FormLabel>
                        <FormControl>
                          <Input type="number" step={0.1} {...field} />
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
                          <Input type="number" min={0} step={0.1} {...field} />
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
                          <Input type="number" min={0} step={0.1} {...field} />
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
                        <FormLabel>Isolation utilisée (m²)</FormLabel>
                        <FormControl>
                          <Input type="number" min={0} step={0.1} {...field} />
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
                          <Input type="number" min={0} step={50} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <FormLabel>Coûts supplémentaires</FormLabel>
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
                        taxes: undefined as unknown as number,
                        attachment: null,
                      })
                    }
                  >
                    <Plus className="w-4 h-4 mr-1" /> Ajouter un coût
                  </Button>
                </div>

                <div className="space-y-2">
                  <FormLabel>Documents chantier</FormLabel>
                  <DriveFileUploader
                    orgId={orgId ?? initialValues?.org_id ?? null}
                    value={siteDriveFile}
                    onChange={setSiteDriveFile}
                    accept="application/pdf,image/*"
                    maxSizeMb={35}
                    entityType="site"
                    entityId={initialValues?.site_ref}
                    description="Documents liés au chantier"
                    helperText="Ajoutez des photos ou des fichiers stockés sur Google Drive."
                  />
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annuler
              </Button>
              <Button type="submit">{mode === "create" ? "Créer le chantier" : "Enregistrer"}</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
