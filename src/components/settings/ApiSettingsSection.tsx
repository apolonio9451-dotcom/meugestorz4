import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Save, Loader2, Eye, EyeOff, Wifi } from "lucide-react";

interface Props {
  companyId: string | null;
  isOwner?: boolean;
}

export default function ApiSettingsSection({ companyId, isOwner = false }: Props) {
  const [apiUrl, setApiUrl] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [pixKey, setPixKey] = useState("");
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
        .select("id, api_url, api_token, pix_key")
        .eq("company_id", companyId)
        .maybeSingle();
      if (data) {
        setApiUrl((data as any).api_url || "");
        setApiToken((data as any).api_token || "");
        setPixKey((data as any).pix_key || "");
        setExistingId((data as any).id);
      }
      setLoading(false);
    };
    fetchData();
  }, [companyId]);

  const handleSave = async () => {
    if (!companyId) return;
    setSaving(true);
    try {
      const payload = { company_id: companyId, api_url: apiUrl.trim().replace(/\/$/, ""), api_token: apiToken.trim(), pix_key: pixKey.trim() };
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
    <div className="glass-card rounded-xl p-6 space-y-6">
      <h2 className="text-lg font-display font-semibold text-foreground flex items-center gap-2">
        <Wifi className="h-5 w-5 text-primary" />
        Configuração de Envio
      </h2>
      <p className="text-muted-foreground text-sm -mt-4">
        Configure os dados necessários para o envio automático de mensagens.
      </p>

      {/* URL da API — visível apenas para Proprietário */}
      {isOwner && (
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
            <Button variant="outline" size="icon" onClick={() => setShowUrl(!showUrl)}>
              {showUrl ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}

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
        <Label className="text-sm font-semibold text-foreground">Chave Pix</Label>
        <Input
          value={pixKey}
          onChange={(e) => setPixKey(e.target.value)}
          placeholder="sua-chave-pix@email.com ou CPF/CNPJ"
          className="bg-secondary/50 border-border"
        />
        <p className="text-muted-foreground text-xs">
          Esta chave será usada na variável <code className="bg-muted px-1 rounded">{'{sua_chave_pix}'}</code> nos templates de mensagem.
        </p>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving || (!isOwner && !apiToken.trim())}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}