import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Loader2, Smartphone, QrCode, CheckCircle2, WifiOff, RefreshCw, Zap } from "lucide-react";

interface Props {
  companyId: string | null;
}

export default function WhatsAppInstanceSection({ companyId }: Props) {
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [fetchingQr, setFetchingQr] = useState(false);
  const [hasInstance, setHasInstance] = useState(false);
  const [instanceName, setInstanceName] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const checkStatus = useCallback(async () => {
    if (!companyId) return;
    try {
      const { data: session } = await supabase.auth.getSession();
      const resp = await supabase.functions.invoke("manage-instance", {
        body: { action: "status", company_id: companyId },
      });
      if (resp.data) {
        setHasInstance(resp.data.has_instance);
        setInstanceName(resp.data.instance_name);
      }
    } catch (err) {
      console.error("Status check error:", err);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const handleCreate = async () => {
    if (!companyId) return;
    setCreating(true);
    try {
      const resp = await supabase.functions.invoke("manage-instance", {
        body: { action: "create", company_id: companyId, base_url: "https://ipazua.uazapi.com" },
      });

      if (resp.error) throw new Error(resp.error.message);
      if (resp.data?.error) throw new Error(resp.data.error);

      setHasInstance(true);
      setInstanceName(resp.data.instance_name);
      toast({ title: "Instância criada com sucesso!", description: "Agora escaneie o QR Code para conectar." });

      // Auto fetch QR code
      setTimeout(() => fetchQrCode(), 2000);
    } catch (err: any) {
      toast({ title: "Erro ao criar instância", description: err?.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const fetchQrCode = async () => {
    if (!companyId) return;
    setFetchingQr(true);
    try {
      const resp = await supabase.functions.invoke("manage-instance", {
        body: { action: "qrcode", company_id: companyId },
      });

      if (resp.error) throw new Error(resp.error.message);
      if (resp.data?.error) throw new Error(resp.data.error);

      const state = resp.data.state || "unknown";
      setConnectionState(state);

      if (resp.data.qrcode) {
        const qr = resp.data.qrcode;
        setQrCode(qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`);
        setAutoRefresh(true);
      } else {
        setQrCode(null);
      }
    } catch (err: any) {
      toast({ title: "Erro ao buscar QR Code", description: err?.message, variant: "destructive" });
    } finally {
      setFetchingQr(false);
    }
  };

  // Auto-refresh QR code every 15 seconds when disconnected
  useEffect(() => {
    if (!autoRefresh || connectionState === "connected") return;
    const interval = setInterval(() => {
      fetchQrCode();
    }, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh, connectionState, companyId]);

  if (loading) return null;

  const isConnected = connectionState === "connected";

  return (
    <div className="glass-card rounded-xl p-6 space-y-6">
      <h2 className="text-lg font-display font-semibold text-foreground flex items-center gap-2">
        <Smartphone className="h-5 w-5 text-primary" />
        Instância WhatsApp (UAZAPI)
      </h2>
      <p className="text-muted-foreground text-sm -mt-4">
        Crie e conecte automaticamente sua instância do WhatsApp para envio de mensagens.
      </p>

      {!hasInstance ? (
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Zap className="w-8 h-8 text-primary" />
          </div>
          <p className="text-center text-muted-foreground text-sm max-w-md">
            Nenhuma instância encontrada. Clique abaixo para criar automaticamente sua instância e configurar o webhook.
          </p>
          <Button onClick={handleCreate} disabled={creating} size="lg">
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Zap className="h-4 w-4 mr-2" />
            )}
            {creating ? "Criando instância..." : "Criar Instância Automaticamente"}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Instance info */}
          <div className="flex items-center justify-between rounded-lg bg-secondary/30 p-3">
            <div>
              <p className="text-xs text-muted-foreground">Instância</p>
              <p className="text-sm font-mono text-foreground">{instanceName}</p>
            </div>
            <div className="flex items-center gap-2">
              {isConnected ? (
                <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  Conectado
                </span>
              ) : connectionState ? (
                <span className="flex items-center gap-1.5 text-warning text-xs font-medium">
                  <WifiOff className="w-4 h-4" />
                  {connectionState}
                </span>
              ) : null}
            </div>
          </div>

          {/* QR Code area */}
          {isConnected ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <p className="text-emerald-400 font-semibold">WhatsApp Conectado!</p>
              <p className="text-muted-foreground text-xs text-center">
                Sua instância está ativa e pronta para enviar/receber mensagens.
              </p>
              <Button variant="outline" size="sm" onClick={fetchQrCode} disabled={fetchingQr}>
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${fetchingQr ? "animate-spin" : ""}`} />
                Verificar Status
              </Button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 py-4">
              {qrCode ? (
                <>
                  <div className="bg-white rounded-xl p-3 shadow-lg">
                    <img src={qrCode} alt="QR Code WhatsApp" className="w-64 h-64 object-contain" />
                  </div>
                  <p className="text-muted-foreground text-xs text-center max-w-sm">
                    Abra o <strong>WhatsApp</strong> no seu celular → <strong>Aparelhos conectados</strong> → <strong>Conectar um aparelho</strong> → Escaneie o QR Code acima.
                  </p>
                  <p className="text-muted-foreground/50 text-[10px] flex items-center gap-1">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Atualizando automaticamente...
                  </p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <QrCode className="w-8 h-8 text-primary" />
                  </div>
                  <Button onClick={fetchQrCode} disabled={fetchingQr}>
                    {fetchingQr ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <QrCode className="h-4 w-4 mr-2" />
                    )}
                    {fetchingQr ? "Gerando QR Code..." : "Gerar QR Code para Conectar"}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
