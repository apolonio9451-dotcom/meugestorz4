import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bell, Info, Clock } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const autoSendCategories = [
  {
    key: "vence_hoje",
    label: "Vence Hoje",
    color: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    description: "Envia lembrete no dia do vencimento do plano do cliente.",
  },
  {
    key: "vence_amanha",
    label: "Vence Amanhã",
    color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    description: "Envia lembrete 1 dia antes do vencimento do plano.",
  },
  {
    key: "a_vencer",
    label: "A Vencer",
    color: "bg-yellow-600/20 text-yellow-500 border-yellow-600/30",
    description: "Envia lembrete 3 dias antes do vencimento do plano.",
  },
  {
    key: "vencidos",
    label: "Vencidos",
    color: "bg-destructive/20 text-destructive border-destructive/30",
    description: "Envia cobrança para clientes com plano já vencido.",
  },
  {
    key: "followup",
    label: "Follow-up",
    color: "bg-cyan-400/20 text-cyan-400 border-cyan-400/50",
    description: "Envia mensagem de acompanhamento para clientes ativos com follow-up habilitado, verificando satisfação.",
  },
  {
    key: "suporte",
    label: "Suporte",
    color: "bg-violet-400/20 text-violet-400 border-violet-400/50",
    description: "Envia check-up automático 2 dias após o cliente receber suporte técnico.",
  },
];

interface Props {
  companyId: string | null;
}

export default function AutoSendCategoryToggles({ companyId }: Props) {
  const [activeCategories, setActiveCategories] = useState<Record<string, boolean>>({});
  const [autoSendHour, setAutoSendHour] = useState(8);
  const [autoSendMinute, setAutoSendMinute] = useState(0);
  const [sendInterval, setSendInterval] = useState(60);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    const fetchData = async () => {
      setLoading(true);

      const [catResult, apiResult] = await Promise.all([
        supabase
          .from("auto_send_category_settings")
          .select("category, is_active")
          .eq("company_id", companyId),
        supabase
          .from("api_settings")
          .select("auto_send_hour, auto_send_minute, send_interval_seconds")
          .eq("company_id", companyId)
          .maybeSingle(),
      ]);

      const map: Record<string, boolean> = {};
      autoSendCategories.forEach((c) => {
        const found = catResult.data?.find((d: any) => d.category === c.key);
        map[c.key] = found ? found.is_active : true;
      });
      setActiveCategories(map);

      if (apiResult.data) {
        setAutoSendHour((apiResult.data as any).auto_send_hour ?? 8);
        setAutoSendMinute((apiResult.data as any).auto_send_minute ?? 0);
        setSendInterval((apiResult.data as any).send_interval_seconds ?? 60);
      }

      setLoading(false);
    };
    fetchData();
  }, [companyId]);

  const handleToggle = async (category: string, checked: boolean) => {
    if (!companyId) return;
    setActiveCategories((prev) => ({ ...prev, [category]: checked }));

    const { error } = await supabase
      .from("auto_send_category_settings")
      .upsert(
        { company_id: companyId, category, is_active: checked, updated_at: new Date().toISOString() },
        { onConflict: "company_id,category" }
      );

    if (error) {
      setActiveCategories((prev) => ({ ...prev, [category]: !checked }));
      toast({ title: "Erro", description: "Não foi possível atualizar.", variant: "destructive" });
    } else {
      toast({
        title: checked ? "Ativado" : "Desativado",
        description: `Envio automático "${autoSendCategories.find((c) => c.key === category)?.label}" ${checked ? "ativado" : "desativado"}.`,
      });
    }
  };

  const handleTimeChange = async (value: string) => {
    const [h, m] = value.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return;
    setAutoSendHour(h);
    setAutoSendMinute(m);

    const { error } = await supabase
      .from("api_settings")
      .update({ auto_send_hour: h, auto_send_minute: m })
      .eq("company_id", companyId);

    if (error) {
      toast({ title: "Erro", description: "Não foi possível salvar o horário.", variant: "destructive" });
    } else {
      toast({ title: "Horário atualizado", description: `Disparos programados para ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} (Brasília).` });
    }
  };

  if (loading || !companyId) return null;

  const activeCount = Object.values(activeCategories).filter(Boolean).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-muted-foreground" />
            Disparos Automáticos Ativos
          </span>
          <Badge variant="outline" className="text-xs">
            {activeCount}/{autoSendCategories.length} ativos
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Escolha quais lembretes automáticos o sistema deve enviar.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <TooltipProvider>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {autoSendCategories.map((cat) => (
              <div
                key={cat.key}
                className="flex items-center justify-between rounded-lg border border-border/50 px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`${cat.color} border text-xs`}>
                    {cat.label}
                  </Badge>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[250px] text-xs">
                      {cat.description}
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Switch
                  checked={activeCategories[cat.key] ?? true}
                  onCheckedChange={(checked) => handleToggle(cat.key, checked)}
                />
              </div>
            ))}
          </div>
        </TooltipProvider>

        <div className="border-t border-border/50 pt-4 space-y-2">
          <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Horário de Disparo Automático
          </Label>
          <Input
            type="time"
            value={`${String(autoSendHour).padStart(2, "0")}:${String(autoSendMinute).padStart(2, "0")}`}
            onChange={(e) => handleTimeChange(e.target.value)}
            className="bg-secondary/50 border-border w-40"
          />
          <p className="text-muted-foreground text-xs">
            Horário exato (HH:mm) em que as mensagens automáticas serão enviadas diariamente (horário de Brasília).
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
