import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  Smartphone,
  RefreshCw,
  Loader2,
  QrCode,
  Save,
  User,
  Trash2,
  Copy,
  ExternalLink,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const SERVER_URL = "https://ipazua.uazapi.com";

interface WhatsAppInstance {
  id: string;
  name: string;
  instance_token: string;
  status: string;
  is_connected: boolean;
  device_name?: string;
}

export default function WhatsAppView() {
  const { user } = useAuth();
  const [instance, setInstance] = useState<WhatsAppInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  
  const [instanceName, setInstanceName] = useState("");
  const [instanceToken, setInstanceToken] = useState("");

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    // Bypass TS error for whats_api table
    const { data: results } = await (supabase
      .from("whats_api" as any)
      .select("*")
      .eq("user_id", user.id) as any);

    if (results && results.length > 0) {
      const data = results[0];
      setInstance(data as WhatsAppInstance);
      setInstanceName(data.name || "");
      setInstanceToken(data.instance_token || "");
    } else {
      setInstance(null);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSave = async () => {
    if (!user) return;
    if (!instanceToken.trim()) {
      toast.error("Preencha o token da instância.");
      return;
    }

    setActionLoading("save");
    try {
      const payload = {
        user_id: user.id,
        name: "Minha Instância", // Nome padrão interno
        instance_token: instanceToken,
        server_url: SERVER_URL,
      };

      const { error } = instance
        ? await supabase.from("whats_api" as any).update(payload).eq("id", instance.id)
        : await supabase.from("whats_api" as any).insert(payload);

      if (error) throw error;
      toast.success("Configurações salvas!");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setActionLoading(null);
    }
  };

  const checkStatus = async () => {
    if (!instance) return;
    setActionLoading("status");
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-manage", {
        body: { action: "qrcode" }
      });

      if (error || data?.error) throw new Error(data?.error || error?.message);

      if (data.connected) {
        toast.success("WhatsApp Conectado!");
        setQrCode(null);
      } else if (data.qrcode) {
        // A API retorna base64 puro ou com o prefixo data:image/png;base64,
        let qrcodeBase64 = data.qrcode;
        if (!qrcodeBase64.startsWith("data:image")) {
          qrcodeBase64 = `data:image/png;base64,${qrcodeBase64}`;
        }
        setQrCode(qrcodeBase64);
      }
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao verificar status");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!instance) return;
    setActionLoading("delete");
    try {
      const { error } = await supabase.from("whats_api" as any).delete().eq("id", instance.id);
      if (error) throw error;
      setInstance(null);
      setQrCode(null);
      setInstanceName("");
      setInstanceToken("");
      toast.success("Instância removida localmente.");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado para a área de transferência!");
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const baseFuncUrl = "https://grlwciflaotripbumhve.supabase.co/functions/v1";
  const finalWebhookUrl = `${baseFuncUrl}/whatsapp-webhook?user_id=${user?.id}`;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-primary" />
                Status do WhatsApp
              </CardTitle>
              <CardDescription>
                Configure sua instância para integrar com o sistema.
              </CardDescription>
            </div>
            {instance && (
              <Badge 
                variant={instance.is_connected ? "default" : "destructive"}
                className={instance.is_connected ? "bg-emerald-500 hover:bg-emerald-600" : ""}
              >
                {instance.is_connected ? "Conectado" : "Desconectado"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 p-4 border rounded-lg bg-muted/20">
            <div className="space-y-2">
              <Label className="flex items-center justify-between">
                URL do Webhook para sua instância
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToClipboard(finalWebhookUrl)}>
                  <Copy className="h-3 w-3" />
                </Button>
              </Label>
              <div className="flex gap-2">
                <Input readOnly value={finalWebhookUrl} className="bg-background text-xs font-mono" />
              </div>
              <p className="text-[10px] text-muted-foreground italic">
                Copie este link e cole no campo "Webhook" das configurações da sua instância externa.
              </p>
            </div>
          </div>

          <div className="grid gap-4 pt-4">
            {/* Campo Nome removido como solicitado */}
            <div className="space-y-2">
              <Label>Token da Instância (Instance Token)</Label>
              <Input 
                type="password"
                placeholder="Insira o Token da sua instância externa" 
                value={instanceToken} 
                onChange={e => setInstanceToken(e.target.value)}
              />
            </div>
            <Button onClick={handleSave} disabled={!!actionLoading} className="w-full">
              {actionLoading === "save" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar Token no Sistema
            </Button>
          </div>

          {instance && (
            <div className="pt-6 border-t space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback><User /></AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{instance.name}</p>
                    <Badge variant={instance.is_connected ? "default" : "secondary"}>
                      {instance.is_connected ? "Status: Conectado" : "Status: Desconectado"}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={checkStatus} disabled={!!actionLoading}>
                    {actionLoading === "status" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={handleDelete} disabled={!!actionLoading}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {!instance.is_connected && (
                <div className="flex flex-col items-center gap-4 bg-muted/30 p-6 rounded-lg">
                  {qrCode ? (
                    <>
                      <img src={qrCode} alt="QR Code" className="w-48 h-48 bg-white p-2 rounded shadow-sm" />
                      <p className="text-xs text-muted-foreground animate-pulse text-center">
                        Escaneie com seu WhatsApp para conectar
                      </p>
                    </>
                  ) : (
                    <div className="text-center space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Sua instância está salva. Você pode gerar o QR Code aqui ou conectar direto pelo seu painel externo.
                      </p>
                      <Button onClick={checkStatus} className="gap-2">
                        <QrCode className="w-4 h-4" />
                        Gerar QR Code Agora
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
