import type { Tables } from "@/integrations/supabase/types";
import {
  FORMULA_QUANTITY_KEY,
  formatFormulaCoefficient,
  normalizeValorisationFormula,
} from "./valorisation-formula";

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

export type ProductCeeMultiplierConfig = {
  key: string | null;
  coefficient: number | null;
};

export type ProductCeeOverrideConfig = {
  bonification: number | null;
  coefficient: number | null;
  multiplier: ProductCeeMultiplierConfig | null;
};

export type ProductCeeConfig = {
  defaults: ProductCeeOverrideConfig;
  overrides: Record<string, ProductCeeOverrideConfig>;
};

export const EMPTY_PRODUCT_CEE_OVERRIDE: ProductCeeOverrideConfig = {
  bonification: null,
  coefficient: null,
  multiplier: null,
};

export const DEFAULT_PRODUCT_CEE_CONFIG: ProductCeeConfig = {
  defaults: { ...EMPTY_PRODUCT_CEE_OVERRIDE },
  overrides: {},
};

type PrimeProductBase = Pick<
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
  | "cee_config"
>;

export type PrimeCeeProductCatalogEntry = Omit<PrimeProductBase, "cee_config"> & {
  cee_config: ProductCeeConfig;
  kwh_cumac_values?: ProductKwhValue[];
};

export type PrimeCeeProductResult = {
  projectProductId: string;
  productId: string;
  productCode: string | null;
  productName: string | null;
  baseKwh: number;
  bonification: number;
  coefficient: number;
  valorisationPerUnitMwh: number;
  valorisationPerUnitEur: number;
  valorisationLabel: string;
  multiplier: number;
  multiplierLabel: string;
  valorisationTotalMwh: number;
  valorisationTotalEur: number;
  delegatePrice: number;
  totalPrime: number;
};

export type PrimeCeeComputation = {
  totalPrime: number;
  totalValorisationMwh: number;
  totalValorisationEur: number;
  delegatePrice: number;
  products: PrimeCeeProductResult[];
};

export type PrimeCeeValorisationEntry = PrimeCeeProductResult & {
  valorisationPerUnit: number;
};

export type PrimeCeeProductDisplayMapEntry = {
  productCode?: string | null;
  productName?: string | null;
};

export type PrimeCeeProductDisplayMap = Record<string, PrimeCeeProductDisplayMapEntry>;

// ============================================================================
// CONSTANTS
// ============================================================================

// Products starting with "ECO" are excluded from Prime CEE calculation
const EXCLUDED_CATEGORY_PREFIXES = ["ECO"] as const;

const DEFAULT_MULTIPLIER_LABEL = "Multiplicateur non renseigné";

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

const toNullableNumber = (value: unknown): number | null => toNumber(value);

const sanitizeMultiplierConfig = (value: unknown): ProductCeeMultiplierConfig | null => {
  if (!isRecord(value)) {
    return null;
  }

  const key = typeof value.key === "string" && value.key.trim().length > 0 ? value.key.trim() : null;
  const coefficient = toNullableNumber(value.coefficient);

  if (!key && coefficient === null) {
    return null;
  }

  return {
    key,
    coefficient,
  };
};

const sanitizeOverrideConfig = (value: unknown): ProductCeeOverrideConfig => {
  if (!isRecord(value)) {
    return { ...EMPTY_PRODUCT_CEE_OVERRIDE };
  }

  return {
    bonification: toNullableNumber(value.bonification),
    coefficient: toNullableNumber(value.coefficient),
    multiplier: sanitizeMultiplierConfig(value.multiplier),
  };
};

export const normalizeProductCeeConfig = (value: unknown): ProductCeeConfig => {
  if (!isRecord(value)) {
    return { ...DEFAULT_PRODUCT_CEE_CONFIG, defaults: { ...EMPTY_PRODUCT_CEE_OVERRIDE }, overrides: {} };
  }

  const overrides: Record<string, ProductCeeOverrideConfig> = {};

  if (isRecord(value.overrides)) {
    for (const [rawKey, rawValue] of Object.entries(value.overrides)) {
      if (typeof rawKey !== "string") {
        continue;
      }
      const key = rawKey.trim();
      if (key.length === 0) {
        continue;
      }
      overrides[key] = sanitizeOverrideConfig(rawValue);
    }
  }

  return {
    defaults: sanitizeOverrideConfig(value.defaults),
    overrides,
  };
};

export const withDefaultProductCeeConfig = <T extends { cee_config?: unknown }>(
  product: T,
): Omit<T, "cee_config"> & { cee_config: ProductCeeConfig } => ({
  ...product,
  cee_config: normalizeProductCeeConfig(product.cee_config),
});

const roundToTwo = (value: number) => Math.round(value * 100) / 100;

// ============================================================================
// VALORISATION ENTRY BUILDER
// ============================================================================

