import type { Tables } from "@/integrations/supabase/types";

const EXCLUDED_CATEGORIES = ["ECO-FURN", "ECO-LOG", "ECO-ADMN"] as const;

type ProductCatalog = Tables<"product_catalog">;
type ProductKwhValue = Pick<Tables<"product_kwh_cumac">, "building_type" | "kwh_cumac">;
type Delegate = Pick<Tables<"delegates">, "price_eur_per_mwh">;

type SchemaField = {
  name?: string;
  label?: string;
  [key: string]: unknown;
};

export type PrimeProductInput = {
  product_id: string;
  quantity?: number;
  dynamic_params?: Record<string, unknown> | null;
};

export type PrimeCeeProductCatalogEntry = Pick<
  ProductCatalog,
  "id" | "name" | "code" | "category" | "is_active" | "params_schema" | "default_params"
> & {
  kwh_cumac_values?: ProductKwhValue[];
};

export type PrimeCeeProductResult = {
  productId: string;
  productCode?: string | null;
  productName?: string | null;
  valorisationBase: number;
  multiplier: number;
  multiplierLabel: string;
  total: number;
};

export type PrimeCeeComputation = {
  total: number;
  products: PrimeCeeProductResult[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeString = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value.replace(/\s+/g, "").replace(",", "."));
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

const roundToTwo = (value: number) => Math.round(value * 100) / 100;

const getSchemaFields = (
  paramsSchema: PrimeCeeProductCatalogEntry["params_schema"]
): SchemaField[] => {
  if (!paramsSchema) {
    return [];
  }

  if (Array.isArray(paramsSchema)) {
    return paramsSchema.filter((field): field is SchemaField => isRecord(field));
  }

  if (isRecord(paramsSchema) && Array.isArray(paramsSchema.fields)) {
    return paramsSchema.fields.filter((field): field is SchemaField => isRecord(field));
  }

  return [];
};

const matchesField = (field: SchemaField, targets: string[]) => {
  const name = typeof field.name === "string" ? normalizeString(field.name) : "";
  const label = typeof field.label === "string" ? normalizeString(field.label) : "";

  return targets.some((target) => {
    const normalizedTarget = normalizeString(target);
    return name === normalizedTarget || label === normalizedTarget;
  });
};

type MultiplierDetection = {
  value: number;
  label: string;
};

const getMultiplierValue = ({
  product,
  productInput,
}: {
  product: PrimeCeeProductCatalogEntry;
  productInput: PrimeProductInput;
}): MultiplierDetection | null => {
  const schemaFields = getSchemaFields(product.params_schema);
  const dynamicParams = isRecord(productInput.dynamic_params)
    ? productInput.dynamic_params
    : undefined;

  const dynamicTargets: { targets: string[]; fallbackLabel: string }[] = [
    {
      targets: ["surface_facturee", "surface facturée"],
      fallbackLabel: "Surface facturée",
    },
    {
      targets: ["nombre_de_luminaire", "nombre de luminaire", "nombre_luminaire"],
      fallbackLabel: "Nombre de luminaire",
    },
  ];

  for (const { targets, fallbackLabel } of dynamicTargets) {
    const matchingField = schemaFields.find((field) => matchesField(field, targets));
    if (!matchingField || !dynamicParams) {
      continue;
    }

    const key = typeof matchingField.name === "string" ? matchingField.name : undefined;
    if (!key) {
      continue;
    }

    const value = toNumber(dynamicParams[key]);
    if (value && value > 0) {
      return {
        value,
        label: typeof matchingField.label === "string" && matchingField.label.length > 0
          ? matchingField.label
          : fallbackLabel,
      };
    }
  }

  if (dynamicParams) {
    const dynamicFallbacks: { key: string; label: string }[] = [
      { key: "quantity", label: "Quantité (champ dynamique)" },
      { key: "surface_isolee", label: "Surface isolée" },
      { key: "nombre_led", label: "Nombre de LED" },
      { key: "surface", label: "Surface" },
    ];

    for (const { key, label } of dynamicFallbacks) {
      if (Object.prototype.hasOwnProperty.call(dynamicParams, key)) {
        const value = toNumber(dynamicParams[key]);
        if (value && value > 0) {
          return { value, label };
        }
      }
    }
  }

  if (typeof productInput.quantity === "number" && Number.isFinite(productInput.quantity)) {
    return {
      value: productInput.quantity,
      label: "Quantité",
    };
  }

  return null;
};

export const resolveBonificationFactor = (value: number | null | undefined) => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  return 2;
};

export const computePrimeCee = ({
  products,
  productMap,
  buildingType,
  delegate,
  primeBonification,
}: {
  products: PrimeProductInput[];
  productMap: Record<string, PrimeCeeProductCatalogEntry>;
  buildingType?: string | null;
  delegate?: Delegate | null;
  primeBonification?: number | null;
}): PrimeCeeComputation | null => {
  if (!delegate || !buildingType) {
    return null;
  }

  const pricePerMwh =
    typeof delegate.price_eur_per_mwh === "number" && Number.isFinite(delegate.price_eur_per_mwh)
      ? delegate.price_eur_per_mwh
      : 0;

  if (pricePerMwh <= 0) {
    return {
      total: 0,
      products: [],
    };
  }

  const bonification = resolveBonificationFactor(primeBonification);

  const productResults: PrimeCeeProductResult[] = [];

  for (const productInput of products) {
    if (!productInput?.product_id) {
      continue;
    }

    const product = productMap[productInput.product_id];
    if (!product) {
      continue;
    }

    if (product.category && EXCLUDED_CATEGORIES.includes(product.category as (typeof EXCLUDED_CATEGORIES)[number])) {
      continue;
    }

    const kwhEntry = product.kwh_cumac_values?.find((value) => {
      return value.building_type === buildingType && typeof value.kwh_cumac === "number";
    });

    if (!kwhEntry || typeof kwhEntry.kwh_cumac !== "number" || !Number.isFinite(kwhEntry.kwh_cumac)) {
      continue;
    }

    const multiplier = getMultiplierValue({ product, productInput });
    if (!multiplier || multiplier.value <= 0) {
      continue;
    }

    const valorisationBase = (kwhEntry.kwh_cumac * bonification * pricePerMwh) / 1000;
    if (!Number.isFinite(valorisationBase) || valorisationBase <= 0) {
      continue;
    }

    const productTotal = valorisationBase * multiplier.value;
    if (!Number.isFinite(productTotal) || productTotal <= 0) {
      continue;
    }

    productResults.push({
      productId: product.id ?? productInput.product_id,
      productCode: product.code,
      productName: product.name,
      valorisationBase,
      multiplier: multiplier.value,
      multiplierLabel: multiplier.label,
      total: productTotal,
    });
  }

  const total = roundToTwo(productResults.reduce((sum, result) => sum + result.total, 0));

  return {
    total,
    products: productResults.map((result) => ({
      ...result,
      valorisationBase: roundToTwo(result.valorisationBase),
      multiplier: roundToTwo(result.multiplier),
      total: roundToTwo(result.total),
    })),
  };
};
