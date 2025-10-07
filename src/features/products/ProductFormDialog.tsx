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
import { useToast } from "@/hooks/use-toast";
import type { TablesInsert } from "@/integrations/supabase/types";
import type { ProductCatalogRecord, CategoryRecord } from "./api";
import { useCreateProduct, useUpdateProduct } from "./api";
import { CategoryFormDialog } from "./CategoryFormDialog";
import { RichDescription } from "./RichDescription";

const numberField = z.preprocess((value) => {
  if (value === "" || value === null || value === undefined) return undefined;
  if (typeof value === "string") {
    const normalized = value.replace(",", ".");
    const parsed = Number(normalized);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return undefined;
}, z.number({ invalid_type_error: "Valeur invalide" }).min(0, "La valeur doit être positive").optional());

const parseNumberInput = (value: string) => {
  if (value === "") return undefined;
  const normalized = value.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const productSchema = z.object({
  name: z.string().min(2, "Le nom est requis").max(200),
  sku: z.string().max(120).optional(),
  product_type: z.string().min(2, "Le type est requis"),
  category_id: z.string().optional().nullable(),
  unit: z.string().max(50).optional(),
  price_ref: numberField,
  quantity_default: numberField,
  description: z.string().max(15000, "La description ne peut pas dépasser 15 000 caractères").optional(),
  enabled: z.boolean().default(true),
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
  productTypes,
  product,
  trigger,
  open: openProp,
  onOpenChange,
}: ProductFormDialogProps) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const { toast } = useToast();
  const createProduct = useCreateProduct(orgId);
  const updateProduct = useUpdateProduct(orgId);

  const defaultValues = useMemo<ProductFormValues>(
    () => ({
      name: product?.name ?? "",
      sku: product?.sku ?? "",
      product_type: product?.product_type ?? "LED",
      category_id: product?.category_id ?? undefined,
      unit: product?.unit ?? "unité",
      price_ref: product?.price_ref ?? undefined,
      quantity_default: product?.quantity_default ?? undefined,
      description: product?.description ?? "",
      enabled: product?.enabled ?? true,
    }),
    [product],
  );

  const typeOptions = useMemo(() => {
    if (!product?.product_type) return productTypes;
    if (productTypes.includes(product.product_type)) return productTypes;
    return [product.product_type, ...productTypes];
  }, [product?.product_type, productTypes]);

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
      toast({ title: "Organisation manquante", description: "Sélectionnez une organisation", variant: "destructive" });
      return;
    }

    const payload: TablesInsert<"products"> = {
      org_id: orgId,
      name: values.name.trim(),
      sku: values.sku?.trim() ? values.sku.trim() : null,
      product_type: values.product_type,
      category_id: values.category_id ?? null,
      unit: values.unit?.trim() || "unité",
      price_ref: values.price_ref ?? null,
      quantity_default: values.quantity_default ?? null,
      description: values.description?.trim() ? values.description.trim() : null,
      enabled: values.enabled,
    };

    try {
      if (product) {
        await updateProduct.mutateAsync({ id: product.id, values: payload });
        toast({ title: "Produit mis à jour", description: `${values.name} a été enregistré` });
      } else {
        await createProduct.mutateAsync(payload);
        toast({ title: "Produit créé", description: `${values.name} a été ajouté` });
      }
      setOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Impossible d'enregistrer le produit";
      toast({ title: "Erreur", description: message, variant: "destructive" });
    }
  };

  const isSubmitting = createProduct.isPending || updateProduct.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{product ? "Modifier le produit" : "Créer un produit"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Isolation des combles" disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU / Référence</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="SKU interne" disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="category_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Catégorie</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-2">
                        <Select
                          value={field.value ?? ""}
                          onValueChange={(value) => field.onChange(value === "" ? null : value)}
                          disabled={isSubmitting}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choisir une catégorie" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Aucune</SelectItem>
                            {categories.map((category) => (
                              <SelectItem key={category.id} value={category.id}>
                                {category.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <CategoryFormDialog
                          orgId={orgId}
                          trigger={
                            <Button type="button" variant="outline" size="sm" className="gap-2 whitespace-nowrap">
                              <Plus className="h-4 w-4" /> + Catégorie
                            </Button>
                          }
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="product_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type *</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange} disabled={isSubmitting}>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner un type" />
                        </SelectTrigger>
                        <SelectContent>
                          {typeOptions.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unité</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="ex. unité, m²" disabled={isSubmitting} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="price_ref"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prix de référence (€)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={field.value ?? ""}
                        onChange={(event) => {
                          field.onChange(parseNumberInput(event.target.value));
                        }}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="quantity_default"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantité par défaut</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={field.value ?? ""}
                        onChange={(event) => {
                          field.onChange(parseNumberInput(event.target.value));
                        }}
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <RichDescription
                      value={field.value ?? ""}
                      onChange={(value) => {
                        field.onChange(value);
                        if (value.length > 15000) {
                          form.setError("description", {
                            type: "too_long",
                            message: "La description ne peut pas dépasser 15 000 caractères",
                          });
                        } else {
                          form.clearErrors("description");
                        }
                      }}
                      onBlur={field.onBlur}
                      maxLength={15000}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="enabled"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <FormLabel>Produit actif</FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Un produit inactif n'apparaîtra pas dans les sélections.
                    </p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} disabled={isSubmitting} />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
                Annuler
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Enregistrement...
                  </span>
                ) : product ? (
                  "Mettre à jour"
                ) : (
                  "Créer"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
