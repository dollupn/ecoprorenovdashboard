import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  BarChart3,
  Users,
  FolderOpen,
  FileText,
  Receipt,
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
  HardHat,
  Target,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useOrg } from "@/features/organizations/OrgContext";
import { useMembers } from "@/features/members/api";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
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
      { title: "Paramètres Lead", url: "/settings?section=lead", icon: Settings2 },
    ]
  },
  {
    title: "Projets",
    url: "/projects",
    icon: FolderOpen,
    clickable: true,
    subItems: [
      { title: "Liste des projets", url: "/projects", icon: FolderOpen },
      { title: "Chantiers", url: "/projects/chantiers", icon: HardHat },
    ]
  },
  { title: "Devis", url: "/quotes", icon: FileText },
  { title: "Clients", url: "/clients", icon: UserCircle },
  { title: "Comptabilité", url: "/accounting", icon: Calculator },
  { title: "Factures", url: "/invoices", icon: Receipt },
  { title: "Produits", url: "/products", icon: Package },
];

const businessItems = [
  { title: "Planning", url: "/calendar", icon: Calendar },
  { title: "Reporting", url: "/reports", icon: TrendingUp },
  { title: "Membres", url: "/members", icon: Users },
  { 
    title: "Paramètres", 
    url: "/settings", 
    icon: Settings,
    subItems: [
      { title: "Paramètres généraux", url: "/settings", icon: Settings },
      { title: "Paramètres Lead", url: "/settings?section=lead", icon: Settings2 },
      { title: "Paramètres Devis", url: "/settings?section=quotes", icon: FileText },
      { title: "Types de RDV", url: "/settings?section=calendar", icon: Calendar },
    ]
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const isCollapsed = state === "collapsed";
  const { user, signOut } = useAuth();
  const { currentOrgId } = useOrg();
  const { data: members = [] } = useMembers(currentOrgId);
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>({});

  const currentMember = React.useMemo(
    () => members.find((member) => member.user_id === user?.id) ?? null,
    [members, user?.id],
  );

  const isAdmin = currentMember?.role === "owner" || currentMember?.role === "admin";

  const computedBusinessItems = React.useMemo(() => {
    return businessItems.map((item) => {
      if (item.title !== "Paramètres" || !item.subItems) {
        return item;
      }

      return {
        ...item,
        subItems: [
          ...item.subItems,
          ...(isAdmin
            ? [{ title: "Paramètres KPI", url: "/settings?section=kpi", icon: Target }]
            : []),
        ],
      };
    });
  }, [isAdmin]);

  const matchesPathWithSearch = (path: string) => {
    const [basePath, search] = path.split("?");
    const pathMatch = currentPath === basePath || currentPath.startsWith(`${basePath}/`);
    if (!search) {
      return pathMatch;
    }

    if (!pathMatch) {
      return false;
    }

    const currentParams = new URLSearchParams(location.search);
    const targetParams = new URLSearchParams(search);

    for (const [key, value] of targetParams.entries()) {
      if (currentParams.get(key) !== value) {
        return false;
      }
    }

    return true;
  };

  const isActive = (path: string, subItems?: any[]) => {
    if (subItems?.length) {
      return matchesPathWithSearch(path) || subItems.some((sub) => matchesPathWithSearch(sub.url));
    }
    return matchesPathWithSearch(path);
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
                      <NavLink to={item.url} className={({ isActive: linkActive }) => getNavClassName(linkActive)}>
                        <SidebarMenuButton className="h-11 pr-8">
                          <item.icon className="w-5 h-5 flex-shrink-0" />
                          {!isCollapsed && <span className="ml-3 flex-1 text-left">{item.title}</span>}
                        </SidebarMenuButton>
                      </NavLink>
                      {!isCollapsed && (
                        <SidebarMenuAction
                          onClick={() => toggleGroup(item.title)}
                          aria-label={`Toggle ${item.title}`}
                          aria-expanded={Boolean(openGroups[item.title] || isActive(item.url, item.subItems))}
                        >
                          <ChevronDown
                            className={`w-4 h-4 transition-transform ${openGroups[item.title] ? "rotate-180" : ""}`}
                          />
                        </SidebarMenuAction>
                      )}
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
              {computedBusinessItems.map((item) => (
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