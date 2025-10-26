import type { Tables } from "@/integrations/supabase/types";

type ProductCatalog = Tables<"product_catalog">;
type ProjectProduct = Tables<"project_products">;

type SchemaField = {
  name: string;
  label?: string;
  unit?: string;
};

const normalizeForComparison = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const buildNormalizedTargets = (targets: string[]) =>
  targets
    .map((target) => normalizeForComparison(target))
    .filter((target) => target.length > 0);

const parseNumericValue = (value: string | number): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const sanitized = value.replace(/\s+/g, "").replace(",", ".");
    const parsed = Number(sanitized);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const normalizeSchemaFields = (
  paramsSchema: ProductCatalog["params_schema"]
): SchemaField[] => {
  if (!paramsSchema) return [];

  if (Array.isArray(paramsSchema)) {
    return (paramsSchema as SchemaField[]).filter(
      (field): field is SchemaField => typeof field?.name === "string"
    );
  }

  if (isRecord(paramsSchema) && Array.isArray(paramsSchema.fields)) {
    return (paramsSchema.fields as SchemaField[]).filter(
      (field): field is SchemaField => typeof field?.name === "string"
    );
  }

  return [];
};

export type DynamicFieldEntry = {
  name: string;
  label: string;
  value: string | number;
  unit?: string;
};

export const getDynamicFieldEntries = (
  paramsSchema: ProductCatalog["params_schema"],
  dynamicParams: ProjectProduct["dynamic_params"]
): DynamicFieldEntry[] => {
  const schemaFields = normalizeSchemaFields(paramsSchema);

  if (!isRecord(dynamicParams)) {
    return [];
  }

  return schemaFields
    .map<DynamicFieldEntry | null>((field) => {
      const rawValue = (dynamicParams as Record<string, unknown>)[field.name];
      if (rawValue === null || rawValue === undefined || rawValue === "") {
        return null;
      }

      const value =
        typeof rawValue === "number" || typeof rawValue === "string"
          ? rawValue
          : Array.isArray(rawValue)
            ? rawValue.join(", ")
            : JSON.stringify(rawValue);

      return {
        name: field.name,
        label: field.label ?? field.name,
        value,
        unit: field.unit,
      };
    })
    .filter((entry): entry is DynamicFieldEntry => entry !== null);
};

export const formatDynamicFieldValue = ({ value, unit }: DynamicFieldEntry) => {
  if (typeof value === "number") {
    return unit ? `${value} ${unit}` : value;
  }
  return unit ? `${value} ${unit}` : value;
};

const matchesTarget = (value: string | undefined, normalizedTargets: string[]) => {
  if (!value) {
    return false;
  }

  const normalizedValue = normalizeForComparison(value);
  return normalizedTargets.some(
    (target) =>
      normalizedValue === target || normalizedValue.startsWith(`${target} `),
  );
};

export const getDynamicFieldNumericValue = (
  paramsSchema: ProductCatalog["params_schema"],
  dynamicParams: ProjectProduct["dynamic_params"],
  targets: string[],
): number | null => {
  if (!Array.isArray(targets) || targets.length === 0) {
    return null;
  }

  const normalizedTargets = buildNormalizedTargets(targets);
  if (normalizedTargets.length === 0) {
    return null;
  }

  const entries = getDynamicFieldEntries(paramsSchema, dynamicParams);

  for (const entry of entries) {
    if (
      matchesTarget(entry.name, normalizedTargets) ||
      matchesTarget(entry.label, normalizedTargets)
    ) {
      const numeric = parseNumericValue(entry.value);
      if (numeric !== null) {
        return numeric;
      }
    }
  }

  return null;
};
