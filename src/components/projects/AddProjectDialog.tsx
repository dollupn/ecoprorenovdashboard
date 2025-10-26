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
  useWatch,
  type Control,
  type FieldArrayWithId,
  type UseFormReturn,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { addMonths, format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useOrg } from "@/features/organizations/OrgContext";
import { useOrganizationPrimeSettings } from "@/features/organizations/useOrganizationPrimeSettings";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Calendar as CalendarIcon, GripVertical, Plus, X } from "lucide-react";
import { DynamicFields } from "@/features/leads/DynamicFields";
import { useProjectStatuses } from "@/hooks/useProjectStatuses";
import { useProjectBuildingTypes } from "@/hooks/useProjectBuildingTypes";
import { useProjectUsages } from "@/hooks/useProjectUsages";
import { AddressAutocomplete } from "@/components/address/AddressAutocomplete";
import {
  computePrimeCee,
  resolveBonificationFactor,
  isProductExcluded,
  type PrimeCeeComputation,
  type PrimeCeeProductCatalogEntry,
  type PrimeProductInput,
} from "@/lib/prime-cee-unified";

type ProductCatalogEntry = PrimeCeeProductCatalogEntry;
type Profile = Tables<"profiles">;
type Delegate = Pick<Tables<"delegates">, "id" | "name" | "price_eur_per_mwh" | "description">;
type SelectOption = {
  value: string;
  label: string;
  description?: string;
};

type ProjectProduct = {
  product_id: string;
  quantity: number;
  dynamic_params: Record<string, unknown>;
};

type ProjectFormWithOptionalExtras = ProjectFormValues & {
  extra_fields?: Record<string, unknown>;
};