export const buildPrimeCeeEntries = ({
  computation,
  productMap,
}: {
  computation: PrimeCeeComputation | null | undefined;
  productMap: PrimeCeeProductDisplayMap;
}): PrimeCeeValorisationEntry[] => {
  if (!computation) return [];

  return computation.products
    .map((product) => {
      const mapEntry = productMap[product.projectProductId];
      if (!mapEntry) {
        return null;
      }

      if (!product.multiplier || product.multiplier <= 0) {
        return null;
      }

      const valorisationPerUnitRaw = product.valorisationPerUnitMwh * product.delegatePrice;
      if (!Number.isFinite(valorisationPerUnitRaw) || valorisationPerUnitRaw <= 0) {
        return null;
      }

      return {
        ...product,
        productCode: mapEntry.productCode ?? product.productCode ?? null,
        productName: mapEntry.productName ?? product.productName ?? null,
        valorisationPerUnit: roundToTwo(valorisationPerUnitRaw),
      } satisfies PrimeCeeValorisationEntry;
    })
    .filter((entry): entry is PrimeCeeValorisationEntry => Boolean(entry));
};

// ============================================================================
// SCHEMA PARSING
// ============================================================================

const getSchemaFields = (paramsSchema: unknown): SchemaField[] => {
  if (!paramsSchema) return [];

  // Handle array of fields directly
  if (Array.isArray(paramsSchema)) {
    return paramsSchema.filter((field): field is SchemaField => isRecord(field));
  }

  // Handle object with fields property
  if (isRecord(paramsSchema) && Array.isArray(paramsSchema.fields)) {
    return (paramsSchema.fields as unknown[]).filter((field): field is SchemaField =>
      isRecord(field),
    );
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
  if (!normalized) return null;

  const coefficient = toPositiveNumber(normalized.coefficient) ?? 1;
  const withCoefficientLabel = (label: string) =>
    coefficient !== 1 ? `${label} × ${formatFormulaCoefficient(coefficient)}` : label;

  if (normalized.variableKey === FORMULA_QUANTITY_KEY) {
    const quantityValue = toPositiveNumber(quantity);
    if (quantityValue) {
      const label = normalized.variableLabel ?? "Quantité";
      return { value: quantityValue * coefficient, label: withCoefficientLabel(label) };
    }
    return null;
  }

  if (!dynamicParams) return null;

  const rawValue = dynamicParams[normalized.variableKey];
  const numericValue = toNumber(rawValue);
  if (!numericValue || numericValue <= 0) return null;

  const match = schemaFields.find((field) => field.name === normalized.variableKey);
  const label =
    (normalized.variableLabel && normalized.variableLabel.length > 0 && normalized.variableLabel) ||
    (typeof match?.label === "string" && match.label.length > 0 ? match.label : undefined) ||
    (typeof match?.name === "string" && match.name.length > 0 ? match.name : undefined) ||
    normalized.variableKey;

  return { value: numericValue * coefficient, label: withCoefficientLabel(label) };
};

// ============================================================================
// MULTIPLIER RESOLUTION (PUBLIC API)
// ============================================================================

/**
 * Detects the multiplier (champ dynamique) from product parameters
 * Priority: surface_isolee > nombre_led > quantity > other dynamic fields
 */
export const getMultiplierValue = ({
  product,
  projectProduct,
}: {
  product: PrimeCeeProductCatalogEntry;
  projectProduct: ProjectProduct;
}): MultiplierDetection | null => {
  const schemaFields = getSchemaFields(product.params_schema);
  const dynamicParams = isRecord(projectProduct.dynamic_params)
    ? (projectProduct.dynamic_params as Record<string, unknown>)
    : undefined;
  const quantityValue = toPositiveNumber(projectProduct.quantity);

  const formulaMultiplier = resolveFormulaMultiplier({
    formula: product.valorisation_formula,
    schemaFields,
    dynamicParams,
    quantity: quantityValue,
  });

  if (formulaMultiplier) {
    return formulaMultiplier;
  }

  if (dynamicParams) {
    for (const { targets, fallbackLabel } of DYNAMIC_FIELD_PRIORITIES) {
      const matchingField = schemaFields.find((field) => matchesField(field, targets));
      if (!matchingField) continue;

      const key = typeof matchingField.name === "string" ? matchingField.name : undefined;
      if (!key) continue;

      const value = toNumber(dynamicParams[key]);
      if (!value || value <= 0) continue;

      const label =
        (typeof matchingField.label === "string" && matchingField.label.length > 0
          ? matchingField.label
          : undefined) ?? fallbackLabel;

      return { value, label };
    }
  }

  if (quantityValue && quantityValue > 0) {
    return { value: quantityValue, label: "Quantité" };
  }

  return null;
};

// ============================================================================
// BONIFICATION & COEFFICIENT HELPERS
// ============================================================================

export const resolveBonificationFactor = (value: number | null | undefined) => {
  const numeric = toPositiveNumber(value);
  return numeric ?? 2;
};

export const resolveProductCoefficient = (
  product: Pick<ProductCatalog, "valorisation_coefficient">,
) => {
  const numeric = toPositiveNumber(product.valorisation_coefficient);
  return numeric ?? 1;
};

// ============================================================================
// CATEGORY EXCLUSION
// ============================================================================

export const isProductExcluded = (product: { category?: string | null; code?: string | null }) => {
  const category = (product.category ?? "").toUpperCase();
  const code = (product.code ?? "").toUpperCase();

  return EXCLUDED_CATEGORY_PREFIXES.some((prefix) =>
    category.startsWith(prefix) || code.startsWith(prefix),
  );
};

export const getValorisationLabel = (
  entry?: Pick<PrimeCeeProductResult, "multiplierLabel"> | null,
) => {
  if (!entry?.multiplierLabel) {
    return DEFAULT_MULTIPLIER_LABEL;
  }

  const trimmed = entry.multiplierLabel.trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_MULTIPLIER_LABEL;
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
  let totalValorisationEur = 0;

  for (const projectProduct of products) {
    if (!projectProduct?.product_id) continue;

    const product = productMap[projectProduct.product_id];
    if (!product) continue;

    if (isProductExcluded(product)) continue;

    const kwhEntry = product.kwh_cumac_values?.find(
      (value) => value.building_type === buildingType && typeof value.kwh_cumac === "number",
    );

    if (!kwhEntry || typeof kwhEntry.kwh_cumac !== "number" || !Number.isFinite(kwhEntry.kwh_cumac)) {
      continue;
    }

    const baseKwh = kwhEntry.kwh_cumac;
    if (baseKwh <= 0) continue;

    const productBonification = toPositiveNumber(product.valorisation_bonification);
    const bonification = resolveBonificationFactor(productBonification ?? primeBonification);
    const coefficient = resolveProductCoefficient(product);

    const valorisationPerUnitMwh = (baseKwh * bonification * coefficient) / 1000;
    if (!Number.isFinite(valorisationPerUnitMwh) || valorisationPerUnitMwh <= 0) {
      continue;
    }

    const multiplierDetection = getMultiplierValue({ 
      product, 
      projectProduct: {
        product_id: projectProduct.product_id,
        quantity: projectProduct.quantity,
        dynamic_params: projectProduct.dynamic_params as any,
      }
    });
    const multiplierValue =
      multiplierDetection && Number.isFinite(multiplierDetection.value) && multiplierDetection.value > 0
        ? multiplierDetection.value
        : 0;
    const multiplierLabel = getValorisationLabel(
      multiplierDetection?.label ? { multiplierLabel: multiplierDetection.label } : null,
    );

    const valorisationTotalMwh = valorisationPerUnitMwh * multiplierValue;
    const valorisationPerUnitEur = valorisationPerUnitMwh * delegatePrice;
    const valorisationTotalEur = valorisationTotalMwh * delegatePrice;
    const valorisationLabel = multiplierDetection?.label
      ? `Valorisation ${multiplierDetection.label}`
      : "Valorisation m²/LED";
    const productPrime = valorisationTotalEur;

    totalValorisationMwh += valorisationTotalMwh;
    totalPrime += productPrime;
    totalValorisationEur += valorisationTotalEur;

    totalValorisationMwh += valorisationTotalMwh;
    totalValorisationEur += valorisationTotalEur;
    totalPrime += valorisationTotalEur;

    productResults.push({
      projectProductId: projectProduct.id ?? projectProduct.product_id,
      productId: product.id ?? projectProduct.product_id,
      productCode: product.code ?? null,
      productName: product.name ?? null,
      baseKwh,
      bonification,
      coefficient,
      valorisationPerUnitMwh,
      valorisationPerUnitEur,
      valorisationLabel,
      multiplier: multiplierValue,
      multiplierLabel,
      valorisationTotalMwh,
      valorisationTotalEur,
      delegatePrice,
      totalPrime: valorisationTotalEur,
    });
  }

  return {
    totalPrime: roundToTwo(totalPrime),
    totalValorisationMwh: roundToTwo(totalValorisationMwh),
    totalValorisationEur: roundToTwo(totalValorisationEur),
    delegatePrice: roundToTwo(delegatePrice),
    products: productResults.map((result) => ({
      ...result,
      baseKwh: roundToTwo(result.baseKwh),
      bonification: roundToTwo(result.bonification),
      coefficient: roundToTwo(result.coefficient),
      valorisationPerUnitMwh: roundToTwo(result.valorisationPerUnitMwh),
      valorisationPerUnitEur: roundToTwo(result.valorisationPerUnitEur),
      multiplier: roundToTwo(result.multiplier),
      valorisationTotalMwh: roundToTwo(result.valorisationTotalMwh),
      valorisationTotalEur: roundToTwo(result.valorisationTotalEur),
      delegatePrice: roundToTwo(result.delegatePrice),
      totalPrime: roundToTwo(result.totalPrime),
    })),
  };
};
