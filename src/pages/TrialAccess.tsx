import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FlaskConical, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { differenceInHours, parseISO } from "date-fns";

export default function TrialAccess() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "valid" | "expired" | "not_found" | "activated">("loading");
  const [trialData, setTrialData] = useState<{
    client_name: string;
    expires_at: string;
    created_at: string;
  } | null>(null);

  useEffect(() => {
    const checkTrial = async () => {
      if (!token) { setStatus("not_found"); return; }

      const { data, error } = await supabase
        .from("trial_links")
        .select("client_name, expires_at, created_at, status")
        .eq("token", token)
        .maybeSingle();

      if (error || !data) {
        setStatus("not_found");
        return;
      }

      if (data.status === "activated") {
        setTrialData(data);
        setStatus("activated");
        return;
      }

      const now = new Date();
      const expiresAt = parseISO(data.expires_at);
      if (now > expiresAt) {
        setTrialData(data);
        setStatus("expired");
        return;
      }

      setTrialData(data);
      setStatus("valid");
    };

    checkTrial();
  }, [token]);

  const hoursLeft = trialData?.expires_at
    ? Math.max(0, differenceInHours(parseISO(trialData.expires_at), new Date()))
    : 0;
  const daysLeft = Math.floor(hoursLeft / 24);

  const handleStartTrial = () => {
    navigate(`/auth?trial=${token}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-6 space-y-4">
          {status === "loading" && (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
              <p className="text-sm text-muted-foreground mt-3">Verificando acesso...</p>
            </div>
          )}

          {status === "valid" && trialData && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center mx-auto">
                <FlaskConical className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Acesso de Teste</h1>
                <p className="text-muted-foreground text-sm mt-1">
                  Você tem acesso temporário ao sistema para avaliação.
                </p>
              </div>
              <div className="rounded-lg bg-primary/10 border border-primary/20 p-4">
                <div className="flex items-center justify-center gap-2 text-primary">
                  <Clock className="w-5 h-5" />
                  <span className="font-semibold">
                    {daysLeft > 0 ? `${daysLeft} dia${daysLeft !== 1 ? "s" : ""} e ${hoursLeft % 24}h restantes` : `${hoursLeft}h restantes`}
                  </span>
                </div>
              </div>
              <Button onClick={handleStartTrial} className="w-full gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Cadastrar e Iniciar Teste
              </Button>
              <p className="text-xs text-muted-foreground">
                Crie sua conta para acessar o sistema em modo teste. O acesso completo será liberado após ativação pelo administrador.
              </p>
            </div>
          )}

          {status === "expired" && trialData && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-destructive/15 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Acesso Expirado</h1>
                <p className="text-muted-foreground text-sm mt-1">
                  O período de teste expirou.
                </p>
              </div>
              <p className="text-sm text-muted-foreground">Entre em contato com o administrador para ativar seu acesso.</p>
            </div>
          )}

          {status === "activated" && trialData && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Acesso Ativado</h1>
                <p className="text-muted-foreground text-sm mt-1">
                  Este acesso já foi ativado. Faça login normalmente.
                </p>
              </div>
              <Button onClick={() => navigate("/auth")} variant="outline" className="w-full">
                Ir para Login
              </Button>
            </div>
          )}

          {status === "not_found" && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                <AlertTriangle className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Link Inválido</h1>
                <p className="text-muted-foreground text-sm mt-1">Este link de teste não existe ou foi removido.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
