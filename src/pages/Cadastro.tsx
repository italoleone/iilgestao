import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LeoneLogo } from "@/components/LeoneLogo";
import { UserPlus, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export default function Cadastro() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password || !discipline) {
      toast.error("Preencha todos os campos.");
      return;
    }
    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name, discipline },
      },
    });

    if (error) {
      toast.error(error.message);
    } else {
      // Sign out immediately - user must wait for approval
      await supabase.auth.signOut();
      setSubmitted(true);
    }
    setLoading(false);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-sm space-y-6 text-center animate-reveal-up" style={{ animationFillMode: "backwards" }}>
          <div className="h-16 w-16 rounded-full bg-accent/20 flex items-center justify-center mx-auto">
            <UserPlus className="h-8 w-8 text-accent" />
          </div>
          <h1 className="text-xl font-bold">Cadastro enviado!</h1>
          <p className="text-sm text-muted-foreground">
            Seu cadastro foi recebido e está pendente de aprovação pelo administrador. Você receberá acesso assim que for aprovado.
          </p>
          <Link to="/login">
            <Button variant="outline" className="gap-2 mt-4">
              <ArrowLeft className="h-4 w-4" /> Voltar ao login
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-background">
      <div className="w-full max-w-sm space-y-8 animate-reveal-up" style={{ animationFillMode: "backwards" }}>
        <div className="text-center">
          <LeoneLogo className="w-40 mx-auto" variant="dark" showSubtext={true} />
        </div>

        <div>
          <h1 className="text-xl font-bold tracking-tight">Criar conta</h1>
          <p className="text-sm text-muted-foreground mt-1">Preencha seus dados para solicitar acesso</p>
        </div>

        <Card className="shadow-none border">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome completo</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" className="h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" className="h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" className="h-11" />
              </div>
              <div className="space-y-2">
                <Label>Disciplina</Label>
                <Select value={discipline} onValueChange={setDiscipline}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Selecione a disciplina" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="estrutural">Estrutural</SelectItem>
                    <SelectItem value="hidraulica">Hidráulica</SelectItem>
                    <SelectItem value="eletrica">Elétrica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full h-11 gap-2 bg-accent text-accent-foreground hover:bg-accent/90 font-medium" disabled={loading}>
                <UserPlus className="h-4 w-4" />
                {loading ? "Enviando..." : "Solicitar acesso"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-sm text-center text-muted-foreground">
          Já tem conta?{" "}
          <Link to="/login" className="text-accent hover:underline font-medium">Entrar</Link>
        </p>
      </div>
    </div>
  );
}
