import type { Tables } from "@/integrations/supabase/types";

type ProductCatalog = Tables<"product_catalog">;
type ProjectProduct = Tables<"project_products">;

type SchemaField = {
  name: string;
  label?: string;
  unit?: string;
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
