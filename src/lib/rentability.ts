export type RentabilityMeasurementMode = "surface" | "luminaire";

export interface RentabilityInput {
  revenue?: number | null;
  laborCostPerUnit?: number | null;
  materialCostPerUnit?: number | null;
  unitsUsed?: number | null;
  billedUnits?: number | null;
  commission?: number | null;
  nonSubsidizedWork?: number | null;
  additionalCosts?: ReadonlyArray<{
    amount_ht?: number | null;
    taxes?: number | null;
  }> | null;
  measurementMode?: RentabilityMeasurementMode;
  unitLabel?: string | null;
}

export interface RentabilityResult {
  revenue: number;
  totalCosts: number;
  additionalCostsTotal: number;
  marginTotal: number;
  marginPerUnit: number;
  marginRate: number;
  unitsUsed: number;
  unitLabel: string;
  measurementMode: RentabilityMeasurementMode;
}

const sanitizeNumber = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const roundZero = (value: number): number => {
  const rounded = Number.isFinite(value) ? value : 0;
  return Math.abs(rounded) < 1e-6 ? 0 : rounded;
};

export const calculateRentability = (input: RentabilityInput): RentabilityResult => {
  const revenue = Math.max(0, sanitizeNumber(input.revenue));
  const laborCostPerUnit = Math.max(0, sanitizeNumber(input.laborCostPerUnit));
  const materialCostPerUnit = Math.max(0, sanitizeNumber(input.materialCostPerUnit));
  const measurementMode = input.measurementMode ?? "surface";
  const defaultLabel = measurementMode === "luminaire" ? "luminaire" : "m²";
  const rawUnitLabel = input.unitLabel ?? defaultLabel;
  const trimmedUnitLabel = rawUnitLabel.trim();
  const unitLabel = trimmedUnitLabel.length > 0 ? trimmedUnitLabel : defaultLabel;

  const unitsCandidates = [input.unitsUsed, input.billedUnits];
  let unitsUsed = 0;
  for (const candidate of unitsCandidates) {
    const numeric = sanitizeNumber(candidate);
    if (numeric > 0) {
      unitsUsed = numeric;
      break;
    }
  }

  const additionalCostsTotal = (input.additionalCosts ?? []).reduce((sum, cost) => {
    if (!cost) return sum;
    const amount = Math.max(0, sanitizeNumber(cost.amount_ht));
    const taxes = Math.max(0, sanitizeNumber(cost.taxes));
    return sum + amount + taxes;
  }, 0);

  const commission = Math.max(0, sanitizeNumber(input.commission));
  const nonSubsidized = Math.max(0, sanitizeNumber(input.nonSubsidizedWork));

  const variableCostBase = unitsUsed > 0 ? unitsUsed : sanitizeNumber(input.unitsUsed);
  const variableCostPerUnit = laborCostPerUnit + materialCostPerUnit;
  const variableCosts = Math.max(0, variableCostBase) * Math.max(0, variableCostPerUnit);

  const totalCosts = variableCosts + additionalCostsTotal + commission + nonSubsidized;
  const marginTotal = revenue - totalCosts;
  const marginRate = revenue > 0 ? marginTotal / revenue : 0;
  const marginPerUnit = unitsUsed > 0 ? marginTotal / unitsUsed : 0;

  return {
    revenue,
    totalCosts: roundZero(totalCosts),
    additionalCostsTotal: roundZero(additionalCostsTotal),
    marginTotal: roundZero(marginTotal),
    marginPerUnit: roundZero(marginPerUnit),
    marginRate: roundZero(marginRate),
    unitsUsed: roundZero(unitsUsed),
    unitLabel,
    measurementMode,
  };
};

export const isLedProduct = (productName: string | null | undefined): boolean => {
  if (!productName) return false;
  const normalized = productName.normalize("NFD").replace(/[^\p{L}\p{N}]+/gu, " ").toLowerCase();
  if (normalized.length === 0) return false;
  return normalized.includes("led") || normalized.includes("luminaire");
};

export interface SiteRentabilitySource {
  revenue?: number | null;
  cout_main_oeuvre_m2_ht?: number | null;
  cout_isolation_m2?: number | null;
  isolation_utilisee_m2?: number | null;
  surface_facturee?: number | null;
  montant_commission?: number | null;
  travaux_non_subventionnes?: string | number | null;
  travaux_non_subventionnes_montant?: number | null;
  additional_costs?: ReadonlyArray<{
    amount_ht?: number | null;
    taxes?: number | null;
  }> | null;
  product_name?: string | null;
}

export const buildRentabilityInputFromSite = (
  values: SiteRentabilitySource,
): RentabilityInput => {
  const led = isLedProduct(values.product_name);
  const unitsUsed = values.isolation_utilisee_m2;
  const billedUnits = led ? values.surface_facturee : values.isolation_utilisee_m2;
  const rawNonSubsidized =
    typeof values.travaux_non_subventionnes_montant === "number"
      ? values.travaux_non_subventionnes_montant
      : values.travaux_non_subventionnes;

  return {
    revenue: values.revenue,
    laborCostPerUnit: values.cout_main_oeuvre_m2_ht,
    materialCostPerUnit: values.cout_isolation_m2,
    unitsUsed,
    billedUnits,
    commission: values.montant_commission,
    nonSubsidizedWork: typeof rawNonSubsidized === 'number' ? rawNonSubsidized : 0,
    additionalCosts: values.additional_costs,
    measurementMode: led ? "luminaire" : "surface",
    unitLabel: led ? "luminaire" : "m²",
  };
};
