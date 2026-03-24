import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Clock,
  BarChart3,
  Bell,
  ListChecks,
  LogOut,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { LeoneLogo } from "@/components/LeoneLogo";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

const ROLE_LABELS: Record<string, string> = {
  admin_geral: "Diretor",
  admin: "Gerente",
  planejamento: "Coordenador",
  projetista: "Projetista",
};

interface NavItem {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  roles?: string[]; // if undefined, visible to all
}

const allNav: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, roles: ["admin_geral", "admin", "planejamento"] },
  { title: "Projetos", url: "/projetos", icon: FolderKanban, roles: ["admin_geral", "admin", "planejamento"] },
  { title: "Tarefas", url: "/tarefas", icon: ListChecks },
  
  { title: "Financeiro", url: "/financeiro", icon: BarChart3, roles: ["admin_geral", "admin"] },
  { title: "Usuários", url: "/usuarios", icon: Users, roles: ["admin_geral"] },
  { title: "Alertas", url: "/alertas", icon: Bell, roles: ["admin_geral", "admin", "planejamento"] },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { profile, signOut } = useAuth();

  const userRole = profile?.role || "projetista";

  const visibleNav = allNav.filter((item) => {
    if (!item.roles) return true;
    return item.roles.includes(userRole);
  });

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          {!collapsed ? (
            <LeoneLogo className="w-28" variant="light" showSubtext={true} />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent">
              <span className="text-xs font-bold text-accent-foreground">L</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/40 uppercase text-[0.65rem] tracking-widest">
            Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleNav.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={active}>
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        activeClassName="bg-sidebar-accent text-accent"
                        className={active ? "" : "text-sidebar-foreground/70 hover:text-sidebar-foreground"}
                      >
                        <item.icon className={`mr-2 h-4 w-4 ${active ? "text-accent" : ""}`} />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 space-y-2 border-t border-sidebar-border">
        <NavLink to="/perfil" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
            {profile?.name?.split(" ").map((n) => n[0]).join("").slice(0, 2) || "?"}
          </div>
          {!collapsed && (
            <div className="animate-fade-in min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{profile?.name || "Usuário"}</p>
              <p className="text-xs text-sidebar-foreground/50">{ROLE_LABELS[profile?.role || ""] || ""}</p>
            </div>
          )}
        </NavLink>
        {!collapsed && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent gap-2"
            onClick={signOut}
          >
            <LogOut className="h-3.5 w-3.5" /> Sair
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
