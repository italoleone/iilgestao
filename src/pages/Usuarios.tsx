import { useEffect, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Check, X, UserCog, Shield, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { useAuth, type AppRole } from "@/contexts/AuthContext";

const ROLE_DISPLAY: Record<string, string> = {
  admin_geral: "Diretor",
  admin: "Gerente",
  coordenador: "Coordenador",
  planejamento: "Planejamento",
  projetista: "Projetista",
};

const DISCIPLINE_DISPLAY: Record<string, string> = {
  estrutural: "Estrutural",
  hidraulica: "Hidráulica",
  eletrica: "Elétrica",
};

interface UserRow {
  id: string;
  name: string;
  email: string;
  discipline: string | null;
  status: string;
  role?: string;
  cost_per_hour?: number | null;
}

export default function Usuarios() {
  const { canAccessFinanceiro } = useAuth();
  const [pendingUsers, setPendingUsers] = useState<UserRow[]>([]);
  const [activeUsers, setActiveUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [approveDialog, setApproveDialog] = useState<UserRow | null>(null);
  const [selectedRole, setSelectedRole] = useState<AppRole | "">("");
  const [editRoleDialog, setEditRoleDialog] = useState<UserRow | null>(null);
  const [editRole, setEditRole] = useState<AppRole | "">("");
  const [editingCostId, setEditingCostId] = useState<string | null>(null);
  const [editCostValue, setEditCostValue] = useState("");

  const fetchUsers = async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from("profiles").select("*");
    const { data: roles } = await supabase.from("user_roles").select("*");

    if (profiles) {
      const roleMap = new Map(roles?.map((r) => [r.user_id, r.role]) || []);

      const pending = profiles
        .filter((p) => (p as any).status === "pending")
        .map((p) => ({ ...p, status: "pending" } as UserRow));

      const active = profiles
        .filter((p) => (p as any).status === "active")
        .map((p) => ({
          ...p,
          status: "active",
          role: roleMap.get(p.id) || undefined,
          cost_per_hour: p.cost_per_hour,
        } as UserRow));

      setPendingUsers(pending);
      setActiveUsers(active);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleApprove = async () => {
    if (!approveDialog || !selectedRole) {
      toast.error("Selecione a função do usuário.");
      return;
    }

    const { error: clearRoleError } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", approveDialog.id);

    if (clearRoleError) {
      toast.error("Erro ao limpar função anterior: " + clearRoleError.message);
      return;
    }

    const { error: roleError } = await supabase.from("user_roles").insert({
      user_id: approveDialog.id,
      role: selectedRole as AppRole,
    });

    if (roleError) {
      toast.error("Erro ao definir função: " + roleError.message);
      return;
    }

    const { data: updatedProfile, error: profileError } = await supabase
      .from("profiles")
      .update({ status: "active" } as any)
      .eq("id", approveDialog.id)
      .select("id")
      .maybeSingle();

    if (profileError || !updatedProfile) {
      toast.error(profileError?.message || "Não foi possível ativar o usuário.");
      return;
    }

    toast.success(`${approveDialog.name} aprovado como ${ROLE_DISPLAY[selectedRole]}`);
    setApproveDialog(null);
    setSelectedRole("");
    await fetchUsers();
  };

  const handleReject = async (user: UserRow) => {
    const { error } = await supabase
      .from("profiles")
      .update({ status: "rejected" } as any)
      .eq("id", user.id);

    if (error) {
      toast.error("Erro ao rejeitar: " + error.message);
      return;
    }

    toast.success(`Cadastro de ${user.name} rejeitado.`);
    fetchUsers();
  };

  const handleChangeRole = async () => {
    if (!editRoleDialog || !editRole) return;

    const { error } = await supabase
      .from("user_roles")
      .update({ role: editRole as AppRole })
      .eq("user_id", editRoleDialog.id);

    if (error) {
      toast.error("Erro ao alterar função: " + error.message);
      return;
    }

    toast.success(`Função de ${editRoleDialog.name} alterada para ${ROLE_DISPLAY[editRole]}`);
    setEditRoleDialog(null);
    setEditRole("");
    fetchUsers();
  };

  const handleDeactivate = async (user: UserRow) => {
    const { error } = await supabase
      .from("profiles")
      .update({ status: "inactive" } as any)
      .eq("id", user.id);

    if (error) {
      toast.error("Erro ao desativar: " + error.message);
      return;
    }

    toast.success(`${user.name} desativado.`);
    fetchUsers();
  };

  const handleSaveCost = async (userId: string) => {
    const value = parseFloat(editCostValue.replace(",", "."));
    if (isNaN(value) || value < 0) {
      toast.error("Informe um valor válido.");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ cost_per_hour: value } as any)
      .eq("id", userId);

    if (error) {
      toast.error("Erro ao salvar valor hora: " + error.message);
      return;
    }

    toast.success("Valor hora atualizado!");
    setEditingCostId(null);
    setEditCostValue("");
    fetchUsers();
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="animate-reveal-up" style={{ animationFillMode: "backwards" }}>
          <h1 className="text-2xl font-bold">Gestão de Usuários</h1>
          <p className="text-muted-foreground mt-1">Aprovar cadastros e gerenciar permissões</p>
        </div>

        {/* Pending Users */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5 text-accent" />
              Pendentes de Aprovação
              {pendingUsers.length > 0 && (
                <Badge className="bg-accent text-accent-foreground ml-2">{pendingUsers.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : pendingUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum cadastro pendente.</p>
            ) : (
              <div className="space-y-3">
                {pendingUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                      {user.discipline && (
                        <Badge variant="outline" className="mt-1 text-xs">
                          {DISCIPLINE_DISPLAY[user.discipline] || user.discipline}
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="gap-1 bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => { setApproveDialog(user); setSelectedRole(""); }}>
                        <Check className="h-3.5 w-3.5" /> Aprovar
                      </Button>
                      <Button size="sm" variant="destructive" className="gap-1" onClick={() => handleReject(user)}>
                        <X className="h-3.5 w-3.5" /> Rejeitar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Active Users */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserCog className="h-5 w-5 text-accent" />
              Usuários Ativos ({activeUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : activeUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum usuário ativo.</p>
            ) : (
              <div className="space-y-3">
                {activeUsers.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-sm font-semibold text-primary-foreground shrink-0">
                        {user.name?.split(" ").map((n) => n[0]).join("").slice(0, 2) || "?"}
                      </div>
                      <div>
                        <p className="font-medium">{user.name}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-sm text-muted-foreground">{user.email}</span>
                          {user.discipline && (
                            <Badge variant="outline" className="text-xs">
                              {DISCIPLINE_DISPLAY[user.discipline] || user.discipline}
                            </Badge>
                          )}
                          {user.role && (
                            <Badge className="text-xs bg-primary/10 text-primary border-0">
                              {ROLE_DISPLAY[user.role] || user.role}
                            </Badge>
                          )}
                          {/* Cost per hour - visible only for Diretor/Gerente */}
                          {canAccessFinanceiro && (
                            <div className="flex items-center gap-1">
                              {editingCostId === user.id ? (
                                <div className="flex items-center gap-1">
                                  <DollarSign className="h-3 w-3 text-muted-foreground" />
                                  <Input
                                    type="text"
                                    value={editCostValue}
                                    onChange={(e) => setEditCostValue(e.target.value)}
                                    placeholder="0,00"
                                    className="h-7 w-24 text-xs"
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") handleSaveCost(user.id);
                                      if (e.key === "Escape") setEditingCostId(null);
                                    }}
                                    autoFocus
                                  />
                                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => handleSaveCost(user.id)}>
                                    <Check className="h-3 w-3" />
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditingCostId(null)}>
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-xs cursor-pointer hover:bg-muted gap-1"
                                  onClick={() => {
                                    setEditingCostId(user.id);
                                    setEditCostValue(user.cost_per_hour ? String(user.cost_per_hour).replace(".", ",") : "");
                                  }}
                                >
                                  <DollarSign className="h-3 w-3" />
                                  R$ {user.cost_per_hour ? Number(user.cost_per_hour).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}/h
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="gap-1" onClick={() => { setEditRoleDialog(user); setEditRole((user.role as AppRole) || ""); }}>
                        <UserCog className="h-3.5 w-3.5" /> Alterar função
                      </Button>
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDeactivate(user)}>
                        Desativar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Approve Dialog */}
      <Dialog open={!!approveDialog} onOpenChange={(open) => !open && setApproveDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprovar Usuário</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Selecione a função para <strong>{approveDialog?.name}</strong>:
          </p>
          <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a função" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin_geral">Diretor</SelectItem>
              <SelectItem value="admin">Gerente</SelectItem>
              <SelectItem value="coordenador">Coordenador</SelectItem>
              <SelectItem value="planejamento">Planejamento</SelectItem>
              <SelectItem value="projetista">Projetista</SelectItem>
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialog(null)}>Cancelar</Button>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleApprove} disabled={!selectedRole}>
              Confirmar Aprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={!!editRoleDialog} onOpenChange={(open) => !open && setEditRoleDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Função</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Alterar função de <strong>{editRoleDialog?.name}</strong>:
          </p>
          <Select value={editRole} onValueChange={(v) => setEditRole(v as AppRole)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione a função" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin_geral">Diretor</SelectItem>
              <SelectItem value="admin">Gerente</SelectItem>
              <SelectItem value="coordenador">Coordenador</SelectItem>
              <SelectItem value="planejamento">Planejamento</SelectItem>
              <SelectItem value="projetista">Projetista</SelectItem>
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRoleDialog(null)}>Cancelar</Button>
            <Button className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={handleChangeRole} disabled={!editRole}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
