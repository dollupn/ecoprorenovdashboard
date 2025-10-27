import { Parser } from "expr-eval";

const DEFAULT_BONIFICATION = 2;
const DEFAULT_COEFFICIENT = 1;
const DEFAULT_LED_WATT = 1;
const DEFAULT_MWH_DIVISOR = 1000;

const roundToTwo = (value: number) => Math.round(value * 100) / 100;

const toFiniteNumber = (value: unknown): number | null => {
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
  const numeric = toFiniteNumber(value);
  if (numeric === null) {
    return null;
  }

  return numeric > 0 ? numeric : null;
};

const getExpression = (value: unknown): string | null => {
  if (!value) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "object") {
    const expression = (value as Record<string, unknown>).expression;
    if (typeof expression === "string") {
      const trimmed = expression.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
  }

  return null;
};

const evaluateExpression = (expression: string, variables: Record<string, number>): number | null => {
  try {
    const parser = Parser.parse(expression);
    const result = parser.evaluate(variables);
    if (typeof result === "number" && Number.isFinite(result) && result >= 0) {
      return result;
    }
    return null;
  } catch (error) {
    console.warn("Failed to evaluate valorisation formula", error);
    return null;
  }
};

const resolveFirstNumeric = (
  source: Record<string, unknown> | null | undefined,
  keys: string[],
  predicate: (value: number) => boolean,
  fallback: number,
) => {
  if (!source) {
    return fallback;
  }

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const numeric = toFiniteNumber(source[key]);
      if (numeric !== null && predicate(numeric)) {
        return numeric;
      }
    }
  }

  return fallback;
};

const resolvePositiveFromRecord = (
  source: Record<string, unknown> | null | undefined,
  keys: string[],
  fallback: number,
) => resolveFirstNumeric(source, keys, (value) => value > 0, fallback);

const resolveNonNegativeFromRecord = (
  source: Record<string, unknown> | null | undefined,
  keys: string[],
  fallback: number,
) => resolveFirstNumeric(source, keys, (value) => value >= 0, fallback);

export type DynamicParams = Record<string, unknown> & {
  quantity?: number | string | null;
  led_watt?: number | string | null;
  ledWatt?: number | string | null;
  LED_WATT?: number | string | null;
};

export type CeeOverrides = Partial<{
  kwhCumac: number | null;
  bonification: number | null;
  coefficient: number | null;
  multiplier: number | null;
  delegatePriceEurPerMwh: number | null;
  valorisationTarif: number | null;
  ledWatt: number | null;
  mwhDivisor: number | null;
}>;

export type CeeConfig = {
  kwhCumac: number;
  bonification?: number | null;
  coefficient?: number | null;
  multiplier?: number | null;
  quantity?: number | null;
  delegatePriceEurPerMwh?: number | null;
  dynamicParams?: DynamicParams | null;
  valorisationFormula?: unknown;
  overrides?: CeeOverrides | null;
};

export type ValorisationMwhResult = {
  multiplier: number;
  valorisationPerUnitMwh: number;
  valorisationTotalMwh: number;
};

export type ValorisationEurResult = ValorisationMwhResult & {
  delegatePrice: number;
  valorisationPerUnitEur: number;
  valorisationTotalEur: number;
};

export type PrimeCeeResult = ValorisationEurResult & {
  totalPrime: number;
};

const resolveKwhCumac = (config: CeeConfig) =>
  toPositiveNumber(config.overrides?.kwhCumac) ?? toPositiveNumber(config.kwhCumac) ?? 0;

const resolveBonification = (config: CeeConfig) =>
  toPositiveNumber(config.overrides?.bonification) ??
  toPositiveNumber(config.bonification) ??
  DEFAULT_BONIFICATION;

const resolveCoefficient = (config: CeeConfig) =>
  toPositiveNumber(config.overrides?.coefficient) ??
  toPositiveNumber(config.coefficient) ??
  DEFAULT_COEFFICIENT;

const resolveMultiplier = (config: CeeConfig) => {
  const override = toPositiveNumber(config.overrides?.multiplier);
  if (override) {
    return override;
  }

  const direct = toPositiveNumber(config.multiplier);
  if (direct) {
    return direct;
  }

  const quantity = toPositiveNumber(config.quantity);
  if (quantity) {
    return quantity;
  }

  if (config.dynamicParams) {
    const dynamicQuantity = resolvePositiveFromRecord(
      config.dynamicParams,
      ["quantity", "quantite", "Quantite", "Quantité", "QUANTITY"],
      0,
    );
    if (dynamicQuantity > 0) {
      return dynamicQuantity;
    }
  }

  return 0;
};

