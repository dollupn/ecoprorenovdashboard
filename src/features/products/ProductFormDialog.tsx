import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { getProjectBuildingTypes } from "@/lib/buildings";
import type { TablesInsert } from "@/integrations/supabase/types";
import type { ProductCatalogRecord, CategoryRecord, ProductKwhCumacInput } from "./api";
import { useCreateProduct, useUpdateProduct } from "./api";
import { CategoryFormDialog } from "./CategoryFormDialog";
import { RichDescription } from "./RichDescription";
import { TechnicalSheetUpload } from "./TechnicalSheetUpload";
import { DynamicFieldsEditor } from "./DynamicFieldsEditor";

const euroFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

const kwhValueSchema = z
  .number({ invalid_type_error: "Saisissez un nombre valide" })
  .min(0, "La valeur doit être positive")
  .nullable();

const productSchema = z.object({
  name: z.string().min(2, "Le nom est requis").max(200),
  code: z.string().max(120).optional(),
  category: z.string().optional().nullable(),
  description: z.string().max(15000, "La description ne peut pas dépasser 15 000 caractères").optional(),
  custom_description_primary: z
    .string()
    .max(15000, "La description ne peut pas dépasser 15 000 caractères")
    .optional()
    .nullable(),
  custom_description_secondary: z
    .string()
    .max(15000, "La description ne peut pas dépasser 15 000 caractères")
    .optional()
    .nullable(),
  is_active: z.boolean().default(true),
  unit_type: z.string().optional().nullable(),
  base_price_ht: z.number().optional().nullable(),
  tva_percentage: z.number().min(0).max(100).optional().nullable(),
  prime_percentage: z.number().min(0).max(100).optional().nullable(),
  eco_admin_percentage: z.number().min(0).max(100).optional().nullable(),
  eco_furn_percentage: z.number().min(0).max(100).optional().nullable(),
  eco_log_percentage: z.number().min(0).max(100).optional().nullable(),
  supplier_name: z.string().optional().nullable(),
  supplier_reference: z.string().optional().nullable(),
  technical_sheet_url: z.string().optional().nullable(),
  params_schema: z.any().optional().nullable(),
  default_params: z.any().optional().nullable(),
  kwh_cumac: z.record(kwhValueSchema).default({}),
});

type ProductFormValues = z.infer<typeof productSchema>;

