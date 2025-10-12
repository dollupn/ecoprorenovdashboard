import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useOrg } from "@/features/organizations/OrgContext";
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
import { Plus, X } from "lucide-react";
import { DynamicFields } from "@/features/leads/DynamicFields";

type ProductCatalogEntry = Tables<"product_catalog">;
type Profile = Tables<"profiles">;
type SelectOption = {
  value: string;
  label: string;
  description?: string;
};

type ProjectProduct = {
  product_id: string;
  quantity: number;
  dynamic_params: Record<string, any>;
};

const projectSchema = z.object({
  client_name: z.string().min(2, "Le nom du client est requis"),
  company: z.string().optional(),
  phone: z.string().optional(),
  products: z.array(z.object({
    product_id: z.string().min(1, "Le produit est requis"),
    quantity: z.coerce.number().min(1, "La quantité doit être >= 1").default(1),
    dynamic_params: z.record(z.any()).optional(),
  })).min(1, "Au moins un produit est requis"),
  city: z.string().min(2, "La ville est requise"),
  postal_code: z.string().min(5, "Code postal invalide"),
  building_type: z.enum(["Entrepôt", "Hôtel"], { required_error: "Sélectionnez un type" }),
  usage: z.enum(["Commercial", "Agricole"], { required_error: "Sélectionnez un usage" }),
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

const baseDefaultValues: Partial<ProjectFormValues> = {
  client_name: "",
  company: "",
  phone: "",
  products: [{ product_id: "", quantity: 1, dynamic_params: {} }],
  city: "",
  postal_code: "",
  building_type: undefined,
  usage: undefined,
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

// Fonction pour initialiser les champs dynamiques avec les valeurs par défaut
const getInitialDynamicParams = (product: any) => {
  if (!product?.params_schema) return {};
  const schema = product.params_schema as any;
  const initialParams: Record<string, any> = {};
  
  if (schema.fields && Array.isArray(schema.fields)) {
    schema.fields.forEach((field: any) => {
      if (product.default_params && typeof product.default_params === 'object' && field.name in product.default_params) {
        initialParams[field.name] = (product.default_params as any)[field.name];
      } else {
        initialParams[field.name] = field.type === "number" ? 0 : "";
      }
    });
  }
  
  return initialParams;
};

export const AddProjectDialog = ({
  onProjectAdded,
  trigger,
  initialValues,
}: AddProjectDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { currentOrgId } = useOrg();
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
    queryKey: ["product-catalog", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return [] as ProductCatalogEntry[];

      const { data, error } = await supabase
        .from("product_catalog")
        .select("id, name, code, category, is_active, params_schema, default_params")
        .eq("org_id", currentOrgId)
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(currentOrgId),
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
        value: product.id ?? "",
        label: product.name ?? "Produit",
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

  const productOptions = rawProductOptions;

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      ...baseDefaultValues,
      assigned_to: defaultAssignee ?? "",
      products: [{ product_id: productOptions.length > 0 ? productOptions[0].value : "", quantity: 1, dynamic_params: {} }],
    } as ProjectFormValues,
  });

  const addProduct = () => {
    const currentProducts = form.getValues("products") || [];
    form.setValue("products", [...currentProducts, { product_id: "", quantity: 1, dynamic_params: {} }]);
  };

  const removeProduct = (index: number) => {
    const currentProducts = form.getValues("products") || [];
    if (currentProducts.length > 1) {
      form.setValue("products", currentProducts.filter((_, i) => i !== index));
    }
  };

  const resetWithInitialValues = useCallback(() => {
    form.reset({
      ...baseDefaultValues,
      assigned_to: defaultAssignee ?? "",
      products: [{ product_id: productOptions.length > 0 ? productOptions[0].value : "", quantity: 1, dynamic_params: {} }],
    } as ProjectFormValues);
  }, [defaultAssignee, form, productOptions]);

  useEffect(() => {
    if (defaultAssignee && form.getValues("assigned_to") !== defaultAssignee) {
      form.setValue("assigned_to", defaultAssignee);
    }
  }, [defaultAssignee, form]);

  useEffect(() => {
    if (open) {
      resetWithInitialValues();
    }
  }, [open, resetWithInitialValues]);

  const onSubmit = async (data: ProjectFormValues) => {
    if (!user || !currentOrgId) {
      toast({
        title: "Erreur",
        description: "Vous devez être connecté",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Générer la référence automatiquement format ECOP-Date-Number
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
      
      // Récupérer le dernier projet du jour pour incrémenter le numéro
      const { data: existingProjects } = await supabase
        .from("projects")
        .select("project_ref")
        .eq("org_id", currentOrgId)
        .like("project_ref", `ECOP-${dateStr}-%`)
        .order("created_at", { ascending: false })
        .limit(1);

      let nextNumber = 1;
      if (existingProjects && existingProjects.length > 0) {
        const lastRef = existingProjects[0].project_ref;
        const lastNumber = parseInt(lastRef.split('-')[2] || "0");
        nextNumber = lastNumber + 1;
      }

      const project_ref = `ECOP-${dateStr}-${nextNumber.toString().padStart(3, '0')}`;
      
      // Récupérer le nom du premier produit pour product_name (legacy)
      const firstProduct = productsData?.find(p => p.id === data.products[0]?.product_id);
      const product_name = firstProduct?.name || "";

      // Créer le projet
      const { data: createdProject, error: projectError } = await supabase
        .from("projects")
        .insert([{
          user_id: user.id,
          org_id: currentOrgId,
          project_ref,
          client_name: data.client_name,
          product_name, // Pour compatibilité
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
        }])
        .select()
        .single();

      if (projectError) throw projectError;

      // Ajouter les produits au projet
      const projectProducts = data.products.map(p => ({
        project_id: createdProject.id,
        product_id: p.product_id,
        quantity: p.quantity,
        dynamic_params: p.dynamic_params || {},
      }));

      const { error: productsError } = await supabase
        .from("project_products")
        .insert(projectProducts);

      if (productsError) throw productsError;

      toast({
        title: "Projet créé",
        description: `Le projet ${project_ref} avec ${data.products.length} produit(s) a été ajouté avec succès`,
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
                    <FormLabel>Type de bâtiment *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionnez un type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Entrepôt">Entrepôt</SelectItem>
                        <SelectItem value="Hôtel">Hôtel</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="usage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Usage *</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionnez un usage" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Commercial">Commercial</SelectItem>
                        <SelectItem value="Agricole">Agricole</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Produits</h3>
                <Button type="button" onClick={addProduct} size="sm" variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Ajouter un produit
                </Button>
              </div>

              {form.watch("products")?.map((_, index) => {
                const productId = form.watch(`products.${index}.product_id`);
                const selectedProduct = productsData?.find(p => p.id === productId);
                
                return (
                  <div key={index} className="border p-4 rounded-md space-y-4 relative">
                    {form.watch("products")!.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2"
                        onClick={() => removeProduct(index)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name={`products.${index}.product_id`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Produit *</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              value={field.value ?? ""}
                              disabled={productsLoading}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Sélectionnez un produit" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {productOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    <div className="flex flex-col">
                                      <span>{option.label}</span>
                                      {option.description && (
                                        <span className="text-xs text-muted-foreground">
                                          {option.description}
                                        </span>
                                      )}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name={`products.${index}.quantity`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Quantité *</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="1"
                                value={field.value ?? 1}
                                onChange={field.onChange}
                                disabled={loading}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {selectedProduct?.params_schema && (
                      <div className="space-y-4 bg-muted/30 p-3 rounded-md">
                        <h4 className="font-medium text-sm">Paramètres du produit</h4>
                        {(selectedProduct.params_schema as any).fields?.map((field: any) => (
                          <FormField
                            key={field.name}
                            control={form.control}
                            name={`products.${index}.dynamic_params.${field.name}` as any}
                            render={({ field: formField }) => (
                              <FormItem>
                                <FormLabel>
                                  {field.label}
                                  {field.required && <span className="text-destructive"> *</span>}
                                </FormLabel>
                                <FormControl>
                                  {field.type === "textarea" ? (
                                    <textarea
                                      className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                      value={formField.value || ""}
                                      onChange={(e) => formField.onChange(e.target.value)}
                                      disabled={loading}
                                      placeholder={field.placeholder || `Entrez ${field.label.toLowerCase()}`}
                                    />
                                  ) : field.type === "select" ? (
                                    <Select
                                      onValueChange={formField.onChange}
                                      value={formField.value || ""}
                                      disabled={loading}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder={`Sélectionnez ${field.label.toLowerCase()}`} />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {field.options?.map((option: string) => (
                                          <SelectItem key={option} value={option}>
                                            {option}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  ) : field.type === "number" ? (
                                    <Input
                                      type="number"
                                      value={formField.value || ""}
                                      onChange={(e) => formField.onChange(e.target.value)}
                                      disabled={loading}
                                      placeholder={field.placeholder || `Entrez ${field.label.toLowerCase()}`}
                                    />
                                  ) : (
                                    <Input
                                      type="text"
                                      value={formField.value || ""}
                                      onChange={(e) => formField.onChange(e.target.value)}
                                      disabled={loading}
                                      placeholder={field.placeholder || `Entrez ${field.label.toLowerCase()}`}
                                    />
                                  )}
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

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
