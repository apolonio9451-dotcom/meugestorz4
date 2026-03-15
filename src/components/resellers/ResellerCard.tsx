import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Coins,
  Pencil,
  Trash2,
  History,
  Ban,
  CheckCircle2,
  Eye,
  UserCog,
  FlaskConical,
  Clock,
  UserCheck,
} from "lucide-react";

type ResellerRole = "admin" | "user";

function getResellerRole(r: { can_resell: boolean; can_create_subreseller: boolean }): ResellerRole {
  if (r.can_resell || r.can_create_subreseller) return "admin";
  return "user";
}

const roleLabels: Record<ResellerRole, string> = {
  admin: "Admin",
  user: "Usuário",
};
import { differenceInHours, parseISO } from "date-fns";

interface Reseller {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  credit_balance: number;
  status: string;
  notes: string;
  created_at: string;
  can_resell: boolean;
  can_create_subreseller: boolean;
  can_create_trial: boolean;
  level: number;
  trial_expires_at?: string | null;
}

interface ResellerCardProps {
  reseller: Reseller;
  onEdit: (r: Reseller) => void;
  onDelete: (id: string) => void;
  onCredits: (r: Reseller) => void;
  onHistory: (r: Reseller) => void;
  onToggleStatus: (r: Reseller) => void;
  onViewClients: (r: Reseller) => void;
  onChangeRole: (r: Reseller) => void;
  onViewTrials: (r: Reseller) => void;
  onActivateTrial?: (r: Reseller) => void;
  trialCount?: number;
}

const roleBadgeColors: Record<ResellerRole, string> = {
  admin: "bg-cyan-500/20 text-cyan-400 border-cyan-500/40",
  user: "bg-muted text-muted-foreground border-border",
};