type ProductFormDialogProps = {
  orgId: string | null;
  categories: CategoryRecord[];
  productTypes: string[];
  product?: ProductCatalogRecord | null;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export const ProductFormDialog = ({
  orgId,
  categories,
  product,
  trigger,
  open: openProp,
  onOpenChange,
}: ProductFormDialogProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const { toast } = useToast();
  const buildingTypes = useMemo(() => getProjectBuildingTypes(), []);
  const allBuildingTypes = useMemo(() => {
    const fromProduct = product?.kwh_cumac_values?.map((entry) => entry.building_type?.trim()).filter((value): value is string =>
      Boolean(value),
    ) ?? [];
    const ordered = new Set<string>();
    buildingTypes.forEach((type) => {
      const trimmed = type.trim();
      if (trimmed) {
        ordered.add(trimmed);
      }
    });
    fromProduct.forEach((type) => {
      const trimmed = type.trim();
      if (trimmed) {
        ordered.add(trimmed);
      }
    });
    return Array.from(ordered);
  }, [buildingTypes, product?.kwh_cumac_values]);
  const createProduct = useCreateProduct(orgId);
  const updateProduct = useUpdateProduct(orgId);

  const defaultValues = useMemo<ProductFormValues>(
    () => ({
      name: product?.name ?? "",
      code: product?.code ?? "",
      category: product?.category ?? null,
      description: product?.description ?? "",
      custom_description_primary: product?.custom_description_primary ?? "",
      custom_description_secondary: product?.custom_description_secondary ?? "",
      is_active: product?.is_active ?? true,
      unit_type: product?.unit_type ?? null,
      base_price_ht: product?.base_price_ht ?? null,
      tva_percentage: product?.tva_percentage ?? 8.5,
      prime_percentage: product?.prime_percentage ?? 0,
      eco_admin_percentage: product?.eco_admin_percentage ?? 15,
      eco_furn_percentage: product?.eco_furn_percentage ?? 5,
      eco_log_percentage: product?.eco_log_percentage ?? 0,
      supplier_name: product?.supplier_name ?? null,
      supplier_reference: product?.supplier_reference ?? null,
      technical_sheet_url: product?.technical_sheet_url ?? null,
      params_schema: product?.params_schema ?? null,
      default_params: product?.default_params ?? null,
      kwh_cumac: allBuildingTypes.reduce<Record<string, number | null>>((acc, type) => {
        const match = product?.kwh_cumac_values?.find(
          (entry) => entry.building_type?.trim() === type,
        );
        acc[type] = match?.kwh_cumac ?? null;
        return acc;
      }, {}),
    }),
    [product, allBuildingTypes],
  );

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues,
  });

  const isControlled = openProp !== undefined;
  const open = isControlled ? Boolean(openProp) : internalOpen;

  useEffect(() => {
    if (open) {
      form.reset(defaultValues);
    }
  }, [open, defaultValues, form]);

  const setOpen = (next: boolean) => {
    if (!isControlled) {
      setInternalOpen(next);
    }
    onOpenChange?.(next);
    if (!next) {
      form.reset(defaultValues);
    }
  };

  const onSubmit = async (values: ProductFormValues) => {
    if (!orgId) {
      toast({ 
        title: "Organisation manquante", 
        description: "Vous devez être membre d'une organisation pour créer des produits", 
        variant: "destructive" 
      });
      return;
    }

    const payload: TablesInsert<"product_catalog"> = {
      org_id: orgId,
      owner_id: orgId,
      name: values.name.trim(),
      code: values.code?.trim() || "",
      category: values.category,
      description: values.description?.trim() || null,
      custom_description_primary: values.custom_description_primary?.trim() || null,
      custom_description_secondary: values.custom_description_secondary?.trim() || null,
      is_active: values.is_active,
      unit_type: values.unit_type,
      base_price_ht: values.base_price_ht,
      tva_percentage: values.tva_percentage,
      prime_percentage: values.prime_percentage ?? 0,
      eco_admin_percentage: values.eco_admin_percentage ?? 0,
      eco_furn_percentage: values.eco_furn_percentage ?? 0,
      eco_log_percentage: values.eco_log_percentage ?? 0,
      supplier_name: values.supplier_name?.trim() || null,
      supplier_reference: values.supplier_reference?.trim() || null,
      technical_sheet_url: values.technical_sheet_url,
      params_schema: values.params_schema,
      default_params: values.default_params,
    };

    const kwhValues = values.kwh_cumac ?? {};
    const kwhEntries: ProductKwhCumacInput[] = Array.from(
      new Set([
        ...allBuildingTypes,
        ...Object.keys(kwhValues),
      ].map((type) => type.trim()).filter((type) => type.length > 0)),
    ).map((type) => ({
      building_type: type,
      kwh_cumac: kwhValues[type] ?? null,
    }));

    try {
      if (product) {
        await updateProduct.mutateAsync({ id: product.id, values: payload, kwhCumac: kwhEntries });
        toast({ title: "Produit modifié", description: `${values.name} a été mis à jour` });
      } else {
        await createProduct.mutateAsync({ values: payload, kwhCumac: kwhEntries });
        toast({ title: "Produit créé", description: `${values.name} a été ajouté au catalogue` });
      }
      setOpen(false);
      form.reset(defaultValues);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Impossible de sauvegarder le produit";
      toast({ title: "Erreur", description: message, variant: "destructive" });
    }
  };

  const isSubmitting = form.formState.isSubmitting;

  const priceTTC = useMemo(() => {
    const basePrice = form.watch("base_price_ht");
    const tva = form.watch("tva_percentage");
    if (basePrice && tva !== null && tva !== undefined) {
      return basePrice * (1 + tva / 100);
    }
    return null;
  }, [form.watch("base_price_ht"), form.watch("tva_percentage")]);

  const ecoEstimation = useMemo(() => {
    const basePrice = form.watch("base_price_ht");
    if (basePrice === null || basePrice === undefined) {
      return null;
    }

    const prime = form.watch("prime_percentage") ?? 0;
    const admin = form.watch("eco_admin_percentage") ?? 0;
    const furn = form.watch("eco_furn_percentage") ?? 0;
    const log = form.watch("eco_log_percentage") ?? 0;

    const safeBase = Number(basePrice);
    if (Number.isNaN(safeBase)) {
      return null;
    }

    const totalPercent = Number(prime || 0) + Number(admin || 0) + Number(furn || 0) + Number(log || 0);
    const ecoCharges = safeBase * (totalPercent / 100);
    const totalWithEco = safeBase + ecoCharges;

    return {
      totalPercent,
      ecoCharges,
      totalWithEco,
    };
  }, [
    form.watch("base_price_ht"),
    form.watch("prime_percentage"),
    form.watch("eco_admin_percentage"),
    form.watch("eco_furn_percentage"),
    form.watch("eco_log_percentage"),
  ]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{product ? "Modifier le produit" : "Nouveau produit"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 overflow-y-auto">
            <Tabs defaultValue="general" className="space-y-6 px-1">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="general">Général</TabsTrigger>
                <TabsTrigger value="pricing">Tarification</TabsTrigger>
                <TabsTrigger value="cee">CEE</TabsTrigger>
                <TabsTrigger value="dynamic">Champs dynamiques</TabsTrigger>
              </TabsList>

              <TabsContent value="general" className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Nom du produit" disabled={isSubmitting} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Code produit" disabled={isSubmitting} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex items-center gap-2">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>Catégorie</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value ?? "null"}
                          onValueChange={(value) => field.onChange(value === "null" ? null : value)}
                          disabled={isSubmitting}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choisir une catégorie" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="null">Aucune</SelectItem>
                            {categories.map((category) => (
                              <SelectItem key={category.id} value={category.name}>
                                {category.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <CategoryFormDialog
                  orgId={orgId}
                  trigger={
                    <Button type="button" variant="outline" size="sm" className="gap-2 whitespace-nowrap mt-8">
                      <Plus className="h-4 w-4" /> Catégorie
                    </Button>
                  }
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <RichDescription
                        value={field.value ?? ""}
                        onChange={(value) => field.onChange(value)}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="custom_description_primary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description personnalisée — bloc 1</FormLabel>
                    <FormControl>
                      <RichDescription
                        value={field.value ?? ""}
                        onChange={(value) => field.onChange(value)}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground px-1">
                      Contenu additionnel utilisé pour enrichir les devis (section principale).
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="custom_description_secondary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description personnalisée — bloc 2</FormLabel>
                    <FormControl>
                      <RichDescription
                        value={field.value ?? ""}
                        onChange={(value) => field.onChange(value)}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground px-1">
                      Deuxième bloc de description pour les annexes ou précisions techniques.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Produit actif</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Ce produit sera visible dans les formulaires
                      </div>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} disabled={isSubmitting} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </TabsContent>

            <TabsContent value="pricing" className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="unit_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type d'unité</FormLabel>
                      <FormControl>
                        <Select
                          value={field.value ?? "null"}
                          onValueChange={(value) => field.onChange(value === "null" ? null : value)}
                          disabled={isSubmitting}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choisir une unité" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="null">Aucune</SelectItem>
                            <SelectItem value="m²">m²</SelectItem>
                            <SelectItem value="unité">Unité</SelectItem>
                            <SelectItem value="kit">Kit</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="base_price_ht"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prix de base HT</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                          placeholder="0.00"
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="tva_percentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>TVA (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                          placeholder="8.5"
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div>
                  <FormLabel>Prix TTC (calculé)</FormLabel>
                  <Input
                    value={priceTTC ? priceTTC.toFixed(2) + " €" : "—"}
                    disabled
                    className="bg-muted mt-2"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <FormField
                  control={form.control}
                  name="prime_percentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Part prime (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                          placeholder="0"
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground px-1">Pourcentage appliqué pour caler le prix prime.</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="eco_admin_percentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ECO-ADMN (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                          placeholder="15"
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground px-1">Frais administratifs (par défaut 15%).</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="eco_furn_percentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ECO-FURN (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                          placeholder="5"
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground px-1">Frais de fourniture (par défaut 5%).</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="eco_log_percentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ECO-LOG (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.1"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                          placeholder="0"
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground px-1">Logistique (défaut 0% - gratuit).</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <FormLabel className="text-sm font-medium">Estimation charges ECO</FormLabel>
                  {ecoEstimation ? (
                    <span className="text-xs text-muted-foreground">
                      {ecoEstimation.totalPercent.toFixed(2)}%
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  Calcul basé sur le prix HT et les pourcentages configurés ci-dessus.
                </p>
                {ecoEstimation ? (
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center justify-between">
                      <span>Montant charges</span>
                      <span>{euroFormatter.format(ecoEstimation.ecoCharges)}</span>
                    </div>
                    <div className="flex items-center justify-between font-medium">
                      <span>Total HT (produit + charges)</span>
                      <span>{euroFormatter.format(ecoEstimation.totalWithEco)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Saisissez un prix de base pour obtenir une estimation.
                  </p>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="supplier_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fournisseur</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          placeholder="Nom du fournisseur"
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="supplier_reference"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Référence fournisseur</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value ?? ""}
                          placeholder="Référence"
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="technical_sheet_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fiche technique (PDF)</FormLabel>
                    <FormControl>
                      <TechnicalSheetUpload
                        orgId={orgId}
                        productId={product?.id}
                        currentUrl={field.value}
                        onUrlChange={field.onChange}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </TabsContent>

            <TabsContent value="cee" className="space-y-6">
              <div>
                <h3 className="text-sm font-medium">kWh cumac</h3>
                <p className="text-xs text-muted-foreground">
                  Renseignez la valeur kWh cumac associée à chaque typologie de bâtiment. Laissez vide si la donnée n&apos;est pas connue.
                </p>
              </div>
              {allBuildingTypes.length > 0 ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {allBuildingTypes.map((type) => (
                    <FormField
                      key={type}
                      control={form.control}
                      name={`kwh_cumac.${type}` as const}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{type}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              step="any"
                              value={field.value ?? ""}
                              onChange={(event) => {
                                const value = event.target.value;
                                if (value === "") {
                                  field.onChange(null);
                                  return;
                                }
                                const parsed = Number(value);
                                if (Number.isNaN(parsed)) {
                                  return;
                                }
                                field.onChange(parsed);
                              }}
                              onBlur={field.onBlur}
                              disabled={isSubmitting}
                              inputMode="decimal"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Aucun type de bâtiment n&apos;a encore été défini. Configurez-les dans les paramètres projets pour activer la saisie des kWh cumac.
                </p>
              )}
            </TabsContent>

            <TabsContent value="dynamic" className="space-y-6">
              <FormField
                control={form.control}
                name="params_schema"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <DynamicFieldsEditor
                        value={{
                          schema: (form.watch("params_schema") as any) || [],
                          defaults: (form.watch("default_params") as any) || {},
                        }}
                        onChange={(value) => {
                          form.setValue("params_schema", value.schema);
                          form.setValue("default_params", value.defaults);
                        }}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </TabsContent>
            </Tabs>

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
                Annuler
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {product ? "Modifier" : "Créer"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
