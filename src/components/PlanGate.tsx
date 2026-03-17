import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import DashboardSkeleton from "@/components/DashboardSkeleton";

interface PlanGateProps {
  children: React.ReactNode;
  feature?: string;
}

export default function PlanGate({ children }: PlanGateProps) {
  const { effectivePlanType, companyId, loading } = useAuth();
  const navigate = useNavigate();
  const hasRedirected = useRef(false);
  const hasAccess = effectivePlanType === "pro";
  const canEvaluateAccess = !loading && Boolean(companyId);

  useEffect(() => {
    if (!canEvaluateAccess || hasAccess || hasRedirected.current) return;

    hasRedirected.current = true;
    toast({
      title: "Acesso bloqueado",
      description:
        "Seu plano atual (Starter) não permite acesso a esta função. Faça o upgrade para o Plano Pro.",
      variant: "destructive",
    });
    navigate("/dashboard", { replace: true });
  }, [canEvaluateAccess, hasAccess, navigate]);

  if (!canEvaluateAccess) {
    return <DashboardSkeleton />;
  }

  if (!hasAccess) return null;

  return <>{children}</>;
}
