import { describe, expect, it } from "vitest";

import {
  buildPrimeCeeEntries,
  computePrimeCee,
  DEFAULT_PRODUCT_CEE_CONFIG,
  type PrimeCeeComputation,
  type PrimeCeeProductCatalogEntry,
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

describe("computePrimeCee", () => {
  const baseProduct = ({
    id,
    kwh_cumac,
  }: {
    id: string;
    kwh_cumac: number;
  }): PrimeCeeProductCatalogEntry => ({
    id,
    name: `Product ${id}`,
    code: `CODE-${id}`,
    category: "CAT",
    is_active: true,
    params_schema: null,
    default_params: null,
    cee_config: DEFAULT_PRODUCT_CEE_CONFIG,
    kwh_cumac_values: [
      {
        building_type: "house",
        kwh_cumac,
      },
    ],
  });

  it("aggregates totals without duplicating products", () => {
    const productMap: Record<string, PrimeCeeProductCatalogEntry> = {
      "prod-1": baseProduct({ id: "prod-1", kwh_cumac: 1000 }),
      "prod-2": baseProduct({ id: "prod-2", kwh_cumac: 1500 }),
    };

    const result = computePrimeCee({
      products: [
        { product_id: "prod-1", quantity: 5 },
        { product_id: "prod-2", quantity: 4 },
      ],
      productMap,
      buildingType: "house",
      delegate: { price_eur_per_mwh: 50 } as any,
      primeBonification: 2,
    });

    expect(result).not.toBeNull();
    expect(result?.products).toHaveLength(2);
    expect(result?.totalValorisationMwh).toBeCloseTo(22, 5);
    expect(result?.totalValorisationEur).toBeCloseTo(1100, 5);
    expect(result?.totalPrime).toBeCloseTo(1100, 5);

    const summedPrime = result?.products.reduce((sum, product) => sum + product.totalPrime, 0) ?? 0;
    const summedValorisationMwh =
      result?.products.reduce((sum, product) => sum + product.valorisationTotalMwh, 0) ?? 0;

    expect(result?.totalPrime).toBeCloseTo(summedPrime, 5);
    expect(result?.totalValorisationMwh).toBeCloseTo(summedValorisationMwh, 5);
  });
});
