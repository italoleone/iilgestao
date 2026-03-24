import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { LeoneLogo } from "@/components/LeoneLogo";
import { LogIn } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

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
                  <Label htmlFor="password">Senha</Label>
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

          <p className="text-xs text-center text-muted-foreground">
            Leone Engenharia © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
