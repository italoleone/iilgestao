import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Dashboard from "./pages/Dashboard";
import Projetos from "./pages/Projetos";
import ProjetoDetalhe from "./pages/ProjetoDetalhe";
import Tarefas from "./pages/Tarefas";
import Horas from "./pages/Horas";
import Financeiro from "./pages/Financeiro";
import Alertas from "./pages/Alertas";
import Login from "./pages/Login";
import Cadastro from "./pages/Cadastro";
import Perfil from "./pages/Perfil";
import Usuarios from "./pages/Usuarios";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) {
  const { user, profile, loading, pendingApproval } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }
  if (pendingApproval) return <Navigate to="/login" replace />;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    // Redirect projetista to tarefas, others to home
    return <Navigate to={profile.role === "projetista" ? "/tarefas" : "/"} replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  const { user, loading, pendingApproval, profile } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Determine default route based on role
  const defaultRoute = profile?.role === "projetista" ? "/tarefas" : "/";

  return (
    <Routes>
      <Route path="/login" element={user && !pendingApproval ? <Navigate to={defaultRoute} replace /> : <Login />} />
      <Route path="/cadastro" element={user && !pendingApproval ? <Navigate to={defaultRoute} replace /> : <Cadastro />} />
      <Route path="/" element={<ProtectedRoute allowedRoles={["admin_geral", "admin", "planejamento"]}><Dashboard /></ProtectedRoute>} />
      <Route path="/projetos" element={<ProtectedRoute allowedRoles={["admin_geral", "admin", "planejamento"]}><Projetos /></ProtectedRoute>} />
      <Route path="/projetos/:id" element={<ProtectedRoute allowedRoles={["admin_geral", "admin", "planejamento"]}><ProjetoDetalhe /></ProtectedRoute>} />
      <Route path="/tarefas" element={<ProtectedRoute><Tarefas /></ProtectedRoute>} />
      <Route path="/horas" element={<ProtectedRoute allowedRoles={["admin_geral", "admin", "planejamento"]}><Horas /></ProtectedRoute>} />
      <Route path="/financeiro" element={<ProtectedRoute allowedRoles={["admin_geral", "admin"]}><Financeiro /></ProtectedRoute>} />
      <Route path="/usuarios" element={<ProtectedRoute allowedRoles={["admin_geral"]}><Usuarios /></ProtectedRoute>} />
      <Route path="/alertas" element={<ProtectedRoute allowedRoles={["admin_geral", "admin", "planejamento"]}><Alertas /></ProtectedRoute>} />
      <Route path="/perfil" element={<ProtectedRoute><Perfil /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

