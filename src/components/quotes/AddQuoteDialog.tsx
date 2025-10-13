import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import * as z from "zod";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useOrg } from "@/features/organizations/OrgContext";
import { useToast } from "@/hooks/use-toast";

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
import { Plus, PlusCircle, Trash2 } from "lucide-react";

import { formatQuoteCurrency } from "./utils";
import type { QuoteLineItem, QuoteMetadata } from "./types";

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
  site_address: z.string().optional(),
  payment_terms: z.string().optional(),
  drive_folder_url: z.string().url("URL invalide").optional().or(z.literal("")),
  email_message: z.string().optional(),
  line_items: z.array(lineItemSchema).default([]),
});

export type QuoteFormValues = z.infer<typeof quoteSchema>;

type ProjectOption = Pick<Tables<"projects">, "id" | "project_ref" | "client_name">;

export interface AddQuoteDialogProps {
  onQuoteAdded?: () => void | Promise<void>;
  trigger?: ReactNode;
  initialValues?: Partial<QuoteFormValues>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const createEmptyLineItem = (): QuoteFormValues["line_items"][number] => ({
  reference: "",
  description: "",
  quantity: 1,
  unit_price: 0,
  tax_rate: 0,
});

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
  site_address: "",
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
}: AddQuoteDialogProps) => {
  const { user } = useAuth();
  const { currentOrgId } = useOrg();
  const { toast } = useToast();

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

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "line_items",
  });

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
        .select("id, project_ref, client_name")
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
        description: project.client_name,
      })),
    [projects]
  );

  useEffect(() => {
    if (!dialogOpen) {
      form.reset(baseDefaultValues);
      return;
    }

    const values: QuoteFormValues = {
      ...baseDefaultValues,
      ...initialValues,
    } as QuoteFormValues;

    if (typeof initialValues?.amount === "number") {
      values.amount = initialValues.amount.toString() as unknown as number;
    }

    if (!values.quote_ref) {
      values.quote_ref = generateQuoteReference();
    }

    if (!values.line_items || values.line_items.length === 0) {
      values.line_items = [createEmptyLineItem()];
    }

    form.reset(values);
  }, [dialogOpen, initialValues, form]);

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

      const metadata: QuoteMetadata = {
        clientEmail: toOptionalString(data.client_email),
        clientPhone: toOptionalString(data.client_phone),
        siteAddress: toOptionalString(data.site_address),
        paymentTerms: toOptionalString(data.payment_terms),
        driveFolderUrl: toOptionalString(data.drive_folder_url),
        emailMessage: toOptionalString(data.email_message),
        internalNotes: toOptionalString(data.notes),
        lineItems: normalizedLineItems && normalizedLineItems.length > 0 ? normalizedLineItems : undefined,
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

      const { error } = await supabase.from("quotes").insert([
        {
          user_id: user.id,
          org_id: currentOrgId ?? null,
          quote_ref: data.quote_ref,
          client_name: data.client_name,
          product_name: data.product_name,
          amount: normalizedAmount,
          status: data.status,
          project_id: data.project_id || null,
          valid_until: data.valid_until || null,
          notes: serializedMetadata,
        },
      ]);

      if (error) throw error;

      toast({
        title: "Devis créé",
        description: "Le devis a été ajouté avec succès.",
      });

      setDialogOpen(false);
      form.reset(baseDefaultValues);
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
          <DialogTitle>Nouveau devis</DialogTitle>
          <DialogDescription>
            Renseignez les informations du devis à créer.
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
                name="site_address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Adresse du chantier</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Adresse complète du site"
                        className="min-h-[80px]"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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

              <div className="space-y-3">
                {fields.length === 0 ? (
                  <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                    Ajoutez des lignes pour détailler votre devis.
                  </div>
                ) : (
                  fields.map((fieldItem, index) => (
                    <div key={fieldItem.id} className="space-y-3 rounded-md border bg-background p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="flex-1 grid grid-cols-1 gap-3 md:grid-cols-2">
                          <FormField
                            control={form.control}
                            name={`line_items.${index}.reference`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Référence</FormLabel>
                                <FormControl>
                                  <Input placeholder="REF-001" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`line_items.${index}.quantity`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Quantité</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    {...field}
                                    onChange={(event) => field.onChange(event.target.valueAsNumber)}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <FormField
                        control={form.control}
                        name={`line_items.${index}.description`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description *</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Détaillez la prestation proposée"
                                className="min-h-[80px]"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <FormField
                          control={form.control}
                          name={`line_items.${index}.unit_price`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Prix unitaire HT</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  {...field}
                                  onChange={(event) => field.onChange(event.target.valueAsNumber)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`line_items.${index}.tax_rate`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>TVA %</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  {...field}
                                  onChange={(event) => field.onChange(event.target.valueAsNumber)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <div className="flex flex-col justify-end">
                          <p className="text-sm text-muted-foreground">Sous-total</p>
                          <p className="text-base font-semibold">
                            {formatQuoteCurrency(
                              (Number(form.getValues(`line_items.${index}.quantity`)) || 0) *
                                (Number(form.getValues(`line_items.${index}.unit_price`)) || 0)
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
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
