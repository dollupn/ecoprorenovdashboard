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

const resolveFromDynamicParams = (
  params: Record<string, unknown> | null | undefined,
  keys: readonly string[],
  fallback: number,
  predicate: (value: number) => boolean,
) => {
  if (!params) {
    return fallback;
  }

  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(params, key)) {
      continue;
    }

    const numeric = toFiniteNumber((params as Record<string, unknown>)[key]);
    if (numeric !== null && predicate(numeric)) {
      return numeric;
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
};

export const normalizeValorisationFormula = (
  value: unknown,
): ValorisationFormulaConfig | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const key = typeof raw.variableKey === "string" ? raw.variableKey.trim() : "";

  if (!key) {
    return null;
  }

  const label =
    typeof raw.variableLabel === "string" && raw.variableLabel.trim().length > 0
      ? raw.variableLabel
      : null;

  const coefficient =
    isFiniteNumber(raw.coefficient) && raw.coefficient > 0 ? raw.coefficient : null;

  return {
    variableKey: key,
    variableLabel: label,
    coefficient,
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
const DEFAULT_BONUS_DOM = 1;

const LIGHTING_LED_WATT_KEYS = ["led_watt", "ledWatt", "LED_WATT"] as const;
const LIGHTING_BONUS_DOM_KEYS = ["bonus_dom", "bonusDom", "BONUS_DOM"] as const;
const LIGHTING_MULTIPLIER_KEYS = [
  "nombre_luminaire",
  "nombreLuminaire",
  "NOMBRE_LUMINAIRE",
  "nombre_de_luminaire",
  "nombreDeLuminaire",
  "NOMBRE_DE_LUMINAIRE",
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

  const nombreLuminaire = resolveNonNegativeFromDynamicParams(
    dynamicParams,
    LIGHTING_MULTIPLIER_KEYS,
    0,
  );

  const bonusDom = resolvePositiveFromDynamicParams(
    dynamicParams,
    LIGHTING_BONUS_DOM_KEYS,
    DEFAULT_BONUS_DOM,
  );

  const ledWatt = resolvePositiveFromDynamicParams(
    dynamicParams,
    LIGHTING_LED_WATT_KEYS,
    DEFAULT_LED_WATT,
  );

  const adjustedBase =
    !warningMissingBase && basePerLuminaire
      ? (basePerLuminaire * bonusDom * ledWatt) / DEFAULT_LED_WATT
      : 0;

  const valorisationPerUnitMwh =
    adjustedBase > 0 ? (adjustedBase * bonification * coefficient) / 1000 : 0;

  const valorisationPerUnitEur = valorisationPerUnitMwh * delegatePrice;
  const valorisationTotalMwh = valorisationPerUnitMwh * nombreLuminaire;
  const valorisationTotalEur = valorisationPerUnitEur * nombreLuminaire;

  if (process.env.NODE_ENV !== "production") {
    console.table({
      buildingType: buildingType ?? "",
      nombreLuminaire,
      bonusDom,
      ledWatt,
      basePerLuminaire: basePerLuminaire ?? 0,
      adjustedBase,
      bonification,
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
    multiplier: nombreLuminaire,
    valorisationTotalMwh,
    valorisationTotalEur,
    warningMissingBase,
  };
};
