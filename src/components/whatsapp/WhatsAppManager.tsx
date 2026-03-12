import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Smartphone, Wifi, WifiOff, Trash2, RefreshCw, Send, Loader2, QrCode } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";

type Status = "idle" | "loading" | "waiting_qr" | "qr" | "connected" | "disconnected" | "error";

interface ConnectionData {
  token: string;
  instanceId: string;
  profileName?: string;
  phoneNumber?: string;
}

interface Props {
  userName: string;
  companyId?: string | null;
  onConnected?: (data: { profileName?: string; phoneNumber?: string }) => void;
}

export default function WhatsAppManager({ userName, companyId, onConnected }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionData | null>(null);
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("Olá! Esta é uma mensagem de teste. 🚀");
  const [sending, setSending] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const WEBHOOK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`;

  const normalizeQrCode = (qr: string) =>
    qr.startsWith("data:") || qr.startsWith("http") ? qr : `data:image/png;base64,${qr}`;

  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const persistToken = async (token: string) => {
    if (!companyId || !token) return;

    const { error } = await supabase
      .from("api_settings" as any)
      .upsert(
        {
          company_id: companyId,
          api_token: token,
          instance_name: userName || "Minha Instância",
        },
        { onConflict: "company_id" }
      );

    if (error) {
      console.error("[WhatsApp] Erro ao persistir token:", error);
    }
  };

  const clearPersistedToken = async () => {
    if (!companyId) return;

    const { error } = await supabase
      .from("api_settings" as any)
      .update({ api_token: "" })
      .eq("company_id", companyId);

    if (error) {
      console.error("[WhatsApp] Erro ao limpar token:", error);
    }
  };

  const startPolling = (instanceToken: string, instanceId: string) => {
    stopPolling();
    let attempts = 0;

    intervalRef.current = setInterval(async () => {
      attempts++;
      console.log(`[WhatsApp] Polling attempt ${attempts}...`);

      try {
        const { data, error } = await supabase.functions.invoke("whatsapp-status", {
          body: { token: instanceToken },
        });

        console.log("[WhatsApp] Status response:", JSON.stringify(data));

        if (error) {
          console.error("[WhatsApp] Status error:", error);
          return;
        }

        if (data?.connected) {
          setStatus("connected");
          setQrCode(null);
          setConnection((prev) => ({
            token: prev?.token ?? instanceToken,
            instanceId: data.instanceId ?? prev?.instanceId ?? instanceId,
            profileName: data.profileName,
            phoneNumber: data.phoneNumber,
          }));

          stopPolling();
          void persistToken(instanceToken);
          toast.success("WhatsApp conectado com sucesso!");
          onConnected?.({ profileName: data.profileName, phoneNumber: data.phoneNumber });
          return;
        }

        if (data?.qrCode) {
          setQrCode(normalizeQrCode(data.qrCode));
          setStatus("qr");
        }

        if (attempts >= 60) {
          stopPolling();
          toast.error("Tempo esgotado. Tente conectar novamente.");
          setStatus("error");
        }
      } catch (err) {
        console.error("[WhatsApp] Erro no polling:", err);
      }
    }, 3000);
  };

  const connect = async () => {
    setStatus("loading");

    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-connect", {
        body: { userName, webhookUrl: WEBHOOK_URL },
      });

      if (error) throw error;
      if (data?.token) void persistToken(data.token);

      if (data.status === "connected") {
        setConnection({
          token: data.token,
          instanceId: data.instanceId ?? "",
          profileName: data.profileName,
          phoneNumber: data.phoneNumber,
        });
        setQrCode(null);
        setStatus("connected");
        toast.success("WhatsApp conectado!");
        onConnected?.({ profileName: data.profileName, phoneNumber: data.phoneNumber });
      } else if (data.qrCode) {
        setQrCode(normalizeQrCode(data.qrCode));
        setConnection({ token: data.token, instanceId: data.instanceId ?? "" });
        setStatus("qr");
        startPolling(data.token, data.instanceId ?? "");
      } else {
        setConnection({ token: data.token, instanceId: data.instanceId ?? "" });
        setStatus("waiting_qr");
        startPolling(data.token, data.instanceId ?? "");
      }
    } catch (err: any) {
      console.error("Erro ao conectar:", err);
      toast.error("Erro ao conectar WhatsApp");
      setStatus("error");
    }
  };

  const checkStatus = async () => {
    if (!connection?.token) return;

    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-status", {
        body: { token: connection.token },
      });

      if (error) throw error;

      if (data?.connected) {
        setStatus("connected");
        setQrCode(null);
        setConnection((prev) => ({
          token: prev?.token ?? connection.token,
          instanceId: data.instanceId ?? prev?.instanceId ?? connection.instanceId,
          profileName: data.profileName,
          phoneNumber: data.phoneNumber,
        }));
        void persistToken(connection.token);
        toast.success("WhatsApp conectado!");
        onConnected?.({ profileName: data.profileName, phoneNumber: data.phoneNumber });
      } else if (data?.qrCode) {
        setQrCode(normalizeQrCode(data.qrCode));
        setStatus("qr");
        startPolling(connection.token, data.instanceId ?? connection.instanceId);
      } else {
        setStatus("disconnected");
        toast.info("WhatsApp desconectado");
      }
    } catch (err) {
      console.error("Erro ao verificar status:", err);
      toast.error("Erro ao verificar status");
    }
  };

  const disconnect = async () => {
    if (!connection?.token) return;

    try {
      await supabase.functions.invoke("whatsapp-disconnect", {
        body: { token: connection.token },
      });

      setStatus("disconnected");
      setQrCode(null);
      stopPolling();
      toast.success("WhatsApp desconectado");
    } catch (err) {
      console.error("Erro ao desconectar:", err);
      toast.error("Erro ao desconectar");
    }
  };

  const deleteInstance = async () => {
    if (!connection?.instanceId) return;

    try {
      await supabase.functions.invoke("whatsapp-delete", {
        body: { instanceId: connection.instanceId },
      });

      await clearPersistedToken();
      setStatus("idle");
      setConnection(null);
      setQrCode(null);
      stopPolling();
      setDeleteConfirm(false);
      toast.success("Instância deletada permanentemente");
    } catch (err) {
      console.error("Erro ao deletar:", err);
      toast.error("Erro ao deletar instância");
    }
  };

  const sendTestMessage = async () => {
    if (!connection?.token || !testPhone || !testMessage) return;
    setSending(true);

    try {
      const { error } = await supabase.functions.invoke("whatsapp-send", {
        body: {
          token: connection.token,
          phone: testPhone.replace(/\D/g, ""),
          message: testMessage,
        },
      });

      if (error) throw error;
      toast.success("Mensagem enviada com sucesso!");
    } catch (err) {
      console.error("Erro ao enviar:", err);
      toast.error("Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const restoreConnection = async () => {
      if (!companyId) return;

      try {
        const { data, error } = await supabase
          .from("api_settings" as any)
          .select("api_token")
          .eq("company_id", companyId)
          .maybeSingle();

        if (error) throw error;

        const savedToken = (data as any)?.api_token?.trim();
        if (!savedToken || !mounted) return;

        setConnection({ token: savedToken, instanceId: "" });
        setStatus("loading");

        const { data: statusData, error: statusError } = await supabase.functions.invoke("whatsapp-status", {
          body: { token: savedToken },
        });

        if (statusError) throw statusError;
        if (!mounted) return;

        if (statusData?.connected) {
          setStatus("connected");
          setQrCode(null);
          setConnection({
            token: savedToken,
            instanceId: statusData.instanceId ?? "",
            profileName: statusData.profileName,
            phoneNumber: statusData.phoneNumber,
          });
        } else if (statusData?.qrCode) {
          setQrCode(normalizeQrCode(statusData.qrCode));
          setStatus("qr");
          startPolling(savedToken, statusData.instanceId ?? "");
        } else {
          setStatus("disconnected");
        }
      } catch (err) {
        console.error("[WhatsApp] Erro ao restaurar instância:", err);
      }
    };

    void restoreConnection();

    return () => {
      mounted = false;
      stopPolling();
    };
  }, [companyId]);

  const statusConfig: Record<Status, { color: string; label: string }> = {
    idle: { color: "bg-muted-foreground", label: "Não conectado" },
    loading: { color: "bg-warning animate-pulse", label: "Conectando..." },
    waiting_qr: { color: "bg-warning animate-pulse", label: "Gerando QR Code..." },
    qr: { color: "bg-warning animate-pulse", label: "Aguardando leitura" },
    connected: { color: "bg-success", label: "Conectado" },
    disconnected: { color: "bg-destructive", label: "Desconectado" },
    error: { color: "bg-destructive", label: "Erro" },
  };

  const { color, label } = statusConfig[status];

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Smartphone className="w-5 h-5 text-primary" />
            WhatsApp
          </CardTitle>
          <Badge variant="outline" className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
            {label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* IDLE */}
        {status === "idle" && (
          <Button onClick={connect} className="w-full gap-2">
            <Smartphone className="w-4 h-4" />
            Conectar WhatsApp
          </Button>
        )}

        {/* LOADING */}
        {status === "loading" && (
          <div className="text-center py-8">
            <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
            <p className="mt-3 text-sm text-muted-foreground">Criando instância e gerando QR Code...</p>
          </div>
        )}

        {/* WAITING QR */}
        {status === "waiting_qr" && (
          <div className="text-center py-8">
            <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
            <p className="mt-3 text-sm text-muted-foreground">Gerando QR Code...</p>
            <p className="mt-1 text-xs text-muted-foreground/70">Isso pode levar alguns segundos</p>
          </div>
        )}

        {/* QR CODE */}
        {status === "qr" && qrCode && (
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2 text-sm font-medium text-foreground">
              <QrCode className="w-4 h-4" />
              Escaneie o QR Code com seu WhatsApp
            </div>
            <div className="bg-white rounded-xl p-3 shadow-lg inline-block">
              <img
                src={qrCode}
                alt="QR Code WhatsApp"
                className="w-64 h-64 object-contain"
              />
            </div>
            <p className="text-xs text-muted-foreground animate-pulse">⏳ Aguardando conexão...</p>
          </div>
        )}

        {/* CONNECTED */}
        {status === "connected" && (
          <div className="space-y-4">
            <div className="bg-success/10 border border-success/30 rounded-xl p-4 text-center">
              <Wifi className="w-8 h-8 text-success mx-auto mb-2" />
              <p className="text-lg font-semibold text-success">WhatsApp Conectado!</p>
              {connection?.profileName && (
                <p className="text-sm text-success/80 mt-1">👤 {connection.profileName}</p>
              )}
              {connection?.phoneNumber && (
                <p className="text-sm text-success/80">📞 {connection.phoneNumber}</p>
              )}
            </div>

            {/* Enviar mensagem de teste */}
            <div className="border border-border rounded-xl p-4 space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2">
                <Send className="w-4 h-4" />
                Enviar mensagem de teste
              </h3>
              <Input
                placeholder="Número (ex: 5511999999999)"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
              />
              <Textarea
                placeholder="Mensagem..."
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                rows={2}
              />
              <Button
                onClick={sendTestMessage}
                disabled={sending || !testPhone}
                className="w-full gap-2"
                variant="secondary"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sending ? "Enviando..." : "Enviar Mensagem"}
              </Button>
            </div>

            {/* Ações */}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 gap-1.5" onClick={checkStatus}>
                <RefreshCw className="w-3.5 h-3.5" />
                Verificar Status
              </Button>
              <Button variant="outline" className="flex-1 gap-1.5 text-warning border-warning/30 hover:bg-warning/10" onClick={disconnect}>
                <WifiOff className="w-3.5 h-3.5" />
                Desconectar
              </Button>
            </div>
            <Button
              variant="outline"
              className="w-full gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={() => setDeleteConfirm(true)}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Deletar Instância (irreversível)
            </Button>
          </div>
        )}

        {/* DISCONNECTED */}
        {status === "disconnected" && (
          <div className="space-y-3 text-center">
            <div className="bg-warning/10 border border-warning/30 rounded-xl p-4">
              <WifiOff className="w-8 h-8 text-warning mx-auto mb-2" />
              <p className="text-warning font-medium">WhatsApp desconectado</p>
              <p className="text-xs text-muted-foreground mt-1">A instância ainda existe. Você pode reconectar ou deletar.</p>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1 gap-1.5" onClick={connect}>
                <RefreshCw className="w-3.5 h-3.5" />
                Reconectar
              </Button>
              <Button
                variant="outline"
                className="flex-1 gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => setDeleteConfirm(true)}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Deletar
              </Button>
            </div>
          </div>
        )}

        {/* ERROR */}
        {status === "error" && (
          <div className="text-center space-y-3">
            <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4">
              <p className="text-destructive font-medium">❌ Erro ao conectar</p>
              <p className="text-xs text-muted-foreground mt-1">Verifique sua conexão e tente novamente</p>
            </div>
            <Button onClick={connect} className="gap-1.5">
              <RefreshCw className="w-3.5 h-3.5" />
              Tentar novamente
            </Button>
          </div>
        )}
      </CardContent>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deletar Instância</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja deletar esta instância permanentemente? Esta ação é irreversível.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteConfirm(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={deleteInstance}>Deletar Permanentemente</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
