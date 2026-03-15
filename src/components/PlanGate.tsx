import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Lock, Zap, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PlanGateProps {
  children: React.ReactNode;
  feature?: string;
}

export default function PlanGate({ children, feature }: PlanGateProps) {
  const { planType, companyId } = useAuth();
  const [supportWhatsapp, setSupportWhatsapp] = useState<string | null>(null);

  useEffect(() => {
    if (planType === "pro" || !companyId) return;
    const fetch = async () => {
      const { data } = await supabase.rpc("get_support_whatsapp", { _company_id: companyId });
      if (data) setSupportWhatsapp(data);
    };
    fetch();
  }, [planType, companyId]);

  if (planType === "pro") return <>{children}</>;

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Lock className="w-10 h-10 text-primary/60" />
        </div>
        <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-[hsl(48,96%,53%)] flex items-center justify-center shadow-lg">
          <Zap className="w-4 h-4 text-black" />
        </div>
      </div>

      <h2 className="text-2xl font-bold text-foreground mb-2">
        Recurso exclusivo do Plano Pro
      </h2>
      <p className="text-muted-foreground text-sm max-w-md mb-6">
        {feature
          ? `O recurso "${feature}" está disponível apenas no Plano Pro. Faça upgrade para desbloquear todos os recursos avançados.`
          : "Este recurso está disponível apenas no Plano Pro. Faça upgrade para desbloquear todos os recursos avançados."}
      </p>

      <div className="flex flex-col sm:flex-row gap-3">
        {supportWhatsapp ? (
          <a
            href={`https://wa.me/${supportWhatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`Olá! Gostaria de fazer upgrade para o Plano Pro.${feature ? ` Recurso: ${feature}` : ""}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 font-bold text-sm bg-[hsl(48,96%,53%)] text-black hover:bg-[hsl(48,96%,45%)] transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            Falar com Suporte para Upgrade
          </a>
        ) : (
          <Button className="gap-2 bg-[hsl(48,96%,53%)] text-black hover:bg-[hsl(48,96%,45%)] font-bold">
            <Zap className="w-4 h-4" />
            Fazer Upgrade para Pro
          </Button>
        )}
      </div>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full">
        {[
          "Configuração de Envio Avançada",
          "Conexão WhatsApp Integrada",
          "Chatbot IA Personalizado",
          "Envios Automáticos",
          "Repescagem de Clientes",
          "Rede de Revendedores",
        ].map((item) => (
          <div
            key={item}
            className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2 border border-border/50"
          >
            <Zap className="w-3 h-3 text-[hsl(48,96%,53%)] shrink-0" />
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
