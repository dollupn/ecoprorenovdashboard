export type RentabilityMeasurementMode = "surface" | "luminaire";

export type RentabilityTravauxOption = "NA" | "CLIENT" | "MARGE" | "PARTAGE";

export interface RentabilityAdditionalCostInput {
  amount_ht?: number | null;
  taxes?: number | null;
}

export interface RentabilityInput {
  revenue?: number | null;
  primeCee?: number | null;
  laborCostPerUnit?: number | null;
  materialCostPerUnit?: number | null;
  unitsUsed?: number | null;
  billedUnits?: number | null;
  commission?: number | null;
  commissionPerUnit?: number | null;
  commissionPerUnitActive?: boolean | null;
  travauxOption?: RentabilityTravauxOption | null;
  travauxAmount?: number | null;
  additionalCosts?: ReadonlyArray<RentabilityAdditionalCostInput | null | undefined> | null;
  fraisTvaPercentage?: number | null;
  subcontractorRatePerUnit?: number | null;
  subcontractorBaseUnits?: number | null;
  subcontractorPaymentConfirmed?: boolean | null;
  measurementMode?: RentabilityMeasurementMode;
  unitLabel?: string | null;
  projectCategory?: string | null;
  originalRevenue?: number | null;
}

export interface RentabilityCostBreakdown {
  labor: number;
  material: number;
  commission: number;
  commissionPerUnit: number;
  subcontractor: number;
  additional: number;
  travaux: number;
}

export interface RentabilityResult {
  ca: number;
  revenue: number;
  originalRevenue: number;
  primeCee: number;
  travauxRevenue: number;
  travauxCost: number;
  totalCosts: number;
  additionalCostsTotal: number;
  fraisTotalTtc: number;
  marginTotal: number;
  marginPerUnit: number;
  marginRate: number;
  unitsUsed: number;
  baseUnits: number;
  unitLabel: string;
  measurementMode: RentabilityMeasurementMode;
  costBreakdown: RentabilityCostBreakdown;
  subcontractorRate: number;
  subcontractorBaseUnits: number;
  subcontractorEstimatedCost: number;
  subcontractorPaymentConfirmed: boolean;
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

const clampPercentage = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
};

const normalizeTravauxOption = (
  value: RentabilityInput["travauxOption"],
): RentabilityTravauxOption => {
  if (!value) return "NA";
  const normalized = `${value}`.trim().toUpperCase();
  switch (normalized) {
    case "CLIENT":
      return "CLIENT";
    case "MARGE":
      return "MARGE";
    case "PARTAGE":
    case "MOITIE":
      return "PARTAGE";
    default:
      return "NA";
  }
};

const toBoolean = (value: unknown): boolean => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized.length === 0) return false;
    return ["true", "t", "1", "oui", "yes", "on"].includes(normalized);
  }
  return false;
};

