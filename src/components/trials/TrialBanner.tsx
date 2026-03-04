import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { FlaskConical, Clock } from "lucide-react";
import { differenceInHours, parseISO } from "date-fns";

export default function TrialBanner() {
  const { isTrial, trialExpiresAt } = useAuth();

  if (!isTrial) return null;

  const hoursLeft = trialExpiresAt
    ? Math.max(0, differenceInHours(parseISO(trialExpiresAt), new Date()))
    : 0;
  const daysLeft = Math.floor(hoursLeft / 24);
  const expired = trialExpiresAt ? new Date() > parseISO(trialExpiresAt) : false;

  return (
    <div className={`w-full px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2 ${
      expired
        ? "bg-destructive/15 text-destructive border-b border-destructive/20"
        : "bg-primary/10 text-primary border-b border-primary/20"
    }`}>
      <FlaskConical className="w-4 h-4" />
      {expired ? (
        <span>Seu período de teste expirou. Entre em contato com o administrador para ativar seu acesso.</span>
      ) : (
        <span>
          Modo Teste — {daysLeft > 0 ? `${daysLeft}d ${hoursLeft % 24}h restantes` : `${hoursLeft}h restantes`}
        </span>
      )}
      <Badge variant="outline" className="text-xs ml-2">
        <Clock className="w-3 h-3 mr-1" />
        Teste
      </Badge>
    </div>
  );
}