const resolveLedWatt = (config: CeeConfig) =>
  toPositiveNumber(config.overrides?.ledWatt) ??
  resolvePositiveFromRecord(
    config.dynamicParams,
    ["led_watt", "ledWatt", "LED_WATT"],
    DEFAULT_LED_WATT,
  );

const resolveMwhDivisor = (config: CeeConfig) =>
  toPositiveNumber(config.overrides?.mwhDivisor) ?? DEFAULT_MWH_DIVISOR;

const resolveDelegatePrice = (config: CeeConfig) => {
  const overrideTarif = toFiniteNumber(config.overrides?.valorisationTarif);
  if (overrideTarif !== null && overrideTarif >= 0) {
    return overrideTarif;
  }

  const override = toFiniteNumber(config.overrides?.delegatePriceEurPerMwh);
  if (override !== null && override >= 0) {
    return override;
  }

  const delegatePrice = toFiniteNumber(config.delegatePriceEurPerMwh);
  return delegatePrice !== null && delegatePrice >= 0 ? delegatePrice : 0;
};

export const computeValorisationMwh = (config: CeeConfig): ValorisationMwhResult => {
  const kwh = resolveKwhCumac(config);
  const multiplier = resolveMultiplier(config);
  if (kwh <= 0 || multiplier <= 0) {
    return {
      multiplier: roundToTwo(multiplier),
      valorisationPerUnitMwh: 0,
      valorisationTotalMwh: 0,
    };
  }

  const bonification = resolveBonification(config);
  const coefficient = resolveCoefficient(config);
  const divisor = resolveMwhDivisor(config);

  let valorisationPerUnitMwh = (kwh * bonification * coefficient) / divisor;

  const expression = getExpression(config.valorisationFormula);
  if (expression) {
    const ledWatt = resolveLedWatt(config);
    const evaluated = evaluateExpression(expression, {
      KWH_CUMAC: kwh,
      BONIFICATION: bonification,
      LED_WATT: ledWatt,
      MWH_DIVISOR: divisor,
      COEFFICIENT: coefficient,
    });

    if (evaluated !== null) {
      valorisationPerUnitMwh = evaluated;
    }
  }

  if (!Number.isFinite(valorisationPerUnitMwh) || valorisationPerUnitMwh <= 0) {
    return {
      multiplier: roundToTwo(multiplier),
      valorisationPerUnitMwh: 0,
      valorisationTotalMwh: 0,
    };
  }

  const total = valorisationPerUnitMwh * multiplier;

  return {
    multiplier: roundToTwo(multiplier),
    valorisationPerUnitMwh: roundToTwo(valorisationPerUnitMwh),
    valorisationTotalMwh: roundToTwo(total),
  };
};

export const computeValorisationEur = (config: CeeConfig): ValorisationEurResult => {
  const mwh = computeValorisationMwh(config);
  const delegatePrice = resolveDelegatePrice(config);
  const valorisationPerUnitEur = mwh.valorisationPerUnitMwh * delegatePrice;
  const valorisationTotalEur = mwh.valorisationTotalMwh * delegatePrice;

  return {
    ...mwh,
    delegatePrice: roundToTwo(delegatePrice),
    valorisationPerUnitEur: roundToTwo(valorisationPerUnitEur),
    valorisationTotalEur: roundToTwo(valorisationTotalEur),
  };
};

export const computePrimeCeeEur = (config: CeeConfig): PrimeCeeResult => {
  const valorisation = computeValorisationEur(config);
  return {
    ...valorisation,
    totalPrime: valorisation.valorisationTotalEur,
  };
};

export type ProjectCeeTotals = {
  totalPrime: number;
  totalValorisationEur: number;
  totalValorisationMwh: number;
};

export const computeProjectCeeTotals = (
  computations: Array<PrimeCeeResult | null | undefined>,
): ProjectCeeTotals => {
  return computations.reduce<ProjectCeeTotals>(
    (acc, item) => {
      if (!item) {
        return acc;
      }

      return {
        totalPrime: roundToTwo(acc.totalPrime + item.totalPrime),
        totalValorisationEur: roundToTwo(acc.totalValorisationEur + item.valorisationTotalEur),
        totalValorisationMwh: roundToTwo(acc.totalValorisationMwh + item.valorisationTotalMwh),
      };
    },
    { totalPrime: 0, totalValorisationEur: 0, totalValorisationMwh: 0 },
  );
};