export const calculateRentability = (input: RentabilityInput): RentabilityResult => {
  const originalRevenue = Math.max(0, sanitizeNumber(input.originalRevenue ?? input.revenue));
  const primeCee = Math.max(0, sanitizeNumber(input.primeCee));
  const laborCostPerUnit = Math.max(0, sanitizeNumber(input.laborCostPerUnit));
  const materialCostPerUnit = Math.max(0, sanitizeNumber(input.materialCostPerUnit));
  const measurementMode = input.measurementMode ?? "surface";
  const defaultLabel = measurementMode === "luminaire" ? "luminaire" : "m²";
  const rawUnitLabel = input.unitLabel ?? defaultLabel;
  const trimmedUnitLabel = rawUnitLabel.trim();
  const unitLabel = trimmedUnitLabel.length > 0 ? trimmedUnitLabel : defaultLabel;

  const billedUnits = Math.max(0, sanitizeNumber(input.billedUnits));
  const executedUnits = Math.max(0, sanitizeNumber(input.unitsUsed));
  const projectCategory = (input.projectCategory ?? "").trim().toLowerCase();
  const isLightingCategory = projectCategory.includes("eclair") || measurementMode === "luminaire";
  const baseUnits = isLightingCategory
    ? billedUnits || executedUnits
    : executedUnits || billedUnits;
  const normalizedBaseUnits = baseUnits > 0 ? baseUnits : Math.max(billedUnits, executedUnits);
  const effectiveUnits = normalizedBaseUnits > 0 ? normalizedBaseUnits : 0;

  const travauxOption = normalizeTravauxOption(input.travauxOption);
  const travauxAmount = Math.max(0, sanitizeNumber(input.travauxAmount));
  let travauxRevenue = 0;
  let travauxCost = 0;
  if (travauxAmount > 0) {
    switch (travauxOption) {
      case "CLIENT":
        travauxRevenue = travauxAmount;
        break;
      case "MARGE":
        travauxCost = travauxAmount;
        break;
      case "PARTAGE":
        travauxRevenue = travauxAmount / 2;
        travauxCost = travauxAmount / 2;
        break;
      default:
        break;
    }
  }

  const additionalCostsTotal = (input.additionalCosts ?? []).reduce((sum, rawCost) => {
    if (!rawCost) return sum;
    const cost = rawCost as RentabilityAdditionalCostInput;
    const amount = Math.max(0, sanitizeNumber(cost.amount_ht));
    const taxesRaw = cost.taxes;
    if (Number.isFinite(taxesRaw as number)) {
      const taxes = Math.max(0, sanitizeNumber(taxesRaw));
      return sum + amount + taxes;
    }
    const rate = clampPercentage(Math.max(0, sanitizeNumber(input.fraisTvaPercentage)));
    const taxes = rate > 0 ? amount * (rate / 100) : 0;
    return sum + amount + taxes;
  }, 0);

  const commissionFixed = Math.max(0, sanitizeNumber(input.commission));
  const commissionPerUnitRate = Math.max(0, sanitizeNumber(input.commissionPerUnit));
  const commissionPerUnitActive = toBoolean(input.commissionPerUnitActive);
  const commissionPerUnitTotal = commissionPerUnitActive ? commissionPerUnitRate * effectiveUnits : 0;

  const subcontractorRate = Math.max(0, sanitizeNumber(input.subcontractorRatePerUnit));
  const subcontractorUnitsCandidate = Math.max(0, sanitizeNumber(input.subcontractorBaseUnits));
  const subcontractorUnits = subcontractorUnitsCandidate > 0 ? subcontractorUnitsCandidate : normalizedBaseUnits;
  const normalizedSubcontractorUnits = subcontractorUnits > 0 ? subcontractorUnits : 0;
  const subcontractorPaymentConfirmed = toBoolean(input.subcontractorPaymentConfirmed);
  const subcontractorEstimatedCost = normalizedSubcontractorUnits * subcontractorRate;
  const subcontractorCost = subcontractorPaymentConfirmed ? subcontractorEstimatedCost : 0;

  const laborCostTotal = effectiveUnits * laborCostPerUnit;
  const materialCostTotal = effectiveUnits * materialCostPerUnit;

  const totalRevenue = originalRevenue + primeCee + travauxRevenue;

  const totalCosts =
    laborCostTotal +
    materialCostTotal +
    additionalCostsTotal +
    commissionFixed +
    commissionPerUnitTotal +
    subcontractorCost +
    travauxCost;

  const marginTotal = totalRevenue - totalCosts;
  const marginRate = totalRevenue > 0 ? marginTotal / totalRevenue : 0;
  const marginPerUnit = effectiveUnits > 0 ? marginTotal / effectiveUnits : 0;

  return {
    ca: roundZero(totalRevenue),
    revenue: roundZero(totalRevenue),
    originalRevenue: roundZero(originalRevenue),
    primeCee: roundZero(primeCee),
    travauxRevenue: roundZero(travauxRevenue),
    travauxCost: roundZero(travauxCost),
    totalCosts: roundZero(totalCosts),
    additionalCostsTotal: roundZero(additionalCostsTotal),
    fraisTotalTtc: roundZero(additionalCostsTotal),
    marginTotal: roundZero(marginTotal),
    marginPerUnit: roundZero(marginPerUnit),
    marginRate: roundZero(marginRate),
    unitsUsed: roundZero(effectiveUnits),
    baseUnits: roundZero(normalizedBaseUnits),
    unitLabel,
    measurementMode,
    costBreakdown: {
      labor: roundZero(laborCostTotal),
      material: roundZero(materialCostTotal),
      commission: roundZero(commissionFixed),
      commissionPerUnit: roundZero(commissionPerUnitTotal),
      subcontractor: roundZero(subcontractorCost),
      additional: roundZero(additionalCostsTotal),
      travaux: roundZero(travauxCost),
    },
    subcontractorRate: roundZero(subcontractorRate),
    subcontractorBaseUnits: roundZero(normalizedSubcontractorUnits),
    subcontractorEstimatedCost: roundZero(subcontractorEstimatedCost),
    subcontractorPaymentConfirmed,
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
  valorisation_cee?: number | null;
  project_prime_cee?: number | null;
  project_prime_cee_total_cents?: number | null;
  commission_eur_per_m2_enabled?: string | boolean | null;
  commission_eur_per_m2?: number | string | null;
  commission_commerciale_ht?: string | boolean | null;
  commission_commerciale_ht_montant?: number | string | null;
  frais_tva_percentage?: number | null;
  subcontractor_pricing_details?: string | number | null;
  subcontractor_payment_confirmed?: boolean | null;
  subcontractor_base_units?: number | null;
  subcontractor_payment_amount?: number | null;
  subcontractor_payment_units?: number | null;
  subcontractor_payment_rate?: number | null;
  subcontractor_payment_unit_label?: string | null;
  project_category?: string | null;
  additional_costs?: ReadonlyArray<{
    amount_ht?: number | null;
    taxes?: number | null;
  }> | null;
  product_name?: string | null;
}

export const buildRentabilityInputFromSite = (
  values: SiteRentabilitySource,
): RentabilityInput => {
  const ledProduct = isLedProduct(values.product_name);
  const projectCategory = values.project_category ?? (ledProduct ? "eclairage" : null);
  const measurementMode = ledProduct ? "luminaire" : "surface";
  const unitLabel = ledProduct ? "luminaire" : "m²";

  const executedUnits = sanitizeNumber(values.isolation_utilisee_m2);
  const billedUnits = sanitizeNumber(values.surface_facturee);

  const travauxAmountCandidate =
    typeof values.travaux_non_subventionnes_montant === "number"
      ? values.travaux_non_subventionnes_montant
      : typeof values.travaux_non_subventionnes === "number"
        ? values.travaux_non_subventionnes
        : null;

  const primeCandidates = [values.valorisation_cee, values.project_prime_cee];
  if (typeof values.project_prime_cee_total_cents === "number") {
    primeCandidates.push(values.project_prime_cee_total_cents / 100);
  }
  const primeCee = primeCandidates.reduce((result, candidate) => {
    const value = sanitizeNumber(candidate);
    return value > 0 ? value : result;
  }, 0);

  const commissionPerUnitActive = toBoolean(
    values.commission_eur_per_m2_enabled ?? values.commission_commerciale_ht,
  );
  const commissionPerUnit = sanitizeNumber(
    values.commission_eur_per_m2 ?? values.commission_commerciale_ht_montant,
  );

  const rawSubcontractorBaseUnits = sanitizeNumber(values.subcontractor_base_units);
  const storedSubcontractorUnits = sanitizeNumber(values.subcontractor_payment_units);
  const subcontractorBaseUnits =
    rawSubcontractorBaseUnits > 0 ? rawSubcontractorBaseUnits : storedSubcontractorUnits;

  const storedSubcontractorAmount = sanitizeNumber(values.subcontractor_payment_amount);
  const storedSubcontractorRate = sanitizeNumber(values.subcontractor_payment_rate);

  let subcontractorRate = sanitizeNumber(values.subcontractor_pricing_details);
  if (subcontractorRate <= 0) {
    if (storedSubcontractorRate > 0) {
      subcontractorRate = storedSubcontractorRate;
    } else if (subcontractorBaseUnits > 0 && storedSubcontractorAmount > 0) {
      subcontractorRate = storedSubcontractorAmount / subcontractorBaseUnits;
    }
  }
  subcontractorRate = subcontractorRate > 0 ? subcontractorRate : 0;

  return {
    revenue: values.revenue,
    originalRevenue: values.revenue,
    primeCee,
    laborCostPerUnit: values.cout_main_oeuvre_m2_ht,
    materialCostPerUnit: values.cout_isolation_m2,
    unitsUsed: executedUnits,
    billedUnits,
    commission: values.montant_commission,
    commissionPerUnit,
    commissionPerUnitActive,
    travauxOption: (values.travaux_non_subventionnes as RentabilityTravauxOption | null | undefined) ?? null,
    travauxAmount: travauxAmountCandidate,
    additionalCosts: values.additional_costs,
    fraisTvaPercentage: values.frais_tva_percentage,
    subcontractorRatePerUnit: subcontractorRate,
    subcontractorBaseUnits,
    subcontractorPaymentConfirmed: values.subcontractor_payment_confirmed,
    measurementMode,
    unitLabel,
    projectCategory,
  };
};
