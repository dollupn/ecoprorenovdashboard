import type { Tables } from "@/integrations/supabase/types";
import { getDynamicFieldEntries } from "@/lib/product-params";

type ProductCatalogSummary = Pick<
  Tables<"product_catalog">,
  "id" | "code" | "name" | "category" | "params_schema"
> & {
  kwh_cumac_values?: Pick<
    Tables<"product_kwh_cumac">,
    "id" | "building_type" | "kwh_cumac"
  >[];
};

type ProjectProductSummary = Pick<
  Tables<"project_products">,
  "id" | "product_id" | "quantity" | "dynamic_params"
> & {
  product: ProductCatalogSummary | null;
};

type DelegateSummary = Pick<Tables<"delegates">, "price_eur_per_mwh"> | null | undefined;

export type ProjectProductValorisation = {
  projectProductId: string;
  productId: string | null;
  productCode: string | null;
  productName: string | null;
  multiplierValue: number | null;
  multiplierFieldName: string | null;
  multiplierLabel: string;
  multiplierUnit?: string;
  totalPrime: number | null;
  valorisationPerUnit: number | null;
};

export type ProjectPrimeValorisationResult = {
  totalPrime: number | null;
  products: ProjectProductValorisation[];
};

const EXCLUDED_PRODUCT_CATEGORIES = new Set(["ECO-FURN", "ECO-LOG", "ECO-ADMN"]);

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const formatLabelFromName = (name?: string | null) => {
  if (!name) return "Unité";

  return name
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
};

const resolveMultiplier = (
  projectProduct: ProjectProductSummary,
  dynamicEntries: ReturnType<typeof getDynamicFieldEntries>
) => {
  const dynamicParams = projectProduct.dynamic_params;

  if (!dynamicParams || typeof dynamicParams !== "object") {
    const quantityValue = toNumber(projectProduct.quantity);
    return {
      value: quantityValue,
      fieldName: quantityValue ? "quantity" : null,
      label: quantityValue ? "Quantité" : "Unité",
      unit: undefined,
    } as const;
  }

  const paramsRecord = dynamicParams as Record<string, unknown>;
  const dynamicEntryMap = dynamicEntries.reduce<Record<string, (typeof dynamicEntries)[number]>>(
    (acc, entry) => {
      acc[entry.name] = entry;
      return acc;
    },
    {}
  );

  const preferredFields = [
    "surface_facturee",
    "surface_isolee",
    "surface",
    "surface_isolee_m2",
    "surface_facturee_m2",
    "nombre_led",
    "nombre_appareils",
    "nombre_points_lumineux",
    "quantity",
  ];

  for (const fieldName of preferredFields) {
    if (!(fieldName in paramsRecord)) continue;
    const maybeValue = toNumber(paramsRecord[fieldName]);
    if (!maybeValue || maybeValue <= 0) continue;

    const entry = dynamicEntryMap[fieldName];
    return {
      value: maybeValue,
      fieldName,
      label: entry?.label ?? formatLabelFromName(fieldName),
      unit: entry?.unit,
    } as const;
  }

  for (const [fieldName, rawValue] of Object.entries(paramsRecord)) {
    const maybeValue = toNumber(rawValue);
    if (!maybeValue || maybeValue <= 0) continue;

    const entry = dynamicEntryMap[fieldName];
    return {
      value: maybeValue,
      fieldName,
      label: entry?.label ?? formatLabelFromName(fieldName),
      unit: entry?.unit,
    } as const;
  }

  const quantityValue = toNumber(projectProduct.quantity);
  return {
    value: quantityValue,
    fieldName: quantityValue ? "quantity" : null,
    label: quantityValue ? "Quantité" : "Unité",
    unit: undefined,
  } as const;
};

export const computeProjectPrimeAndValorisation = ({
  products,
  buildingType,
  delegate,
  primeBonification,
}: {
  products: ProjectProductSummary[] | null | undefined;
  buildingType?: string | null;
  delegate?: DelegateSummary;
  primeBonification: number;
}): ProjectPrimeValorisationResult => {
  if (!products || products.length === 0) {
    return { totalPrime: null, products: [] };
  }

  const pricePerMwh = toNumber(delegate?.price_eur_per_mwh) ?? 0;
  const bonification = Number.isFinite(primeBonification)
    ? primeBonification
    : 1;

  let totalPrimeAccumulator = 0;
  const productResults: ProjectProductValorisation[] = [];

  for (const projectProduct of products) {
    const productId = projectProduct.product_id ?? projectProduct.product?.id ?? null;
    const projectProductId = projectProduct.id?.toString();

    if (!projectProductId) {
      continue;
    }

    const product = projectProduct.product;

    if (!product) {
      continue;
    }

    if (product.category && EXCLUDED_PRODUCT_CATEGORIES.has(product.category)) {
      continue;
    }

    const kwhEntry = product.kwh_cumac_values?.find((entry) => {
      return (
        entry.building_type === buildingType &&
        typeof entry.kwh_cumac === "number" &&
        Number.isFinite(entry.kwh_cumac)
      );
    });

    if (!kwhEntry) {
      continue;
    }

    const dynamicEntries = getDynamicFieldEntries(
      product.params_schema ?? null,
      projectProduct.dynamic_params
    );

    const { value: multiplierValue, fieldName, label, unit } = resolveMultiplier(
      projectProduct,
      dynamicEntries
    );

    if (!multiplierValue || multiplierValue <= 0) {
      continue;
    }

    const baseAmount =
      (kwhEntry.kwh_cumac * bonification * pricePerMwh) /
      1000;

    if (!Number.isFinite(baseAmount) || baseAmount <= 0) {
      continue;
    }

    const totalPrime = baseAmount * multiplierValue;
    const roundedTotalPrime = Math.round(totalPrime * 100) / 100;
    totalPrimeAccumulator += roundedTotalPrime;

    productResults.push({
      projectProductId,
      productId,
      productCode: product.code ?? null,
      productName: product.name ?? null,
      multiplierValue,
      multiplierFieldName: fieldName,
      multiplierLabel: label,
      multiplierUnit: unit,
      totalPrime: roundedTotalPrime,
      valorisationPerUnit: Math.round(baseAmount * 100) / 100,
    });
  }

  if (productResults.length === 0) {
    return { totalPrime: null, products: [] };
  }

  const roundedTotal = Math.round(totalPrimeAccumulator * 100) / 100;

  return {
    totalPrime: roundedTotal,
    products: productResults,
  };
};

