import { AlertCircle, Mail, Phone, RefreshCw, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { RoleOption, TeamMember } from "./types";
import { ROLE_OPTIONS } from "./types";

interface TeamManagementCardProps {
  members: TeamMember[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onInvite: () => void;
  onRetry: () => void;
  onRoleChange: (id: string, role: RoleOption) => void;
  formatIdentifier: (identifier: string) => string;
}

export const TeamManagementCard = ({
  members,
  loading,
  error,
  onRefresh,
  onInvite,
  onRetry,
  onRoleChange,
  formatIdentifier,
}: TeamManagementCardProps) => {
  const renderMembers = () => {
    if (loading) {
      return (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`team-skeleton-${index}`}
              className="h-[116px] rounded-2xl border border-dashed border-border/60 bg-muted/20"
            />
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-6 text-center text-sm text-destructive">
          <AlertCircle className="h-6 w-6" />
          <p>{error}</p>
          <Button size="sm" variant="outline" onClick={onRetry}>
            Réessayer
          </Button>
        </div>
      );
    }

    if (members.length === 0) {
      return (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border/60 bg-background/40 p-6 text-center text-sm text-muted-foreground">
          <Users className="h-6 w-6 text-muted-foreground" />
          <p>Aucun collaborateur trouvé dans Supabase.</p>
          <Button variant="secondary" size="sm" onClick={onInvite}>
            Inviter votre premier membre
          </Button>
        </div>
      );
    }

    return members.map((member) => (
      <div
        key={member.id}
        className="flex flex-col gap-4 rounded-2xl border border-border/60 bg-background/60 p-4 transition hover:border-primary/40 md:flex-row md:items-center md:justify-between"
      >
        <div className="flex items-center gap-4">
          <Avatar className="h-12 w-12">
            <AvatarFallback className="bg-primary/10 text-primary">
              {member.name
                .split(" ")
                .map((part) => part[0])
                .join("")}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-foreground">{member.name}</p>
              <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                ID {formatIdentifier(member.identifier)}
              </Badge>
              {!member.active && (
                <Badge variant="destructive" className="text-xs font-normal">
                  Désactivé
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" />
                {member.email ?? "Email non renseigné"}
              </span>
              <span className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" />
                {member.phone ?? "Téléphone non renseigné"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6">
          <div className="space-y-1">
            <Label htmlFor={`role-${member.id}`} className="text-xs uppercase tracking-wide text-muted-foreground">
              Rôle
            </Label>
            <Select
              value={member.role}
              onValueChange={(value: RoleOption) => {
                onRoleChange(member.id, value);
              }}
            >
              <SelectTrigger id={`role-${member.id}`} className="w-[180px]">
                <SelectValue placeholder="Sélectionner" />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Dernière activité
            </Label>
            <p className="text-sm text-foreground">{member.lastConnection}</p>
          </div>
          <div className="flex items-center gap-3">
            <Label
              htmlFor={`active-${member.id}`}
              className="text-sm text-muted-foreground"
              title="Statut synchronisé automatiquement depuis Supabase"
            >
              {member.active ? "Actif" : "Inactif"}
            </Label>
            <Switch id={`active-${member.id}`} checked={member.active} disabled />
          </div>
        </div>
      </div>
    ));
  };

  return (
    <Card className="border border-border/60 bg-card/70 shadow-sm">
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Users className="h-5 w-5 text-primary" />
            Gestion des utilisateurs
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Administrez les accès, les rôles et le statut d&apos;activité de vos collaborateurs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={onRefresh}
            disabled={loading}
            className="h-9 w-9 border-border/60"
            aria-label="Rafraîchir la liste des membres"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={onInvite} variant="secondary">
            Inviter un membre
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">{renderMembers()}</CardContent>
    </Card>
  );
};
