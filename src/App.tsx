import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Projetos from "./pages/Projetos";
import ProjetoDetalhe from "./pages/ProjetoDetalhe";
import Tarefas from "./pages/Tarefas";
import TarefaDetalhe from "./pages/TarefaDetalhe";
import Horas from "./pages/Horas";
import Financeiro from "./pages/Financeiro";
import FinanceiroDashboard from "./pages/financeiro/FinanceiroDashboard";
import FinanceiroReceber from "./pages/financeiro/FinanceiroReceber";
import FinanceiroPagar from "./pages/financeiro/FinanceiroPagar";
import FinanceiroRentabilidade from "./pages/financeiro/FinanceiroRentabilidade";
import FinanceiroSaldosProjeto from "./pages/financeiro/FinanceiroSaldosProjeto";
import Alertas from "./pages/Alertas";
import Login from "./pages/Login";
import Cadastro from "./pages/Cadastro";
import Perfil from "./pages/Perfil";
import ResetPassword from "./pages/ResetPassword";
import Usuarios from "./pages/Usuarios";
import DashboardPlanejamento from "./pages/DashboardPlanejamento";
import Cronograma from "./pages/Cronograma";
import ComercialDashboard from "./pages/comercial/ComercialDashboard";
import ComercialClientes from "./pages/comercial/ComercialClientes";
import ComercialPropostas from "./pages/comercial/ComercialPropostas";
import ComercialPipeline from "./pages/comercial/ComercialPipeline";
import ComercialRelatorios from "./pages/comercial/ComercialRelatorios";
import NotFound from "./pages/NotFound";
import Bonificacao from "./pages/Bonificacao";
import Demandas from "./pages/Demandas";

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
    // Redirect based on role
    if (profile.role === "projetista") return <Navigate to="/tarefas" replace />;
    return <Navigate to="/planejamento" replace />;
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
  const defaultRoute = profile?.role === "projetista" ? "/tarefas" : "/planejamento";

  return (
    <Routes>
      <Route path="/login" element={user && !pendingApproval ? <Navigate to={defaultRoute} replace /> : <Login />} />
      <Route path="/cadastro" element={user && !pendingApproval ? <Navigate to={defaultRoute} replace /> : <Cadastro />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/" element={<Navigate to="/planejamento" replace />} />
      <Route path="/planejamento" element={<ProtectedRoute allowedRoles={["admin_geral", "admin", "planejamento", "coordenador"]}><DashboardPlanejamento /></ProtectedRoute>} />
      <Route path="/projetos" element={<ProtectedRoute allowedRoles={["admin_geral", "admin", "planejamento", "coordenador"]}><Projetos /></ProtectedRoute>} />
      <Route path="/projetos/:id" element={<ProtectedRoute allowedRoles={["admin_geral", "admin", "planejamento", "coordenador"]}><ProjetoDetalhe /></ProtectedRoute>} />
      <Route path="/tarefas" element={<ProtectedRoute><Tarefas /></ProtectedRoute>} />
      <Route path="/tarefas/:id" element={<ProtectedRoute><TarefaDetalhe /></ProtectedRoute>} />
      <Route path="/demandas" element={<ProtectedRoute><Demandas /></ProtectedRoute>} />
      <Route path="/horas" element={<ProtectedRoute allowedRoles={["admin_geral", "admin", "planejamento", "coordenador"]}><Horas /></ProtectedRoute>} />
      <Route path="/cronograma" element={<ProtectedRoute allowedRoles={["admin_geral", "admin", "planejamento", "coordenador"]}><Cronograma /></ProtectedRoute>} />
      <Route path="/bonificacao" element={<ProtectedRoute allowedRoles={["admin_geral", "admin", "planejamento"]}><Bonificacao /></ProtectedRoute>} />
      <Route path="/financeiro" element={<ProtectedRoute allowedRoles={["admin_geral", "admin"]}><FinanceiroDashboard /></ProtectedRoute>} />
      <Route path="/financeiro/receber" element={<ProtectedRoute allowedRoles={["admin_geral", "admin"]}><FinanceiroReceber /></ProtectedRoute>} />
      <Route path="/financeiro/pagar" element={<ProtectedRoute allowedRoles={["admin_geral", "admin"]}><FinanceiroPagar /></ProtectedRoute>} />
      <Route path="/financeiro/rentabilidade" element={<ProtectedRoute allowedRoles={["admin_geral", "admin"]}><FinanceiroRentabilidade /></ProtectedRoute>} />
      <Route path="/financeiro/saldos" element={<ProtectedRoute allowedRoles={["admin_geral", "admin"]}><FinanceiroSaldosProjeto /></ProtectedRoute>} />
      <Route path="/usuarios" element={<ProtectedRoute allowedRoles={["admin_geral"]}><Usuarios /></ProtectedRoute>} />
      <Route path="/alertas" element={<ProtectedRoute allowedRoles={["admin_geral", "admin", "planejamento", "coordenador"]}><Alertas /></ProtectedRoute>} />
      <Route path="/comercial" element={<ProtectedRoute allowedRoles={["admin_geral", "admin"]}><ComercialDashboard /></ProtectedRoute>} />
      <Route path="/comercial/clientes" element={<ProtectedRoute allowedRoles={["admin_geral", "admin"]}><ComercialClientes /></ProtectedRoute>} />
      <Route path="/comercial/propostas" element={<ProtectedRoute allowedRoles={["admin_geral", "admin"]}><ComercialPropostas /></ProtectedRoute>} />
      <Route path="/comercial/pipeline" element={<ProtectedRoute allowedRoles={["admin_geral", "admin"]}><ComercialPipeline /></ProtectedRoute>} />
      <Route path="/comercial/relatorios" element={<ProtectedRoute allowedRoles={["admin_geral", "admin"]}><ComercialRelatorios /></ProtectedRoute>} />
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

