import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { User, Lock, Mail, Briefcase } from "lucide-react";
import { toast } from "sonner";

export default function Perfil() {
  const { profile, refreshProfile, canAccessFinanceiro } = useAuth();
  const [name, setName] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [costPerHour, setCostPerHour] = useState("");
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setDiscipline(profile.discipline || "");
      setCostPerHour(String(profile.cost_per_hour || 0));
    }
  }, [profile]);

  const handleSaveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    const updates: { name: string; discipline: string; cost_per_hour?: number } = { name, discipline };
    if (canAccessFinanceiro) {
      updates.cost_per_hour = Number(costPerHour) || 0;
    }
    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", profile.id);

    if (error) {
      toast.error("Erro ao salvar perfil.");
    } else {
      toast.success("Perfil atualizado!");
      await refreshProfile();
    }
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error("A nova senha deve ter no mínimo 6 caracteres.");
      return;
    }
    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast.error("Erro ao alterar senha.");
    } else {
      toast.success("Senha alterada com sucesso!");
      setCurrentPassword("");
      setNewPassword("");
    }
    setChangingPassword(false);
  };

  if (!profile) return null;

  const ROLE_LABELS: Record<string, string> = {
    admin_geral: "Administrador Geral",
    admin: "Administrador",
    planejamento: "Planejamento",
    projetista: "Projetista",
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="animate-reveal-up" style={{ animationFillMode: "backwards" }}>
          <h1 className="text-2xl font-bold">Meu Perfil</h1>
          <p className="text-muted-foreground mt-1">Gerencie suas informações</p>
        </div>

        {/* Avatar + Info */}
        <Card className="shadow-sm animate-reveal-up delay-1" style={{ animationFillMode: "backwards" }}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4" /> Informações Pessoais
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4 mb-2">
              <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center text-lg font-bold text-primary-foreground">
                {profile.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </div>
              <div>
                <p className="font-medium">{profile.name}</p>
                <p className="text-sm text-muted-foreground">{ROLE_LABELS[profile.role] || profile.role}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Mail className="h-3 w-3" /> E-mail</Label>
              <Input value={profile.email} disabled className="bg-muted" />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1"><Briefcase className="h-3 w-3" /> Cargo</Label>
              <Input value={ROLE_LABELS[profile.role] || profile.role} disabled className="bg-muted" />
            </div>

            <div className="space-y-2">
              <Label>Disciplina</Label>
              <select
                value={discipline}
                onChange={(e) => setDiscipline(e.target.value)}
                className="h-10 w-full rounded-md border bg-card px-3 text-sm"
              >
                <option value="">Selecione...</option>
                <option value="estrutural">Estrutural</option>
                <option value="hidraulica">Hidráulica</option>
                <option value="eletrica">Elétrica</option>
              </select>
            </div>

            {canAccessFinanceiro && (
              <div className="space-y-2">
                <Label>Custo por hora (R$)</Label>
                <Input
                  type="number"
                  value={costPerHour}
                  onChange={(e) => setCostPerHour(e.target.value)}
                />
              </div>
            )}

            <Button onClick={handleSaveProfile} disabled={saving}>
              {saving ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </CardContent>
        </Card>

        {/* Password */}
        <Card className="shadow-sm animate-reveal-up delay-2" style={{ animationFillMode: "backwards" }}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="h-4 w-4" /> Alterar Senha
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Nova Senha</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <Button onClick={handleChangePassword} disabled={changingPassword} variant="outline">
              {changingPassword ? "Alterando..." : "Alterar Senha"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
