import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Clock,
  BarChart3,
  Bell,
  Building2,
  ListChecks,
  UserCircle,
  LogOut,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
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
  admin_geral: "Admin Geral",
  admin: "Administrador",
  planejamento: "Planejamento",
  projetista: "Projetista",
};

const mainNav = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Projetos", url: "/projetos", icon: FolderKanban },
  { title: "Tarefas", url: "/tarefas", icon: ListChecks },
  { title: "Equipe", url: "/equipe", icon: Users },
  { title: "Controle de Horas", url: "/horas", icon: Clock },
  { title: "Financeiro", url: "/financeiro", icon: BarChart3 },
  { title: "Alertas", url: "/alertas", icon: Bell },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { profile, signOut, canAccessFinanceiro } = useAuth();

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary">
            <Building2 className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="animate-fade-in">
              <p className="text-sm font-semibold text-sidebar-foreground">II Leone EPP</p>
              <p className="text-xs text-sidebar-foreground/60">Engenharia</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => {
                // Hide financeiro for non-admin users
                if (item.url === "/financeiro" && !canAccessFinanceiro) {
                  return null;
                }

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                      >
                        <item.icon className="mr-2 h-4 w-4" />
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

      <SidebarFooter className="p-4 space-y-2">
        <NavLink to="/perfil" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground">
            {profile?.name?.split(" ").map((n) => n[0]).join("").slice(0, 2) || "?"}
          </div>
          {!collapsed && (
            <div className="animate-fade-in min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">{profile?.name || "Usuário"}</p>
              <p className="text-xs text-sidebar-foreground/60">{ROLE_LABELS[profile?.role || ""] || ""}</p>
            </div>
          )}
        </NavLink>
        {!collapsed && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sidebar-foreground/60 hover:text-sidebar-foreground gap-2"
            onClick={signOut}
          >
            <LogOut className="h-3.5 w-3.5" /> Sair
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
