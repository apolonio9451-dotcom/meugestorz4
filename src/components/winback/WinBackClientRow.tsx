import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TableCell, TableRow } from "@/components/ui/table";
import { MessageCircle, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const CAMPAIGN_STEPS = [
  { key: "winback_day1", day: 1, label: "Dia 1" },
  { key: "winback_day3", day: 3, label: "Dia 3" },
  { key: "winback_day6", day: 6, label: "Dia 6" },
  { key: "winback_day10", day: 10, label: "Dia 10" },
  { key: "winback_day15", day: 15, label: "Dia 15" },
];

export interface WinBackClient {
  id: string;
  name: string;
  whatsapp: string;
  server: string;
  status: string;
  last_end_date: string;
  days_expired: number;
  last_plan: string;
  last_amount: number;
}

interface Props {
  client: WinBackClient;
  companyId: string;
  currentStep: number;
  templates: Record<string, string>;
  onReactivated: (id: string) => void;
  onStepAdvanced: (clientId: string, newStep: number) => void;
}

export default function WinBackClientRow({ client, companyId, currentStep, templates, onReactivated, onStepAdvanced }: Props) {
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const daysBadge = (days: number) => {
    if (days >= 90) return <Badge variant="outline" className="bg-destructive/10 text-destructive">{days}d</Badge>;
    if (days >= 60) return <Badge variant="outline" className="bg-warning/10 text-warning">{days}d</Badge>;
    return <Badge variant="outline" className="bg-muted text-muted-foreground">{days}d</Badge>;
  };

  const handleSendCampaignMessage = async () => {
    if (!client.whatsapp) {
      toast.error("Cliente sem WhatsApp cadastrado");
      return;
    }
    if (currentStep >= CAMPAIGN_STEPS.length) {
      toast.info("Campanha finalizada para este cliente");
      return;
    }

    const step = CAMPAIGN_STEPS[currentStep];
    const template = templates[step.key] || `Olá ${client.name}! Sentimos sua falta.`;
    const msg = template
      .replace(/{nome}/g, client.name)
      .replace(/{plano}/g, client.last_plan)
      .replace(/{valor}/g, client.last_amount > 0 ? fmt(client.last_amount) : "—")
      .replace(/{dias}/g, String(client.days_expired))
      .replace(/{servidor}/g, client.server || "—");

    const phone = client.whatsapp.replace(/\D/g, "");
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, "_blank");

    // Advance step
    const newStep = currentStep + 1;
    const { error } = await supabase
      .from("winback_campaign_progress")
      .upsert(
        { company_id: companyId, client_id: client.id, current_step: newStep, last_sent_at: new Date().toISOString() },
        { onConflict: "company_id,client_id" }
      );

    if (error) {
      toast.error("Erro ao atualizar progresso");
    } else {
      onStepAdvanced(client.id, newStep);
      toast.success(`${step.label} enviado para ${client.name}`);
    }
  };

  const handleReactivate = async () => {
    const { error } = await supabase
      .from("clients")
      .update({ status: "active" })
      .eq("id", client.id);
    if (error) {
      toast.error("Erro ao reativar cliente");
    } else {
      toast.success(`${client.name} reativado!`);
      onReactivated(client.id);
    }
  };

  const stepInfo = currentStep < CAMPAIGN_STEPS.length
    ? CAMPAIGN_STEPS[currentStep]
    : null;

  return (
    <TableRow>
      <TableCell className="font-medium">{client.name}</TableCell>
      <TableCell>{client.server || "—"}</TableCell>
      <TableCell>{client.last_plan}</TableCell>
      <TableCell className="text-right">{client.last_amount > 0 ? fmt(client.last_amount) : "—"}</TableCell>
      <TableCell className="text-center">{daysBadge(client.days_expired)}</TableCell>
      <TableCell className="text-center">
        {currentStep >= CAMPAIGN_STEPS.length ? (
          <Badge variant="outline" className="bg-success/10 text-success border-success/30">Finalizado</Badge>
        ) : (
          <div className="flex items-center justify-center gap-1">
            {CAMPAIGN_STEPS.map((s, i) => (
              <div
                key={s.key}
                className={`w-2 h-2 rounded-full ${
                  i < currentStep
                    ? "bg-primary"
                    : i === currentStep
                    ? "bg-primary animate-pulse"
                    : "bg-muted-foreground/30"
                }`}
                title={s.label}
              />
            ))}
            <span className="text-xs text-muted-foreground ml-1.5">
              {stepInfo?.label}
            </span>
          </div>
        )}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          {currentStep < CAMPAIGN_STEPS.length && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-xs text-primary hover:text-primary"
              title={`Enviar ${stepInfo?.label}`}
              onClick={handleSendCampaignMessage}
            >
              <Send className="w-3.5 h-3.5" />
              {stepInfo?.label}
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Reativar cliente" onClick={handleReactivate}>
            <RefreshCw className="w-4 h-4 text-primary" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
