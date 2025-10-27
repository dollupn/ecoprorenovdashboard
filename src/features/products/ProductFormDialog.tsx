import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Plus } from "lucide-react";
import { Parser } from "expr-eval";

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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { getProjectBuildingTypes } from "@/lib/buildings";
import { FORMULA_QUANTITY_KEY } from "@/lib/valorisation-formula";
import {
  DEFAULT_PRODUCT_CEE_CONFIG,
  PRODUCT_CEE_CATEGORIES,
  PRODUCT_CEE_FORMULA_TEMPLATES,
  formatProductCeeMultiplierLabel,
  getProductCeeFormulaTemplateById,
  isQuantityMultiplier,
  normalizeProductCeeConfig,
} from "@/lib/prime-cee-config";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import type { ProductCatalogRecord, CategoryRecord, ProductKwhCumacInput } from "./api";
import { useCreateProduct, useUpdateProduct } from "./api";
import { CategoryFormDialog } from "./CategoryFormDialog";
import { RichDescription } from "./RichDescription";
import { TechnicalSheetUpload } from "./TechnicalSheetUpload";
import { DynamicFieldsEditor } from "./DynamicFieldsEditor";

const euroFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const decimalFormatter = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const formatDecimalValue = (value: number | null | undefined, fallback: number) => {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return decimalFormatter.format(numeric);
};

type DynamicSchemaField = { name: string; label?: string | null } & Record<string, unknown>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isSchemaField = (field: unknown): field is DynamicSchemaField =>
  isRecord(field) && typeof field.name === "string";

const extractSchemaFields = (schema: unknown): DynamicSchemaField[] => {
  if (!schema) return [];

  if (Array.isArray(schema)) {
    const fields = schema.filter(isSchemaField) as DynamicSchemaField[];
    const hasInvalidEntries = fields.length !== schema.length;
    return hasInvalidEntries ? fields : (schema as DynamicSchemaField[]);
  }

  if (isRecord(schema)) {
    const fields = (schema as Record<string, unknown>).fields;
    if (Array.isArray(fields)) {
      return fields.filter(isSchemaField) as DynamicSchemaField[];
    }
  }

  return [];
};

const buildDefaultsFromFields = (fields: DynamicSchemaField[]): Record<string, unknown> => {
  const defaults: Record<string, unknown> = {};

  fields.forEach((field) => {
    const rawDefault = isRecord(field)
      ? "defaultValue" in field && field.defaultValue !== undefined
        ? field.defaultValue
        : "default" in field && field.default !== undefined
          ? field.default
          : "value" in field && field.value !== undefined
            ? field.value
            : undefined
      : undefined;

    if (rawDefault !== undefined) {
      defaults[field.name] = rawDefault;
    }
  });

  return defaults;
};

const normalizeSchemaValue = (value: unknown) => {
  if (Array.isArray(value)) {
    const fields = extractSchemaFields(value);
    const shouldUpdate = fields.length !== value.length;
    return { schema: shouldUpdate ? fields : (value as DynamicSchemaField[]), shouldUpdate };
  }

  if (!value) {
    return { schema: [] as DynamicSchemaField[], shouldUpdate: value !== undefined && value !== null };
  }

  if (isRecord(value)) {
    const fields = extractSchemaFields(value.fields);
    return { schema: fields, shouldUpdate: true };
  }

  return { schema: [] as DynamicSchemaField[], shouldUpdate: true };
};

const normalizeDefaultsValue = (value: unknown) => {
  if (!value) {
    return {
      defaults: {} as Record<string, unknown>,
      schemaFromDefaults: [] as DynamicSchemaField[],
      shouldUpdate: value !== undefined && value !== null,
    };
  }

  if (Array.isArray(value)) {
    const schemaFromDefaults = extractSchemaFields(value);
    return {
      defaults: buildDefaultsFromFields(schemaFromDefaults),
      schemaFromDefaults,
      shouldUpdate: true,
    };
  }

  if (isRecord(value)) {
    const recordValue = value as Record<string, unknown>;
    const schemaFromDefaults = extractSchemaFields(recordValue.schema ?? recordValue.fields);

    if (isRecord(recordValue.defaults)) {
      return {
        defaults: { ...(recordValue.defaults as Record<string, unknown>) },
        schemaFromDefaults,
        shouldUpdate: true,
      };
    }

    if ("schema" in recordValue || "fields" in recordValue || "defaults" in recordValue) {
      const defaults: Record<string, unknown> = {};
      Object.entries(recordValue).forEach(([key, val]) => {
        if (key === "schema" || key === "fields" || key === "defaults") {
          return;
        }
        defaults[key] = val;
      });

      return { defaults, schemaFromDefaults, shouldUpdate: true };
    }

    return {
      defaults: recordValue,
      schemaFromDefaults,
      shouldUpdate: false,
    };
  }

  return {
    defaults: {} as Record<string, unknown>,
    schemaFromDefaults: [] as DynamicSchemaField[],
    shouldUpdate: true,
  };
};

