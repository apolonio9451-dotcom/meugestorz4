import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Zap, Mail, Lock, User, Building2 } from "lucide-react";

export default function Auth() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const { error } = await signIn(form.get("email") as string, form.get("password") as string);
    if (error) toast.error(error.message);
    else navigate("/dashboard");
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const { error } = await signUp(
      form.get("email") as string,
      form.get("password") as string,
      form.get("fullName") as string,
      form.get("companyName") as string
    );
    if (error) toast.error(error.message);
    else toast.success("Conta criada! Verifique seu email para confirmar.");
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/20 border border-primary/30 mb-4">
            <Zap className="w-8 h-8 text-accent" />
          </div>
          <h1 className="text-3xl font-bold font-display text-accent">Max Gestor</h1>
          <p className="text-muted-foreground mt-1">Gestão inteligente de assinaturas</p>
        </div>

        <Tabs defaultValue="login">
          <TabsList className="grid w-full grid-cols-2 mb-4 bg-secondary">
            <TabsTrigger value="login">Entrar</TabsTrigger>
            <TabsTrigger value="register">Criar Conta</TabsTrigger>
          </TabsList>

          {/* Login */}
          <TabsContent value="login">
            <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-foreground font-semibold">Email ou Usuário</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input name="email" type="email" required placeholder="seu@email.com ou nome de usuário"
                      className="pl-10 bg-input border-border text-foreground placeholder:text-muted-foreground h-12 rounded-xl" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground font-semibold">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input name="password" type="password" required placeholder="••••••"
                      className="pl-10 bg-input border-border text-foreground placeholder:text-muted-foreground h-12 rounded-xl" />
                  </div>
                </div>
                <Button type="submit" disabled={loading}
                  className="w-full h-12 rounded-xl text-base font-semibold bg-accent text-accent-foreground hover:bg-accent/90 shadow-[0_0_20px_hsl(180_100%_50%/0.3)]">
                  {loading ? "Entrando..." : "Entrar"}
                </Button>
                <p className="text-center text-sm text-accent cursor-pointer hover:underline">Esqueci minha senha</p>
              </form>
            </div>
          </TabsContent>

          {/* Register */}
          <TabsContent value="register">
            <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-foreground font-semibold">Nome completo</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input name="fullName" required placeholder="João Silva"
                      className="pl-10 bg-input border-border text-foreground placeholder:text-muted-foreground h-12 rounded-xl" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground font-semibold">Nome da empresa</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input name="companyName" required placeholder="Minha Empresa"
                      className="pl-10 bg-input border-border text-foreground placeholder:text-muted-foreground h-12 rounded-xl" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground font-semibold">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input name="email" type="email" required placeholder="seu@email.com"
                      className="pl-10 bg-input border-border text-foreground placeholder:text-muted-foreground h-12 rounded-xl" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground font-semibold">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input name="password" type="password" required minLength={6} placeholder="Mínimo 6 caracteres"
                      className="pl-10 bg-input border-border text-foreground placeholder:text-muted-foreground h-12 rounded-xl" />
                  </div>
                </div>
                <Button type="submit" disabled={loading}
                  className="w-full h-12 rounded-xl text-base font-semibold bg-accent text-accent-foreground hover:bg-accent/90 shadow-[0_0_20px_hsl(180_100%_50%/0.3)]">
                  {loading ? "Criando..." : "Criar Conta"}
                </Button>
              </form>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
