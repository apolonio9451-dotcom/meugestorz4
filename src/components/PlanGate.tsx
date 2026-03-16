import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

interface PlanGateProps {
  children: React.ReactNode;
  feature?: string;
}

export default function PlanGate({ children }: PlanGateProps) {
  const { planType, companyId, userRole } = useAuth();
  const navigate = useNavigate();
  const hasRedirected = useRef(false);
  const isOwner = userRole === "Proprietário";

  useEffect(() => {
    if (planType === "pro" || isOwner || !companyId || hasRedirected.current) return;

    hasRedirected.current = true;
    toast({
      title: "Acesso bloqueado",
      description:
        "Seu plano atual (Starter) não permite acesso a esta função. Faça o upgrade para o Plano Pro.",
      variant: "destructive",
    });
    navigate("/dashboard", { replace: true });
  }, [planType, isOwner, companyId, navigate]);

  if (planType !== "pro" && !isOwner) return null;

  return <>{children}</>;
}