const normalizeDynamicFieldsState = (
  schemaInput: unknown,
  defaultsInput: unknown,
): {
  schema: DynamicSchemaField[];
  defaults: Record<string, unknown>;
  schemaShouldUpdate: boolean;
  defaultsShouldUpdate: boolean;
} => {
  const { schema, shouldUpdate: schemaNeedsUpdate } = normalizeSchemaValue(schemaInput);
  const {
    defaults,
    schemaFromDefaults,
    shouldUpdate: defaultsNeedUpdate,
  } = normalizeDefaultsValue(defaultsInput);

  const effectiveSchema = schema.length > 0 ? schema : schemaFromDefaults;

  const shouldUpdateSchema =
    schemaNeedsUpdate ||
    (!Array.isArray(schemaInput) && effectiveSchema.length > 0) ||
    (Array.isArray(schemaInput) && schemaInput.length === 0 && effectiveSchema.length > 0);

  return {
    schema: effectiveSchema,
    defaults,
    schemaShouldUpdate: shouldUpdateSchema,
    defaultsShouldUpdate: defaultsNeedUpdate,
  };
};

const kwhValueSchema = z
  .number({ invalid_type_error: "Saisissez un nombre valide" })
  .min(0, "La valeur doit être positive")
  .nullable();

const ceeCategoryValues = PRODUCT_CEE_CATEGORIES.map((item) => item.value) as [
  (typeof PRODUCT_CEE_CATEGORIES)[number]["value"],
  ...(typeof PRODUCT_CEE_CATEGORIES)[number]["value"][],
];

const ceeTemplateValues = PRODUCT_CEE_FORMULA_TEMPLATES.map((item) => item.id) as [
  (typeof PRODUCT_CEE_FORMULA_TEMPLATES)[number]["id"],
  ...(typeof PRODUCT_CEE_FORMULA_TEMPLATES)[number]["id"][],
];

