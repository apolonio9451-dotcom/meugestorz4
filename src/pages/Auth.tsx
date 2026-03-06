import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Zap, Mail, Lock, User, Building2, FlaskConical, Clock } from "lucide-react";
import { differenceInHours, parseISO } from "date-fns";

export default function Auth() {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [resendingConfirmation, setResendingConfirmation] = useState(false);
  const [resendEmail, setResendEmail] = useState<string | null>(null);
  const trialToken = searchParams.get("trial");
  const [trialInfo, setTrialInfo] = useState<{ expires_at: string; company_id: string; id: string } | null>(null);
  const [brandName, setBrandName] = useState("Meu Gestor");

  useEffect(() => {
    if (trialToken) {
      supabase
        .from("trial_links")
        .select("id, expires_at, company_id, status")
        .eq("token", trialToken)
        .eq("status", "pending")
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setTrialInfo(data);
            // Fetch brand name from company settings
            supabase
              .from("company_settings")
              .select("brand_name")
              .eq("company_id", data.company_id)
              .maybeSingle()
              .then(({ data: settings }) => {
                if (settings?.brand_name) setBrandName(settings.brand_name);
              });
          }
        });
    }
  }, [trialToken]);

  const hoursLeft = trialInfo?.expires_at
    ? Math.max(0, differenceInHours(parseISO(trialInfo.expires_at), new Date()))
    : 0;
  const daysLeft = Math.floor(hoursLeft / 24);

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
    const email = form.get("email") as string;
    const password = form.get("password") as string;
    const fullName = form.get("fullName") as string;
    const companyName = form.get("companyName") as string;

    if (trialToken && trialInfo) {
      // Trial signup: create user with trial metadata
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            company_name: companyName,
            is_trial: true,
            trial_token: trialToken,
            trial_company_id: trialInfo.company_id,
            trial_link_id: trialInfo.id,
            trial_expires_at: trialInfo.expires_at,
          },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) {
        toast.error(error.message);
      } else {
        setResendEmail(email);
        toast.success("Conta de teste criada! Verifique seu email para confirmar.");
      }
    } else {
      const { error } = await signUp(email, password, fullName, companyName);
      if (error) {
        toast.error(error.message);
      } else {
        setResendEmail(email);
        toast.success("Conta criada! Verifique seu email para confirmar.");
      }
    }
    setLoading(false);
  };

  const handleResendConfirmation = async () => {
    if (!resendEmail) return;
    setResendingConfirmation(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: resendEmail,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Email de verificação reenviado com sucesso.");
    }
    setResendingConfirmation(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/20 border border-primary/30 mb-4">
            <Zap className="w-8 h-8 text-accent" />
          </div>
          <h1 className="text-3xl font-bold font-display text-accent">{brandName}</h1>
          <p className="text-muted-foreground mt-1">Gestão inteligente de assinaturas</p>
        </div>

        {/* Trial Banner */}
        {trialToken && trialInfo && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 mb-4 text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              <FlaskConical className="w-5 h-5 text-primary" />
              <span className="font-semibold text-foreground">Cadastro de Teste</span>
            </div>
            <div className="flex items-center justify-center gap-2 text-sm text-primary">
              <Clock className="w-4 h-4" />
              <span>
                {daysLeft > 0 ? `${daysLeft}d ${hoursLeft % 24}h restantes` : `${hoursLeft}h restantes`}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Cadastre-se para acessar o sistema em modo teste. O acesso completo será liberado pelo administrador.
            </p>
          </div>
        )}

        <Tabs defaultValue={trialToken ? "register" : "login"}>
          <TabsList className="grid w-full grid-cols-2 mb-4 bg-secondary">
            <TabsTrigger value="login">Entrar</TabsTrigger>
            <TabsTrigger value="register">{trialToken ? "Criar Conta (Teste)" : "Criar Conta"}</TabsTrigger>
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
                {!trialToken && (
                  <div className="space-y-2">
                    <Label className="text-foreground font-semibold">Nome da empresa</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input name="companyName" required placeholder="Minha Empresa"
                        className="pl-10 bg-input border-border text-foreground placeholder:text-muted-foreground h-12 rounded-xl" />
                    </div>
                  </div>
                )}
                {trialToken && (
                  <input type="hidden" name="companyName" value="Trial" />
                )}
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
                  {loading ? "Criando..." : trialToken ? "Criar Conta de Teste" : "Criar Conta"}
                </Button>
              </form>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
