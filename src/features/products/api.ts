import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type CategoryRecord = Tables<"categories">;
export type ProductRecord = Tables<"products">;
export type ProductCatalogRecord = Tables<"product_catalog">;

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
        .select("*", { count: "exact" })
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
        query = query.eq("category_id", categoryId);
      }

      if (productType) {
        query = query.eq("product_type", productType);
      }

      if (enabled !== null && enabled !== undefined) {
        query = query.eq("enabled", enabled);
      }

      if (pagination) {
        const from = (pagination.page - 1) * pagination.pageSize;
        const to = from + pagination.pageSize - 1;
        query = query.range(from, to);
      }

      const { data, error, count } = await query;

      if (error) throw error;
      return {
        data: data ?? [],
        count: count ?? (data?.length ?? 0),
      };
    },
  });

export const useCreateProduct = (orgId: string | null) => {
  const queryClient = useQueryClient();

  return useMutation<ProductRecord, Error, TablesInsert<"products">>({
    mutationFn: async (payload) => {
      const { data, error } = await supabase
        .from("products")
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: ["product-catalog", orgId] });
      }
    },
  });
};

export const useUpdateProduct = (orgId: string | null) => {
  const queryClient = useQueryClient();

  return useMutation<ProductRecord, Error, { id: string; values: TablesUpdate<"products"> }>({
    mutationFn: async ({ id, values }) => {
      const { data, error } = await supabase
        .from("products")
        .update(values)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
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
      const { error } = await supabase.from("products").delete().eq("id", id);
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
    const existing = catalog?.map((product) => product.product_type).filter(Boolean) ?? [];
    return Array.from(new Set([...defaults, ...existing])).sort((a, b) => a.localeCompare(b));
  }, [catalog]);
