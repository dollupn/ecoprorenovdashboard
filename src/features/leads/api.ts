import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

type LeadRecord = Tables<"leads">;

type LeadInsert = TablesInsert<"leads">;
type LeadUpdate = TablesUpdate<"leads">;

type MembershipRecord = Tables<"memberships">;
type ProfileRecord = Tables<"profiles">;

type ProductRecord = Tables<"products">;

type QueryError = Error;

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

export const getProductFormSchema = async (orgId: string, productType: string) => {
  const { data, error } = await supabase
    .from("products")
    .select("product_type, label, form_schema, enabled")
    .eq("org_id", orgId)
    .eq("product_type", productType)
    .eq("enabled", true)
    .maybeSingle();

  if (error) throw error as QueryError;

  if (!data) return null;

  const formSchema = (data.form_schema ?? { fields: [] }) as ProductFormSchema;

  return {
    ...data,
    form_schema: formSchema,
  } as ProductRecord & { form_schema: ProductFormSchema };
};

export const getOrganizationProducts = async (orgId: string) => {
  const { data, error } = await supabase
    .from("products")
    .select("id, product_type, label, enabled, form_schema")
    .eq("org_id", orgId)
    .eq("enabled", true)
    .order("label", { ascending: true });

  if (error) throw error as QueryError;

  return (data ?? []).map((product) => ({
    ...product,
    form_schema: (product.form_schema ?? { fields: [] }) as ProductFormSchema,
  }));
};

export const getOrganizationMembers = async (orgId: string) => {
  const { data: memberships, error } = await supabase
    .from("memberships")
    .select("org_id, user_id, role, created_at")
    .eq("org_id", orgId);

  if (error) throw error as QueryError;

  if (!memberships?.length) {
    return [] as Array<MembershipRecord & { profile?: ProfileRecord | null }>;
  }

  const userIds = memberships.map((membership) => membership.user_id);
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("user_id, full_name, role")
    .in("user_id", userIds);

  if (profileError) throw profileError as QueryError;

  return memberships.map((membership) => ({
    ...membership,
    profile: profiles?.find((profile) => profile.user_id === membership.user_id) ?? null,
  }));
};

export const useLeadsList = (orgId: string | null, filters?: LeadFilters, search?: string) => {
  const sanitizedSearch = search?.trim() ? sanitizeSearch(search.trim()) : null;

  return useQuery<LeadRecord[], QueryError>({
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

      if (filters?.assignedTo) {
        query = query.eq("assigned_to", filters.assignedTo);
      }

      if (sanitizedSearch) {
        query = query.or(
          [
            `full_name.ilike.%${sanitizedSearch}%`,
            `email.ilike.%${sanitizedSearch}%`,
            `phone_raw.ilike.%${sanitizedSearch}%`,
            `city.ilike.%${sanitizedSearch}%`,
            `postal_code.ilike.%${sanitizedSearch}%`,
            `company.ilike.%${sanitizedSearch}%`,
            `product_name.ilike.%${sanitizedSearch}%`,
            `utm_source.ilike.%${sanitizedSearch}%`,
          ].join(",")
        );
      }

      const { data, error } = await query;

      if (error) throw error as QueryError;

      return data ?? [];
    },
  });
};

export const useCreateLead = (_orgId: string | null) => {
  const queryClient = useQueryClient();
  return useMutation<LeadRecord, QueryError, LeadInsert>({
    mutationFn: async (payload) => {
      const { data, error } = await supabase.from("leads").insert(payload).select().single();
      if (error) throw error as QueryError;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });
};

export const useUpdateLead = (_orgId: string | null) => {
  const queryClient = useQueryClient();
  return useMutation<LeadRecord, QueryError, { id: string; values: LeadUpdate }>({
    mutationFn: async ({ id, values }) => {
      const { data, error } = await supabase
        .from("leads")
        .update(values)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error as QueryError;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });
};
