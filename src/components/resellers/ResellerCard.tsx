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
} from "lucide-react";
import { getResellerRole, roleLabels, type ResellerRole } from "@/pages/Resellers";

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
}

const roleBadgeColors: Record<ResellerRole, string> = {
  master: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  reseller: "bg-primary/15 text-primary border-primary/30",
  trial_only: "bg-muted text-muted-foreground border-border",
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
}: ResellerCardProps) {
  const isActive = r.status === "active";
  const initials = r.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const role = getResellerRole(r);

  return (
    <Card className={`group transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 border ${isActive ? "border-border hover:border-primary/30" : "border-destructive/30 opacity-80"}`}>
      <CardContent className="p-0">
        {/* Header */}
        <div className="flex items-start gap-3 p-4 pb-2">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isActive ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"}`}>
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm text-foreground truncate">{r.name}</h3>
              <Badge variant={isActive ? "default" : "destructive"} className="text-[9px] px-1.5 py-0 h-4 shrink-0">
                {isActive ? "Ativo" : "Bloqueado"}
              </Badge>
            </div>
            {r.email && <p className="text-[11px] text-muted-foreground truncate">{r.email}</p>}
            {r.whatsapp && <p className="text-[11px] text-muted-foreground">{r.whatsapp}</p>}
          </div>
        </div>

        {/* Role badge - clickable */}
        <div className="px-4 pb-2">
          <button
            onClick={() => onChangeRole(r)}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-semibold transition-all hover:opacity-80 cursor-pointer ${roleBadgeColors[role]}`}
          >
            <UserCog className="w-3 h-3" />
            {roleLabels[role]}
          </button>
        </div>

        {/* Credit bar */}
        <div className="mx-4 flex items-center justify-between rounded-md bg-muted/40 px-3 py-1.5">
          <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <Coins className="w-3 h-3" /> Créditos
          </span>
          <span className={`font-mono text-xs font-bold ${r.credit_balance > 0 ? "text-primary" : "text-destructive"}`}>
            {r.credit_balance}
          </span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-between px-3 py-2 mt-1 border-t border-border/50">
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
        </div>
      </CardContent>
    </Card>
  );
}
