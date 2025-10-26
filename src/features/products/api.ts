import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type CategoryRecord = Tables<"categories">;
export type ProductRecord = Tables<"product_catalog">;
export type ProductKwhCumacRecord = Tables<"product_kwh_cumac">;

export type ProductCatalogRecord = ProductRecord & {
  kwh_cumac_values?: ProductKwhCumacRecord[];
};

export type ProductKwhCumacInput = {
  building_type: string;
  kwh_cumac: number | null;
};

export type ProductFilters = {
  search?: string;
  categoryId?: string | null;
  productType?: string | null;
  enabled?: boolean | null;
};

export type PaginationOptions = {
  page: number;
  pageSize: number;
};

const sanitizeSearch = (value: string) => value.replace(/[%_]/g, (match) => `\\${match}`);

export const useCategories = (orgId: string | null) =>
  useQuery<CategoryRecord[], Error>({
    queryKey: ["categories", orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      if (!orgId) return [];

      const { data, error } = await supabase
        .from("categories")
        .select("id, org_id, name, description, created_at")
        .eq("org_id", orgId)
        .order("name", { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  });

export const useCreateCategory = (orgId: string | null) => {
  const queryClient = useQueryClient();

  return useMutation<CategoryRecord, Error, { name: string; description?: string | null }>({
    mutationFn: async ({ name, description }) => {
      if (!orgId) throw new Error("Organisation requise");

      const payload: TablesInsert<"categories"> = {
        org_id: orgId,
        name,
        description: description ?? null,
      };

      const { data, error } = await supabase
        .from("categories")
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: ["categories", orgId] });
        queryClient.invalidateQueries({ queryKey: ["product-catalog", orgId] });
      }
    },
  });
};

export const useProductCatalog = (
  orgId: string | null,
  filters?: ProductFilters,
  pagination?: PaginationOptions,
) =>
  useQuery<{ data: ProductCatalogRecord[]; count: number }, Error>({
    queryKey: ["product-catalog", orgId, filters, pagination],
    enabled: Boolean(orgId),
    queryFn: async () => {
      if (!orgId) return { data: [], count: 0 };

      const { search, categoryId, productType, enabled } = filters ?? {};
      const trimmedSearch = search?.trim();
      const sanitizedSearch = trimmedSearch ? sanitizeSearch(trimmedSearch) : null;

      let query = supabase
        .from("product_catalog")
        .select("*, kwh_cumac_values:product_kwh_cumac(id, building_type, kwh_cumac)", {
          count: "exact",
        })
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });

      if (sanitizedSearch) {
        const pattern = `%${sanitizedSearch}%`;
        query = query.or(
          [
            `name.ilike.${pattern}`,
            `sku.ilike.${pattern}`,
            `product_type.ilike.${pattern}`,
            `category.ilike.${pattern}`,
          ].join(","),
        );
      }

      if (categoryId) {
        query = query.eq("category", categoryId);
      }

      if (enabled !== null && enabled !== undefined) {
        query = query.eq("is_active", enabled);
      }

      if (pagination) {
        const from = (pagination.page - 1) * pagination.pageSize;
        const to = from + pagination.pageSize - 1;
        query = query.range(from, to);
      }

      const { data, error, count } = await query;

      if (error) throw error;
      return {
        data: (data ?? []) as ProductCatalogRecord[],
        count: count ?? (data?.length ?? 0),
      };
    },
  });

const syncProductKwhCumac = async (productId: string, entries: ProductKwhCumacInput[]) => {
  const sanitized = entries
    .map((entry) => ({
      building_type: entry.building_type.trim(),
      kwh_cumac: entry.kwh_cumac,
    }))
    .filter((entry) => entry.building_type.length > 0);

  const { error: deleteError } = await supabase
    .from("product_kwh_cumac")
    .delete()
    .eq("product_id", productId);

  if (deleteError) throw deleteError;

  const toInsert = sanitized.filter(
    (entry): entry is { building_type: string; kwh_cumac: number } =>
      entry.kwh_cumac !== null && entry.kwh_cumac !== undefined,
  );

  if (toInsert.length === 0) {
    return;
  }

  const { error: insertError } = await supabase.from("product_kwh_cumac").insert(
    toInsert.map((entry) => ({
      product_id: productId,
      building_type: entry.building_type,
      kwh_cumac: entry.kwh_cumac,
    })),
  );

  if (insertError) throw insertError;
};

const fetchProductWithRelations = async (id: string): Promise<ProductCatalogRecord> => {
  const { data, error } = await supabase
    .from("product_catalog")
    .select("*, kwh_cumac_values:product_kwh_cumac(id, building_type, kwh_cumac)")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as ProductCatalogRecord;
};

export const useCreateProduct = (orgId: string | null) => {
  const queryClient = useQueryClient();

  return useMutation<ProductCatalogRecord, Error, { values: TablesInsert<"product_catalog">; kwhCumac?: ProductKwhCumacInput[] }>(
    {
      mutationFn: async ({ values, kwhCumac }) => {
        if (!orgId) throw new Error("Organisation requise");

        const insertValues: TablesInsert<"product_catalog"> = {
          ...values,
          org_id: values.org_id ?? orgId,
        };

        if (!insertValues.owner_id) {
          throw new Error("Utilisateur requis pour créer un produit");
        }

        const { data, error } = await supabase
          .from("product_catalog")
          .insert(insertValues)
          .select()
          .single();

        if (error) throw error;

        if (kwhCumac) {
          await syncProductKwhCumac(data.id, kwhCumac);
          return fetchProductWithRelations(data.id);
        }

        return data as ProductCatalogRecord;
      },
      onSuccess: () => {
        if (orgId) {
          queryClient.invalidateQueries({ queryKey: ["product-catalog", orgId] });
        }
      },
    },
  );
};

export const useUpdateProduct = (orgId: string | null) => {
  const queryClient = useQueryClient();

  return useMutation<
    ProductCatalogRecord,
    Error,
    { id: string; values: TablesUpdate<"product_catalog">; kwhCumac?: ProductKwhCumacInput[] }
  >({
    mutationFn: async ({ id, values, kwhCumac }) => {
      const { data, error } = await supabase
        .from("product_catalog")
        .update(values)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      if (kwhCumac) {
        await syncProductKwhCumac(id, kwhCumac);
        return fetchProductWithRelations(id);
      }

      return data as ProductCatalogRecord;
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: ["product-catalog", orgId] });
      }
    },
  });
};

export const useDeleteProduct = (orgId: string | null) => {
  const queryClient = useQueryClient();

  return useMutation<{ id: string }, Error, string>({
    mutationFn: async (id) => {
      const { error } = await supabase.from("product_catalog").delete().eq("id", id);
      if (error) throw error;
      return { id };
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: ["product-catalog", orgId] });
      }
    },
  });
};

export const useProductTypes = (
  catalog: ProductCatalogRecord[] | undefined,
): string[] =>
  useMemo(() => {
    const defaults = ["LED", "Isolation", "PAC", "Photovoltaïque", "Menuiserie"];
    const existing = catalog?.map((product) => product.name).filter(Boolean) ?? [];
    return Array.from(new Set([...defaults, ...existing])).sort((a, b) => a.localeCompare(b));
  }, [catalog]);