type ProductParamField = {
  name?: string;
  type?: string;
  [key: string]: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const currencyFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

const formatCurrency = (value: number) => currencyFormatter.format(value);
const decimalFormatter = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
const formatDecimal = (value: number) => decimalFormatter.format(value);

const extractProductParamFields = (
  schema: ProductCatalogEntry["params_schema"]
): ProductParamField[] => {
  if (!schema) {
    return [];
  }

  if (Array.isArray(schema)) {
    return schema.filter((field: any): field is ProductParamField => {
      return isRecord(field) && typeof field.name === "string";
    }) as ProductParamField[];
  }

  if (isRecord(schema)) {
    const maybeFields = (schema as Record<string, unknown>).fields;
    if (Array.isArray(maybeFields)) {
      return maybeFields.filter((field: any): field is ProductParamField => {
        return isRecord(field) && typeof field.name === "string";
      }) as ProductParamField[];
    }
  }

  return [];
};

interface SortableProjectProductRowProps {
  field: FieldArrayWithId<ProjectFormValues, "products">;
  index: number;
  control: Control<ProjectFormValues>;
  form: UseFormReturn<ProjectFormValues>;
  onRemove: (index: number) => void;
  canRemove: boolean;
  productsLoading: boolean;
  rawProductOptions: SelectOption[];
  productsData: ProductCatalogEntry[] | undefined;
  isSubmitting: boolean;
}

const SortableProjectProductRow = ({
  field,
  index,
  control,
  form,
  onRemove,
  canRemove,
  productsLoading,
  rawProductOptions,
  productsData,
  isSubmitting,
}: SortableProjectProductRowProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const productId = form.watch(`products.${index}.product_id`);
  const selectedProduct = productsData?.find((product) => product.id === productId);
  const dynamicFields = selectedProduct
    ? extractProductParamFields(selectedProduct.params_schema)
    : [];
  const hasDynamicFields = dynamicFields.length > 0;

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
            aria-label="Réorganiser le produit"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-muted-foreground">Produit {index + 1}</span>
        </div>
        {canRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => onRemove(index)}
            aria-label="Supprimer le produit"
            disabled={isSubmitting}
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField
          control={control}
          name={`products.${index}.product_id`}
          render={({ field: productField }) => (
            <FormItem>
              <FormLabel>Produit *</FormLabel>
              <Select
                onValueChange={productField.onChange}
                value={productField.value ?? ""}
                disabled={productsLoading || isSubmitting}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionnez un code produit" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {rawProductOptions.map((option) => (
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

        <FormField
          control={control}
          name={`products.${index}.quantity`}
          render={({ field: quantityField }) => (
            <FormItem>
              <FormLabel>Quantité *</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min="1"
                  value={quantityField.value ?? 1}
                  onChange={quantityField.onChange}
                  disabled={isSubmitting}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {hasDynamicFields ? (
        <DynamicFields
          form={form as unknown as UseFormReturn<ProjectFormWithOptionalExtras>}
          schema={{ fields: dynamicFields as any }}
          disabled={isSubmitting}
          fieldPrefix={`products.${index}.dynamic_params`}
        />
      ) : null}
    </div>
  );
};

const sirenSchema = z
  .string()
  .optional()
  .refine((value) => {
    if (!value) return true;
    const sanitized = value.replace(/\s+/g, "");
    if (sanitized.length === 0) return true;
    return /^\d{9}$/.test(sanitized);
  }, "Le SIREN doit contenir 9 chiffres");

const createSelectionSchema = (
  options: readonly string[],
  messages: { required: string; invalid: string },
) =>
  options.length > 0
    ? z
        .string({ required_error: messages.required })
        .min(1, messages.required)
        .refine((value) => options.includes(value), {
          message: messages.invalid,
        })
    : z.string({ required_error: messages.required }).min(1, messages.required);

const createProjectSchema = (
  allowedStatuses: readonly string[],
  buildingTypes: readonly string[],
  usages: readonly string[],
) => {
  const statusSchema = createSelectionSchema(allowedStatuses, {
    required: "Sélectionnez un statut",
    invalid: "Statut invalide",
  });

  const buildingTypeSchema = createSelectionSchema(buildingTypes, {
    required: "Sélectionnez un type",
    invalid: "Type de bâtiment invalide",
  });

  const usageSchema = createSelectionSchema(usages, {
    required: "Sélectionnez un usage",
    invalid: "Usage invalide",
  });

  return z.object({
    client_first_name: z.string().min(2, "Le prénom du client est requis"),
    client_last_name: z.string().min(2, "Le nom du client est requis"),
    company: z.string().optional(),
    phone: z.string().optional(),
    hq_address: z.string().min(3, "L'adresse du siège est requise"),
    hq_city: z.string().min(2, "La ville du siège est requise"),
    hq_postal_code: z.string().min(5, "Code postal du siège invalide"),
    same_address: z.boolean().default(false),
    address: z.string().min(3, "L'adresse du chantier est requise"),
    siren: sirenSchema,
    external_reference: z.string().optional().or(z.literal("")),
    products: z
      .array(
        z.object({
          product_id: z.string().min(1, "Le produit est requis"),
          quantity: z.coerce.number().min(1, "La quantité doit être >= 1").default(1),
          dynamic_params: z.record(z.any()).optional(),
        }),
      )
      .min(1, "Au moins un produit est requis"),
    city: z.string().min(2, "La ville du chantier est requise"),
    postal_code: z.string().min(5, "Code postal du chantier invalide"),
    building_type: buildingTypeSchema,
    usage: usageSchema,
    delegate_id: z
      .string({ required_error: "Sélectionnez un délégataire" })
      .uuid("Délégataire invalide"),
    signatory_name: z.string().optional(),
    signatory_title: z.string().optional(),
    surface_batiment_m2: z.coerce.number().optional(),
    status: statusSchema,
    assigned_to: z.string().min(2, "Assignation requise"),
    source: z.string().min(2, "La source est requise"),
    date_debut_prevue: z.string().optional(),
    date_fin_prevue: z.string().optional(),
    estimated_value: z.coerce.number().optional(),
    lead_id: z.string().optional(),
  });
};

type ProjectFormSchema = ReturnType<typeof createProjectSchema>;

export type ProjectFormValues = z.infer<ProjectFormSchema>;

interface AddProjectDialogProps {
  onProjectAdded?: () => void | Promise<void>;
  trigger?: ReactNode;
  initialValues?: Partial<ProjectFormValues>;
}

const baseDefaultValues: Partial<ProjectFormValues> = {
  client_first_name: "",
  client_last_name: "",
  company: "",
  phone: "",
  hq_address: "",
  hq_city: "",
  hq_postal_code: "",
  same_address: false,
  address: "",
  city: "",
  postal_code: "",
  siren: "",
  external_reference: "",
  products: [{ product_id: "", quantity: 1, dynamic_params: {} }],
  building_type: "",
  usage: "",
  delegate_id: "",
  signatory_name: "",
  signatory_title: "",
  surface_batiment_m2: undefined,
  status: "",
  assigned_to: "",
  source: "",
  date_debut_prevue: "",
  date_fin_prevue: "",
  estimated_value: undefined,
  lead_id: undefined,
};

// Fonction pour initialiser les champs dynamiques avec les valeurs par défaut
const getInitialDynamicParams = (product?: ProductCatalogEntry | null) => {
  if (!product) {
    return {} as Record<string, unknown>;
  }

  const fields = extractProductParamFields(product.params_schema);
  const defaults = isRecord(product.default_params)
    ? (product.default_params as Record<string, unknown>)
    : undefined;

  const initialParams: Record<string, unknown> = {};

  fields.forEach((field) => {
    const fieldName = field.name;
    if (!fieldName) {
      return;
    }

    if (defaults && fieldName in defaults) {
      initialParams[fieldName] = defaults[fieldName];
      return;
    }

    initialParams[fieldName] = field.type === "number" ? 0 : "";
  });

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
  const projectStatuses = useProjectStatuses();
  const buildingTypes = useProjectBuildingTypes();
  const usages = useProjectUsages();
  const { primeBonification } = useOrganizationPrimeSettings();

  const statusOptions = useMemo(
    () => projectStatuses.map((status) => status.value),
    [projectStatuses],
  );

  const buildingTypeOptions = useMemo(() => [...buildingTypes], [buildingTypes]);
  const usageOptions = useMemo(() => [...usages], [usages]);

  const projectSchema = useMemo(
    () => createProjectSchema(statusOptions, buildingTypeOptions, usageOptions),
    [statusOptions, buildingTypeOptions, usageOptions],
  );

  const resolver = useMemo(() => zodResolver(projectSchema), [projectSchema]);

  const defaultStatus = useMemo(() => {
    if (initialValues?.status && statusOptions.includes(initialValues.status)) {
      return initialValues.status;
    }

    return statusOptions[0] ?? "";
  }, [initialValues?.status, statusOptions]);

  const defaultBuildingType = useMemo(() => {
    if (
      initialValues?.building_type &&
      buildingTypeOptions.includes(initialValues.building_type)
    ) {
      return initialValues.building_type;
    }

    return buildingTypeOptions[0] ?? "";
  }, [buildingTypeOptions, initialValues?.building_type]);

  const defaultUsage = useMemo(() => {
    if (initialValues?.usage && usageOptions.includes(initialValues.usage)) {
      return initialValues.usage;
    }

    return usageOptions[0] ?? "";
  }, [initialValues?.usage, usageOptions]);

  const defaultStartDate = useMemo(() => {
    if (initialValues?.date_debut_prevue) {
      return initialValues.date_debut_prevue;
    }

    return format(addMonths(new Date(), 1), "yyyy-MM-dd");
  }, [initialValues?.date_debut_prevue]);

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
        .select(
          "id, name, code, category, is_active, params_schema, default_params, kwh_cumac_values:product_kwh_cumac(id, building_type, kwh_cumac)"
        )
        .eq("org_id", currentOrgId)
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(currentOrgId),
  });

  const {
    data: delegatesData,
    isLoading: delegatesLoading,
    error: delegatesError,
  } = useQuery({
    queryKey: ["delegates", currentOrgId],
    queryFn: async () => {
      if (!currentOrgId) return [] as Delegate[];

      const { data, error } = await supabase
        .from("delegates")
        .select("id, name, price_eur_per_mwh, description")
        .eq("org_id", currentOrgId)
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) throw error;
      return (data ?? []) as Delegate[];
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

  useEffect(() => {
    if (delegatesError) {
      const message =
        delegatesError instanceof Error
          ? delegatesError.message
          : "Impossible de charger les délégataires";
      toast({
        title: "Erreur",
        description: message,
        variant: "destructive",
      });
    }
  }, [delegatesError, toast]);

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
        label: product.code ?? product.name ?? "Produit",
      })) as SelectOption[];
  }, [productsData]);

  const delegateOptions = useMemo(() => {
    if (!delegatesData) return [] as SelectOption[];

    return delegatesData.map((delegate) => {
      const description =
        typeof delegate.price_eur_per_mwh === "number"
          ? `${formatCurrency(delegate.price_eur_per_mwh)} / MWh`
          : undefined;

      return {
        value: delegate.id,
        label: delegate.name,
        description,
      } satisfies SelectOption;
    });
  }, [delegatesData]);

  const delegatesById = useMemo(() => {
    if (!delegatesData) return {} as Record<string, Delegate>;

    return delegatesData.reduce<Record<string, Delegate>>((acc, delegate) => {
      acc[delegate.id] = delegate;
      return acc;
    }, {});
  }, [delegatesData]);

  const defaultDelegateId = useMemo(() => {
    if (initialValues?.delegate_id) {
      return initialValues.delegate_id;
    }

    return delegatesData?.[0]?.id ?? "";
  }, [delegatesData, initialValues?.delegate_id]);

  const ecoProducts = useMemo(() => {
    if (!productsData) return [] as ProductCatalogEntry[];
    return productsData.filter((product) =>
      (product.code ?? "").toUpperCase().startsWith("ECO")
    );
  }, [productsData]);

  const [selectedEcoProductIds, setSelectedEcoProductIds] = useState<string[]>([]);

  const createProductEntry = (product?: ProductCatalogEntry | null): ProjectProduct => ({
    product_id: product?.id ?? "",
    quantity: 1,
    dynamic_params: getInitialDynamicParams(product),
  });

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

  const defaultSource = useMemo(() => {
    if (initialValues?.source && initialValues.source.trim().length > 0) {
      return initialValues.source;
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
  }, [initialValues?.source, profile?.full_name, user?.email, user?.user_metadata?.full_name]);

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

  const form = useForm<ProjectFormValues>({
    resolver,
    defaultValues: {
      ...baseDefaultValues,
      ...initialValues,
      status: defaultStatus,
      building_type: defaultBuildingType,
      usage: defaultUsage,
      assigned_to: initialValues?.assigned_to ?? defaultAssignee ?? "",
      source: initialValues?.source ?? defaultSource ?? "",
      delegate_id: initialValues?.delegate_id ?? defaultDelegateId ?? "",
      products: initialValues?.products ?? [createProductEntry()],
    } as ProjectFormValues,
  });

  // keep field array (drag & drop + replace/save)
  const {
    fields: productFields,
    append: appendProductField,
    move: moveProduct,
    replace: replaceProducts,
  } = useFieldArray({
    control: form.control,
    name: "products",
  });

  const watchedProducts = useWatch({ control: form.control, name: "products" });
  const watchedBuildingType = useWatch({ control: form.control, name: "building_type" });
  const watchedDelegateId = useWatch({ control: form.control, name: "delegate_id" });

  const productMap = useMemo(() => {
    if (!productsData) return {} as Record<string, ProductCatalogEntry>;

    return productsData.reduce<Record<string, ProductCatalogEntry>>((acc, product) => {
      if (product.id) {
        acc[product.id] = product;
      }
      return acc;
    }, {});
  }, [productsData]);

  const selectedDelegate = useMemo(() => {
    if (!watchedDelegateId) return undefined;
    return delegatesById[watchedDelegateId];
  }, [delegatesById, watchedDelegateId]);

  const missingKwhProductCodes = useMemo(() => {
    if (!watchedBuildingType) {
      return [] as string[];
    }

    return (watchedProducts ?? []).reduce<string[]>((acc, item) => {
      if (!item?.product_id) {
        return acc;
      }

      const product = productMap[item.product_id];
      if (!product) {
        return acc;
      }

      // Skip ECO products as they are excluded from Prime CEE calculation
      if (isProductExcluded(product)) {
        return acc;
      }

      const hasKwhForBuilding = product.kwh_cumac_values?.some((value) => {
        return value.building_type === watchedBuildingType && typeof value.kwh_cumac === "number";
      });

      if (!hasKwhForBuilding) {
        const label = product.code ?? product.name ?? product.id ?? "Produit";
        if (!acc.includes(label)) {
          acc.push(label);
        }
      }

      return acc;
    }, []);
  }, [productMap, watchedBuildingType, watchedProducts]);

  const effectivePrimeBonification = useMemo(
    () => resolveBonificationFactor(primeBonification),
    [primeBonification]
  );

  const primeCeeComputation = useMemo<PrimeCeeComputation | null>(() => {
    const normalizedProducts: PrimeProductInput[] = (watchedProducts ?? [])
      .filter((item) => Boolean(item?.product_id))
      .map((item) => ({
        product_id: item.product_id as string,
        quantity:
          typeof item.quantity === "number"
            ? item.quantity
            : Number.isFinite(Number(item.quantity))
              ? Number(item.quantity)
              : undefined,
        dynamic_params: item.dynamic_params ?? {},
      }));

    return computePrimeCee({
      products: normalizedProducts,
      buildingType: watchedBuildingType,
      delegate: selectedDelegate,
      primeBonification,
      productMap,
    });
  }, [watchedProducts, watchedBuildingType, selectedDelegate, primeBonification, productMap]);

  const primeCeeProducts = primeCeeComputation?.products ?? [];
  const hasPrimeCeeValue =
    typeof primeCeeComputation?.totalPrime === "number" && Number.isFinite(primeCeeComputation.totalPrime);
  const primeCeeTotal = hasPrimeCeeValue && primeCeeComputation ? primeCeeComputation.totalPrime : null;
  const totalValorisationMwh = primeCeeComputation?.totalValorisationMwh ?? null;

  // preserve status auto-correction effect
  useEffect(() => {
    const currentDelegateId = form.getValues("delegate_id");

    if (!currentDelegateId && defaultDelegateId) {
      form.setValue("delegate_id", defaultDelegateId);
    }
  }, [defaultDelegateId, form]);

  useEffect(() => {
    const currentStatus = form.getValues("status");

    if (!currentStatus && defaultStatus) {
      form.setValue("status", defaultStatus);
      return;
    }

    if (currentStatus && statusOptions.length > 0 && !statusOptions.includes(currentStatus)) {
      form.setValue("status", defaultStatus);
    }
  }, [defaultStatus, form, statusOptions]);

  useEffect(() => {
    const currentType = form.getValues("building_type");

    if (!currentType && defaultBuildingType) {
      form.setValue("building_type", defaultBuildingType);
      return;
    }

    if (
      currentType &&
      buildingTypeOptions.length > 0 &&
      !buildingTypeOptions.includes(currentType)
    ) {
      form.setValue("building_type", defaultBuildingType || "");
    }
  }, [buildingTypeOptions, defaultBuildingType, form]);

  useEffect(() => {
    const currentUsage = form.getValues("usage");

    if (!currentUsage && defaultUsage) {
      form.setValue("usage", defaultUsage);
      return;
    }

    if (currentUsage && usageOptions.length > 0 && !usageOptions.includes(currentUsage)) {
      form.setValue("usage", defaultUsage || "");
    }
  }, [defaultUsage, form, usageOptions]);

  // single addProduct using fieldArray append
  const addProduct = useCallback(() => {
    appendProductField(createProductEntry());
  }, [appendProductField]);

  const removeProduct = useCallback(
    (index: number) => {
      const currentProducts = form.getValues("products") ?? [];

      if (currentProducts.length <= 1) {
        form.setValue(`products.${index}`, createProductEntry());
        return;
      }

      const ecoMap = new Map(ecoProducts.map((product) => [product.id, product]));
      const removed = currentProducts[index];
      const updated = currentProducts.filter((_, idx) => idx !== index);

      const hasNonEcoProduct = updated.some(
        (item) => !item?.product_id || !ecoMap.has(item.product_id)
      );

      if (!hasNonEcoProduct) {
        updated.push(createProductEntry());
      }

      replaceProducts(updated);

      if (removed?.product_id && ecoMap.has(removed.product_id)) {
        setSelectedEcoProductIds((prev) => prev.filter((id) => id !== removed.product_id));
      }
    },
    [ecoProducts, form, replaceProducts]
  );

  const syncEcoProducts = useCallback(
    (nextSelected: string[]) => {
      const currentProducts = form.getValues("products") ?? [];
      const ecoMap = new Map(ecoProducts.map((product) => [product.id, product]));

      const ecoEntries = nextSelected
        .map((id) => {
          const existing = currentProducts.find((item) => item.product_id === id);
          if (existing) {
            return existing;
          }
          const catalogProduct = ecoMap.get(id);
          return catalogProduct ? createProductEntry(catalogProduct) : null;
        })
        .filter((entry): entry is ProjectProduct => Boolean(entry));

      const nonEcoProducts = currentProducts.filter(
        (item) => !ecoMap.has(item.product_id)
      );

      const merged = [...ecoEntries, ...nonEcoProducts];

      if (merged.length === 0) {
        merged.push(createProductEntry());
      } else {
        const hasNonEcoProduct = merged.some(
          (item) => !item.product_id || !ecoMap.has(item.product_id)
        );

        if (!hasNonEcoProduct) {
          merged.push(createProductEntry());
        }
      }

      replaceProducts(merged);
    },
    [ecoProducts, form, replaceProducts]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const productsValues = form.watch("products");
  const startDateValue = form.watch("date_debut_prevue");
  const endDateValue = form.watch("date_fin_prevue");

  const productFieldEntries = useMemo(
    () =>
      productFields.map((field, index) => ({
        field,
        index,
        productId: productsValues?.[index]?.product_id ?? "",
      })),
    [productFields, productsValues]
  );

  const visibleProductEntries = useMemo(
    () =>
      productFieldEntries.filter((entry) => {
        const productId = entry.productId;
        return !productId || !selectedEcoProductIds.includes(productId);
      }),
    [productFieldEntries, selectedEcoProductIds]
  );

  const visibleProductIds = useMemo(
    () => visibleProductEntries.map((entry) => entry.field.id),
    [visibleProductEntries]
  );

  const startDate = useMemo(() => {
    if (!startDateValue) {
      return undefined;
    }

    const parsed = parseISO(startDateValue);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }, [startDateValue]);

  const endDate = useMemo(() => {
    if (!endDateValue) {
      return undefined;
    }

    const parsed = parseISO(endDateValue);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }, [endDateValue]);

  const handleProductDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (!over || active.id === over.id) {
        return;
      }

      const activeIndex = visibleProductIds.findIndex((id) => id === active.id);
      const overIndex = visibleProductIds.findIndex((id) => id === over.id);

      if (activeIndex === -1 || overIndex === -1) {
        return;
      }

      const activeActualIndex = visibleProductEntries[activeIndex]?.index;
      const overActualIndex = visibleProductEntries[overIndex]?.index;

      if (
        activeActualIndex === undefined ||
        overActualIndex === undefined ||
        activeActualIndex === overActualIndex
      ) {
        return;
      }

      moveProduct(activeActualIndex, overActualIndex);
    },
    [moveProduct, visibleProductEntries, visibleProductIds]
  );

  useEffect(() => {
    if (defaultAssignee && form.getValues("assigned_to") !== defaultAssignee) {
      form.setValue("assigned_to", defaultAssignee);
    }
  }, [defaultAssignee, form]);

  useEffect(() => {
    if (defaultSource && form.getValues("source") !== defaultSource) {
      form.setValue("source", defaultSource);
    }
  }, [defaultSource, form]);

  // **** Merged/conflict-resolved effect: honors initialValues + defaults ****
  useEffect(() => {
    if (!open) return;

    const defaultEcoIds = ecoProducts
      .map((product) => product.id)
      .filter((id): id is string => Boolean(id));

    const ecoMap = new Map(ecoProducts.map((product) => [product.id, product]));

    // Validate initial products against current catalog
    const initialProductEntries =
      (initialValues?.products ?? [])
        .map((entry) => {
          if (!entry?.product_id) return null;
          const catalogProduct = productsData?.find((product) => product.id === entry.product_id);
          return catalogProduct
            ? {
                product_id: entry.product_id,
                quantity: entry.quantity ?? 1,
                dynamic_params: entry.dynamic_params ?? getInitialDynamicParams(catalogProduct),
              }
            : null;
        })
        .filter((entry): entry is ProjectProduct => Boolean(entry));

    // Merge default ECO selection with initial products that are ECO
    const mergedEcoSelection = new Set<string>([
      ...defaultEcoIds,
      ...initialProductEntries
        .map((entry) => entry.product_id)
        .filter((productId): productId is string => ecoMap.has(productId)),
    ]);

    setSelectedEcoProductIds(Array.from(mergedEcoSelection));

    const ecoEntries = Array.from(mergedEcoSelection)
      .map((id) => ecoMap.get(id))
      .filter((p): p is ProductCatalogEntry => Boolean(p))
      .map((p) => createProductEntry(p));

    const productList =
      initialProductEntries.length > 0
        ? initialProductEntries
        : ecoEntries.length
        ? [...ecoEntries, createProductEntry()]
        : [createProductEntry()];

    const nextStatus =
      initialValues?.status && statusOptions.includes(initialValues.status)
        ? initialValues.status
        : defaultStatus;

    form.reset({
      ...baseDefaultValues,
      ...initialValues,
      status: nextStatus,
      assigned_to: initialValues?.assigned_to ?? defaultAssignee ?? "",
      source: initialValues?.source ?? defaultSource ?? "",
      delegate_id: initialValues?.delegate_id ?? defaultDelegateId ?? "",
      siren: initialValues?.siren ?? "",
      address: initialValues?.address ?? "",
      date_debut_prevue: initialValues?.date_debut_prevue ?? defaultStartDate ?? "",
      products: productList,
    } as ProjectFormValues);
  }, [
    open,
    ecoProducts,
    form,
    defaultAssignee,
    defaultSource,
    initialValues,
    productsData,
    defaultStatus,
    statusOptions,
    defaultStartDate,
    defaultDelegateId,
  ]);
  // **** end merged effect ****

  const handleEcoToggle = useCallback(
    (productId: string, checked: boolean | "indeterminate") => {
      const isChecked = checked === true;
      setSelectedEcoProductIds((prev) => {
        const next = isChecked
          ? Array.from(new Set([...prev, productId]))
          : prev.filter((id) => id !== productId);
        syncEcoProducts(next);
        return next;
      });
    },
    [syncEcoProducts]
  );

  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (!name?.startsWith("products") || !name.endsWith("product_id")) {
        return;
      }

      const match = name.match(/^products\.(\d+)\.product_id$/);
      if (!match) return;
      const index = Number(match[1]);
      const productId = value?.products?.[index]?.product_id as string | undefined;
      if (!productId) {
        form.setValue(`products.${index}.dynamic_params`, {});
        return;
      }

      const catalogProduct = productsData?.find((product) => product.id === productId);
      if (!catalogProduct) {
        form.setValue(`products.${index}.dynamic_params`, {});
        return;
      }

      form.setValue(
        `products.${index}.dynamic_params`,
        getInitialDynamicParams(catalogProduct)
      );

      if ((catalogProduct.code ?? "").toUpperCase().startsWith("ECO")) {
        setSelectedEcoProductIds((prev) => {
          if (prev.includes(catalogProduct.id!)) {
            return prev;
          }
          const next = [...prev, catalogProduct.id!];
          syncEcoProducts(next);
          return next;
        });
      }
    });

    return () => subscription.unsubscribe();
  }, [form, productsData, syncEcoProducts]);

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
      const dateStr = today.toISOString().split("T")[0].replace(/-/g, "");

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
        const lastRef = existingProjects[0].project_ref as string;
        const parts = lastRef.split("-");
        const lastNumber = parseInt(parts[2] || "0", 10);
        nextNumber = (Number.isFinite(lastNumber) ? lastNumber : 0) + 1;
      }

      const project_ref = `ECOP-${dateStr}-${nextNumber.toString().padStart(3, "0")}`;

      // Récupérer le nom du premier produit pour product_name (legacy)
      const firstProduct = productsData?.find((p) => p.id === data.products[0]?.product_id);
      const product_name = firstProduct?.name || "";

      // Créer le projet
      const normalizedSiren = (data.siren ?? "").replace(/\s+/g, "").trim();
      const clientFirstName = data.client_first_name.trim();
      const clientLastName = data.client_last_name.trim();
      const client_name = `${clientFirstName} ${clientLastName}`.replace(/\s+/g, " ").trim();

      const normalizedAddress = data.address?.trim();
      const normalizedHqAddress = data.hq_address?.trim();
      const normalizedExternalRef = data.external_reference?.trim();
      const projectCost = data.estimated_value ?? undefined;
      const delegateRecord = data.delegate_id
        ? delegatesById[data.delegate_id] ?? delegatesData?.find((delegate) => delegate.id === data.delegate_id)
        : undefined;
      const validProducts: PrimeProductInput[] = data.products
        .filter((p) => Boolean(p.product_id))
        .map((p) => ({
          product_id: p.product_id as string,
          quantity:
            typeof p.quantity === "number"
              ? p.quantity
              : Number.isFinite(Number(p.quantity))
                ? Number(p.quantity)
                : undefined,
          dynamic_params: p.dynamic_params ?? {},
        }));

      const primeCeeValue = computePrimeCee({
        products: validProducts,
        buildingType: data.building_type,
        delegate: delegateRecord,
        primeBonification,
        productMap,
      });
      const sanitizedPrimeCee = primeCeeValue ? primeCeeValue.totalPrime : undefined;

      const { data: createdProject, error: projectError } = await supabase
        .from("projects")
        .insert([
          {
            user_id: user.id,
            org_id: currentOrgId,
            project_ref,
            client_name,
            client_first_name: clientFirstName,
            client_last_name: clientLastName,
            product_name, // Pour compatibilité
            hq_address: normalizedHqAddress ? normalizedHqAddress : undefined,
            hq_city: data.hq_city || undefined,
            hq_postal_code: data.hq_postal_code || undefined,
            same_address: data.same_address || false,
            address: normalizedAddress ? normalizedAddress : undefined,
            external_reference: normalizedExternalRef ? normalizedExternalRef : undefined,
            city: data.city,
            postal_code: data.postal_code,
            status: data.status,
            assigned_to: data.assigned_to,
            source: data.source || undefined,
            company: data.company || undefined,
            phone: data.phone || undefined,
            siren: normalizedSiren ? normalizedSiren : undefined,
            building_type: data.building_type || undefined,
            usage: data.usage || undefined,
            prime_cee: sanitizedPrimeCee,
            delegate_id: data.delegate_id,
            signatory_name: data.signatory_name || undefined,
            signatory_title: data.signatory_title || undefined,
            surface_batiment_m2: data.surface_batiment_m2 || undefined,
            date_debut_prevue: data.date_debut_prevue || undefined,
            date_fin_prevue: data.date_fin_prevue || undefined,
            estimated_value: projectCost,
            lead_id: data.lead_id || undefined,
          },
        ])
        .select()
        .single();

      if (projectError) throw projectError;

      // Ajouter les produits au projet
      const projectProducts = data.products.map((p) => ({
        project_id: createdProject.id,
        product_id: p.product_id,
        quantity: p.quantity,
        dynamic_params: p.dynamic_params || {},
      }));

      const { error: productsInsertError } = await supabase
        .from("project_products")
        .insert(projectProducts);

      if (productsInsertError) throw productsInsertError;

      toast({
        title: "Projet créé",
        description: `Le projet ${project_ref} avec ${data.products.length} produit(s) a été ajouté avec succès`,
      });

      const defaultEcoIds = ecoProducts
        .map((product) => product.id)
        .filter((id): id is string => Boolean(id));
      setSelectedEcoProductIds(defaultEcoIds);

      const ecoEntries = defaultEcoIds
        .map((id) => ecoProducts.find((product) => product.id === id))
        .filter((product): product is ProductCatalogEntry => Boolean(product))
        .map((product) => createProductEntry(product));

      form.reset({
        ...baseDefaultValues,
        assigned_to: defaultAssignee ?? "",
        source: defaultSource ?? "",
        delegate_id: defaultDelegateId ?? "",
        products: ecoEntries.length ? ecoEntries : [createProductEntry()],
      } as ProjectFormValues);
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
                    value={field.value}
                    disabled={projectStatuses.length === 0}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            projectStatuses.length === 0
                              ? "Aucun statut disponible"
                              : "Sélectionnez un statut"
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {projectStatuses.map((status) => (
                        <SelectItem key={status.id} value={status.value}>
                          {status.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="client_first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prénom du client *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="client_last_name"
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
              <FormField
                control={form.control}
                name="source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source du projet *</FormLabel>
                    <FormControl>
                      <Input placeholder="Propriétaire du projet" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </div>

            {/* Headquarters Address Section */}
            <div className="space-y-4 rounded-lg border bg-muted/50 p-4">
              <h3 className="text-sm font-semibold">Adresse du Siège Social *</h3>
              
              <FormField
                control={form.control}
                name="hq_address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Adresse du siège *</FormLabel>
                    <FormControl>
                      <AddressAutocomplete
                        value={field.value}
                        onChange={(address, city, postalCode) => {
                          form.setValue("hq_address", address);
                          form.setValue("hq_city", city);
                          form.setValue("hq_postal_code", postalCode);
                          
                          // If same_address is checked, also update site address
                          if (form.watch("same_address")) {
                            form.setValue("address", address);
                            form.setValue("city", city);
                            form.setValue("postal_code", postalCode);
                          }
                        }}
                        disabled={loading}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="hq_city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ville du siège *</FormLabel>
                      <FormControl>
                        <Input {...field} disabled />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="hq_postal_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code postal du siège *</FormLabel>
                      <FormControl>
                        <Input {...field} disabled />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Same Address Checkbox */}
            <FormField
              control={form.control}
              name="same_address"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={async (checked) => {
                        field.onChange(checked);
                        if (checked) {
                          // Copy headquarters address to site address
                          const hqAddress = form.getValues("hq_address");
                          const hqCity = form.getValues("hq_city");
                          const hqPostalCode = form.getValues("hq_postal_code");
                          form.setValue("address", hqAddress);
                          form.setValue("city", hqCity);
                          form.setValue("postal_code", hqPostalCode);
                          // Trigger validation for the updated fields
                          await form.trigger(["address", "city", "postal_code"]);
                        }
                      }}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>
                      L'adresse du chantier est la même que celle du siège social
                    </FormLabel>
                  </div>
                </FormItem>
              )}
            />

            {/* Site Address Section */}
            <div className="space-y-4 rounded-lg border bg-muted/50 p-4">
              <h3 className="text-sm font-semibold">Adresse du Chantier *</h3>
              
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Adresse du chantier *</FormLabel>
                    <FormControl>
                      <AddressAutocomplete
                        value={field.value}
                        onChange={(address, city, postalCode) => {
                          form.setValue("address", address);
                          form.setValue("city", city);
                          form.setValue("postal_code", postalCode);
                        }}
                        disabled={loading || form.watch("same_address")}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ville *</FormLabel>
                      <FormControl>
                        <Input {...field} disabled />
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
                        <Input {...field} disabled />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="siren"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SIREN (optionnel)</FormLabel>
                    <FormControl>
                      <Input placeholder="000000000" maxLength={11} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="external_reference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Référence Externe</FormLabel>
                    <FormControl>
                      <Input placeholder="Référence délégataire..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </div>

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
                      disabled={buildingTypeOptions.length === 0}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              buildingTypeOptions.length === 0
                                ? "Configurez les types dans les paramètres"
                                : "Sélectionnez un type"
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {buildingTypeOptions.length === 0 ? (
                          <SelectItem value="__no-building-type__" disabled>
                            Aucun type disponible
                          </SelectItem>
                        ) : (
                          buildingTypeOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))
                        )}
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
                      disabled={usageOptions.length === 0}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              usageOptions.length === 0
                                ? "Configurez les usages dans les paramètres"
                                : "Sélectionnez un usage"
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {usageOptions.length === 0 ? (
                          <SelectItem value="__no-usage__" disabled>
                            Aucun usage disponible
                          </SelectItem>
                        ) : (
                          usageOptions.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))
                        )}
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

              {ecoProducts.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    Produits ECO ajoutés par défaut
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {ecoProducts.map((product) => (
                      <label
                        key={product.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <Checkbox
                          checked={selectedEcoProductIds.includes(product.id!)}
                          onCheckedChange={(checked) =>
                            handleEcoToggle(product.id!, checked)
                          }
                          disabled={loading}
                        />
                        <span className="font-medium">{product.code}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {visibleProductEntries.length > 1 ? (
                <p className="text-xs text-muted-foreground">
                  Faites glisser les poignées pour réorganiser vos produits dans l&apos;ordre souhaité.
                </p>
              ) : null}

              {visibleProductEntries.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                  Les produits ECO sélectionnés sont ajoutés automatiquement. Cliquez sur « Ajouter un produit » pour en
                  ajouter d&apos;autres.
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleProductDragEnd}
                >
                  <SortableContext items={visibleProductIds} strategy={verticalListSortingStrategy}>
                    {visibleProductEntries.map(({ field, index }) => (
                      <SortableProjectProductRow
                        key={field.id}
                        field={field}
                        index={index}
                        control={form.control}
                        form={form}
                        onRemove={removeProduct}
                        canRemove={
                          visibleProductEntries.length > 1 || selectedEcoProductIds.length > 0
                        }
                        productsLoading={productsLoading}
                        rawProductOptions={rawProductOptions}
                        productsData={productsData}
                        isSubmitting={loading}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="delegate_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Délégataire *</FormLabel>
                     <Select
                      onValueChange={field.onChange}
                      value={field.value}
                      disabled={delegatesLoading || delegateOptions.length === 0 || loading}
                    >
                      <FormControl>
                        <SelectTrigger className="h-auto">
                          <SelectValue
                            placeholder={
                              delegatesLoading
                                ? "Chargement..."
                                : delegateOptions.length > 0
                                ? "Sélectionnez un délégataire"
                                : "Aucun délégataire disponible"
                            }
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {delegatesLoading ? (
                          <SelectItem value="__loading" disabled>
                            Chargement...
                          </SelectItem>
                        ) : delegateOptions.length > 0 ? (
                          delegateOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value} className="h-auto py-3">
                              <div className="flex flex-col gap-1">
                                <span className="font-medium">{option.label}</span>
                                {option.description ? (
                                  <span className="text-sm font-semibold text-emerald-600">
                                    {option.description}
                                  </span>
                                ) : null}
                              </div>
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="__empty" disabled>
                            Aucun délégataire disponible
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    {selectedDelegate && typeof selectedDelegate.price_eur_per_mwh === "number" && (
                      <p className="text-sm font-semibold text-emerald-600">
                        {formatCurrency(selectedDelegate.price_eur_per_mwh)} / MWh
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="space-y-2">
                <FormLabel>Valorisation CEE</FormLabel>
                <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2.5 text-sm font-medium">
                  {!watchedBuildingType ? (
                    "Sélectionnez un type de bâtiment"
                  ) : totalValorisationMwh !== null && totalValorisationMwh > 0 ? (
                    `${formatDecimal(totalValorisationMwh)} MWh`
                  ) : (
                    "0 MWh"
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <FormLabel>Prime CEE estimée</FormLabel>
              <div className="space-y-2">
                <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm font-medium">
                  {delegatesLoading ? (
                    "Calcul en attente du chargement des délégataires..."
                  ) : !selectedDelegate ? (
                    "Sélectionnez un délégataire pour estimer la prime."
                  ) : !watchedBuildingType ? (
                    "Sélectionnez un type de bâtiment pour estimer la prime."
                  ) : hasPrimeCeeValue ? (
                    primeCeeTotal !== null ? formatCurrency(primeCeeTotal) : "0 €"
                  ) : (
                    "Impossible de calculer la prime : vérifiez les kWh cumac du produit choisi."
                  )}
                </div>

                {selectedDelegate && hasPrimeCeeValue && primeCeeProducts.length > 0 ? (
                  <div className="rounded-md border border-dashed border-border/60 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
                    <div className="font-semibold text-foreground">Détail par produit</div>
                    <ul className="mt-1 space-y-2">
                      {primeCeeProducts.map((product) => {
                        const label = product.productCode || product.productName || product.productId;
                        const valorisationLabel = (product.valorisationLabel || "Valorisation m²/LED").trim();
                        return (
                          <li key={product.productId} className="flex flex-col gap-1">
                            <span className="font-medium text-foreground">{label}</span>
                            <span className="text-sm font-semibold text-emerald-600">
                              {valorisationLabel}: {formatCurrency(product.valorisationPerUnitEur)} / {product.multiplierLabel}
                            </span>
                            <span className="text-sm font-semibold text-emerald-600">
                              Prime calculée : {formatCurrency(product.valorisationTotalEur)}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Soit {formatDecimal(product.valorisationPerUnitMwh)} MWh × {product.multiplierLabel} = {formatDecimal(
                                product.valorisationTotalMwh,
                              )} MWh
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                Valorisation CEE (MWh) = (kWh cumac × bonification × coefficient) / 1000. Prime estimée = Σ(Valorisation CEE × champ dynamique × tarif délégataire). Bonification projet par défaut : {formatDecimal(effectivePrimeBonification)}.
              </p>
              {missingKwhProductCodes.length > 0 ? (
                <p className="text-xs text-amber-600">
                  Valeurs kWh cumac manquantes pour : {missingKwhProductCodes.join(", ")}. Ces produits sont ignorés
                  dans le calcul.
                </p>
              ) : null}
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date_debut_prevue"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Date de début prévue</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {startDate
                              ? format(startDate, "PPP", { locale: fr })
                              : "Choisir une date"}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={startDate}
                          onSelect={(date) => {
                            field.onChange(date ? format(date, "yyyy-MM-dd") : "");
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="date_fin_prevue"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Date de fin prévue</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {endDate
                              ? format(endDate, "PPP", { locale: fr })
                              : "Choisir une date"}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={endDate}
                          onSelect={(date) => {
                            field.onChange(date ? format(date, "yyyy-MM-dd") : "");
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
