import {
  LayoutDashboard,
  FolderKanban,
  Users,
  BarChart3,
  Bell,
  ListChecks,
  LogOut,
  Briefcase,
  ChevronRight,
  ClipboardList,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { LeoneLogo } from "@/components/LeoneLogo";
import { cn } from "@/lib/utils";
import { useState } from "react";

const ROLE_LABELS: Record<string, string> = {
  admin_geral: "Diretor",
  admin: "Gerente",
  planejamento: "Coordenador",
  projetista: "Projetista",
};

interface NavModule {
  title: string;
  icon: typeof LayoutDashboard;
  url?: string;
  roles?: string[];
  children?: { title: string; url: string; icon: typeof LayoutDashboard }[];
}

const modules: NavModule[] = [
  {
    title: "Dashboard",
    icon: LayoutDashboard,
    url: "/",
    roles: ["admin_geral", "admin", "planejamento"],
  },
  {
    title: "Planejamento",
    icon: ClipboardList,
    roles: ["admin_geral", "admin", "planejamento", "projetista"],
    children: [
      { title: "Dashboard", url: "/planejamento", icon: LayoutDashboard },
      { title: "Projetos", url: "/projetos", icon: FolderKanban },
      { title: "Tarefas", url: "/tarefas", icon: ListChecks },
    ],
  },
  {
    title: "Financeiro",
    icon: BarChart3,
    url: "/financeiro",
    roles: ["admin_geral", "admin"],
  },
  {
    title: "Comercial",
    icon: Briefcase,
    url: "#",
    roles: ["admin_geral", "admin"],
  },
  {
    title: "Usuários",
    icon: Users,
    url: "/usuarios",
    roles: ["admin_geral"],
  },
  {
    title: "Alertas",
    icon: Bell,
    url: "/alertas",
    roles: ["admin_geral", "admin", "planejamento"],
  },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const [hoveredModule, setHoveredModule] = useState<string | null>(null);

  const userRole = profile?.role || "projetista";

  // For projetista, only show Planejamento > Tarefas
  const visibleModules = modules.filter((m) => {
    if (!m.roles) return true;
    return m.roles.includes(userRole);
  });

  // Filter children for projetista
  const getVisibleChildren = (mod: NavModule) => {
    if (!mod.children) return [];
    if (userRole === "projetista") {
      return mod.children.filter((c) => c.url === "/tarefas");
    }
    return mod.children;
  };

  const isModuleActive = (mod: NavModule) => {
    if (mod.url && mod.url !== "#") {
      return mod.url === "/" ? location.pathname === "/" : location.pathname.startsWith(mod.url);
    }
    if (mod.children) {
      return mod.children.some((c) =>
        c.url === "/" ? location.pathname === "/" : location.pathname.startsWith(c.url)
      );
    }
    return false;
  };

  const isChildActive = (url: string) =>
    url === "/" ? location.pathname === "/" : location.pathname.startsWith(url);

  return (
    <div className="relative flex h-screen shrink-0 z-40">
      {/* Compact icon strip */}
      <div className="flex flex-col w-16 bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
        {/* Logo */}
        <div className="flex items-center justify-center h-14 border-b border-sidebar-border">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent">
            <span className="text-xs font-bold text-accent-foreground">L</span>
          </div>
        </div>

        {/* Module icons */}
        <nav className="flex-1 flex flex-col py-2 gap-1">
          {visibleModules.map((mod) => {
            const active = isModuleActive(mod);
            const Icon = mod.icon;
            return (
              <div
                key={mod.title}
                className="relative px-2"
                onMouseEnter={() => setHoveredModule(mod.title)}
                onMouseLeave={() => setHoveredModule(null)}
              >
                <button
                  onClick={() => {
                    if (mod.url && mod.url !== "#") {
                      navigate(mod.url);
                    } else if (mod.children) {
                      const children = getVisibleChildren(mod);
                      if (children.length > 0) navigate(children[0].url);
                    }
                  }}
                  className={cn(
                    "flex items-center justify-center w-12 h-10 rounded-lg transition-all duration-200",
                    active
                      ? "bg-accent text-accent-foreground"
                      : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                  )}
                >
                  <Icon className="h-5 w-5" />
                </button>

                {/* Hover flyout */}
                {hoveredModule === mod.title && (
                  <div
                    className="absolute left-full top-0 ml-0 z-50"
                    onMouseEnter={() => setHoveredModule(mod.title)}
                    onMouseLeave={() => setHoveredModule(null)}
                  >
                    <div className="bg-sidebar border border-sidebar-border rounded-lg shadow-xl py-2 px-1 min-w-[180px] ml-1">
                      {/* Module title */}
                      <div className="px-3 py-1.5 text-xs font-semibold text-sidebar-foreground/40 uppercase tracking-widest">
                        {mod.title}
                      </div>

                      {mod.children ? (
                        getVisibleChildren(mod).map((child) => {
                          const childActive = isChildActive(child.url);
                          const ChildIcon = child.icon;
                          return (
                            <NavLink
                              key={child.url}
                              to={child.url}
                              className={cn(
                                "flex items-center gap-2 px-3 py-2 mx-1 rounded-md text-sm transition-colors",
                                childActive
                                  ? "bg-accent text-accent-foreground font-medium"
                                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                              )}
                            >
                              <ChildIcon className="h-4 w-4" />
                              <span>{child.title}</span>
                              {childActive && <ChevronRight className="h-3 w-3 ml-auto" />}
                            </NavLink>
                          );
                        })
                      ) : (
                        <NavLink
                          to={mod.url || "#"}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 mx-1 rounded-md text-sm transition-colors",
                            active
                              ? "bg-accent text-accent-foreground font-medium"
                              : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          <span>Acessar</span>
                        </NavLink>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer - user avatar + logout */}
        <div className="border-t border-sidebar-border p-2 flex flex-col items-center gap-2 pb-3">
          <button
            onClick={() => navigate("/perfil")}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground hover:ring-2 hover:ring-accent/50 transition-all"
            title={profile?.name || "Perfil"}
          >
            {profile?.name?.split(" ").map((n) => n[0]).join("").slice(0, 2) || "?"}
          </button>
          <button
            onClick={signOut}
            className="flex items-center justify-center w-9 h-9 rounded-lg text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
