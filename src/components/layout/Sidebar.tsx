import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  BarChart3,
  Users,
  FolderOpen,
  FileText,
  Receipt,
  Building2,
  Package,
  Settings,
  Home,
  Calendar,
  TrendingUp,
  LogOut,
  ClipboardPlus,
  UserCircle,
  Calculator,
  Settings2,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const mainItems = [
  { title: "Tableau de Bord", url: "/", icon: BarChart3 },
  { 
    title: "Leads", 
    url: "/leads", 
    icon: Users,
    subItems: [
      { title: "Liste des leads", url: "/leads", icon: Users },
      { title: "Lead terrain", url: "/leads/pos", icon: ClipboardPlus },
      { title: "Paramètres Lead", url: "/leads/settings", icon: Settings2 },
    ]
  },
  { title: "Projets", url: "/projects", icon: FolderOpen },
  { title: "Devis", url: "/quotes", icon: FileText },
  { title: "Chantiers", url: "/sites", icon: Building2 },
  { title: "Clients", url: "/clients", icon: UserCircle },
  { title: "Comptabilité", url: "/accounting", icon: Calculator },
  { title: "Factures", url: "/invoices", icon: Receipt },
  { title: "Produits", url: "/products", icon: Package },
];

const businessItems = [
  { title: "Planning RDV", url: "/calendar", icon: Calendar },
  { title: "Reporting", url: "/reports", icon: TrendingUp },
  { title: "Membres", url: "/members", icon: Users },
  { title: "Paramètres", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const isCollapsed = state === "collapsed";
  const { signOut } = useAuth();
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>({});

  const isActive = (path: string, subItems?: any[]) => {
    if (path === "/") return currentPath === "/";
    if (subItems) {
      return subItems.some(sub => currentPath === sub.url || currentPath.startsWith(sub.url + "/"));
    }
    return currentPath === path || currentPath.startsWith(path + "/");
  };

  const getNavClassName = (active: boolean) =>
    active 
      ? "bg-gradient-to-r from-primary/20 to-primary/10 text-primary border-r-2 border-primary font-medium" 
      : "hover:bg-muted/50 text-muted-foreground hover:text-foreground";

  const toggleGroup = (title: string) => {
    setOpenGroups(prev => ({ ...prev, [title]: !prev[title] }));
  };

  return (
    <Sidebar className={isCollapsed ? "w-14" : "w-64"} collapsible="icon">
      <SidebarContent className="bg-gradient-to-b from-background to-muted/20">
        {/* Logo */}
        <div className="p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
              <Home className="w-4 h-4 text-white" />
            </div>
            {!isCollapsed && (
              <div>
                <h1 className="font-bold text-lg text-primary">EcoProRenov</h1>
                <p className="text-xs text-muted-foreground">CRM Professionnel</p>
              </div>
            )}
          </div>
        </div>

        {/* Main Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs text-muted-foreground px-4">
            {!isCollapsed && "GESTION PRINCIPALE"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="px-2 space-y-1">
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  {item.subItems ? (
                    <>
                      <SidebarMenuButton 
                        className="h-11"
                        onClick={() => !isCollapsed && toggleGroup(item.title)}
                      >
                        <item.icon className="w-5 h-5 flex-shrink-0" />
                        {!isCollapsed && (
                          <>
                            <span className="ml-3 flex-1 text-left">{item.title}</span>
                            <ChevronDown className={`w-4 h-4 transition-transform ${openGroups[item.title] || isActive(item.url, item.subItems) ? 'rotate-180' : ''}`} />
                          </>
                        )}
                      </SidebarMenuButton>
                      {!isCollapsed && (openGroups[item.title] || isActive(item.url, item.subItems)) && (
                        <SidebarMenu className="ml-4 mt-1 space-y-1">
                          {item.subItems.map((subItem) => (
                            <SidebarMenuItem key={subItem.title}>
                              <SidebarMenuButton asChild className="h-10">
                                <NavLink
                                  to={subItem.url}
                                  className={getNavClassName(isActive(subItem.url))}
                                >
                                  <subItem.icon className="w-4 h-4 flex-shrink-0" />
                                  <span className="ml-2 text-sm">{subItem.title}</span>
                                </NavLink>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          ))}
                        </SidebarMenu>
                      )}
                    </>
                  ) : (
                    <SidebarMenuButton asChild className="h-11">
                      <NavLink
                        to={item.url}
                        className={getNavClassName(isActive(item.url))}
                      >
                        <item.icon className="w-5 h-5 flex-shrink-0" />
                        {!isCollapsed && <span className="ml-3">{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Business Tools */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs text-muted-foreground px-4">
            {!isCollapsed && "OUTILS MÉTIER"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="px-2 space-y-1">
              {businessItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="h-11">
                    <NavLink
                      to={item.url}
                      className={getNavClassName(isActive(item.url))}
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      {!isCollapsed && <span className="ml-3">{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Logout */}
        <div className="mt-auto border-t pt-4">
          <SidebarMenu className="px-2">
            <SidebarMenuItem>
              <SidebarMenuButton 
                onClick={signOut}
                className="h-11 hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
              >
                <LogOut className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && <span className="ml-3">Déconnexion</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}