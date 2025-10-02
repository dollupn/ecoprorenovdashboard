import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import * as z from "zod";
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
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

type ProductCatalogEntry = Tables<"product_catalog">;
type Profile = Tables<"profiles">;
type SelectOption = {
  value: string;
  label: string;
  description?: string;
};

const projectSchema = z.object({
  project_ref: z.string().min(3, "La référence est requise"),
  client_name: z.string().min(2, "Le nom du client est requis"),
  company: z.string().optional(),
  phone: z.string().optional(),
  product_name: z.string().min(2, "Le produit est requis"),
  city: z.string().min(2, "La ville est requise"),
  postal_code: z.string().min(5, "Code postal invalide"),
  building_type: z.string().optional(),
  usage: z.string().optional(),
  prime_cee: z.coerce.number().optional(),
  discount: z.coerce.number().optional(),
  unit_price: z.coerce.number().optional(),
  signatory_name: z.string().optional(),
  signatory_title: z.string().optional(),
  surface_batiment_m2: z.coerce.number().optional(),
  surface_isolee_m2: z.coerce.number().optional(),
  status: z.enum(["PROSPECTION", "ETUDE", "DEVIS_ENVOYE", "ACCEPTE", "A_PLANIFIER", "EN_COURS", "LIVRE", "CLOTURE"]),
  assigned_to: z.string().min(2, "Assignation requise"),
  date_debut_prevue: z.string().optional(),
  date_fin_prevue: z.string().optional(),
  estimated_value: z.coerce.number().optional(),
  lead_id: z.string().optional(),
});

export type ProjectFormValues = z.infer<typeof projectSchema>;

interface AddProjectDialogProps {
  onProjectAdded?: () => void | Promise<void>;
  trigger?: ReactNode;
  initialValues?: Partial<ProjectFormValues>;
}

const baseDefaultValues: ProjectFormValues = {
  project_ref: "",
  client_name: "",
  company: "",
  phone: "",
  product_name: "",
  city: "",
  postal_code: "",
  building_type: "",
  usage: "",
  prime_cee: undefined,
  discount: undefined,
  unit_price: undefined,
  signatory_name: "",
  signatory_title: "",
  surface_batiment_m2: undefined,
  surface_isolee_m2: undefined,
  status: "PROSPECTION",
  assigned_to: "",
  date_debut_prevue: "",
  date_fin_prevue: "",
  estimated_value: undefined,
  lead_id: undefined,
};

