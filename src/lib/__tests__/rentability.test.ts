import { describe, expect, it } from "vitest";

import {
  buildRentabilityInputFromSite,
  calculateRentability,
  type RentabilityInput,
  type RentabilityTravauxOption,
} from "../rentability";

const baseInput: RentabilityInput = {
  revenue: 10000,
  primeCee: 2000,
  laborCostPerUnit: 10,
  materialCostPerUnit: 5,
  unitsUsed: 100,
  billedUnits: 95,
  commission: 300,
  commissionPerUnit: 2,
  commissionPerUnitActive: true,
  additionalCosts: [{ amount_ht: 500, taxes: 100 }],
  travauxAmount: 1000,
  travauxOption: "CLIENT",
  subcontractorRatePerUnit: 50,
  subcontractorPaymentConfirmed: true,
};

describe("calculateRentability", () => {
  it("computes isolation rentability with client-funded travaux and commissions", () => {
    const result = calculateRentability(baseInput);

    expect(result.ca).toBeCloseTo(13000);
    expect(result.primeCee).toBe(2000);
    expect(result.travauxRevenue).toBe(1000);
    expect(result.travauxCost).toBe(0);
    expect(result.totalCosts).toBeCloseTo(7600);
    expect(result.marginTotal).toBeCloseTo(5400);
    expect(result.marginPerUnit).toBeCloseTo(54);
    expect(result.unitsUsed).toBe(100);
    expect(result.costBreakdown.commissionPerUnit).toBeCloseTo(200);
    expect(result.costBreakdown.subcontractor).toBeCloseTo(5000);
    expect(result.subcontractorBaseUnits).toBe(100);
    expect(result.subcontractorRate).toBe(50);
    expect(result.subcontractorEstimatedCost).toBeCloseTo(5000);
    expect(result.subcontractorPaymentConfirmed).toBe(true);
  });

  it("uses billed luminaires as base units for lighting projects", () => {
    const lightingInput: RentabilityInput = {
      revenue: 5000,
      laborCostPerUnit: 8,
      materialCostPerUnit: 12,
      unitsUsed: 40,
      billedUnits: 60,
      additionalCosts: [{ amount_ht: 200, taxes: 40 }],
      measurementMode: "luminaire",
      unitLabel: "luminaire",
      projectCategory: "eclairage",
      subcontractorRatePerUnit: 20,
      subcontractorPaymentConfirmed: true,
    };

    const result = calculateRentability(lightingInput);

    expect(result.unitsUsed).toBe(60);
    expect(result.totalCosts).toBeCloseTo(2640);
    expect(result.marginTotal).toBeCloseTo(2360);
    expect(result.marginPerUnit).toBeCloseTo(39.3333, 4);
    expect(result.measurementMode).toBe("luminaire");
    expect(result.subcontractorBaseUnits).toBe(60);
    expect(result.subcontractorEstimatedCost).toBeCloseTo(1200);
  });

  it("splits travaux amount according to option", () => {
    const amount = 1200;
    const run = (option: RentabilityTravauxOption) =>
      calculateRentability({
        revenue: 4000,
        unitsUsed: 40,
        travauxOption: option,
        travauxAmount: amount,
      });

    const clientResult = run("CLIENT");
    expect(clientResult.travauxRevenue).toBe(amount);
    expect(clientResult.travauxCost).toBe(0);
    expect(clientResult.ca).toBe(5200);

    const marginResult = run("MARGE");
    expect(marginResult.travauxRevenue).toBe(0);
    expect(marginResult.travauxCost).toBe(amount);
    expect(marginResult.totalCosts).toBe(amount);
    expect(marginResult.marginTotal).toBe(2800);

    const moitiéResult = run("MOITIE");
    expect(moitiéResult.travauxRevenue).toBe(amount / 2);
    expect(moitiéResult.travauxCost).toBe(amount / 2);
    expect(moitiéResult.ca).toBe(4600);

    const defaultResult = run("NA");
    expect(defaultResult.travauxRevenue).toBe(0);
    expect(defaultResult.travauxCost).toBe(0);
    expect(defaultResult.ca).toBe(4000);
  });

  it("reuses stored subcontractor payment metadata when pricing is missing", () => {
    const input = buildRentabilityInputFromSite({
      revenue: 1000,
      isolation_utilisee_m2: 20,
      surface_facturee: 20,
      subcontractor_pricing_details: null,
      subcontractor_payment_amount: 600,
      subcontractor_payment_units: 20,
      subcontractor_payment_rate: null,
      subcontractor_payment_confirmed: true,
    });

    expect(input.subcontractorRatePerUnit).toBeCloseTo(30);
    expect(input.subcontractorBaseUnits).toBe(20);
  });
});
