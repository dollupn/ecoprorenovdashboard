import { describe, expect, it } from "vitest";

import { normalizeValorisationFormula, calcCeeLighting } from "../valorisation-formula";

describe("normalizeValorisationFormula", () => {
  it("normalizes Nombre Led synonyms to the canonical nombre_luminaire key", () => {
    const result = normalizeValorisationFormula({
      variableKey: "Nombre Led",
      variableLabel: "Nombre Led",
      variableValue: "45",
    });

    expect(result).toEqual({
      variableKey: "nombre_luminaire",
      variableLabel: "Nombre Led",
      coefficient: null,
      variableValue: 45,
    });
  });

  it("returns a zero value when no positive nombre_luminaire count is provided", () => {
    const result = normalizeValorisationFormula({
      variableKey: "nombre_led",
      variableLabel: "Nombre de LED",
      variableValue: null,
    });

    expect(result).toEqual({
      variableKey: "nombre_luminaire",
      variableLabel: "Nombre de LED",
      coefficient: null,
      variableValue: 0,
    });
  });
});

describe("calcCeeLighting", () => {
  const mockKwhEntries = [
    {
      building_type: "Entrepôts",
      kwh_cumac_lt_400: 63,
      kwh_cumac_gte_400: 62,
    },
  ];

  it("uses ledWattConstant when provided for simplified calculation", () => {
    const result = calcCeeLighting({
      kwhEntries: mockKwhEntries,
      buildingType: "Entrepôts",
      dynamicParams: { nombre_led: 40 },
      bonification: 2,
      coefficient: 1,
      delegatePrice: 6.7,
      buildingSurface: 500,
      ledWattConstant: 250,
    });

    // With ledWattConstant: (62 * 2 * 1 * 250) / 1,000,000 = 0.031 MWh per LED
    expect(result.valorisationPerUnitMwh).toBeCloseTo(0.031, 3);
    expect(result.valorisationTotalMwh).toBeCloseTo(1.24, 2); // 0.031 * 40
    expect(result.valorisationPerUnitEur).toBeCloseTo(0.2077, 3); // 0.031 * 6.7
    expect(result.valorisationTotalEur).toBeCloseTo(8.308, 2); // 1.24 * 6.7
    expect(result.multiplier).toBe(40);
    expect(result.warningMissingBase).toBe(false);
  });

  it("uses legacy LED watt scaling when ledWattConstant is not provided", () => {
    const result = calcCeeLighting({
      kwhEntries: mockKwhEntries,
      buildingType: "Entrepôts",
      dynamicParams: { nombre_led: 40, led_watt: 100 },
      bonification: 2,
      coefficient: 1,
      delegatePrice: 6.7,
      buildingSurface: 500,
    });

    // Should use legacy scaling formula with led_watt
    expect(result.multiplier).toBe(40);
    expect(result.warningMissingBase).toBe(false);
    // The actual values will differ from ledWattConstant calculation
    expect(result.valorisationPerUnitMwh).toBeGreaterThan(0);
  });

  it("selects correct kWh cumac based on building surface", () => {
    // Test with surface >= 400 m²
    const resultGte400 = calcCeeLighting({
      kwhEntries: mockKwhEntries,
      buildingType: "Entrepôts",
      dynamicParams: { nombre_led: 1 },
      bonification: 2,
      coefficient: 1,
      delegatePrice: 6.7,
      buildingSurface: 500,
      ledWattConstant: 250,
    });

    // Should use kwh_cumac_gte_400 = 62
    expect(resultGte400.valorisationPerUnitMwh).toBeCloseTo(0.031, 3);

    // Test with surface < 400 m²
    const resultLt400 = calcCeeLighting({
      kwhEntries: mockKwhEntries,
      buildingType: "Entrepôts",
      dynamicParams: { nombre_led: 1 },
      bonification: 2,
      coefficient: 1,
      delegatePrice: 6.7,
      buildingSurface: 300,
      ledWattConstant: 250,
    });

    // Should use kwh_cumac_lt_400 = 63
    expect(resultLt400.valorisationPerUnitMwh).toBeCloseTo(0.0315, 4);
  });
});