export const AddProjectDialog = ({
  onProjectAdded,
  trigger,
  initialValues,
}: AddProjectDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, user_id")
        .eq("user_id", user.id)
        .maybeSingle<Profile>();

      if (error) throw error;
      return data ?? null;
    },
    enabled: Boolean(user?.id),
  });

  const {
    data: salesRepsData,
    isLoading: salesRepsLoading,
    error: salesRepsError,
  } = useQuery({
    queryKey: ["profiles-sales-reps", user?.id],
    queryFn: async () => {
      if (!user) return [] as Profile[];

      const { data, error } = await supabase
        .from("profiles")
        .select("id, user_id, full_name")
        .order("full_name", { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(user?.id),
  });

  const {
    data: productsData,
    isLoading: productsLoading,
    error: productsError,
  } = useQuery({
    queryKey: ["product-catalog", user?.id],
    queryFn: async () => {
      if (!user) return [] as ProductCatalogEntry[];

      const { data, error } = await supabase
        .from("product_catalog")
        .select("id, name, code, category, is_active, owner_id")
        .eq("owner_id", user.id)
        .order("name", { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(user?.id),
  });

  useEffect(() => {
    if (salesRepsError) {
      const message =
        salesRepsError instanceof Error
          ? salesRepsError.message
          : "Impossible de charger les commerciaux";
      toast({
        title: "Erreur",
        description: message,
        variant: "destructive",
      });
    }
  }, [salesRepsError, toast]);

  useEffect(() => {
    if (productsError) {
      const message =
        productsError instanceof Error
          ? productsError.message
          : "Impossible de charger les produits";
      toast({
        title: "Erreur",
        description: message,
        variant: "destructive",
      });
    }
  }, [productsError, toast]);

  const rawCommercialOptions = useMemo(() => {
    if (!salesRepsData) return [] as SelectOption[];

    return salesRepsData
      .filter((rep) => rep.full_name)
      .map((rep) => ({
        value: rep.full_name!,
        label: rep.full_name!,
        description: undefined,
      })) as SelectOption[];
  }, [salesRepsData]);

  const rawProductOptions = useMemo(() => {
    if (!productsData) return [] as SelectOption[];

    return productsData
      .filter((product) => product.is_active !== false)
      .map((product) => ({
        value: product.name,
        label: product.name,
        description: product.code ?? undefined,
      })) as SelectOption[];
  }, [productsData]);

  const defaultAssignee = useMemo(() => {
    if (initialValues?.assigned_to) {
      return initialValues.assigned_to;
    }

    if (salesRepsData && salesRepsData.length > 0) {
      const firstProfile = salesRepsData.find((rep) => rep.full_name);
      if (firstProfile?.full_name) {
        return firstProfile.full_name;
      }
    }

    if (profile?.full_name && profile.full_name.trim().length > 0) {
      return profile.full_name;
    }

    const metadataName =
      typeof user?.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name.trim()
        : "";

    if (metadataName) {
      return metadataName;
    }

    return user?.email ?? "";
  }, [initialValues?.assigned_to, profile?.full_name, salesRepsData, user?.email, user?.user_metadata?.full_name]);

  const commercialOptions = useMemo(() => {
    if (!defaultAssignee) {
      return rawCommercialOptions;
    }

    const exists = rawCommercialOptions.some((option) => option.value === defaultAssignee);
    if (exists) {
      return rawCommercialOptions;
    }

    return [
      {
        value: defaultAssignee,
        label: defaultAssignee,
        description: user?.email ?? undefined,
      },
      ...rawCommercialOptions,
    ];
  }, [defaultAssignee, rawCommercialOptions, user?.email]);

  const productOptions = useMemo(() => {
    const options = [...rawProductOptions];
    const initialProductName = initialValues?.product_name?.trim();

    if (initialProductName && !options.some((option) => option.value === initialProductName)) {
      options.unshift({ value: initialProductName, label: initialProductName });
    }

    return options;
  }, [initialValues?.product_name, rawProductOptions]);

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      ...baseDefaultValues,
      ...initialValues,
      assigned_to: initialValues?.assigned_to ?? defaultAssignee ?? "",
      product_name:
        initialValues?.product_name ??
        (productOptions.length > 0 ? productOptions[0].value : ""),
    },
  });

  const resetWithInitialValues = useCallback(() => {
    form.reset({
      ...baseDefaultValues,
      ...initialValues,
      assigned_to: initialValues?.assigned_to ?? defaultAssignee ?? "",
      product_name:
        initialValues?.product_name ??
        (productOptions.length > 0 ? productOptions[0].value : ""),
    });
  }, [defaultAssignee, form, initialValues, productOptions]);

  useEffect(() => {
    if (defaultAssignee && form.getValues("assigned_to") !== defaultAssignee) {
      form.setValue("assigned_to", defaultAssignee);
    }
  }, [defaultAssignee, form]);

  useEffect(() => {
    if (productOptions.length === 0) {
      return;
    }

    const currentValue = form.getValues("product_name");
    if (!currentValue) {
      form.setValue("product_name", productOptions[0].value);
    }
  }, [form, productOptions]);

  useEffect(() => {
    if (open) {
      resetWithInitialValues();
    }
  }, [open, resetWithInitialValues]);

  const onSubmit = async (data: ProjectFormValues) => {
    if (!user) {
      toast({
        title: "Erreur",
        description: "Vous devez être connecté",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("projects").insert([{
        user_id: user.id,
        project_ref: data.project_ref,
        client_name: data.client_name,
        product_name: data.product_name,
        city: data.city,
        postal_code: data.postal_code,
        status: data.status,
        assigned_to: data.assigned_to,
        company: data.company || undefined,
        phone: data.phone || undefined,
        building_type: data.building_type || undefined,
        usage: data.usage || undefined,
        prime_cee: data.prime_cee || undefined,
        discount: data.discount || undefined,
        unit_price: data.unit_price || undefined,
        signatory_name: data.signatory_name || undefined,
        signatory_title: data.signatory_title || undefined,
        surface_batiment_m2: data.surface_batiment_m2 || undefined,
        surface_isolee_m2: data.surface_isolee_m2 || undefined,
        date_debut_prevue: data.date_debut_prevue || undefined,
        date_fin_prevue: data.date_fin_prevue || undefined,
        estimated_value: data.estimated_value || undefined,
        lead_id: data.lead_id || undefined,
      }]);

      if (error) throw error;

      toast({
        title: "Projet créé",
        description: "Le projet a été ajouté avec succès",
      });

      resetWithInitialValues();
      setOpen(false);
      await onProjectAdded?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Une erreur inattendue est survenue";
      toast({
        title: "Erreur",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Nouveau Projet
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ajouter un nouveau projet</DialogTitle>
          <DialogDescription>
            Remplissez les informations du projet
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="project_ref"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Référence *</FormLabel>
                    <FormControl>
                      <Input placeholder="PRJ-2024-XXXX" {...field} />
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
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="PROSPECTION">Prospection</SelectItem>
                        <SelectItem value="ETUDE">Étude</SelectItem>
                        <SelectItem value="DEVIS_ENVOYE">Devis Envoyé</SelectItem>
                        <SelectItem value="ACCEPTE">Accepté</SelectItem>
                        <SelectItem value="A_PLANIFIER">À Planifier</SelectItem>
                        <SelectItem value="EN_COURS">En Cours</SelectItem>
                        <SelectItem value="LIVRE">Livré</SelectItem>
                        <SelectItem value="CLOTURE">Clôturé</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="client_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom du client *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Entreprise</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Téléphone</FormLabel>
                  <FormControl>
                    <Input type="tel" placeholder="+33 6 12 34 56 78" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="building_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type de bâtiment</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="usage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Usage</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="product_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Produit *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={productsLoading && productOptions.length === 0}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            productsLoading && productOptions.length === 0
                              ? "Chargement..."
                              : productOptions.length > 0
                                ? "Sélectionnez un produit"
                                : "Aucun produit disponible"
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {productsLoading && productOptions.length === 0 ? (
                        <SelectItem value="__loading" disabled>
                          Chargement...
                        </SelectItem>
                      ) : productOptions.length > 0 ? (
                        productOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex flex-col">
                              <span>{option.label}</span>
                              {option.description ? (
                                <span className="text-xs text-muted-foreground">
                                  {option.description}
                                </span>
                              ) : null}
                            </div>
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="__empty" disabled>
                          Aucun produit configuré
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ville *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="postal_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Code postal *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="surface_batiment_m2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Surface bâtiment (m²)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="surface_isolee_m2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Surface isolée (m²)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="prime_cee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prime CEE (€)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="discount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Remise (€)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unit_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prix unitaire (€)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="assigned_to"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assigné à *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={salesRepsLoading && commercialOptions.length === 0}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            salesRepsLoading && commercialOptions.length === 0
                              ? "Chargement..."
                              : commercialOptions.length > 0
                                ? "Sélectionnez un commercial"
                                : "Aucun commercial configuré"
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {salesRepsLoading && commercialOptions.length === 0 ? (
                        <SelectItem value="__loading" disabled>
                          Chargement...
                        </SelectItem>
                      ) : commercialOptions.length > 0 ? (
                        commercialOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            <div className="flex flex-col">
                              <span>{option.label}</span>
                              {option.description ? (
                                <span className="text-xs text-muted-foreground">
                                  {option.description}
                                </span>
                              ) : null}
                            </div>
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="__empty" disabled>
                          Aucun commercial configuré
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date_debut_prevue"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date de début prévue</FormLabel>
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
            </div>

            <FormField
              control={form.control}
              name="estimated_value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Montant estimé (€)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="signatory_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom du signataire</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="signatory_title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fonction du signataire</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Création..." : "Créer le projet"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
