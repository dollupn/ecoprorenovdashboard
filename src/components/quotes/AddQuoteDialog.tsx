import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  useForm,
  useFieldArray,
  type Control,
  type FieldArrayWithId,
  type UseFormGetValues,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
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

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { getProjectClientName } from "@/lib/projects";
import { useAuth } from "@/hooks/useAuth";
import { useOrg } from "@/features/organizations/OrgContext";
import { useToast } from "@/hooks/use-toast";
import { DriveFileUploader } from "@/components/integrations/DriveFileUploader";
import type { DriveFileMetadata } from "@/integrations/googleDrive";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { GripVertical, Plus, PlusCircle, Trash2 } from "lucide-react";

import { formatQuoteCurrency, parseQuoteMetadata } from "./utils";
import type { QuoteLineItem, QuoteMetadata } from "./types";
import { AddressAutocomplete } from "@/components/address/AddressAutocomplete";

const quoteStatuses = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"] as const;

const lineItemSchema = z.object({
  reference: z.string().optional(),
  description: z.string().min(2, "La description est requise"),
  quantity: z.coerce.number().min(0.01, "Quantité invalide"),
  unit_price: z.coerce.number().min(0, "Prix unitaire invalide"),
  tax_rate: z.coerce.number().min(0).max(100).optional(),
});

const quoteSchema = z.object({
  quote_ref: z.string().min(3, "La référence est requise"),
  client_name: z.string().min(2, "Le nom du client est requis"),
  product_name: z.string().min(2, "Le nom du produit est requis"),
  amount: z.coerce.number().min(0.01, "Le montant doit être supérieur à 0"),
  status: z.enum(quoteStatuses),
  project_id: z.string().optional(),
  valid_until: z.string().optional(),
  notes: z.string().optional(),
  client_email: z.string().email("Email invalide").optional().or(z.literal("")),
  client_phone: z.string().optional(),
  client_siren: z.string().optional(),
  site_address: z.string().optional(),
  site_city: z.string().optional(),
  site_postal_code: z.string().optional(),
  payment_terms: z.string().optional(),
  drive_folder_url: z.string().url("URL invalide").optional().or(z.literal("")),
  email_message: z.string().optional(),
  line_items: z.array(lineItemSchema).default([]),
});

export type QuoteFormValues = z.infer<typeof quoteSchema>;

type ProjectOption = Pick<
  Tables<"projects">,
  "id" | "project_ref" | "client_name" | "client_first_name" | "client_last_name"
>;

export interface AddQuoteDialogProps {
  onQuoteAdded?: () => void | Promise<void>;
  trigger?: ReactNode;
  initialValues?: Partial<QuoteFormValues>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  mode?: "create" | "edit";
  quoteId?: string;
}

const createEmptyLineItem = (): QuoteFormValues["line_items"][number] => ({
  reference: "",
  description: "",
  quantity: 1,
  unit_price: 0,
  tax_rate: 0,
});

interface SortableQuoteLineItemProps {
  field: FieldArrayWithId<QuoteFormValues, "line_items">;
  index: number;
  control: Control<QuoteFormValues>;
  remove: (index: number) => void;
  getValues: UseFormGetValues<QuoteFormValues>;
}

