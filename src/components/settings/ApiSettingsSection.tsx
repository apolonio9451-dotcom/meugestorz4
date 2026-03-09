import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Save, Loader2, Eye, EyeOff, Wifi, Clock } from "lucide-react";

interface Props {
  companyId: string | null;
}

export default function ApiSettingsSection({ companyId }: Props) {
  const [apiUrl, setApiUrl] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [autoSendHour, setAutoSendHour] = useState(8);
  const [autoSendMinute, setAutoSendMinute] = useState(0);
  const [showToken, setShowToken] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [existingId, setExistingId] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("api_settings" as any)
        .select("id, api_url, api_token, auto_send_hour, auto_send_minute")
        .eq("company_id", companyId)
        .maybeSingle();
      if (data) {
        setApiUrl((data as any).api_url || "");
        setApiToken((data as any).api_token || "");
        setAutoSendHour((data as any).auto_send_hour ?? 8);
        setAutoSendMinute((data as any).auto_send_minute ?? 0);
        setExistingId((data as any).id);
      }
      setLoading(false);
    };
    fetch();
  }, [companyId]);

  const handleSave = async () => {
    if (!companyId) return;
    setSaving(true);
    try {
      const payload = { company_id: companyId, api_url: apiUrl.trim().replace(/\/$/, ""), api_token: apiToken.trim(), auto_send_hour: autoSendHour, auto_send_minute: autoSendMinute };
      let error;
      if (existingId) {
        ({ error } = await supabase.from("api_settings" as any).update(payload).eq("id", existingId));
      } else {
        const { data, error: e } = await supabase.from("api_settings" as any).insert(payload).select().single();
        error = e;
        if (data) setExistingId((data as any).id);
      }
      if (error) throw error;
      toast({ title: "Configurações da API salvas!" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div className="glass-card rounded-xl p-6 space-y-6">
      <h2 className="text-lg font-display font-semibold text-foreground flex items-center gap-2">
        <Wifi className="h-5 w-5 text-primary" />
        API de WhatsApp (UAZAPI)
      </h2>
      <p className="text-muted-foreground text-sm -mt-4">
        Configure a URL e o token da sua instância para envio automático de mensagens.
      </p>

      <div className="space-y-2">
        <Label className="text-sm font-semibold text-foreground">URL da API</Label>
        <Input
          value={apiUrl}
          onChange={(e) => setApiUrl(e.target.value)}
          placeholder="https://ipazua.uazapi.com"
          className="bg-secondary/50 border-border"
        />
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
          <Button variant="outline" size="icon" onClick={() => setShowToken(!showToken)}>
            {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">
          O token é armazenado de forma segura e utilizado apenas pelo servidor para enviar mensagens.
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          Horário de Disparo Automático
        </Label>
        <Input
          type="time"
          value={`${String(autoSendHour).padStart(2, "0")}:${String(autoSendMinute).padStart(2, "0")}`}
          onChange={(e) => {
            const [h, m] = e.target.value.split(":").map(Number);
            if (!isNaN(h)) setAutoSendHour(h);
            if (!isNaN(m)) setAutoSendMinute(m);
          }}
          className="bg-secondary/50 border-border w-40"
        />
        <p className="text-muted-foreground text-xs">
          Horário exato (HH:mm) em que as mensagens automáticas serão enviadas diariamente (horário de Brasília).
        </p>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || !apiUrl.trim() || !apiToken.trim()}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar Configurações da API
        </Button>
      </div>
    </div>
  );
}
