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
    if (!instanceName.trim() || !instanceToken.trim()) {
      toast.error("Preencha o nome e o token da instância.");
      return;
    }

    setActionLoading("save");
    try {
      const payload = {
        user_id: user.id,
        name: instanceName,
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

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-primary" />
            Configuração WhatsApi
          </CardTitle>
          <CardDescription>
            Conecte uma instância existente usando o token fornecido pela plataforma.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Nome da Instância</Label>
              <Input 
                placeholder="Ex: minha-instancia" 
                value={instanceName} 
                onChange={e => setInstanceName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Token da Instância</Label>
              <Input 
                type="password"
                placeholder="Token da sua instância" 
                value={instanceToken} 
                onChange={e => setInstanceToken(e.target.value)}
              />
            </div>
            <Button onClick={handleSave} disabled={!!actionLoading} className="w-full">
              {actionLoading === "save" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar Configurações
            </Button>
          </div>

          {instance && (
            <div className="pt-6 border-t mt-6 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback><User /></AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{instance.name}</p>
                    <Badge variant={instance.is_connected ? "default" : "secondary"}>
                      {instance.is_connected ? "Conectado" : "Desconectado"}
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
                      <img src={qrCode} alt="QR Code" className="w-48 h-48 bg-white p-2 rounded" />
                      <p className="text-xs text-muted-foreground animate-pulse text-center">
                        Escaneie para conectar seu WhatsApp
                      </p>
                    </>
                  ) : (
                    <Button onClick={checkStatus} className="gap-2">
                      <QrCode className="w-4 h-4" />
                      Gerar QR Code
                    </Button>
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
