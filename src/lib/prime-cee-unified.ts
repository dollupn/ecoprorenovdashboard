import type { Tables } from "@/integrations/supabase/types";
import { FORMULA_QUANTITY_KEY, normalizeValorisationFormula } from "./valorisation-formula";

// ============================================================================
// TYPES
// ============================================================================

type ProductCatalog = Tables<"product_catalog">;
type ProductKwhValue = Pick<Tables<"product_kwh_cumac">, "building_type" | "kwh_cumac">;
type Delegate = Pick<Tables<"delegates">, "price_eur_per_mwh">;
type ProjectProduct = Pick<
  Tables<"project_products">,
  "product_id" | "quantity" | "dynamic_params"
> & {
  id?: string; // Optional since new products don't have IDs yet
};

export type PrimeProductInput = {
  product_id: string;
  quantity?: number | null;
  dynamic_params?: Record<string, unknown> | null;
  id?: string; // Optional ID for existing products
};

type SchemaField = {
  name?: string;
  label?: string;
  [key: string]: unknown;
};

export type PrimeCeeProductCatalogEntry = Pick<
  ProductCatalog,
  | "id"
  | "name"
  | "code"
  | "category"
  | "is_active"
  | "params_schema"
  | "default_params"
  | "valorisation_bonification"
  | "valorisation_coefficient"
  | "valorisation_formula"
> & {
  kwh_cumac_values?: ProductKwhValue[];
};

export type PrimeCeeProductResult = {
  projectProductId: string;
  productId: string;
  productCode?: string | null;
  productName?: string | null;
  baseKwh: number;
  bonification: number;
  coefficient: number;
  valorisationPerUnitMwh: number;
  multiplier: number;
  multiplierLabel: string;
  valorisationTotalMwh: number;
  delegatePrice: number;
  totalPrime: number;
};

export type PrimeCeeComputation = {
  totalPrime: number;
  totalValorisationMwh: number;
  delegatePrice: number;
  products: PrimeCeeProductResult[];
};

// ============================================================================
// CONSTANTS
// ============================================================================

// Products starting with "ECO" are excluded from Prime CEE calculation
const EXCLUDED_CATEGORY_PREFIXES = ["ECO"] as const;

// Priority order for dynamic field detection
const DYNAMIC_FIELD_PRIORITIES = [
  { targets: ["surface_isolee", "surface isolée"], fallbackLabel: "Surface isolée" },
  { targets: ["nombre_led", "nombre de led"], fallbackLabel: "Nombre de LED" },
  { targets: ["quantity", "quantité"], fallbackLabel: "Quantité" },
  { targets: ["surface_facturee", "surface facturée"], fallbackLabel: "Surface facturée" },
  { targets: ["nombre_de_luminaire", "nombre de luminaire", "nombre_luminaire"], fallbackLabel: "Nombre de luminaire" },
  { targets: ["surface"], fallbackLabel: "Surface" },
] as const;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

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

const toPositiveNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  return null;
};

const roundToTwo = (value: number) => Math.round(value * 100) / 100;

// ============================================================================
// SCHEMA PARSING
// ============================================================================

const getSchemaFields = (paramsSchema: unknown): SchemaField[] => {
  if (!paramsSchema) {
    return [];
  }

  // Handle array of fields directly
  if (Array.isArray(paramsSchema)) {
    return paramsSchema.filter((field): field is SchemaField => isRecord(field));
  }

  // Handle object with fields property
  if (isRecord(paramsSchema) && Array.isArray(paramsSchema.fields)) {
    return (paramsSchema.fields as unknown[]).filter((field): field is SchemaField => isRecord(field));
  }

  return [];
};

const matchesField = (field: SchemaField, targets: readonly string[]) => {
  const name = typeof field.name === "string" ? normalizeString(field.name) : "";
  const label = typeof field.label === "string" ? normalizeString(field.label) : "";

  return targets.some((target) => {
    const normalizedTarget = normalizeString(target);
    return name === normalizedTarget || label === normalizedTarget;
  });
};

// ============================================================================
// MULTIPLIER DETECTION
// ============================================================================

type MultiplierDetection = {
  value: number;
  label: string;
};

