import type { Tables } from "@/integrations/supabase/types";

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
  "id" | "name" | "code" | "category" | "is_active" | "params_schema" | "default_params"
> & {
  kwh_cumac_values?: ProductKwhValue[];
};

export type PrimeCeeProductResult = {
  projectProductId: string;
  productId: string;
  productCode?: string | null;
  productName?: string | null;
  valorisationPerUnit: number; // Valorisation CEE = (kWh cumac × bonification / 1000) × tarif délégataire
  multiplier: number; // champ dynamique (surface_isolee, nombre_led, quantity, etc.)
  multiplierLabel: string;
  totalPrime: number; // valorisationPerUnit × multiplier
};

export type PrimeCeeComputation = {
  totalPrime: number;
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

/**
 * Detects the multiplier (champ dynamique) from product parameters
 * Priority: surface_isolee > nombre_led > quantity > other dynamic fields
 */
export const getMultiplierValue = ({
  product,
  projectProduct,
}: {
  product: PrimeCeeProductCatalogEntry;
  projectProduct: { quantity?: number | null; dynamic_params?: unknown };
}): MultiplierDetection | null => {
  const schemaFields = getSchemaFields(product.params_schema);
  const dynamicParams = isRecord(projectProduct.dynamic_params)
    ? projectProduct.dynamic_params
    : undefined;

  // Try to find matching fields in priority order
  if (dynamicParams) {
    for (const { targets, fallbackLabel } of DYNAMIC_FIELD_PRIORITIES) {
      const matchingField = schemaFields.find((field) => matchesField(field, targets));
      
      if (matchingField) {
        const key = typeof matchingField.name === "string" ? matchingField.name : undefined;
        if (key) {
          const value = toNumber(dynamicParams[key]);
          if (value && value > 0) {
            return {
              value,
              label:
                typeof matchingField.label === "string" && matchingField.label.length > 0
                  ? matchingField.label
                  : fallbackLabel,
            };
          }
        }
      }
    }
  }

  // Fallback to quantity field
  if (typeof projectProduct.quantity === "number" && Number.isFinite(projectProduct.quantity)) {
    return {
      value: projectProduct.quantity,
      label: "Quantité",
    };
  }

  return null;
};

// ============================================================================
// BONIFICATION FACTOR
// ============================================================================

export const resolveBonificationFactor = (value: number | null | undefined) => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  return 2;
};

// ============================================================================
// CATEGORY EXCLUSION
// ============================================================================

/**
 * Checks if a product should be excluded from Prime CEE calculation
 * Excludes products whose category or code starts with "ECO"
 */
export const isProductExcluded = (product: { category?: string | null; code?: string | null }): boolean => {
  const category = (product.category ?? "").toUpperCase();
  const code = (product.code ?? "").toUpperCase();
  
  return EXCLUDED_CATEGORY_PREFIXES.some(
    (prefix) => category.startsWith(prefix) || code.startsWith(prefix)
  );
};

// ============================================================================
// PRIME CEE COMPUTATION
// ============================================================================

/**
 * Computes Prime CEE for a list of products
 * 
 * Formula:
 * - Valorisation CEE = (kWh cumac × bonification / 1000) × tarif délégataire
 * - Prime CEE = Σ(Valorisation CEE × champ dynamique)
 * 
 * Products starting with "ECO" are excluded from calculation
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
  if (!delegate || !buildingType) {
    return null;
  }

  const pricePerMwh =
    typeof delegate.price_eur_per_mwh === "number" && Number.isFinite(delegate.price_eur_per_mwh)
      ? delegate.price_eur_per_mwh
      : 0;

  if (pricePerMwh <= 0) {
    return {
      totalPrime: 0,
      products: [],
    };
  }

  const bonification = resolveBonificationFactor(primeBonification);

  const productResults: PrimeCeeProductResult[] = [];

  for (const projectProduct of products) {
    if (!projectProduct?.product_id) {
      continue;
    }

    const product = productMap[projectProduct.product_id];
    if (!product) {
      continue;
    }

    // Exclude ECO-* products
    if (isProductExcluded(product)) {
      continue;
    }

    const kwhEntry = product.kwh_cumac_values?.find((value) => {
      return value.building_type === buildingType && typeof value.kwh_cumac === "number";
    });

    if (!kwhEntry || typeof kwhEntry.kwh_cumac !== "number" || !Number.isFinite(kwhEntry.kwh_cumac)) {
      continue;
    }

    const multiplier = getMultiplierValue({ product, projectProduct });
    if (!multiplier || multiplier.value <= 0) {
      continue;
    }

    // Valorisation CEE = (kWh cumac × bonification / 1000) × tarif délégataire
    const valorisationPerUnit = (kwhEntry.kwh_cumac * bonification * pricePerMwh) / 1000;
    if (!Number.isFinite(valorisationPerUnit) || valorisationPerUnit <= 0) {
      continue;
    }

    // Prime CEE = Valorisation CEE × champ dynamique
    const totalPrime = valorisationPerUnit * multiplier.value;
    if (!Number.isFinite(totalPrime) || totalPrime <= 0) {
      continue;
    }

    productResults.push({
      projectProductId: projectProduct.id ?? projectProduct.product_id,
      productId: product.id ?? projectProduct.product_id,
      productCode: product.code,
      productName: product.name,
      valorisationPerUnit,
      multiplier: multiplier.value,
      multiplierLabel: multiplier.label,
      totalPrime,
    });
  }

  const total = roundToTwo(productResults.reduce((sum, result) => sum + result.totalPrime, 0));

  return {
    totalPrime: total,
    products: productResults.map((result) => ({
      ...result,
      valorisationPerUnit: roundToTwo(result.valorisationPerUnit),
      multiplier: roundToTwo(result.multiplier),
      totalPrime: roundToTwo(result.totalPrime),
    })),
  };
};
