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
        hasMissingKwhCumac: false,
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
          hasMissingKwhCumac: false,
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

  const lightingProduct = ({
    id,
    buildingType,
    kwh_cumac,
    entries,
  }: {
    id: string;
    buildingType: string;
    kwh_cumac?: number | null;
    entries?: { building_type: string; kwh_cumac: number }[];
  }): PrimeCeeProductCatalogEntry => ({
    id,
    name: `Lighting ${id}`,
    code: `BAT-EQ-127-${id}`,
    category: "lighting",
    is_active: true,
    params_schema: null,
    default_params: null,
    cee_config: DEFAULT_PRODUCT_CEE_CONFIG,
    kwh_cumac_values:
      entries ??
      (kwh_cumac != null
        ? [
            {
              building_type: buildingType,
              kwh_cumac,
            },
          ]
        : []),
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

  it("computes lighting valorisation for the 40 LED scenario", () => {
    const productMap: Record<string, PrimeCeeProductCatalogEntry> = {
      "light-1": lightingProduct({ id: "light-1", buildingType: "tertiaire", kwh_cumac: 500 }),
    };

    const result = computePrimeCee({
      products: [
        {
          product_id: "light-1",
          quantity: null,
          dynamic_params: {
            nombre_luminaire: 40,
            led_watt: 200,
            bonus_dom: 1.2,
          },
        },
      ],
      productMap,
      buildingType: "tertiaire",
      delegate: { price_eur_per_mwh: 55 } as any,
      primeBonification: 2,
    });

    expect(result).not.toBeNull();
    const [product] = result!.products;
    expect(product.baseKwh).toBeCloseTo(480, 5);
    expect(product.valorisationPerUnitMwh).toBeCloseTo(0.96, 5);
    expect(product.valorisationPerUnitEur).toBeCloseTo(52.8, 5);
    expect(product.multiplier).toBeCloseTo(40, 5);
    expect(product.valorisationTotalMwh).toBeCloseTo(38.4, 5);
    expect(product.valorisationTotalEur).toBeCloseTo(2112, 5);
    expect(product.hasMissingKwhCumac).toBe(false);
    expect(result?.totalPrime).toBeCloseTo(2112, 5);
    expect(result?.totalValorisationMwh).toBeCloseTo(38.4, 5);
  });

  it("returns a warning when lighting kWh base is missing", () => {
    const productMap: Record<string, PrimeCeeProductCatalogEntry> = {
      "light-2": lightingProduct({ id: "light-2", buildingType: "tertiaire", kwh_cumac: null }),
    };

    const result = computePrimeCee({
      products: [
        {
          product_id: "light-2",
          dynamic_params: {
            nombre_luminaire: 10,
          },
        },
      ],
      productMap,
      buildingType: "tertiaire",
      delegate: { price_eur_per_mwh: 60 } as any,
      primeBonification: 2,
    });

    expect(result).not.toBeNull();
    expect(result?.products).toHaveLength(1);
    const [product] = result!.products;
    expect(product.baseKwh).toBe(0);
    expect(product.valorisationPerUnitMwh).toBe(0);
    expect(product.valorisationPerUnitEur).toBe(0);
    expect(product.valorisationTotalMwh).toBe(0);
    expect(product.valorisationTotalEur).toBe(0);
    expect(product.hasMissingKwhCumac).toBe(true);
    expect(result?.totalPrime).toBe(0);
  });

  it("handles single luminaire lighting computations across building types", () => {
    const productMap: Record<string, PrimeCeeProductCatalogEntry> = {
      "light-3": lightingProduct({
        id: "light-3",
        buildingType: "industrial",
        entries: [
          { building_type: "tertiaire", kwh_cumac: 400 },
          { building_type: "industrial", kwh_cumac: 300 },
        ],
      }),
    };

    const result = computePrimeCee({
      products: [
        {
          product_id: "light-3",
          dynamic_params: {
            nombre_luminaire: 1,
          },
        },
      ],
      productMap,
      buildingType: "Industrial",
      delegate: { price_eur_per_mwh: 60 } as any,
      primeBonification: 2,
    });

    expect(result).not.toBeNull();
    const [product] = result!.products;
    expect(product.baseKwh).toBeCloseTo(300, 5);
    expect(product.valorisationPerUnitMwh).toBeCloseTo(0.6, 5);
    expect(product.valorisationPerUnitEur).toBeCloseTo(36, 5);
    expect(product.multiplier).toBeCloseTo(1, 5);
    expect(product.valorisationTotalMwh).toBeCloseTo(0.6, 5);
    expect(product.valorisationTotalEur).toBeCloseTo(36, 5);
    expect(product.hasMissingKwhCumac).toBe(false);
  });
});
