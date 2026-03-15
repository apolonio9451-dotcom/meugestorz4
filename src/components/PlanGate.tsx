import { useAuth } from "@/hooks/useAuth";
import { Lock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PlanGateProps {
  children: React.ReactNode;
  /** Features that require Pro */
  feature?: string;
}

export default function PlanGate({ children, feature }: PlanGateProps) {
  const { planType } = useAuth();

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
        <Button className="gap-2 bg-[hsl(48,96%,53%)] text-black hover:bg-[hsl(48,96%,45%)] font-bold">
          <Zap className="w-4 h-4" />
          Fazer Upgrade para Pro
        </Button>
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
