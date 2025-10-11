import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";
import { useMembers, useUpdateMemberRole, useDeleteMember, MemberRole } from "@/features/members/api";
import { UserInviteDialog } from "@/features/members/UserInviteDialog";
import { UserRoleBadge } from "@/features/members/UserRoleBadge";
import { useOrg } from "@/features/organizations/OrgContext";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function Members() {
  const { currentOrgId, currentOrg } = useOrg();
  const { user } = useAuth();
  const { data: members = [], isLoading } = useMembers(currentOrgId);
  const updateRole = useUpdateMemberRole();
  const deleteMember = useDeleteMember();

  const currentMember = members.find((m) => m.user_id === user?.id);
  const canManage = currentMember?.role === "owner" || currentMember?.role === "admin";

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleRoleChange = (userId: string, newRole: MemberRole) => {
    if (!currentOrgId) return;
    updateRole.mutate({ orgId: currentOrgId, userId, role: newRole });
  };

  const handleDelete = (userId: string) => {
    if (!currentOrgId) return;
    deleteMember.mutate({ orgId: currentOrgId, userId });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Membres</h1>
            <p className="text-muted-foreground">
              Gérez les membres de {currentOrg?.name}
            </p>
          </div>
          {canManage && <UserInviteDialog />}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Équipe</CardTitle>
            <CardDescription>
              {members.length} membre{members.length > 1 ? "s" : ""} dans cette organisation
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Chargement...</p>
              </div>
            ) : members.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Aucun membre trouvé</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Membre</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Ajouté le</TableHead>
                    {canManage && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.user_id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarFallback>
                              {getInitials(member.profiles?.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">
                              {member.profiles?.full_name || "Utilisateur"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {canManage && member.role !== "owner" ? (
                          <Select
                            value={member.role}
                            onValueChange={(v) =>
                              handleRoleChange(member.user_id, v as MemberRole)
                            }
                            disabled={member.user_id === user?.id}
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">
                                <UserRoleBadge role="admin" />
                              </SelectItem>
                              <SelectItem value="commercial">
                                <UserRoleBadge role="commercial" />
                              </SelectItem>
                              <SelectItem value="member">
                                <UserRoleBadge role="member" />
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <UserRoleBadge role={member.role} />
                        )}
                      </TableCell>
                      <TableCell>
                        {format(new Date(member.created_at), "dd MMM yyyy", {
                          locale: fr,
                        })}
                      </TableCell>
                      {canManage && (
                        <TableCell className="text-right">
                          {member.role !== "owner" && member.user_id !== user?.id && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Êtes-vous sûr de vouloir retirer ce membre de l'organisation ?
                                    Cette action est irréversible.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(member.user_id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Supprimer
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
