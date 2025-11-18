/**
 * Pure calculation functions for HT/TTC rentability
 * with category-specific VAT rules
 */

// VAT Constants
const TVA_MO = 1.021; // 2.1% for all labor
const TVA_MAT_ECLAIRAGE = 1.085; // 8.5% for Éclairage materials
const TVA_MAT_ISOLATION = 1.0; // NO VAT for Isolation materials
const TVA_COMMISSION = 1.085; // 8.5% for commission
const TVA_TRAVAUX = 1.085; // 8.5% for travaux non subventionnés

// Input Interfaces
interface BaseRentabiliteInput {
  primeCEE_TTC: number;
  travauxNonSubv_HT: number;
  commission_HT: number;
  fraisAdditionnels: Array<{ amount_ht: number; amount_ttc: number }>;
}

export interface EclairageRentabiliteInput extends BaseRentabiliteInput {
  MO_HT: number;
  MAT_HT: number;
  nbLuminaires: number;
}

export interface IsolationRentabiliteInput extends BaseRentabiliteInput {
  surface_facturee_m2: number;
  surface_posee_m2: number;
  MO_HT_per_m2: number;
  MAT_HT: number;
  use_surface_posee_for_mo?: boolean;
}

// Output Interface
export interface RentabiliteOutput {
  ca: number;
  cout_chantier: number;
  marge_totale: number;
  marge_par_unite: number;
  frais_additionnels: number;
}

