import { describe, expect, it } from "vitest";

import {
  buildPrimeCeeEntries,
  type PrimeCeeComputation,
  type PrimeCeeProductDisplayMap,
} from "../prime-cee-unified";

describe("buildPrimeCeeEntries", () => {
  const baseComputation: PrimeCeeComputation = {
    totalPrime: 750,
    totalValorisationMwh: 15,
    totalValorisationEur: 750,
    delegatePrice: 50,
    products: [
      {
        projectProductId: "pp-1",
        productId: "prod-1",
        productCode: "OLD",
        productName: "Produit initial",
        baseKwh: 1500,
        bonification: 2,
        coefficient: 1,
        valorisationPerUnitMwh: 1.5,
        valorisationPerUnitEur: 75,
        valorisationLabel: "Valorisation Surface isolée",
        multiplier: 10,
        multiplierLabel: "Surface isolée",
        valorisationTotalMwh: 15,
        valorisationTotalEur: 750,
        delegatePrice: 50,
        totalPrime: 750,
      },
    ],
  };

  it("computes euro valorisation per unit and merges display metadata", () => {
    const productMap: PrimeCeeProductDisplayMap = {
      "pp-1": {
        productCode: "NEW",
        productName: "Produit personnalisé",
      },
    };

    const entries = buildPrimeCeeEntries({
      computation: baseComputation,
      productMap,
    });

    expect(entries).toHaveLength(1);
    const [entry] = entries;
    expect(entry.productCode).toBe("NEW");
    expect(entry.productName).toBe("Produit personnalisé");
    expect(entry.valorisationPerUnit).toBeCloseTo(75, 5);
    expect(entry.valorisationPerUnitMwh).toBe(1.5);
    expect(entry.totalPrime).toBe(750);
  });

  it("filters out entries without mapping or multiplier", () => {
    const computation: PrimeCeeComputation = {
      ...baseComputation,
      products: [
        baseComputation.products[0],
        {
          projectProductId: "pp-2",
          productId: "prod-2",
          productCode: "CODE-2",
          productName: "Produit 2",
          baseKwh: 1000,
          bonification: 2,
          coefficient: 1,
          valorisationPerUnitMwh: 1,
          valorisationPerUnitEur: 40,
          valorisationLabel: "Valorisation Quantité",
          multiplier: 0,
          multiplierLabel: "Quantité",
          valorisationTotalMwh: 0,
          valorisationTotalEur: 0,
          delegatePrice: 40,
          totalPrime: 0,
        },
      ],
    };

    const entries = buildPrimeCeeEntries({
      computation,
      productMap: {
        "pp-1": { productCode: "VALID" },
        "pp-2": { productCode: "IGNORED" },
      },
    });

    expect(entries).toHaveLength(1);
    expect(entries[0].projectProductId).toBe("pp-1");
  });
});
