import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Coins,
  Pencil,
  Trash2,
  History,
  MoreVertical,
  Ban,
  CheckCircle2,
  Eye,
  UserCog,
} from "lucide-react";

interface Reseller {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  credit_balance: number;
  status: string;
  notes: string;
  created_at: string;
}

interface ResellerCardProps {
  reseller: Reseller;
  onEdit: (r: Reseller) => void;
  onDelete: (id: string) => void;
  onCredits: (r: Reseller) => void;
  onHistory: (r: Reseller) => void;
  onToggleStatus: (r: Reseller) => void;
  onViewClients: (r: Reseller) => void;
}

export default function ResellerCard({
  reseller: r,
  onEdit,
  onDelete,
  onCredits,
  onHistory,
  onToggleStatus,
  onViewClients,
}: ResellerCardProps) {
  const isActive = r.status === "active";

  return (
    <Card className={`transition-all duration-200 hover:shadow-md ${!isActive ? "opacity-70 border-destructive/30" : ""}`}>
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground truncate">{r.name}</h3>
              <Badge variant={isActive ? "default" : "destructive"} className="text-[10px] shrink-0">
                {isActive ? "Ativo" : "Bloqueado"}
              </Badge>
            </div>
            {r.email && <p className="text-xs text-muted-foreground truncate mt-0.5">{r.email}</p>}
            {r.whatsapp && <p className="text-xs text-muted-foreground">{r.whatsapp}</p>}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="shrink-0 h-8 w-8">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(r)}>
                <Pencil className="w-4 h-4 mr-2" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onViewClients(r)}>
                <Eye className="w-4 h-4 mr-2" /> Ver Clientes
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onToggleStatus(r)}>
                {isActive ? (
                  <><Ban className="w-4 h-4 mr-2 text-destructive" /> <span className="text-destructive">Bloquear</span></>
                ) : (
                  <><CheckCircle2 className="w-4 h-4 mr-2 text-primary" /> <span className="text-primary">Desbloquear</span></>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onDelete(r.id)} className="text-destructive focus:text-destructive">
                <Trash2 className="w-4 h-4 mr-2" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Credit balance */}
        <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Créditos</span>
          </div>
          <span className={`font-mono font-bold text-sm ${r.credit_balance > 0 ? "text-primary" : "text-destructive"}`}>
            {r.credit_balance}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-xs" onClick={() => onCredits(r)}>
            <Coins className="w-3.5 h-3.5" /> Créditos
          </Button>
          <Button size="sm" variant="outline" className="flex-1 gap-1.5 text-xs" onClick={() => onHistory(r)}>
            <History className="w-3.5 h-3.5" /> Histórico
          </Button>
        </div>

        {/* Date */}
        <p className="text-[10px] text-muted-foreground text-right">
          Desde {new Date(r.created_at).toLocaleDateString("pt-BR")}
        </p>
      </CardContent>
    </Card>
  );
}
