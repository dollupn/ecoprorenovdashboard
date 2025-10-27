const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const toFiniteNumber = (value: unknown): number | null => {
  if (isFiniteNumber(value)) {
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

const removeDiacritics = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae");

const normalizeKey = (value: string) =>
  removeDiacritics(value)
    .trim()
    .replace(/[-\s]+/g, "_")
    .toLowerCase();

export const LEGACY_QUANTITY_KEY = "__quantity__" as const;

export const CATEGORY_MULTIPLIER_KEYS = {
  isolation: "surface_isolee",
  eclairage: "nombre_luminaire",
} as const;

const CATEGORY_MULTIPLIER_LABELS: Record<string, string> = {
  isolation: "Surface isolée",
  eclairage: "Nombre de luminaire",
};

type CategoryMultiplierKeyMap = typeof CATEGORY_MULTIPLIER_KEYS;

const normalizeCategory = (category: string | null | undefined): keyof CategoryMultiplierKeyMap | null => {
  if (!category || typeof category !== "string") {
    return null;
  }

  const normalized = normalizeKey(category);

  if (normalized === "lighting") {
    return "eclairage";
  }

  if (normalized in CATEGORY_MULTIPLIER_KEYS) {
    return normalized as keyof CategoryMultiplierKeyMap;
  }

  return null;
};

export const getCategoryDefaultMultiplierKey = (
  category: string | null | undefined,
): string | null => {
  const normalizedCategory = normalizeCategory(category);
  if (!normalizedCategory) {
    return null;
  }

  return CATEGORY_MULTIPLIER_KEYS[normalizedCategory];
};

export const getCategoryDefaultMultiplierLabel = (
  category: string | null | undefined,
): string | null => {
  const normalizedCategory = normalizeCategory(category);
  if (!normalizedCategory) {
    return null;
  }

  return CATEGORY_MULTIPLIER_LABELS[normalizedCategory] ?? null;
};

export const resolveMultiplierKeyForCategory = (
  key: unknown,
  category: string | null | undefined,
): string | null => {
  if (typeof key !== "string") {
    return null;
  }

  const trimmed = key.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.toLowerCase();
  const defaultKey = getCategoryDefaultMultiplierKey(category);

  if (normalized === "quantity" || trimmed === LEGACY_QUANTITY_KEY) {
    return defaultKey ?? LEGACY_QUANTITY_KEY;
  }

  return trimmed;
};

export const isLegacyQuantityMultiplier = (value: string | null | undefined) => {
  if (typeof value !== "string") {
    return false;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  return trimmed === LEGACY_QUANTITY_KEY || trimmed.toLowerCase() === "quantity";
};

export type ValorisationFormulaConfig = {
  variableKey: string;
  variableLabel?: string | null;
  coefficient?: number | null;
  variableValue?: number;
};

export const normalizeValorisationFormula = (
  value: unknown,
): ValorisationFormulaConfig | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const rawKey = typeof raw.variableKey === "string" ? raw.variableKey.trim() : "";

  const normalizedKeySlug = rawKey ? normalizeKey(rawKey) : "";
  const variableKey =
    normalizedKeySlug &&
    ["nombre_led", "nombre_luminaire", "nombre_leds", "nombre_de_led", "nombre_de_luminaire"].includes(
      normalizedKeySlug,
    )
      ? "nombre_luminaire"
      : rawKey;

  if (!variableKey) {
    return null;
  }

  const label =
    typeof raw.variableLabel === "string" && raw.variableLabel.trim().length > 0
      ? raw.variableLabel
      : null;

  const coefficient =
    isFiniteNumber(raw.coefficient) && raw.coefficient > 0 ? raw.coefficient : null;

  let variableValue: number | undefined;

  const resolveVariableValue = (input: unknown): number | null => {
    const numeric = toFiniteNumber(input);
    return numeric !== null && Number.isFinite(numeric) ? numeric : null;
  };

  const normalizedKey = normalizeKey(variableKey);

  if (normalizedKey === "nombre_luminaire") {
    const candidates = [
      raw.variableValue,
      (raw as Record<string, unknown>).variable_value,
      raw.nombre_luminaire,
      raw.nombreLuminaire,
      raw.nombre_led,
      raw.nombreLed,
      (raw as Record<string, unknown>)["Nombre Led"],
    ];

    for (const candidate of candidates) {
      const numeric = resolveVariableValue(candidate);
      if (numeric !== null && numeric > 0) {
        variableValue = numeric;
        break;
      }
    }

    if (variableValue === undefined) {
      variableValue = 0;
    }
  } else if (raw.variableValue !== undefined) {
    const numeric = resolveVariableValue(raw.variableValue);
    if (numeric !== null && numeric > 0) {
      variableValue = numeric;
    }
  }

  return {
    variableKey,
    variableLabel: label,
    coefficient,
    variableValue,
  };
};

export const formatFormulaCoefficient = (value: number): string => {
  if (!Number.isFinite(value)) {
    return "1";
  }
  return Number.isInteger(value) ? value.toString() : value.toFixed(2).replace(/\.00$/, "");
};
