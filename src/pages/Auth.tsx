import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Zap, Mail, Lock, User, FlaskConical, Clock, Phone, ShieldAlert } from "lucide-react";
import { differenceInHours, parseISO } from "date-fns";

export default function Auth() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [resendingConfirmation, setResendingConfirmation] = useState(false);
  const [resendEmail, setResendEmail] = useState<string | null>(null);
  const [showNoTrialModal, setShowNoTrialModal] = useState(false);
  const trialToken = searchParams.get("trial");
  const [trialInfo, setTrialInfo] = useState<{ expires_at: string; company_id: string; id: string } | null>(null);
  const [brandName, setBrandName] = useState("Meu Gestor");
  const [ownerWhatsapp, setOwnerWhatsapp] = useState<string>("");

  useEffect(() => {
    if (trialToken) {
      supabase
        .rpc("get_trial_link_by_token", { _token: trialToken })
        .maybeSingle()
        .then(({ data }) => {
          if (data && data.status === "pending") {
            setTrialInfo({ id: data.id, expires_at: data.expires_at, company_id: data.company_id });
            supabase
              .from("company_settings")
              .select("brand_name, support_whatsapp")
              .eq("company_id", data.company_id)
              .maybeSingle()
              .then(({ data: settings }) => {
                if (settings?.brand_name) setBrandName(settings.brand_name);
                if (settings?.support_whatsapp) setOwnerWhatsapp(settings.support_whatsapp);
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

    // Block registration without trial token
    if (!trialToken || !trialInfo) {
      setShowNoTrialModal(true);
      return;
    }

    setLoading(true);
    const form = new FormData(e.currentTarget);
    const email = form.get("email") as string;
    const password = form.get("password") as string;
    const fullName = form.get("fullName") as string;
    const whatsapp = (form.get("whatsapp") as string || "").trim();

    if (!whatsapp) {
      toast.error("O número de WhatsApp é obrigatório.");
      setLoading(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          company_name: "Trial",
          whatsapp,
          is_trial: true,
          trial_token: trialToken,
          trial_company_id: trialInfo.company_id,
          trial_link_id: trialInfo.id,
          trial_expires_at: trialInfo.expires_at,
        },
        emailRedirectTo: window.location.origin,
      },
    });

    const isRepeatedSignup = !error && (!data?.user || (Array.isArray(data.user.identities) && data.user.identities.length === 0));

    if (error || isRepeatedSignup) {
      toast.error(error?.message || "Este email já está cadastrado. Faça login ou redefina a senha.");
    } else {
      setResendEmail(email);
      toast.success("Conta de teste criada! Verifique seu email para confirmar.");
    }
    setLoading(false);
  };

  const handleResendConfirmation = async () => {
    if (!resendEmail) return;
    setResendingConfirmation(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: resendEmail,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) toast.error(error.message);
    else toast.success("Email de verificação reenviado com sucesso.");
    setResendingConfirmation(false);
  };

  // When no trial token, show only login + blocked register tab
  const hasTrialAccess = !!trialToken && !!trialInfo;

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
        {hasTrialAccess && (
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
              Cadastre-se para acessar o sistema em modo teste.
            </p>
          </div>
        )}

        <Tabs defaultValue={hasTrialAccess ? "register" : "login"}>
          <TabsList className="grid w-full grid-cols-2 mb-4 bg-secondary">
            <TabsTrigger value="login">Entrar</TabsTrigger>
            <TabsTrigger
              value="register"
              onClick={(e) => {
                if (!hasTrialAccess) {
                  e.preventDefault();
                  setShowNoTrialModal(true);
                }
              }}
            >
              Criar Conta
            </TabsTrigger>
          </TabsList>

          {/* Login */}
          <TabsContent value="login">
            <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
              <form onSubmit={handleLogin} className="space-y-5">
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

          {/* Register - only accessible with trial token */}
          {hasTrialAccess && (
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
                    <Label className="text-foreground font-semibold">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input name="email" type="email" required placeholder="seu@email.com"
                        className="pl-10 bg-input border-border text-foreground placeholder:text-muted-foreground h-12 rounded-xl" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-foreground font-semibold">WhatsApp <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input name="whatsapp" type="tel" required placeholder="5511999999999"
                        className="pl-10 bg-input border-border text-foreground placeholder:text-muted-foreground h-12 rounded-xl" />
                    </div>
                    <p className="text-muted-foreground text-[10px]">Obrigatório. Será configurado como seu WhatsApp de suporte.</p>
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
                    {loading ? "Criando..." : "Criar Conta de Teste"}
                  </Button>

                  {resendEmail && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleResendConfirmation}
                      disabled={resendingConfirmation}
                      className="w-full h-11 rounded-xl"
                    >
                      {resendingConfirmation ? "Reenviando..." : "Reenviar email de verificação"}
                    </Button>
                  )}
                </form>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Modal: No trial token */}
      <Dialog open={showNoTrialModal} onOpenChange={setShowNoTrialModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-center mb-2">
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
                <ShieldAlert className="w-6 h-6 text-destructive" />
              </div>
            </div>
            <DialogTitle className="text-center">Cadastro não permitido</DialogTitle>
            <DialogDescription className="text-center">
              O cadastro só é possível através de um link de convite gerado pelo seu administrador ou revendedor. Entre em contato para obter acesso.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-2">
            {ownerWhatsapp ? (
              <a
                href={`https://wa.me/${ownerWhatsapp.replace(/\D/g, "")}?text=${encodeURIComponent("Olá! Gostaria de obter acesso ao sistema.")}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button className="w-full h-12 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold gap-2">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  Falar com o Administrador
                </Button>
              </a>
            ) : (
              <p className="text-sm text-muted-foreground text-center">
                Solicite um link de acesso ao administrador do sistema.
              </p>
            )}
            <Button variant="outline" onClick={() => setShowNoTrialModal(false)} className="rounded-xl">
              Voltar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
