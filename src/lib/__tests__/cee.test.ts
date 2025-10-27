import { describe, expect, it } from "vitest";

import {
  type CeeConfig,
  computePrimeCeeEur,
  computeProjectCeeTotals,
  computeValorisationEur,
  computeValorisationMwh,
} from "../cee";

describe("computeValorisationMwh", () => {
  it("handles isolation example with base bonification", () => {
    const config: CeeConfig = {
      kwhCumac: 5400,
      bonification: 2,
      coefficient: 1,
      multiplier: 120,
      delegatePriceEurPerMwh: 8,
    };

    const result = computeValorisationMwh(config);

    expect(result).toEqual({
      multiplier: 120,
      valorisationPerUnitMwh: 10.8,
      valorisationTotalMwh: 1296,
    });
  });
});

describe("computeValorisationEur", () => {
  it("handles éclairage example using valorisation formula tokens", () => {
    const config: CeeConfig = {
      kwhCumac: 400,
      bonification: 2,
      coefficient: 1,
      multiplier: 45,
      delegatePriceEurPerMwh: 6,
      valorisationFormula: {
        expression: "KWH_CUMAC * BONUS_DOM * LED_WATT / MWH_DIVISOR",
      },
      dynamicParams: {
        bonus_dom: 1.3,
        led_watt: 30,
      },
    };

    const result = computeValorisationEur(config);

    expect(result).toEqual({
      multiplier: 45,
      valorisationPerUnitMwh: 15.6,
      valorisationTotalMwh: 702,
      delegatePrice: 6,
      valorisationPerUnitEur: 93.6,
      valorisationTotalEur: 4212,
    });
  });
});

describe("computeProjectCeeTotals", () => {
  it("aggregates prime results without double counting", () => {
    const isolation: CeeConfig = {
      kwhCumac: 5400,
      bonification: 2,
      coefficient: 1,
      multiplier: 120,
      delegatePriceEurPerMwh: 8,
    };

    const eclairage: CeeConfig = {
      kwhCumac: 400,
      bonification: 2,
      coefficient: 1,
      multiplier: 45,
      delegatePriceEurPerMwh: 6,
      valorisationFormula: {
        expression: "KWH_CUMAC * BONUS_DOM * LED_WATT / MWH_DIVISOR",
      },
      dynamicParams: {
        bonus_dom: 1.3,
        led_watt: 30,
      },
    };

    const isolationPrime = computePrimeCeeEur(isolation);
    const eclairagePrime = computePrimeCeeEur(eclairage);

    const totals = computeProjectCeeTotals([isolationPrime, eclairagePrime]);

    expect(totals).toEqual({
      totalPrime: isolationPrime.totalPrime + eclairagePrime.totalPrime,
      totalValorisationEur:
        isolationPrime.valorisationTotalEur + eclairagePrime.valorisationTotalEur,
      totalValorisationMwh:
        isolationPrime.valorisationTotalMwh + eclairagePrime.valorisationTotalMwh,
    });
  });
});
