import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Save, Loader2, Eye, EyeOff, Wifi } from "lucide-react";

interface Props {
  companyId: string | null;
  isOwner?: boolean;
}

const clampPauseDays = (value: number) => Math.min(90, Math.max(1, Number.isFinite(value) ? value : 10));

export default function ApiSettingsSection({ companyId, isOwner = false }: Props) {
  const [apiUrl, setApiUrl] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [overdueChargePauseEnabled, setOverdueChargePauseEnabled] = useState(true);
  const [overdueChargePauseDays, setOverdueChargePauseDays] = useState(10);
  const [showToken, setShowToken] = useState(false);
  const [showUrl, setShowUrl] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [existingId, setExistingId] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    const fetchData = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("api_settings" as any)
        .select("id, api_url, api_token, pix_key, overdue_charge_pause_enabled, overdue_charge_pause_days")
        .eq("company_id", companyId)
        .maybeSingle();
      if (data) {
        const parsedDays = Number((data as any).overdue_charge_pause_days ?? 10);
        const normalizedDays = parsedDays > 0 ? clampPauseDays(parsedDays) : 10;
        setApiUrl((data as any).api_url || "");
        setApiToken((data as any).api_token || "");
        setPixKey((data as any).pix_key || "");
        setOverdueChargePauseEnabled(Boolean((data as any).overdue_charge_pause_enabled ?? parsedDays > 0));
        setOverdueChargePauseDays(normalizedDays);
        setExistingId((data as any).id);
      } else {
        setOverdueChargePauseEnabled(true);
        setOverdueChargePauseDays(10);
      }
      setLoading(false);
    };
    fetchData();
  }, [companyId]);

  const handleSave = async () => {
    if (!companyId) return;
    setSaving(true);
    try {
      const payload = {
        company_id: companyId,
        api_url: apiUrl.trim().replace(/\/$/, ""),
        api_token: apiToken.trim(),
        pix_key: pixKey.trim(),
        overdue_charge_pause_enabled: overdueChargePauseEnabled,
        overdue_charge_pause_days: clampPauseDays(overdueChargePauseDays),
      };
      let error;
      if (existingId) {
        ({ error } = await supabase.from("api_settings" as any).update(payload).eq("id", existingId));
      } else {
        const { data, error: e } = await supabase.from("api_settings" as any).insert(payload).select().single();
        error = e;
        if (data) setExistingId((data as any).id);
      }
      if (error) throw error;
      toast({ title: "Configurações salvas!" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div className="glass-card rounded-xl p-6 space-y-6 relative">
      <h2 className="text-lg font-display font-semibold text-foreground flex items-center gap-2">
        <Wifi className="h-5 w-5 text-primary" />
        Configuração de Envio
      </h2>
      <p className="text-muted-foreground text-sm -mt-4">
        Configure os dados necessários para o envio automático de mensagens.
      </p>

      {isOwner ? (
        <>
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-foreground">URL da API</Label>
            <div className="flex gap-2">
              <Input
                type={showUrl ? "text" : "password"}
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="https://..."
                className="bg-secondary/50 border-border font-mono"
              />
              <Button type="button" variant="outline" size="icon" onClick={() => setShowUrl(!showUrl)}>
                {showUrl ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold text-foreground">Token da Instância</Label>
            <div className="flex gap-2">
              <Input
                type={showToken ? "text" : "password"}
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
                placeholder="Cole seu token aqui"
                className="bg-secondary/50 border-border font-mono"
              />
              <Button type="button" variant="outline" size="icon" onClick={() => setShowToken(!showToken)}>
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">
              O token é armazenado de forma segura e utilizado apenas pelo servidor para enviar mensagens.
            </p>
          </div>

          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 shadow-[0_0_24px_-12px_hsl(var(--primary)/0.65)] space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <Label htmlFor="overdue-charge-pause" className="text-sm font-semibold text-foreground">
                  Ativar Pausa Automática
                </Label>
                <p className="text-xs text-muted-foreground">
                  Interrompe a cobrança diária de clientes vencidos há muito tempo sem alterar a categoria deles.
                </p>
              </div>
              <Switch
                id="overdue-charge-pause"
                checked={overdueChargePauseEnabled}
                onCheckedChange={setOverdueChargePauseEnabled}
                aria-label="Ativar pausa automática"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="overdue-charge-pause-days" className="text-sm font-semibold text-foreground">
                Pausar após (dias)
              </Label>
              <Input
                id="overdue-charge-pause-days"
                type="number"
                min={1}
                max={90}
                step={1}
                value={overdueChargePauseDays}
                disabled={!overdueChargePauseEnabled}
                onChange={(e) => setOverdueChargePauseDays(clampPauseDays(Number(e.target.value || 10)))}
                placeholder="10"
                className="max-w-[180px] bg-background/70 border-border"
              />
              <p className="text-xs text-muted-foreground">
                {overdueChargePauseEnabled
                  ? `Clientes vencidos há mais de ${overdueChargePauseDays} dias ficarão com a cobrança automática pausada.`
                  : "A pausa automática está desativada; clientes vencidos continuarão elegíveis para cobrança diária."}
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar Configurações
            </Button>
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-border/50 bg-muted/30 px-4 py-3">
          <p className="text-sm text-muted-foreground">
            🔒 Informações de Acesso Master (URL, Token e pausa automática) são visíveis apenas para o Proprietário/Master.
          </p>
        </div>
      )}
    </div>
  );
}