const SortableQuoteLineItem = ({
  field,
  index,
  control,
  remove,
  getValues,
}: SortableQuoteLineItemProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const quantity = Number(getValues(`line_items.${index}.quantity`)) || 0;
  const unitPrice = Number(getValues(`line_items.${index}.unit_price`)) || 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`space-y-4 rounded-md border bg-background p-4 shadow-sm transition-shadow ${
        isDragging ? "ring-2 ring-primary/40" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="cursor-grab active:cursor-grabbing"
            aria-label="Réorganiser la ligne du devis"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-muted-foreground">Ligne {index + 1}</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => remove(index)}
          aria-label="Supprimer la ligne"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <FormField
          control={control}
          name={`line_items.${index}.reference`}
          render={({ field: referenceField }) => (
            <FormItem>
              <FormLabel>Référence</FormLabel>
              <FormControl>
                <Input placeholder="REF-001" {...referenceField} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`line_items.${index}.quantity`}
          render={({ field: quantityField }) => (
            <FormItem>
              <FormLabel>Quantité</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  {...quantityField}
                  onChange={(event) => quantityField.onChange(event.target.valueAsNumber)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={control}
        name={`line_items.${index}.description`}
        render={({ field: descriptionField }) => (
          <FormItem>
            <FormLabel>Description *</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Détaillez la prestation proposée"
                className="min-h-[80px]"
                {...descriptionField}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <FormField
          control={control}
          name={`line_items.${index}.unit_price`}
          render={({ field: unitPriceField }) => (
            <FormItem>
              <FormLabel>Prix unitaire HT</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  {...unitPriceField}
                  onChange={(event) => unitPriceField.onChange(event.target.valueAsNumber)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={`line_items.${index}.tax_rate`}
          render={({ field: taxRateField }) => (
            <FormItem>
              <FormLabel>TVA %</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  {...taxRateField}
                  onChange={(event) => taxRateField.onChange(event.target.valueAsNumber)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex flex-col justify-end rounded-md border bg-muted/40 px-3 py-2">
          <p className="text-sm text-muted-foreground">Sous-total</p>
          <p className="text-base font-semibold">{formatQuoteCurrency(quantity * unitPrice)}</p>
        </div>
      </div>
    </div>
  );
};

const baseDefaultValues: QuoteFormValues = {
  quote_ref: "",
  client_name: "",
  product_name: "",
  amount: 0 as unknown as number,
  status: "DRAFT",
  project_id: undefined,
  valid_until: "",
  notes: "",
  client_email: "",
  client_phone: "",
  client_siren: "",
  site_address: "",
  site_city: "",
  site_postal_code: "",
  payment_terms: "",
  drive_folder_url: "",
  email_message: "",
  line_items: [createEmptyLineItem()],
};

const generateQuoteReference = () => {
  const now = new Date();
  const year = now.getFullYear();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `DEV-${year}-${random}`;
};

export const AddQuoteDialog = ({
  onQuoteAdded,
  trigger,
  initialValues,
  open,
  onOpenChange,
  mode = "create",
  quoteId,
}: AddQuoteDialogProps) => {
  const { user } = useAuth();
  const { currentOrgId } = useOrg();
  const { toast } = useToast();
  const [quoteDriveFile, setQuoteDriveFile] = useState<DriveFileMetadata | null>(null);
  const [isManualSiteAddress, setIsManualSiteAddress] = useState(false);
  const parsedMetadata = useMemo(
    () => parseQuoteMetadata({ notes: initialValues?.notes ?? "" }),
    [initialValues?.notes],
  );
  const metadataLineItems = useMemo<QuoteFormValues["line_items"] | null>(() => {
    if (!parsedMetadata.lineItems || parsedMetadata.lineItems.length === 0) {
      return null;
    }

    return parsedMetadata.lineItems.map((item) => ({
      reference: item.reference ?? "",
      description: item.description ?? "",
      quantity: item.quantity ?? 0,
      unit_price: item.unitPrice ?? 0,
      tax_rate: item.taxRate ?? undefined,
    }));
  }, [parsedMetadata.lineItems]);

  const metadataDriveFile = useMemo<DriveFileMetadata | null>(() => {
    if (parsedMetadata.driveFileUrl) {
      return {
        id: parsedMetadata.driveFileId ?? parsedMetadata.driveFileUrl,
        name: parsedMetadata.driveFileName ?? "Document devis",
        webViewLink: parsedMetadata.driveFileUrl,
        webContentLink: parsedMetadata.driveFileUrl,
      };
    }

    if (parsedMetadata.driveFileId) {
      const baseUrl = `https://drive.google.com/file/d/${parsedMetadata.driveFileId}/view`;
      return {
        id: parsedMetadata.driveFileId,
        name: parsedMetadata.driveFileName ?? "Document devis",
        webViewLink: baseUrl,
      };
    }

    return null;
  }, [parsedMetadata.driveFileId, parsedMetadata.driveFileName, parsedMetadata.driveFileUrl]);

  const [internalOpen, setInternalOpen] = useState(false);
  const dialogOpen = open ?? internalOpen;

  const setDialogOpen = useCallback(
    (next: boolean) => {
      if (onOpenChange) {
        onOpenChange(next);
      } else {
        setInternalOpen(next);
      }
    },
    [onOpenChange]
  );

  const form = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteSchema),
    defaultValues: baseDefaultValues,
  });

  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: "line_items",
  });

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const lineItemIds = useMemo(() => fields.map((field) => field.id), [fields]);

  const handleLineItemsDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (!over || active.id === over.id) {
        return;
      }

      const activeIndex = lineItemIds.findIndex((id) => id === active.id);
      const overIndex = lineItemIds.findIndex((id) => id === over.id);

      if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex) {
        return;
      }

      move(activeIndex, overIndex);
    },
    [lineItemIds, move]
  );

  const watchedLineItems = form.watch("line_items");

  const lineItemsSubtotal = useMemo(() => {
    if (!watchedLineItems || watchedLineItems.length === 0) {
      return 0;
    }

    return watchedLineItems.reduce((total, item) => {
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unit_price) || 0;
      return total + quantity * unitPrice;
    }, 0);
  }, [watchedLineItems]);

  useEffect(() => {
    if (!watchedLineItems || watchedLineItems.length === 0) {
      return;
    }

    form.setValue("amount", Number(lineItemsSubtotal.toFixed(2)) as unknown as number, {
      shouldDirty: true,
    });
  }, [form, watchedLineItems, lineItemsSubtotal]);

  const { data: projects = [] } = useQuery<ProjectOption[]>({
    queryKey: ["projects", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("projects")
        .select("id, project_ref, client_name, client_first_name, client_last_name")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });

  const projectOptions = useMemo(
    () =>
      projects.map((project) => ({
        value: project.id,
        label: project.project_ref,
        description: getProjectClientName(project),
      })),
    [projects]
  );

  useEffect(() => {
    if (!dialogOpen) {
      form.reset(baseDefaultValues);
      setQuoteDriveFile(null);
      setIsManualSiteAddress(false);
      return;
    }

    const values: QuoteFormValues = {
      ...baseDefaultValues,
      ...initialValues,
    } as QuoteFormValues;

    const pickValue = (current?: string | null, fallback?: string) => {
      if (current && current.trim().length > 0) return current;
      return fallback ?? "";
    };

    values.client_email = pickValue(initialValues?.client_email ?? undefined, parsedMetadata.clientEmail);
    values.client_phone = pickValue(initialValues?.client_phone ?? undefined, parsedMetadata.clientPhone);
    values.client_siren = pickValue(initialValues?.client_siren ?? undefined, parsedMetadata.clientSiren);
    values.site_address = pickValue(initialValues?.site_address ?? undefined, parsedMetadata.siteAddress);
    values.site_city = pickValue(initialValues?.site_city ?? undefined, parsedMetadata.siteCity);
    values.site_postal_code = pickValue(
      initialValues?.site_postal_code ?? undefined,
      parsedMetadata.sitePostalCode,
    );
    values.payment_terms = pickValue(initialValues?.payment_terms ?? undefined, parsedMetadata.paymentTerms);
    values.drive_folder_url = pickValue(
      initialValues?.drive_folder_url ?? undefined,
      parsedMetadata.driveFolderUrl,
    );
    values.email_message = pickValue(initialValues?.email_message ?? undefined, parsedMetadata.emailMessage);
    values.notes =
      parsedMetadata.internalNotes ??
      (initialValues?.notes && initialValues.notes.trim().length > 0 ? initialValues.notes : "");

    if (typeof initialValues?.amount === "number") {
      values.amount = initialValues.amount.toString() as unknown as number;
    } else if (typeof initialValues?.amount === "string" && (initialValues.amount as any).trim().length > 0) {
      values.amount = initialValues.amount as unknown as number;
    } else if (metadataLineItems && metadataLineItems.length > 0) {
      const total = metadataLineItems.reduce(
        (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_price) || 0),
        0,
      );
      values.amount = total.toString() as unknown as number;
    }

    if (!values.quote_ref) {
      values.quote_ref = generateQuoteReference();
    }

    if ((!initialValues?.line_items || initialValues.line_items.length === 0) && metadataLineItems) {
      values.line_items = metadataLineItems;
    }

    if (!values.line_items || values.line_items.length === 0) {
      values.line_items = [createEmptyLineItem()];
    }

    form.reset(values);
    setIsManualSiteAddress(
      Boolean(values.site_address && (!values.site_city || !values.site_postal_code))
    );
    setQuoteDriveFile(metadataDriveFile);
  }, [
    dialogOpen,
    form,
    initialValues,
    metadataDriveFile,
    metadataLineItems,
    parsedMetadata.clientEmail,
    parsedMetadata.clientPhone,
    parsedMetadata.clientSiren,
    parsedMetadata.driveFolderUrl,
    parsedMetadata.emailMessage,
    parsedMetadata.internalNotes,
    parsedMetadata.paymentTerms,
    parsedMetadata.siteAddress,
    parsedMetadata.siteCity,
    parsedMetadata.sitePostalCode,
  ]);

  const handleSubmit = async (data: QuoteFormValues) => {
    if (!user) {
      toast({
        title: "Authentification requise",
        description: "Veuillez vous connecter pour créer un devis.",
        variant: "destructive",
      });
      return;
    }

    try {
      const normalizedLineItems: QuoteLineItem[] | undefined = data.line_items.length
        ? data.line_items.map((item) => ({
            reference: item.reference?.trim() ? item.reference.trim() : undefined,
            description: item.description.trim(),
            quantity: Number(item.quantity) || 0,
            unitPrice: Number(item.unit_price) || 0,
            taxRate:
              item.tax_rate === undefined || item.tax_rate === null
                ? undefined
                : Number(item.tax_rate),
          }))
        : undefined;

      const normalizedAmount = normalizedLineItems?.length
        ? normalizedLineItems.reduce((total, item) => total + item.quantity * item.unitPrice, 0)
        : data.amount;

      const toOptionalString = (value?: string) => {
        if (!value) return undefined;
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
      };

      const driveFileUrl = quoteDriveFile?.webViewLink ?? quoteDriveFile?.webContentLink ?? undefined;

      const metadata: QuoteMetadata = {
        clientEmail: toOptionalString(data.client_email),
        clientPhone: toOptionalString(data.client_phone),
        clientSiren: toOptionalString(data.client_siren),
        siteAddress: toOptionalString(data.site_address),
        siteCity: toOptionalString(data.site_city),
        sitePostalCode: toOptionalString(data.site_postal_code),
        paymentTerms: toOptionalString(data.payment_terms),
        driveFolderUrl: toOptionalString(data.drive_folder_url),
        emailMessage: toOptionalString(data.email_message),
        internalNotes: toOptionalString(data.notes),
        lineItems: normalizedLineItems && normalizedLineItems.length > 0 ? normalizedLineItems : undefined,
        driveFileUrl,
        driveFileId: driveFileUrl ? quoteDriveFile?.id : undefined,
        driveFileName: driveFileUrl ? quoteDriveFile?.name : undefined,
      };

      const cleanedMetadataEntries = Object.entries(metadata).filter(([_, value]) => {
        if (typeof value === "string") {
          return value.trim().length > 0;
        }

        if (Array.isArray(value)) {
          return value.length > 0;
        }

        return value !== undefined && value !== null;
      });

      const serializedMetadata =
        cleanedMetadataEntries.length > 0 ? JSON.stringify(Object.fromEntries(cleanedMetadataEntries)) : null;

      const basePayload = {
        quote_ref: data.quote_ref,
        client_name: data.client_name,
        product_name: data.product_name,
        amount: normalizedAmount,
        status: data.status,
        project_id: data.project_id || null,
        valid_until: data.valid_until || null,
        notes: serializedMetadata,
      } as const;

      const isEditMode = mode === "edit" && Boolean(quoteId);

      if (isEditMode && quoteId) {
        const { error } = await supabase
          .from("quotes")
          .update({
            ...basePayload,
            updated_at: new Date().toISOString(),
          })
          .eq("id", quoteId);

        if (error) throw error;

        toast({
          title: "Devis mis à jour",
          description: "Le devis a été modifié avec succès.",
        });
      } else {
        const { error } = await supabase.from("quotes").insert([
          {
            user_id: user.id,
            org_id: currentOrgId ?? null,
            ...basePayload,
          },
        ]);

        if (error) throw error;

        toast({
          title: "Devis créé",
          description: "Le devis a été ajouté avec succès.",
        });
      }

      setDialogOpen(false);
      form.reset(baseDefaultValues);
      setQuoteDriveFile(null);
      setIsManualSiteAddress(false);
      await onQuoteAdded?.();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Une erreur inattendue est survenue lors de la création du devis.";

      toast({
        title: "Erreur",
        description: message,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Modifier le devis" : "Nouveau devis"}</DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Mettez à jour les informations du devis et regénérez-le si nécessaire."
              : "Renseignez les informations du devis à créer."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-8">
            <section className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="quote_ref"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Référence *</FormLabel>
                      <FormControl>
                        <Input placeholder="DEV-2024-001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Statut *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner un statut" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {quoteStatuses.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status}
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
                  name="client_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Client *</FormLabel>
                      <FormControl>
                        <Input placeholder="Société Martin" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="product_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Solution proposée *</FormLabel>
                      <FormControl>
                        <Input placeholder="Isolation toiture" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Montant HT *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="15000"
                          {...field}
                          onChange={(event) => field.onChange(event.target.value)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="valid_until"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Validité</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground">Coordonnées client</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="client_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email du client</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="client@exemple.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="client_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Téléphone</FormLabel>
                      <FormControl>
                        <Input placeholder="06 12 34 56 78" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="client_siren"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SIRET/SIREN</FormLabel>
                    <FormControl>
                      <Input placeholder="123 456 789 00012" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="site_address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Adresse du chantier</FormLabel>
                    <FormControl>
                      <AddressAutocomplete
                        value={field.value ?? ""}
                        onChange={(address, city, postalCode, options) => {
                          const isManual = options?.manual ?? false;
                          setIsManualSiteAddress(isManual);
                          field.onChange(address);
                          form.setValue("site_city", city ?? "", {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                          form.setValue("site_postal_code", postalCode ?? "", {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                        }}
                        disabled={form.formState.isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="site_city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ville du chantier</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          readOnly={!isManualSiteAddress}
                          disabled={form.formState.isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="site_postal_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code postal</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          readOnly={!isManualSiteAddress}
                          disabled={form.formState.isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground">Projet associé</h3>
              <FormField
                control={form.control}
                name="project_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Projet associé</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value === "none" ? undefined : value)}
                      value={field.value ?? "none"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un projet" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Aucun projet</SelectItem>
                        {projectOptions.length === 0 ? (
                          <SelectItem value="no-project" disabled>
                            Aucun projet disponible
                          </SelectItem>
                        ) : (
                          projectOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              <div className="flex flex-col">
                                <span className="font-medium">{option.label}</span>
                                <span className="text-xs text-muted-foreground">{option.description}</span>
                              </div>
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground">Lignes du devis</h3>
                <Button type="button" variant="outline" size="sm" onClick={() => append(createEmptyLineItem())}>
                  <Plus className="mr-2 h-4 w-4" /> Ajouter une ligne
                </Button>
              </div>

              {fields.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Glissez-déposez les lignes pour personnaliser l&apos;ordre d&apos;affichage du devis.
                </p>
              ) : null}

              <div className="space-y-3">
                {fields.length === 0 ? (
                  <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Ajoutez des lignes pour détailler votre devis.
                  </div>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleLineItemsDragEnd}
                  >
                    <SortableContext items={lineItemIds} strategy={verticalListSortingStrategy}>
                      {fields.map((fieldItem, index) => (
                        <SortableQuoteLineItem
                          key={fieldItem.id}
                          field={fieldItem}
                          index={index}
                          control={form.control}
                          remove={remove}
                          getValues={form.getValues}
                        />
                      ))}
                    </SortableContext>
                  </DndContext>
                )}
              </div>

              <div className="flex justify-end">
                <div className="rounded-md border bg-background px-4 py-3 text-right text-sm">
                  <p className="text-muted-foreground">Total lignes HT</p>
                  <p className="text-base font-semibold">{formatQuoteCurrency(lineItemsSubtotal)}</p>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground">Conditions commerciales</h3>
              <FormField
                control={form.control}
                name="payment_terms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Modalités de paiement</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Ex : 30% à la commande, 40% en cours, 30% à la réception"
                        className="min-h-[80px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="drive_folder_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lien dossier Google Drive</FormLabel>
                    <FormControl>
                      <Input placeholder="https://drive.google.com/" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="space-y-2">
                <FormLabel>Document du devis (PDF)</FormLabel>
                <DriveFileUploader
                  orgId={currentOrgId}
                  value={quoteDriveFile}
                  onChange={setQuoteDriveFile}
                  accept="application/pdf"
                  maxSizeMb={25}
                  entityType="quote"
                  description="Document de devis généré via Ecoprorenov"
                  helperText="Le fichier est automatiquement stocké dans le Drive de l'organisation."
                  disabled={form.formState.isSubmitting}
                />
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground">Communication client</h3>
              <FormField
                control={form.control}
                name="email_message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Message email</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Message personnalisé envoyé avec le devis"
                        className="min-h-[80px]"
                        {...field}
                      />
                    </FormControl>
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
                        placeholder="Conditions particulières, informations complémentaires..."
                        className="min-h-[100px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit">
                <PlusCircle className="w-4 h-4 mr-2" />
                Créer le devis
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default AddQuoteDialog;