// Helper to format currency
export const formatEuro = (value: number): string => {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

/**
 * Éclairage - Mode HT
 */
export function calcEclairageHT(input: EclairageRentabiliteInput): RentabiliteOutput {
  const {
    primeCEE_TTC,
    travauxNonSubv_HT,
    MO_HT,
    MAT_HT,
    commission_HT,
    nbLuminaires,
    fraisAdditionnels,
  } = input;

  // CA_HT = (primeCEE_TTC / 1.085) + travauxNonSubv_HT
  const ca = primeCEE_TTC / TVA_TRAVAUX + travauxNonSubv_HT;

  // FRAIS_ADDITIONNELS = sum(fraisAdd_HT)
  const frais_additionnels = fraisAdditionnels.reduce(
    (sum, frais) => sum + frais.amount_ht,
    0
  );

  // COUT_HT = MO_HT + MAT_HT + sum(fraisAdd_HT)
  const cout_chantier = MO_HT + MAT_HT + frais_additionnels;

  // MARGE_TOTALE_HT = CA_HT - COUT_HT - commission_HT
  const marge_totale = ca - cout_chantier - commission_HT;

  // MARGE_PAR_LUMI = MARGE_TOTALE_HT / max(nbLuminaires,1)
  const marge_par_unite = marge_totale / Math.max(nbLuminaires, 1);

  return {
    ca,
    cout_chantier,
    marge_totale,
    marge_par_unite,
    frais_additionnels,
  };
}

/**
 * Éclairage - Mode TTC
 */
export function calcEclairageTTC(input: EclairageRentabiliteInput): RentabiliteOutput {
  const {
    primeCEE_TTC,
    travauxNonSubv_HT,
    MO_HT,
    MAT_HT,
    commission_HT,
    nbLuminaires,
    fraisAdditionnels,
  } = input;

  // CA_TTC = primeCEE_TTC + (travauxNonSubv_HT × 1.085)
  const ca = primeCEE_TTC + travauxNonSubv_HT * TVA_TRAVAUX;

  // MO_TTC = MO_HT × 1.021
  const MO_TTC = MO_HT * TVA_MO;

  // MAT_TTC = MAT_HT × 1.085
  const MAT_TTC = MAT_HT * TVA_MAT_ECLAIRAGE;

  // FRAIS_TTC = sum(fraisAdd_TTC)
  const frais_additionnels = fraisAdditionnels.reduce(
    (sum, frais) => sum + frais.amount_ttc,
    0
  );

  // COUT_TTC = MO_TTC + MAT_TTC + FRAIS_TTC
  const cout_chantier = MO_TTC + MAT_TTC + frais_additionnels;

  // COMMISSION_TTC = commission_HT × 1.085
  const COMMISSION_TTC = commission_HT * TVA_COMMISSION;

  // MARGE_TOTALE_TTC = CA_TTC - COUT_TTC - COMMISSION_TTC
  const marge_totale = ca - cout_chantier - COMMISSION_TTC;

  // MARGE_PAR_LUMI = MARGE_TOTALE_TTC / max(nbLuminaires,1)
  const marge_par_unite = marge_totale / Math.max(nbLuminaires, 1);

  return {
    ca,
    cout_chantier,
    marge_totale,
    marge_par_unite,
    frais_additionnels,
  };
}

/**
 * Isolation - Mode HT
 */
export function calcIsolationHT(input: IsolationRentabiliteInput): RentabiliteOutput {
  const {
    primeCEE_TTC,
    travauxNonSubv_HT,
    surface_facturee_m2,
    surface_posee_m2,
    MO_HT_per_m2,
    MAT_HT,
    commission_HT,
    fraisAdditionnels,
    use_surface_posee_for_mo = false,
  } = input;

  // CA_HT = (primeCEE_TTC / 1.085) + travauxNonSubv_HT
  const ca = primeCEE_TTC / TVA_TRAVAUX + travauxNonSubv_HT;

  // MO_HT = surface × MO_HT_per_m2 (use surface_facturee_m2 by default, or surface_posee_m2 if option enabled)
  const surface_for_mo = use_surface_posee_for_mo ? surface_posee_m2 : surface_facturee_m2;
  const MO_HT = surface_for_mo * MO_HT_per_m2;

  // FRAIS_ADDITIONNELS = sum(fraisAdd_HT)
  const frais_additionnels = fraisAdditionnels.reduce(
    (sum, frais) => sum + frais.amount_ht,
    0
  );

  // COUT_HT = MO_HT + MAT_HT + sum(fraisAdd_HT)
  const cout_chantier = MO_HT + MAT_HT + frais_additionnels;

  // MARGE_TOTALE_HT = CA_HT - COUT_HT - commission_HT
  const marge_totale = ca - cout_chantier - commission_HT;

  // MARGE_PAR_M2 = MARGE_TOTALE_HT / max(surface_facturee_m2,1)
  const marge_par_unite = marge_totale / Math.max(surface_facturee_m2, 1);

  return {
    ca,
    cout_chantier,
    marge_totale,
    marge_par_unite,
    frais_additionnels,
  };
}

/**
 * Isolation - Mode TTC
 * CRITICAL: Isolation materials have NO VAT (Mat TTC = Mat HT × 1.0)
 */
export function calcIsolationTTC(input: IsolationRentabiliteInput): RentabiliteOutput {
  const {
    primeCEE_TTC,
    travauxNonSubv_HT,
    surface_facturee_m2,
    surface_posee_m2,
    MO_HT_per_m2,
    MAT_HT,
    commission_HT,
    fraisAdditionnels,
    use_surface_posee_for_mo = false,
  } = input;

  // CA_TTC = primeCEE_TTC + (travauxNonSubv_HT × 1.085)
  const ca = primeCEE_TTC + travauxNonSubv_HT * TVA_TRAVAUX;

  // MO_HT = surface × MO_HT_per_m2 (use surface_facturee_m2 by default, or surface_posee_m2 if option enabled)
  const surface_for_mo = use_surface_posee_for_mo ? surface_posee_m2 : surface_facturee_m2;
  const MO_HT = surface_for_mo * MO_HT_per_m2;

  // MO_TTC = MO_HT × 1.021
  const MO_TTC = MO_HT * TVA_MO;

  // MAT_TTC = MAT_HT × 1.0 (NO VAT for Isolation materials)
  const MAT_TTC = MAT_HT * TVA_MAT_ISOLATION;

  // FRAIS_TTC = sum(fraisAdd_TTC)
  const frais_additionnels = fraisAdditionnels.reduce(
    (sum, frais) => sum + frais.amount_ttc,
    0
  );

  // COUT_TTC = MO_TTC + MAT_TTC + FRAIS_TTC
  const cout_chantier = MO_TTC + MAT_TTC + frais_additionnels;

  // COMMISSION_TTC = commission_HT × 1.085
  const COMMISSION_TTC = commission_HT * TVA_COMMISSION;

  // MARGE_TOTALE_TTC = CA_TTC - COUT_TTC - COMMISSION_TTC
  const marge_totale = ca - cout_chantier - COMMISSION_TTC;

  // MARGE_PAR_M2 = MARGE_TOTALE_TTC / max(surface_facturee_m2,1)
  const marge_par_unite = marge_totale / Math.max(surface_facturee_m2, 1);

  return {
    ca,
    cout_chantier,
    marge_totale,
    marge_par_unite,
    frais_additionnels,
  };
}
