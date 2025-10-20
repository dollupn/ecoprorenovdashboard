import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./Sidebar";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ModeToggle } from "@/components/theme/ModeToggle";
import { OrgSelector } from "@/features/organizations/OrgSelector";
import { useAuth } from "@/hooks/useAuth";
import { useOrg } from "@/features/organizations/OrgContext";
import { useMembers } from "@/features/members/api";
import { UserRoleBadge } from "@/features/members/UserRoleBadge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { NotificationBell } from "@/components/notifications/NotificationBell";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user } = useAuth();
  const { currentOrgId } = useOrg();
  const { data: members = [] } = useMembers(currentOrgId);
  
  const currentMember = members.find((m) => m.user_id === user?.id);
  
  const getInitials = (name: string | null | undefined) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-to-br from-background via-background to-muted/30">
        <AppSidebar />

        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="border-b bg-card/50 backdrop-blur-sm px-4 py-3 md:px-6 md:py-0">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3 md:flex-1 min-w-0">
                <SidebarTrigger className="text-muted-foreground hover:text-foreground flex-shrink-0" />

                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher leads, projets, clients..."
                    className="pl-10 w-full bg-background/50"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap justify-end">
                <OrgSelector />
                <ModeToggle />
                <NotificationBell />

                <div className="flex items-center gap-2 min-w-0">
                  <Avatar>
                    <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white">
                      {getInitials(currentMember?.profiles?.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden sm:block min-w-0 text-left sm:text-right">
                    <p className="text-sm font-medium truncate">
                      {currentMember?.profiles?.full_name || "Utilisateur"}
                    </p>
                    <div className="text-xs">
                      {currentMember?.role && <UserRoleBadge role={currentMember.role} />}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 p-4 sm:p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
