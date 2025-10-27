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
  eclairage: "nombre_led",
} as const;

const CATEGORY_MULTIPLIER_LABELS: Record<string, string> = {
  isolation: "Surface isolée",
  eclairage: "Nombre de LED",
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
const resolveFromDynamicParams = (
  params: Record<string, unknown> | null | undefined,
  keys: readonly string[],
  fallback: number,
  predicate: (value: number) => boolean,
) => {
  if (!params) {
    return fallback;
  }

  // Create a normalized map of keys for case-insensitive lookup
  const normalizedParams: Record<string, unknown> = {};
  const keyMapping: Record<string, string> = {};
  
  for (const [paramKey, paramValue] of Object.entries(params)) {
    const normalizedKey = paramKey.toLowerCase().replace(/[\s_-]+/g, '');
    normalizedParams[normalizedKey] = paramValue;
    keyMapping[normalizedKey] = paramKey;
  }

  for (const key of keys) {
    const normalizedSearchKey = key.toLowerCase().replace(/[\s_-]+/g, '');
    
    if (normalizedSearchKey in normalizedParams) {
      const numeric = toFiniteNumber(normalizedParams[normalizedSearchKey]);
      if (numeric !== null && predicate(numeric)) {
        return numeric;
      }
    }
  }

  return fallback;
};

const resolvePositiveFromDynamicParams = (
  params: Record<string, unknown> | null | undefined,
  keys: readonly string[],
  fallback: number,
) =>
  resolveFromDynamicParams(params, keys, fallback, (value) => value > 0);

const resolveNonNegativeFromDynamicParams = (
  params: Record<string, unknown> | null | undefined,
  keys: readonly string[],
  fallback: number,
) =>
  resolveFromDynamicParams(params, keys, fallback, (value) => value >= 0);

export const FORMULA_QUANTITY_KEY = "__quantity__" as const;

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

  if (normalizedKey === "nombre_led" || normalizedKey === "nombre_luminaire") {
    const candidates = [
      raw.variableValue,
      (raw as Record<string, unknown>).variable_value,
      raw.nombre_led,
      raw.nombreLed,
      (raw as Record<string, unknown>)["Nombre Led"],
      raw.nombre_luminaire,
      raw.nombreLuminaire,
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

type ProductKwhCumacEntry = {
  building_type?: string | null;
  kwh_cumac?: number | null;
};

const normalizeBuildingType = (value: string | null | undefined) =>
  (value ?? "").trim().toLowerCase();

export const getKwhCumacBasePerBuilding = (
  entries: ProductKwhCumacEntry[] | null | undefined,
  buildingType: string | null | undefined,
): number | null => {
  if (!entries || entries.length === 0) {
    return null;
  }

  const target = normalizeBuildingType(buildingType ?? null);
  if (!target) {
    return null;
  }

  const match = entries.find(
    (entry) => normalizeBuildingType(entry.building_type) === target,
  );

  if (!match || !isFiniteNumber(match.kwh_cumac) || match.kwh_cumac <= 0) {
    return null;
  }

  return match.kwh_cumac;
};

export type CalcCeeLightingInput = {
  kwhEntries: ProductKwhCumacEntry[] | null | undefined;
  buildingType: string | null | undefined;
  dynamicParams: Record<string, unknown> | null | undefined;
  bonification: number;
  coefficient: number;
  delegatePrice: number;
};

export type CalcCeeLightingResult = {
  baseKwh: number;
  bonification: number;
  coefficient: number;
  valorisationPerUnitMwh: number;
  valorisationPerUnitEur: number;
  multiplier: number;
  valorisationTotalMwh: number;
  valorisationTotalEur: number;
  warningMissingBase: boolean;
};

const DEFAULT_LED_WATT = 250;

const LIGHTING_LED_WATT_KEYS = ["led_watt", "ledWatt", "LED_WATT"] as const;
const LIGHTING_MULTIPLIER_KEYS = [
  "nombre_led",
  "nombreLed",
  "NOMBRE_LED",
  "Nombre Led",
  "nombre_de_led",
  "nombreDeLed",
  "NOMBRE_DE_LED",
] as const;

export const calcCeeLighting = ({
  kwhEntries,
  buildingType,
  dynamicParams,
  bonification,
  coefficient,
  delegatePrice,
}: CalcCeeLightingInput): CalcCeeLightingResult => {
  const basePerLuminaire = getKwhCumacBasePerBuilding(kwhEntries, buildingType);
  const warningMissingBase = basePerLuminaire === null;

  const nombreLed = resolveNonNegativeFromDynamicParams(
    dynamicParams,
    LIGHTING_MULTIPLIER_KEYS,
    0,
  );

  const ledWatt = resolvePositiveFromDynamicParams(
    dynamicParams,
    LIGHTING_LED_WATT_KEYS,
    DEFAULT_LED_WATT,
  );

  const adjustedBase =
    !warningMissingBase && basePerLuminaire
      ? (basePerLuminaire * bonification * ledWatt) / DEFAULT_LED_WATT
      : 0;

  const valorisationPerUnitMwh =
    adjustedBase > 0 ? (adjustedBase * coefficient) / 1000 : 0;

  const valorisationPerUnitEur = valorisationPerUnitMwh * delegatePrice;
  const valorisationTotalMwh = valorisationPerUnitMwh * nombreLed;
  const valorisationTotalEur = valorisationPerUnitEur * nombreLed;

  if (process.env.NODE_ENV !== "production") {
    console.table({
      buildingType: buildingType ?? "",
      nombreLed,
      bonification,
      ledWatt,
      basePerLuminaire: basePerLuminaire ?? 0,
      adjustedBase,
      coefficient,
      valorisationPerUnitMwh,
      valorisationPerUnitEur,
      valorisationTotalMwh,
      valorisationTotalEur,
      delegatePrice,
      warningMissingBase,
    });
  }

  return {
    baseKwh: adjustedBase,
    bonification,
    coefficient,
    valorisationPerUnitMwh,
    valorisationPerUnitEur,
    multiplier: nombreLed,
    valorisationTotalMwh,
    valorisationTotalEur,
    warningMissingBase,
  };
};