const ceeConfigSchema = z
  .object({
    category: z.enum(ceeCategoryValues, { required_error: "Sélectionnez une catégorie" }),
    formulaTemplate: z.enum(ceeTemplateValues, { required_error: "Sélectionnez une formule" }),
    formulaExpression: z
      .string({ invalid_type_error: "Saisissez une formule valide" })
      .max(500, "La formule ne peut pas dépasser 500 caractères")
      .optional()
      .nullable(),
    primeMultiplierParam: z
      .string({ invalid_type_error: "Saisissez un champ valide" })
      .max(120, "Le champ est trop long")
      .optional()
      .nullable(),
    primeMultiplierCoefficient: z
      .number({ invalid_type_error: "Saisissez un coefficient valide" })
      .gt(0, "Le coefficient doit être positif")
      .optional()
      .nullable(),
    ledWattConstant: z
      .number({ invalid_type_error: "Saisissez une valeur valide" })
      .gt(0, "La valeur doit être positive")
      .optional()
      .nullable(),
  })
  .superRefine((value, ctx) => {
    const template = getProductCeeFormulaTemplateById(value.formulaTemplate) ?? null;

    if (template?.allowedCategories && !template.allowedCategories.includes(value.category)) {
      ctx.addIssue({
        path: ["formulaTemplate"],
        code: z.ZodIssueCode.custom,
        message: "Cette formule n'est pas disponible pour la catégorie choisie",
      });
    }

    if (template?.requiresLedWattConstant && (!value.ledWattConstant || value.ledWattConstant <= 0)) {
      ctx.addIssue({
        path: ["ledWattConstant"],
        code: z.ZodIssueCode.custom,
        message: "Indiquez la puissance moyenne d'un luminaire LED",
      });
    }

    if (template?.isCustom) {
      const expression = value.formulaExpression?.trim();
      if (!expression) {
        ctx.addIssue({
          path: ["formulaExpression"],
          code: z.ZodIssueCode.custom,
          message: "Saisissez une formule personnalisée",
        });
        return;
      }

      try {
        Parser.parse(expression);
      } catch (error) {
        ctx.addIssue({
          path: ["formulaExpression"],
          code: z.ZodIssueCode.custom,
          message: "Formule invalide",
        });
      }
    }
  });

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
  cee_config: ceeConfigSchema,
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
  const { user } = useAuth();
  const buildingTypes = useMemo(() => getProjectBuildingTypes(), []);
  const allBuildingTypes = useMemo(() => {
    const fromProduct =
      product?.kwh_cumac_values?.map((entry) => entry.building_type?.trim()).filter((value): value is string => Boolean(value)) ??
      [];
    const ordered = new Set<string>();
    buildingTypes.forEach((type) => {
      const trimmed = type.trim();
      if (trimmed) ordered.add(trimmed);
    });
    fromProduct.forEach((type) => {
      const trimmed = type.trim();
      if (trimmed) ordered.add(trimmed);
    });
    return Array.from(ordered);
  }, [buildingTypes, product?.kwh_cumac_values]);

  const createProduct = useCreateProduct(orgId);
  const updateProduct = useUpdateProduct(orgId);

  const sanitizedCeeConfig = useMemo(
    () => normalizeProductCeeConfig(product?.cee_config ?? DEFAULT_PRODUCT_CEE_CONFIG),
    [product?.cee_config],
  );

  const productDynamicFields = useMemo(
    () => normalizeDynamicFieldsState(product?.params_schema ?? null, product?.default_params ?? null),
    [product?.params_schema, product?.default_params],
  );

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
      params_schema: productDynamicFields.schema,
      default_params: productDynamicFields.defaults,
      kwh_cumac: allBuildingTypes.reduce<Record<string, number | null>>((acc, type) => {
        const match = product?.kwh_cumac_values?.find((entry) => entry.building_type?.trim() === type);
        acc[type] = match?.kwh_cumac ?? null;
        return acc;
      }, {}),
      cee_config: sanitizedCeeConfig,
    }),
    [product, allBuildingTypes, sanitizedCeeConfig, productDynamicFields],
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
    if (!isControlled) setInternalOpen(next);
    onOpenChange?.(next);
    if (!next) form.reset(defaultValues);
  };

  const onSubmit = async (values: ProductFormValues) => {
    if (!orgId) {
      toast({
        title: "Organisation manquante",
        description: "Vous devez être membre d'une organisation pour créer des produits",
        variant: "destructive",
      });
      return;
    }

    const ceeConfigInput = values.cee_config ?? DEFAULT_PRODUCT_CEE_CONFIG;
    const template = getProductCeeFormulaTemplateById(ceeConfigInput.formulaTemplate) ?? null;

    const multiplierParamRaw = ceeConfigInput.primeMultiplierParam?.trim();
    const multiplierParamNormalized = multiplierParamRaw
      ? multiplierParamRaw === "quantity"
        ? FORMULA_QUANTITY_KEY
        : multiplierParamRaw
      : null;

    const multiplierCoefficientNormalized =
      typeof ceeConfigInput.primeMultiplierCoefficient === "number" &&
      Number.isFinite(ceeConfigInput.primeMultiplierCoefficient) &&
      ceeConfigInput.primeMultiplierCoefficient > 0
        ? ceeConfigInput.primeMultiplierCoefficient
        : null;

    const ledWattNormalized =
      ceeConfigInput.category === "lighting" &&
      typeof ceeConfigInput.ledWattConstant === "number" &&
      Number.isFinite(ceeConfigInput.ledWattConstant) &&
      ceeConfigInput.ledWattConstant > 0
        ? ceeConfigInput.ledWattConstant
        : null;

    const expressionNormalized = template?.isCustom
      ? ceeConfigInput.formulaExpression?.trim() ?? null
      : template?.expression ?? null;

    const normalizedCeeConfig = normalizeProductCeeConfig({
      ...ceeConfigInput,
      formulaExpression: expressionNormalized,
      primeMultiplierParam: multiplierParamNormalized ?? FORMULA_QUANTITY_KEY,
      primeMultiplierCoefficient: multiplierCoefficientNormalized,
      ledWattConstant: ledWattNormalized,
    });

    const basePayload: Omit<TablesInsert<"product_catalog">, "org_id" | "owner_id"> = {
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
      valorisation_bonification: product?.valorisation_bonification ?? null,
      valorisation_coefficient: product?.valorisation_coefficient ?? null,
      valorisation_formula: product?.valorisation_formula ?? null,
      cee_config: normalizedCeeConfig,
    };

    const kwhValues = values.kwh_cumac ?? {};
    const kwhEntries: ProductKwhCumacInput[] = Array.from(
      new Set([...allBuildingTypes, ...Object.keys(kwhValues)].map((type) => type.trim()).filter((type) => type.length > 0)),
    ).map((type) => ({
      building_type: type,
      kwh_cumac: kwhValues[type] ?? null,
    }));

    try {
      if (product) {
        const updatePayload: TablesUpdate<"product_catalog"> = { ...basePayload };
        await updateProduct.mutateAsync({ id: product.id, values: updatePayload, kwhCumac: kwhEntries });
        toast({ title: "Produit modifié", description: `${values.name} a été mis à jour` });
      } else {
        if (!orgId) {
          throw new Error("Organisation requise pour créer un produit");
        }

        if (!user?.id) {
          throw new Error("Utilisateur requis pour créer un produit");
        }

        const insertPayload: TablesInsert<"product_catalog"> = {
          ...basePayload,
          org_id: orgId,
          owner_id: user.id,
        };

        await createProduct.mutateAsync({ values: insertPayload, kwhCumac: kwhEntries });
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

  const watchedBasePrice = form.watch("base_price_ht");
  const watchedTva = form.watch("tva_percentage");
  const watchedPrime = form.watch("prime_percentage");
  const watchedEcoAdmin = form.watch("eco_admin_percentage");
  const watchedEcoFurn = form.watch("eco_furn_percentage");
  const watchedEcoLog = form.watch("eco_log_percentage");
  const watchedParamsSchema = form.watch("params_schema");
  const watchedDefaultParams = form.watch("default_params");

  const {
    schema: normalizedParamsSchema,
    defaults: normalizedDefaultParams,
    schemaShouldUpdate,
    defaultsShouldUpdate,
  } = useMemo(
    () => normalizeDynamicFieldsState(watchedParamsSchema, watchedDefaultParams),
    [watchedParamsSchema, watchedDefaultParams],
  );

  useEffect(() => {
    if (schemaShouldUpdate) {
      form.setValue("params_schema", normalizedParamsSchema);
    }
  }, [schemaShouldUpdate, normalizedParamsSchema, form]);

  useEffect(() => {
    if (defaultsShouldUpdate) {
      form.setValue("default_params", normalizedDefaultParams);
    }
  }, [defaultsShouldUpdate, normalizedDefaultParams, form]);

  const ceeCategoryValue = form.watch("cee_config.category");
  const ceeTemplateValue = form.watch("cee_config.formulaTemplate");
  const ceeMultiplierParamValue = form.watch("cee_config.primeMultiplierParam");
  const ceeMultiplierCoefficientValue = form.watch("cee_config.primeMultiplierCoefficient");
  const ceeFormulaExpressionValue = form.watch("cee_config.formulaExpression");

  const priceTTC = useMemo(() => {
    if (watchedBasePrice && watchedTva !== null && watchedTva !== undefined) {
      return watchedBasePrice * (1 + watchedTva / 100);
    }
    return null;
  }, [watchedBasePrice, watchedTva]);

  const dynamicSchemaFields = useMemo(
    () =>
      extractSchemaFields(normalizedParamsSchema).map((field) => ({
        name: field.name,
        label: field.label && field.label.trim().length > 0 ? field.label : field.name,
      })),
    [normalizedParamsSchema],
  );

  const selectedCeeTemplate = useMemo(
    () => getProductCeeFormulaTemplateById(ceeTemplateValue) ?? null,
    [ceeTemplateValue],
  );

  const ceeMultiplierPreview = useMemo(() => {
    const rawKey = ceeMultiplierParamValue?.trim() || FORMULA_QUANTITY_KEY;

    if (isQuantityMultiplier(rawKey)) {
      return formatProductCeeMultiplierLabel("Quantité", ceeMultiplierCoefficientValue ?? null);
    }

    const matchField = dynamicSchemaFields.find((field) => field.name === rawKey);
    const label =
      (matchField?.label && matchField.label.trim().length > 0 ? matchField.label : undefined) ??
      (matchField?.name && matchField.name.trim().length > 0 ? matchField.name : undefined) ??
      rawKey;

    return formatProductCeeMultiplierLabel(label, ceeMultiplierCoefficientValue ?? null);
  }, [ceeMultiplierParamValue, ceeMultiplierCoefficientValue, dynamicSchemaFields]);

  useEffect(() => {
    const template = getProductCeeFormulaTemplateById(ceeTemplateValue);
    if (!template || template.isCustom) {
      return;
    }

    const expectedExpression = template.expression ?? null;
    if (form.getValues("cee_config.formulaExpression") !== expectedExpression) {
      form.setValue("cee_config.formulaExpression", expectedExpression);
    }
  }, [ceeTemplateValue, form]);

  useEffect(() => {
    if (ceeCategoryValue !== "lighting" && form.getValues("cee_config.ledWattConstant") !== null) {
      form.setValue("cee_config.ledWattConstant", null);
    }
  }, [ceeCategoryValue, form]);

  const ecoEstimation = useMemo(() => {
    if (watchedBasePrice === null || watchedBasePrice === undefined) return null;

    const prime = watchedPrime ?? 0;
    const admin = watchedEcoAdmin ?? 0;
    const furn = watchedEcoFurn ?? 0;
    const log = watchedEcoLog ?? 0;

    const safeBase = Number(watchedBasePrice);
    if (Number.isNaN(safeBase)) return null;

    const totalPercent = Number(prime || 0) + Number(admin || 0) + Number(furn || 0) + Number(log || 0);
    const ecoCharges = safeBase * (totalPercent / 100);
    const totalWithEco = safeBase + ecoCharges;

    return { totalPercent, ecoCharges, totalWithEco };
  }, [watchedBasePrice, watchedPrime, watchedEcoAdmin, watchedEcoFurn, watchedEcoLog]);

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
                        <RichDescription value={field.value ?? ""} onChange={(value) => field.onChange(value)} disabled={isSubmitting} />
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
                        <RichDescription value={field.value ?? ""} onChange={(value) => field.onChange(value)} disabled={isSubmitting} />
                      </FormControl>
                      <p className="text-xs text-muted-foreground px-1">Contenu additionnel utilisé pour enrichir les devis (section principale).</p>
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
                        <RichDescription value={field.value ?? ""} onChange={(value) => field.onChange(value)} disabled={isSubmitting} />
                      </FormControl>
                      <p className="text-xs text-muted-foreground px-1">Deuxième bloc de description pour les annexes ou précisions techniques.</p>
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
                        <div className="text-sm text-muted-foreground">Ce produit sera visible dans les formulaires</div>
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
                    <Input value={priceTTC ? priceTTC.toFixed(2) + " €" : "—"} disabled className="bg-muted mt-2" />
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
                    {ecoEstimation ? <span className="text-xs text-muted-foreground">{ecoEstimation.totalPercent.toFixed(2)}%</span> : null}
                  </div>
                  <p className="text-xs text-muted-foreground">Calcul basé sur le prix HT et les pourcentages configurés ci-dessus.</p>
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
                    <p className="text-sm text-muted-foreground">Saisissez un prix de base pour obtenir une estimation.</p>
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
                          <Input {...field} value={field.value ?? ""} placeholder="Nom du fournisseur" disabled={isSubmitting} />
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
                          <Input {...field} value={field.value ?? ""} placeholder="Référence" disabled={isSubmitting} />
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
                                  if (Number.isNaN(parsed)) return;
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

                <div className="space-y-4 rounded-lg border p-4">
                  <div>
                    <h3 className="text-sm font-medium">Configuration Prime CEE</h3>
                    <p className="text-xs text-muted-foreground">
                      Sélectionnez la catégorie, la formule de valorisation et le champ utilisé pour calculer la prime CEE.
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="cee_config.category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Catégorie</FormLabel>
                          <FormControl>
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                              disabled={isSubmitting}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Choisir une catégorie" />
                              </SelectTrigger>
                              <SelectContent>
                                {PRODUCT_CEE_CATEGORIES.map((category) => (
                                  <SelectItem key={category.value} value={category.value}>
                                    {category.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="cee_config.formulaTemplate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Formule CEE</FormLabel>
                          <FormControl>
                            <Select
                              value={field.value}
                              onValueChange={field.onChange}
                              disabled={isSubmitting}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Choisir une formule" />
                              </SelectTrigger>
                              <SelectContent>
                                {PRODUCT_CEE_FORMULA_TEMPLATES.map((template) => (
                                  <SelectItem key={template.id} value={template.id}>
                                    {template.label}
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

                  {selectedCeeTemplate ? (
                    <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                      {selectedCeeTemplate.description}
                    </div>
                  ) : null}

                  {selectedCeeTemplate?.isCustom ? (
                    <FormField
                      control={form.control}
                      name="cee_config.formulaExpression"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Formule personnalisée</FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              value={field.value ?? ""}
                              onChange={(event) => field.onChange(event.target.value)}
                              placeholder="Exemple : KWH_CUMAC * BONUS_DOM * LED_WATT / MWH_DIVISOR"
                              rows={3}
                              disabled={isSubmitting}
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground px-1">
                            Variables disponibles : KWH_CUMAC, BONUS_DOM, LED_WATT, MWH_DIVISOR, BONIFICATION, COEFFICIENT.
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : (
                    <div className="rounded-md border border-dashed border-border/60 bg-muted/20 px-3 py-2 text-xs">
                      <p className="font-medium text-foreground">Formule appliquée</p>
                      <p className="mt-1 whitespace-pre-wrap text-muted-foreground">
                        {selectedCeeTemplate?.expression ?? "(kWh cumac × bonification × coefficient) / 1000"}
                      </p>
                    </div>
                  )}

                  {ceeCategoryValue === "lighting" || selectedCeeTemplate?.requiresLedWattConstant ? (
                    <FormField
                      control={form.control}
                      name="cee_config.ledWattConstant"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Puissance LED moyenne (W)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.1"
                              min={0}
                              value={field.value ?? ""}
                              onChange={(event) => {
                                const value = event.target.value;
                                if (value === "") {
                                  field.onChange(null);
                                  return;
                                }
                                const parsed = Number(value);
                                if (Number.isNaN(parsed)) return;
                                field.onChange(parsed);
                              }}
                              onBlur={field.onBlur}
                              placeholder="30"
                              disabled={isSubmitting}
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground px-1">
                            Valeur utilisée pour calculer la valorisation des opérations d&apos;éclairage.
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : null}

                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="cee_config.primeMultiplierParam"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Champ multiplicateur (Prime CEE)</FormLabel>
                          <FormControl>
                            <Input
                              value={field.value ?? ""}
                              onChange={(event) => {
                                const value = event.target.value;
                                field.onChange(value.trim().length === 0 ? null : value);
                              }}
                              placeholder="__quantity__"
                              disabled={isSubmitting}
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground">
                            Utilisez "__quantity__" pour la quantité ou choisissez un champ dynamique ci-dessous.
                          </p>
                          {dynamicSchemaFields.length > 0 ? (
                            <div className="flex flex-wrap gap-2 pt-1">
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => field.onChange(FORMULA_QUANTITY_KEY)}
                                disabled={isSubmitting}
                              >
                                Quantité
                              </Button>
                              {dynamicSchemaFields.map((option) => (
                                <Button
                                  key={option.name}
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => field.onChange(option.name)}
                                  disabled={isSubmitting}
                                >
                                  {option.label}
                                </Button>
                              ))}
                            </div>
                          ) : null}
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="cee_config.primeMultiplierCoefficient"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Coefficient du multiplicateur</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min={0}
                              value={field.value ?? ""}
                              onChange={(event) => {
                                const value = event.target.value;
                                if (value === "") {
                                  field.onChange(null);
                                  return;
                                }
                                const parsed = Number(value);
                                if (Number.isNaN(parsed)) return;
                                field.onChange(parsed);
                              }}
                              onBlur={field.onBlur}
                              placeholder="1"
                              disabled={isSubmitting}
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground px-1">
                            Optionnel. Permet de pondérer le champ sélectionné (ex. surface × 1.3).
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">Multiplicateur appliqué</p>
                    <p className="mt-1">{ceeMultiplierPreview}</p>
                    {selectedCeeTemplate?.isCustom ? (
                      <p className="mt-2 text-muted-foreground">
                        Formule personnalisée : {ceeFormulaExpressionValue?.trim() || "Non définie"}
                      </p>
                    ) : null}
                  </div>
                </div>
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
                            schema: normalizedParamsSchema as any,
                            defaults: normalizedDefaultParams as any,
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