export default function ResellerCard({
  reseller: r,
  onEdit,
  onDelete,
  onCredits,
  onHistory,
  onToggleStatus,
  onViewClients,
  onChangeRole,
  onViewTrials,
  onActivateTrial,
  trialCount = 0,
}: ResellerCardProps) {
  const isTrial = r.status === "trial";
  const isActive = r.status === "active";
  const isBlocked = r.status === "blocked";
  const initials = r.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const role = getResellerRole(r);

  // Trial time left
  const trialHoursLeft = isTrial && r.trial_expires_at
    ? Math.max(0, differenceInHours(parseISO(r.trial_expires_at), new Date()))
    : 0;
  const trialDaysLeft = Math.floor(trialHoursLeft / 24);
  const trialExpired = isTrial && r.trial_expires_at ? new Date() > parseISO(r.trial_expires_at) : false;

  const borderClass = isTrial
    ? "border-amber-500/40 hover:border-amber-500/60"
    : isActive
      ? "border-border hover:border-primary/30"
      : "border-destructive/30 opacity-80";

  const avatarClass = isTrial
    ? "bg-amber-500/15 text-amber-500"
    : isActive
      ? "bg-primary/15 text-primary"
      : "bg-destructive/15 text-destructive";

  const statusBadge = isTrial
    ? { label: "Teste", variant: "outline" as const, className: "bg-amber-500/15 text-amber-500 border-amber-500/30 text-[9px] px-1.5 py-0 h-4" }
    : isActive
      ? { label: "Ativo", variant: "default" as const, className: "text-[9px] px-1.5 py-0 h-4" }
      : { label: "Bloqueado", variant: "destructive" as const, className: "text-[9px] px-1.5 py-0 h-4" };

  return (
    <Card className={`group transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 border ${borderClass}`}>
      <CardContent className="p-0">
        {/* Header */}
        <div className="flex items-start gap-3 p-4 pb-2">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${avatarClass}`}>
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm text-foreground truncate">{r.name}</h3>
              <Badge variant={statusBadge.variant} className={statusBadge.className + " shrink-0"}>
                {statusBadge.label}
              </Badge>
            </div>
            {r.email && <p className="text-[11px] text-muted-foreground truncate">{r.email}</p>}
            {r.whatsapp && <p className="text-[11px] text-muted-foreground">{r.whatsapp}</p>}
          </div>
        </div>

        {/* Trial countdown */}
        {isTrial && (
          <div className="mx-4 mb-1">
            <div className={`flex items-center justify-between rounded-md px-3 py-1.5 ${trialExpired ? "bg-destructive/10" : "bg-amber-500/10"}`}>
              <span className={`text-[11px] flex items-center gap-1.5 ${trialExpired ? "text-destructive" : "text-amber-500"}`}>
                <Clock className="w-3 h-3" />
                {trialExpired
                  ? "Teste expirado"
                  : trialDaysLeft > 0
                    ? `${trialDaysLeft}d ${trialHoursLeft % 24}h restantes`
                    : `${trialHoursLeft}h restantes`
                }
              </span>
              <FlaskConical className={`w-3.5 h-3.5 ${trialExpired ? "text-destructive" : "text-amber-500"}`} />
            </div>
          </div>
        )}

        {/* Role badge (only for non-trial) */}
        {!isTrial && (
          <div className="px-4 pb-2">
            <button
              onClick={() => onChangeRole(r)}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-semibold transition-all hover:opacity-80 cursor-pointer ${roleBadgeColors[role]}`}
            >
              <UserCog className="w-3 h-3" />
              {roleLabels[role]}
            </button>
          </div>
        )}

        {/* Credit bar (only for non-trial) */}
        {!isTrial && (
          <div className="mx-4 space-y-1">
            <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-1.5">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <Coins className="w-3 h-3" /> Créditos
              </span>
              <span className={`font-mono text-xs font-bold ${r.credit_balance > 0 ? "text-primary" : "text-destructive"}`}>
                {r.credit_balance}
              </span>
            </div>
            {trialCount > 0 && (
              <button
                onClick={() => onViewTrials(r)}
                className="w-full flex items-center justify-between rounded-md bg-amber-500/10 px-3 py-1.5 hover:bg-amber-500/15 transition-colors cursor-pointer"
              >
                <span className="text-[11px] text-amber-500 flex items-center gap-1.5">
                  <FlaskConical className="w-3 h-3" /> Testes pendentes
                </span>
                <span className="font-mono text-xs font-bold text-amber-500">{trialCount}</span>
              </button>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-between px-3 py-2 mt-1 border-t border-border/50">
          {isTrial ? (
            /* Trial: show Activate button prominently */
            <div className="flex items-center gap-1 w-full">
              <Button
                size="sm"
                className="gap-1.5 h-7 text-xs flex-1"
                onClick={() => onActivateTrial?.(r)}
              >
                <UserCheck className="w-3.5 h-3.5" /> Ativar Acesso
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive" onClick={() => onDelete(r.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom"><p className="text-xs">Excluir</p></TooltipContent>
              </Tooltip>
            </div>
          ) : (
            /* Normal: all action buttons */
            <>
              <div className="flex items-center gap-0.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onCredits(r)}>
                      <Coins className="w-3.5 h-3.5 text-primary" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom"><p className="text-xs">Gerenciar créditos</p></TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onHistory(r)}>
                      <History className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom"><p className="text-xs">Histórico</p></TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onViewClients(r)}>
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom"><p className="text-xs">Ver clientes</p></TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(r)}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom"><p className="text-xs">Editar</p></TooltipContent>
                </Tooltip>
              </div>

              <div className="flex items-center gap-0.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className={`h-7 w-7 ${isActive ? "hover:bg-destructive/10 hover:text-destructive" : "hover:bg-primary/10 hover:text-primary"}`}
                      onClick={() => onToggleStatus(r)}
                    >
                      {isActive ? <Ban className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom"><p className="text-xs">{isActive ? "Bloquear" : "Desbloquear"}</p></TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive" onClick={() => onDelete(r.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom"><p className="text-xs">Excluir</p></TooltipContent>
                </Tooltip>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
