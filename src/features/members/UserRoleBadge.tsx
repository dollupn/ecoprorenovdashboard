import { Badge } from "@/components/ui/badge";
import { MemberRole } from "./api";

interface UserRoleBadgeProps {
  role: MemberRole;
}

export function UserRoleBadge({ role }: UserRoleBadgeProps) {
  const variants = {
    owner: "bg-yellow-500/20 text-yellow-700 border-yellow-500/20 hover:bg-yellow-500/30",
    admin: "bg-blue-500/20 text-blue-700 border-blue-500/20 hover:bg-blue-500/30",
    member: "bg-muted text-muted-foreground hover:bg-muted/80",
  };

  const labels = {
    owner: "Propriétaire",
    admin: "Admin",
    member: "Membre",
  };

  return (
    <Badge className={variants[role]}>
      {labels[role]}
    </Badge>
  );
}
