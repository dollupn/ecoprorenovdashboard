import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export type MemberRole = "owner" | "admin" | "commercial" | "member";

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
    mutationFn: async ({
      email,
      role,
      orgId,
    }: {
      email: string;
      role: MemberRole;
      orgId: string;
    }) => {
      // For now, we'll just show an error message
      // In production, you would send an invitation email
      throw new Error(
        "L'invitation par email n'est pas encore configurée. L'utilisateur doit créer un compte puis vous partagerez votre ID d'organisation."
      );
    },
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
    mutationFn: async ({
      orgId,
      userId,
      role,
    }: {
      orgId: string;
      userId: string;
      role: MemberRole;
    }) => {
      const { error } = await supabase
        .from("memberships")
        .update({ role })
        .eq("org_id", orgId)
        .eq("user_id", userId);

      if (error) throw error;
    },
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
    mutationFn: async ({
      orgId,
      userId,
    }: {
      orgId: string;
      userId: string;
    }) => {
      const { error } = await supabase
        .from("memberships")
        .delete()
        .eq("org_id", orgId)
        .eq("user_id", userId);

      if (error) throw error;
    },
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
