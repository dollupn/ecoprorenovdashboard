const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

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
