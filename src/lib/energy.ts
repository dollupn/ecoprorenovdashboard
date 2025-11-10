import type { Tables } from "@/integrations/supabase/types";
import {
  getMultiplierValue,
  isProductExcluded,
  type PrimeCeeProductCatalogEntry,
  type ProductCeeConfig,
} from "@/lib/prime-cee-unified";
import { getKwhCumacBasePerBuilding } from "@/lib/valorisation-formula";

export type ProjectProductWithEnergy =
  Pick<Tables<"project_products">, "quantity" | "dynamic_params"> & {
    product?:
      | (Pick<
          Tables<"product_catalog">,
          "id" | "code" | "category" | "params_schema" | "is_active" | "default_params" | "cee_config"
        > & {
          cee_config: ProductCeeConfig;
          kwh_cumac_values?:
            | (Pick<
                Tables<"product_kwh_cumac">,
                "building_type" | "kwh_cumac_lt_400" | "kwh_cumac_gte_400"
              > | null)[]
            | null;
        })
      | null;
  };

export type ProjectWithProducts = Pick<
  Tables<"projects">,
  | "id"
  | "status"
  | "updated_at"
  | "surface_isolee_m2"
  | "surface_batiment_m2"
  | "city"
  | "client_name"
  | "building_type"
> & {
  project_products?: ProjectProductWithEnergy[] | null;
};

export interface EnergyBreakdownEntry {
  category: string;
  mwh: number;
}

export interface EnergyAggregationResult {
  totalMwh: number;
  breakdown: EnergyBreakdownEntry[];
}

export interface AggregateEnergyOptions {
  shouldIncludeProject?: (project: ProjectWithProducts) => boolean;
}

const normalizeCategory = (category: string | null | undefined) => {
  const trimmed = category?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "Autres";
};

export const aggregateEnergyByCategory = (
  projects: ProjectWithProducts[],
  options: AggregateEnergyOptions = {}
): EnergyAggregationResult => {
  const categoryTotals = new Map<string, number>();

  for (const project of projects) {
    if (options.shouldIncludeProject && !options.shouldIncludeProject(project)) {
      continue;
    }

    const projectProducts = project.project_products ?? [];
    const projectCategoryTotals = new Map<string, number>();

    const buildingSurface =
      typeof project.surface_batiment_m2 === "number" &&
      Number.isFinite(project.surface_batiment_m2)
        ? project.surface_batiment_m2
        : null;

    let projectTotalMwh = 0;

    for (const projectProduct of projectProducts) {
      if (!projectProduct?.product) {
        continue;
      }

      const { product } = projectProduct;

      if (isProductExcluded(product)) {
        continue;
      }

      const baseKwh = getKwhCumacBasePerBuilding(
        product.kwh_cumac_values ?? [],
        project.building_type,
        buildingSurface,
      );

      if (typeof baseKwh !== "number" || !Number.isFinite(baseKwh)) {
        continue;
      }

      const multiplier = getMultiplierValue({
        product: product as PrimeCeeProductCatalogEntry,
        projectProduct: {
          product_id: product.id,
          quantity: projectProduct.quantity,
          dynamic_params: projectProduct.dynamic_params,
        },
      });

      if (!multiplier || multiplier.value <= 0) {
        continue;
      }

      const productMwh = (baseKwh / 1000) * multiplier.value;

      if (!Number.isFinite(productMwh) || productMwh <= 0) {
        continue;
      }

      projectTotalMwh += productMwh;

      const category = normalizeCategory(product.category);
      const currentTotal = projectCategoryTotals.get(category) ?? 0;
      projectCategoryTotals.set(category, currentTotal + productMwh);
    }

    if (projectTotalMwh <= 0) {
      continue;
    }

    for (const [category, value] of projectCategoryTotals.entries()) {
      const currentTotal = categoryTotals.get(category) ?? 0;
      categoryTotals.set(category, currentTotal + value);
    }
  }

  const breakdown = Array.from(categoryTotals.entries())
    .map(([category, value]) => ({
      category,
      mwh: Number(value.toFixed(2)),
    }))
    .filter((entry) => entry.mwh > 0)
    .sort((a, b) => b.mwh - a.mwh);

  const totalRaw = Array.from(categoryTotals.values()).reduce((sum, value) => sum + value, 0);
  const totalMwh = Number(totalRaw.toFixed(2));

  return {
    totalMwh,
    breakdown,
  };
};