const resolveFormulaMultiplier = ({
  formula,
  schemaFields,
  dynamicParams,
  quantity,
}: {
  formula: ProductCatalog["valorisation_formula"];
  schemaFields: SchemaField[];
  dynamicParams?: Record<string, unknown>;
  quantity?: number | null;
}): MultiplierDetection | null => {
  const normalized = normalizeValorisationFormula(formula);
  if (!normalized) {
    return null;
  }

  if (normalized.variableKey === FORMULA_QUANTITY_KEY) {
    if (typeof quantity === "number" && Number.isFinite(quantity) && quantity > 0) {
      const label = normalized.variableLabel ?? "Quantité";
      return { value: quantity, label };
    }
    return null;
  }

  if (!dynamicParams) {
    return null;
  }

  const rawValue = dynamicParams[normalized.variableKey];
  const numericValue = toNumber(rawValue);
  if (!numericValue || numericValue <= 0) {
    return null;
  }

  const match = schemaFields.find((field) => field.name === normalized.variableKey);
  const label =
    (normalized.variableLabel && normalized.variableLabel.length > 0 && normalized.variableLabel) ||
    (typeof match?.label === "string" && match.label.length > 0 ? match.label : undefined) ||
    (typeof match?.name === "string" && match.name.length > 0 ? match.name : undefined) ||
    normalized.variableKey;

  return { value: numericValue, label };
};

/**
 * Computes Valorisation and Prime CEE for a list of products.
 *
 * Valorisation CEE (MWh) = (kWh cumac × bonification × coefficient) / 1000
 * Prime CEE (€) = Valorisation CEE (MWh) × champ dynamique × tarif délégataire
 *
 * Products starting with "ECO" are excluded from calculation.
 */
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
  if (!buildingType) {
    return null;
  }

  const delegatePrice =
    typeof delegate?.price_eur_per_mwh === "number" && Number.isFinite(delegate.price_eur_per_mwh)
      ? delegate.price_eur_per_mwh
      : 0;

  const productResults: PrimeCeeProductResult[] = [];
  let totalPrime = 0;
  let totalValorisationMwh = 0;

  for (const projectProduct of products) {
    if (!projectProduct?.product_id) {
      continue;
    }

    const product = productMap[projectProduct.product_id];
    if (!product) {
      continue;
    }

    if (isProductExcluded(product)) {
      continue;
    }

    const kwhEntry = product.kwh_cumac_values?.find((value) => {
      return value.building_type === buildingType && typeof value.kwh_cumac === "number";
    });

    if (!kwhEntry || typeof kwhEntry.kwh_cumac !== "number" || !Number.isFinite(kwhEntry.kwh_cumac)) {
      continue;
    }

    const baseKwh = kwhEntry.kwh_cumac;
    if (baseKwh <= 0) {
      continue;
    }

    const productBonification = toPositiveNumber(product.valorisation_bonification);
    const bonification = resolveBonificationFactor(productBonification ?? primeBonification);
    const coefficient = resolveProductCoefficient(product);

    const valorisationPerUnitMwh = (baseKwh * bonification * coefficient) / 1000;
    if (!Number.isFinite(valorisationPerUnitMwh) || valorisationPerUnitMwh <= 0) {
      continue;
    }

    const multiplierDetection = getMultiplierValue({ product, projectProduct });
    const multiplierValue =
      multiplierDetection && Number.isFinite(multiplierDetection.value) && multiplierDetection.value > 0
        ? multiplierDetection.value
        : 0;
    const multiplierLabel = multiplierDetection?.label ?? "Multiplicateur non renseigné";

    const valorisationTotalMwh = valorisationPerUnitMwh * multiplierValue;
    const productPrime = valorisationTotalMwh * delegatePrice;

    totalValorisationMwh += valorisationTotalMwh;
    totalPrime += productPrime;

    productResults.push({
      projectProductId: projectProduct.id ?? projectProduct.product_id,
      productId: product.id ?? projectProduct.product_id,
      productCode: product.code,
      productName: product.name,
      baseKwh,
      bonification,
      coefficient,
      valorisationPerUnitMwh,
      multiplier: multiplierValue,
      multiplierLabel,
      valorisationTotalMwh,
      delegatePrice,
      totalPrime: productPrime,
    });
  }

  return {
    totalPrime: roundToTwo(totalPrime),
    totalValorisationMwh: roundToTwo(totalValorisationMwh),
    delegatePrice: roundToTwo(delegatePrice),
    products: productResults.map((result) => ({
      ...result,
      baseKwh: roundToTwo(result.baseKwh),
      bonification: roundToTwo(result.bonification),
      coefficient: roundToTwo(result.coefficient),
      valorisationPerUnitMwh: roundToTwo(result.valorisationPerUnitMwh),
      multiplier: roundToTwo(result.multiplier),
      valorisationTotalMwh: roundToTwo(result.valorisationTotalMwh),
      delegatePrice: roundToTwo(result.delegatePrice),
      totalPrime: roundToTwo(result.totalPrime),
    })),
  };
};
