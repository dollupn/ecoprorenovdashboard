import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

export type MemberRole = "owner" | "admin" | "commercial" | "member";
type AppRole = Database["public"]["Enums"]["app_role"];

export const mapMemberRoleToAppRole = (role: MemberRole): AppRole => {
  switch (role) {
    case "owner":
    case "admin":
      return "admin";
    case "commercial":
      return "commercial";
    default:
      return "user";
  }
};

export async function upsertUserRole(orgId: string, userId: string, role: MemberRole) {
  const appRole = mapMemberRoleToAppRole(role);
  const { error } = await supabase
    .from("user_roles")
    .upsert(
      {
        org_id: orgId,
        user_id: userId,
        role: appRole,
      },
      { onConflict: "user_id,org_id" }
    );

  if (error) throw error;

  return appRole;
}

export async function removeUserRole(orgId: string, userId: string) {
  const { error } = await supabase
    .from("user_roles")
    .delete()
    .match({ org_id: orgId, user_id: userId });

  if (error) throw error;
}

export async function lookupUserIdByEmail(email: string) {
  const { data, error } = await supabase.rpc("lookup_user_id_by_email", { email });

  if (error) throw error;
  if (!data) {
    throw new Error("Aucun utilisateur trouvé avec cet email.");
  }

  return data;
}

export async function inviteMember({
  email,
  role,
  orgId,
}: {
  email: string;
  role: MemberRole;
  orgId: string;
}) {
  const userId = await lookupUserIdByEmail(email);
  const { data: authData } = await supabase.auth.getUser();
  const invitedBy = authData.user?.id ?? null;

  const { error } = await supabase
    .from("memberships")
    .upsert(
      {
        org_id: orgId,
        user_id: userId,
        role,
        invited_by: invitedBy,
      },
      { onConflict: "org_id,user_id" }
    );

  if (error) throw error;

  const appRole = await upsertUserRole(orgId, userId, role);

  return { userId, appRole };
}

export async function updateMemberRole({
  orgId,
  userId,
  role,
}: {
  orgId: string;
  userId: string;
  role: MemberRole;
}) {
  const { error } = await supabase
    .from("memberships")
    .update({ role })
    .match({ org_id: orgId, user_id: userId });

  if (error) throw error;

  const appRole = await upsertUserRole(orgId, userId, role);

  return { appRole };
}

export async function deleteMember({
  orgId,
  userId,
}: {
  orgId: string;
  userId: string;
}) {
  const { error } = await supabase
    .from("memberships")
    .delete()
    .match({ org_id: orgId, user_id: userId });

  if (error) throw error;

  await removeUserRole(orgId, userId);
}

export interface Member {
  user_id: string;
  org_id: string;
  role: MemberRole;
  created_at: string;
  invited_by?: string;
  profiles?: {
    full_name: string | null;
  };
}

export function useMembers(orgId: string | null) {
  return useQuery({
    queryKey: ["members", orgId],
    queryFn: async () => {
      if (!orgId) return [];
      
      const { data, error } = await supabase
        .from("memberships")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      
      // Fetch profiles separately
      const userIds = data.map(m => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);
      
      // Merge data
      return data.map(member => ({
        ...member,
        profiles: profiles?.find(p => p.user_id === member.user_id) || null
      })) as any;
    },
    enabled: !!orgId,
  });
}

export function useInviteMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: inviteMember,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["members", variables.orgId] });
      toast({
        title: "Membre invité",
        description: "Le membre a été ajouté à l'organisation avec succès.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message,
      });
    },
  });
}

export function useUpdateMemberRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateMemberRole,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["members", variables.orgId] });
      toast({
        title: "Rôle modifié",
        description: "Le rôle du membre a été modifié avec succès.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de modifier le rôle du membre.",
      });
    },
  });
}

export function useDeleteMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteMember,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["members", variables.orgId] });
      toast({
        title: "Membre supprimé",
        description: "Le membre a été retiré de l'organisation.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de supprimer le membre.",
      });
    },
  });
}
