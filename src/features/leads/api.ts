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

export type LeadProductTypeRecord = Tables<"lead_product_types">;

export const getLeadProductTypes = async (orgId: string) => {
  const { data, error } = await supabase
    .from("lead_product_types")
    .select("id, name, org_id, created_at, updated_at")
    .eq("org_id", orgId)
    .order("name", { ascending: true });

  if (error) throw error;

  return data ?? [];
};

export const useLeadProductTypes = (orgId: string | null) =>
  useQuery<LeadProductTypeRecord[], Error>({
    queryKey: ["lead-product-types", orgId],
    enabled: Boolean(orgId),
    queryFn: async () => {
      if (!orgId) return [];
      return getLeadProductTypes(orgId);
    },
    staleTime: 5 * 60 * 1000,
  });

export const useCreateLeadProductType = (orgId: string | null) => {
  const queryClient = useQueryClient();

  return useMutation<LeadProductTypeRecord, Error, { name: string }>({
    mutationFn: async ({ name }) => {
      if (!orgId) throw new Error("Organisation requise");

      const payload: TablesInsert<"lead_product_types"> = {
        org_id: orgId,
        name: name.trim(),
      };

      const { data, error } = await supabase
        .from("lead_product_types")
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: ["lead-product-types", orgId] });
      }
    },
  });
};

export const useDeleteLeadProductType = (orgId: string | null) => {
  const queryClient = useQueryClient();

  return useMutation<{ id: string }, Error, string>({
    mutationFn: async (id) => {
      const { error } = await supabase.from("lead_product_types").delete().eq("id", id);
      if (error) throw error;
      return { id };
    },
    onSuccess: () => {
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: ["lead-product-types", orgId] });
      }
    },
  });
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
          `full_name.ilike.%${sanitizedSearch}%,email.ilike.%${sanitizedSearch}%,phone_raw.ilike.%${sanitizedSearch}%,city.ilike.%${sanitizedSearch}%,postal_code.ilike.%${sanitizedSearch}%,company.ilike.%${sanitizedSearch}%,siren.ilike.%${sanitizedSearch}%,product_name.ilike.%${sanitizedSearch}%,utm_source.ilike.%${sanitizedSearch}%`
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
