import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type DynamicFieldSchema = {
  name: string;
  label: string;
  type: "text" | "number" | "select" | "textarea";
  required?: boolean;
  min?: number;
  max?: number;
  options?: string[];
  placeholder?: string;
};

export type ProductFormSchema = {
  title?: string;
  fields: DynamicFieldSchema[];
};

export type LeadFilters = {
  statuses?: string[];
  assignedTo?: string;
};

const sanitizeSearch = (value: string) => value.replace(/[%_]/g, (match) => `\\${match}`);

export const getOrganizationProducts = async (orgId: string) => {
  const { data, error } = await supabase
    .from("product_catalog")
    .select("id, name, code, category, description, is_active")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((product) => ({
    ...product,
    product_code: product.code,
    product_type: product.code,
    value: product.code ?? product.id,
    label: product.name,
  }));
};

export const getOrganizationMembers = async (orgId: string) => {
  const { data: memberships, error } = await supabase
    .from("memberships")
    .select("org_id, user_id, role, created_at")
    .eq("org_id", orgId);

  if (error) throw error;

  if (!memberships?.length) {
    return [];
  }

  const userIds = memberships.map((membership) => membership.user_id);
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("user_id, full_name, role")
    .in("user_id", userIds);

  if (profileError) throw profileError;

  return memberships.map((membership) => ({
    ...membership,
    profile: profiles?.find((profile) => profile.user_id === membership.user_id) ?? null,
  }));
};

export const useLeadsList = (orgId: string | null, filters?: LeadFilters, search?: string) => {
  const sanitizedSearch = search?.trim() ? sanitizeSearch(search.trim()) : null;

  return useQuery<Tables<"leads">[], Error>({
    queryKey: [
      "leads",
      orgId,
      (filters?.statuses ?? []).join("|"),
      filters?.assignedTo ?? null,
      sanitizedSearch,
    ],
    enabled: Boolean(orgId),
    queryFn: async () => {
      if (!orgId) return [];

      let query = supabase
        .from("leads")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });

      if (filters?.statuses && filters.statuses.length > 0) {
        query = query.in("status", filters.statuses);
      }

      if (sanitizedSearch) {
        query = query.or(
          `full_name.ilike.%${sanitizedSearch}%,email.ilike.%${sanitizedSearch}%,phone_raw.ilike.%${sanitizedSearch}%,city.ilike.%${sanitizedSearch}%,postal_code.ilike.%${sanitizedSearch}%,company.ilike.%${sanitizedSearch}%,product_name.ilike.%${sanitizedSearch}%,utm_source.ilike.%${sanitizedSearch}%`
        );
      }

      const { data, error } = await query;

      if (error) throw error;

      return data ?? [];
    },
  });
};

export const useCreateLead = (_orgId: string | null) => {
  const queryClient = useQueryClient();
  return useMutation<Tables<"leads">, Error, TablesInsert<"leads">>({
    mutationFn: async (payload) => {
      const { data, error } = await supabase.from("leads").insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });
};

export const useUpdateLead = (_orgId: string | null) => {
  const queryClient = useQueryClient();
  return useMutation<Tables<"leads">, Error, { id: string; values: TablesUpdate<"leads"> }>({
    mutationFn: async ({ id, values }) => {
      const { data, error } = await supabase
        .from("leads")
        .update(values)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });
};
