import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { LeoneLogo } from "@/components/LeoneLogo";
import { LogIn, ArrowLeft, Mail } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export default function Login() {
  const { signIn, pendingApproval } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [sendingReset, setSendingReset] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Preencha e-mail e senha.");
      return;
    }
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      toast.error("Credenciais inválidas. Verifique e-mail e senha.");
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) {
      toast.error("Informe seu e-mail de cadastro.");
      return;
    }
    setSendingReset(true);
    const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSendingReset(false);
    if (error) {
      toast.error("Não foi possível enviar o e-mail. Tente novamente.");
      return;
    }
    toast.success("Se este e-mail estiver cadastrado, você receberá um link para redefinir a senha.");
    setForgotMode(false);
    setForgotEmail("");
  };

  if (pendingApproval) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="h-16 w-16 rounded-full bg-accent/20 flex items-center justify-center mx-auto">
            <LogIn className="h-8 w-8 text-accent" />
          </div>
          <h1 className="text-xl font-bold">Aguardando aprovação</h1>
          <p className="text-sm text-muted-foreground">
            Seu cadastro está pendente de aprovação pelo administrador. Tente novamente mais tarde.
          </p>
          <Link to="/login">
            <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
              Tentar novamente
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel - brand */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary items-center justify-center relative overflow-hidden">
        {/* Decorative geometric pattern */}
        <div className="absolute inset-0 opacity-[0.03]">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute border border-white/20"
              style={{
                width: `${60 + i * 40}px`,
                height: `${60 + i * 40}px`,
                top: `${50 - (60 + i * 40) / 2}%`,
                left: `${50 - (60 + i * 40) / 2}%`,
                transform: `translate(${50}%, ${50}%) rotate(${i * 4}deg)`,
              }}
            />
          ))}
        </div>
        <div className="relative z-10 text-center">
          <LeoneLogo className="w-64 mx-auto" variant="light" showSubtext={true} />
          <div className="mt-8 space-y-1">
            <p className="text-primary-foreground/40 text-sm tracking-wide">
              Sistema de Gestão de Projetos
            </p>
          </div>
        </div>
        {/* Accent bar at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-accent" />
      </div>

      {/* Right panel - login form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-sm space-y-8 animate-reveal-up" style={{ animationFillMode: "backwards" }}>
          {/* Mobile logo */}
          <div className="lg:hidden text-center">
            <LeoneLogo className="w-40 mx-auto" variant="dark" showSubtext={true} />
          </div>

          {!forgotMode ? (
            <>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Entrar no sistema</h1>
                <p className="text-sm text-muted-foreground mt-1">Acesse sua conta para continuar</p>
              </div>

              <Card className="shadow-none border">
                <CardContent className="pt-6">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">E-mail</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="seu@email.com"
                        autoComplete="email"
                        className="h-11"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password">Senha</Label>
                        <button
                          type="button"
                          onClick={() => setForgotMode(true)}
                          className="text-xs text-accent hover:underline font-medium"
                        >
                          Esqueci minha senha
                        </button>
                      </div>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••"
                        autoComplete="current-password"
                        className="h-11"
                      />
                    </div>
                    <Button type="submit" className="w-full h-11 gap-2 bg-accent text-accent-foreground hover:bg-accent/90 font-medium" disabled={loading}>
                      <LogIn className="h-4 w-4" />
                      {loading ? "Entrando..." : "Entrar"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <p className="text-sm text-center text-muted-foreground">
                Não tem conta?{" "}
                <Link to="/cadastro" className="text-accent hover:underline font-medium">Cadastrar-se</Link>
              </p>
            </>
          ) : (
            <>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Recuperar senha</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Enviaremos um link para o seu e-mail de cadastro.
                </p>
              </div>

              <Card className="shadow-none border">
                <CardContent className="pt-6">
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="forgot-email">E-mail</Label>
                      <Input
                        id="forgot-email"
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="seu@email.com"
                        autoComplete="email"
                        className="h-11"
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full h-11 gap-2 bg-accent text-accent-foreground hover:bg-accent/90 font-medium"
                      disabled={sendingReset}
                    >
                      <Mail className="h-4 w-4" />
                      {sendingReset ? "Enviando..." : "Enviar link de recuperação"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full h-10 gap-2"
                      onClick={() => setForgotMode(false)}
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Voltar para login
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </>
          )}

          <p className="text-xs text-center text-muted-foreground">
            Leone Engenharia © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
