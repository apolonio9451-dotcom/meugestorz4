import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

interface PlanGateProps {
  children: React.ReactNode;
  feature?: string;
}

export default function PlanGate({ children }: PlanGateProps) {
  const { planType, companyId } = useAuth();
  const navigate = useNavigate();
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (planType === "pro" || !companyId || hasRedirected.current) return;

    hasRedirected.current = true;
    toast({
      title: "Acesso bloqueado",
      description:
        "Seu plano atual (Starter) não permite acesso a esta função. Faça o upgrade para o Plano Pro.",
      variant: "destructive",
    });
    navigate("/dashboard", { replace: true });
  }, [planType, companyId, navigate]);

  if (planType !== "pro") return null;

  return <>{children}</>;
}
