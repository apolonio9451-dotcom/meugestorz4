import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Smartphone, 
  Wifi, 
  WifiOff, 
  Trash2, 
  RefreshCw, 
  Loader2, 
  QrCode,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog";

type InstanceStatus = "created" | "connecting" | "connected" | "disconnected" | "error";

interface WhatsAppInstance {
  id: string;
  instance_name: string;
  device_name: string;
  status: InstanceStatus;
  is_connected: boolean;
  last_connection_at?: string;
}

export default function WhatsAppView() {
  const [instance, setInstance] = useState<WhatsAppInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  const pollingRef = useRef<number | null>(null);
  const lockRef = useRef(false);

  const callManage = useCallback(async (action: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-manage", {
        body: { action }
      });
      if (error) throw error;
      return data;
    } catch (err: any) {
      console.error(`[WhatsApp] Error calling ${action}:`, err);
      toast.error(err.message || `Erro ao executar ${action}`);
      return null;
    }
  }, []);

  const loadInstance = useCallback(async () => {
    if (lockRef.current) return;
    lockRef.current = true;
    setLoading(true);
    
    const data = await callManage("get-or-create");
    if (data?.instance) {
      setInstance(data.instance);
      if (data.is_new) {
        toast.success("Instância WhatsApp inicializada!");
      }
      
      if (!data.instance.is_connected) {
        fetchQrCode();
      }
    }
    
    setLoading(false);
    lockRef.current = false;
  }, [callManage]);

  const fetchQrCode = useCallback(async () => {
    setActionLoading("qrcode");
    const data = await callManage("qrcode");
    if (data?.connected) {
      setInstance(prev => prev ? { ...prev, is_connected: true, status: "connected" } : null);
      setQrCode(null);
      toast.success("WhatsApp já está conectado!");
    } else if (data?.qrcode) {
      setQrCode(data.qrcode);
      setPolling(true);
    }
    setActionLoading(null);
  }, [callManage]);

  const handleDisconnect = async () => {
    setActionLoading("disconnect");
    const data = await callManage("disconnect");
    if (data?.success) {
      setInstance(prev => prev ? { ...prev, is_connected: false, status: "disconnected" } : null);
      setQrCode(null);
      setPolling(false);
      toast.success("WhatsApp desconectado.");
      // Reinicia fluxo para pegar novo QR
      fetchQrCode();
    }
    setActionLoading(null);
  };

  const handleDelete = async () => {
    setActionLoading("delete");
    const data = await callManage("delete");
    if (data?.deleted) {
      setInstance(null);
      setQrCode(null);
      setPolling(false);
      toast.success("Instância removida permanentemente.");
    }
    setActionLoading(null);
    setShowDeleteDialog(false);
  };

  const checkStatus = useCallback(async () => {
    const data = await callManage("get-or-create");
    if (data?.instance) {
      setInstance(data.instance);
      if (data.instance.is_connected) {
        setPolling(false);
        setQrCode(null);
        toast.success("WhatsApp conectado!");
      }
    }
  }, [callManage]);

  // Initial load
  useEffect(() => {
    loadInstance();
  }, [loadInstance]);

  // Polling logic
  useEffect(() => {
    if (!polling || !instance || instance.is_connected) return;

    pollingRef.current = window.setInterval(() => {
      checkStatus();
    }, 15000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [polling, instance, checkStatus]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Carregando configurações do WhatsApp...</p>
      </div>
    );
  }

  const getStatusBadge = () => {
    if (!instance) return <Badge variant="outline">Nenhuma instância</Badge>;
    if (instance.is_connected) return <Badge className="bg-success hover:bg-success/80">Conectado</Badge>;
    if (instance.status === "disconnected") return <Badge variant="destructive">Desconectado</Badge>;
    return <Badge variant="secondary" className="animate-pulse">Aguardando Conexão</Badge>;
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-primary" />
                Gerenciamento WhatsApp
              </CardTitle>
              <CardDescription>
                Conecte sua conta para automatizar mensagens e atendimentos.
              </CardDescription>
            </div>
            {getStatusBadge()}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {!instance ? (
            <div className="text-center py-8 space-y-4">
              <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto" />
              <p className="text-muted-foreground">Ocorreu um erro ao carregar sua instância.</p>
              <Button onClick={() => loadInstance()}>Tentar Novamente</Button>
            </div>
          ) : instance.is_connected ? (
            <div className="space-y-6">
              <div className="bg-success/10 border border-success/30 rounded-xl p-6 text-center space-y-3">
                <Wifi className="w-12 h-12 text-success mx-auto" />
                <h3 className="text-xl font-bold text-success">Conectado com Sucesso!</h3>
                <div className="text-sm text-foreground/80 space-y-1">
                  <p><strong>Dispositivo:</strong> {instance.device_name}</p>
                  <p><strong>Status:</strong> Ativo e pronto para uso</p>
                  {instance.last_connection_at && (
                    <p className="text-xs text-muted-foreground">
                      Última atividade: {new Date(instance.last_connection_at).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Button 
                  variant="outline" 
                  className="w-full gap-2 text-warning hover:bg-warning/10 border-warning/30"
                  onClick={handleDisconnect}
                  disabled={!!actionLoading}
                >
                  {actionLoading === "disconnect" ? <Loader2 className="w-4 h-4 animate-spin" /> : <WifiOff className="w-4 h-4" />}
                  Desconectar Temporariamente
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full gap-2 text-destructive hover:bg-destructive/10 border-destructive/30"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={!!actionLoading}
                >
                  {actionLoading === "delete" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Remover Instância Permanentemente
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-6 py-4">
              {qrCode ? (
                <>
                  <div className="text-center space-y-2">
                    <h3 className="font-semibold flex items-center justify-center gap-2">
                      <QrCode className="w-5 h-5" />
                      Escaneie o QR Code abaixo
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Abra o WhatsApp no seu celular {">"} Dispositivos Conectados {">"} Conectar um dispositivo.
                    </p>
                  </div>
                  
                  <div className="bg-white p-4 rounded-2xl shadow-xl border border-border/50">
                    <img 
                      src={qrCode} 
                      alt="WhatsApp QR Code" 
                      className="w-64 h-64 object-contain"
                    />
                  </div>
                  
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-xs text-muted-foreground flex items-center gap-2 animate-pulse">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Aguardando leitura do código...
                    </p>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs gap-2"
                      onClick={fetchQrCode}
                      disabled={!!actionLoading}
                    >
                      <RefreshCw className={`w-3 h-3 ${actionLoading === "qrcode" ? "animate-spin" : ""}`} />
                      Gerar novo código
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 space-y-4">
                  <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
                  <p className="text-muted-foreground">Gerando conexão segura com a API...</p>
                </div>
              )}

              <Button 
                variant="ghost" 
                className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs gap-1"
                onClick={() => setShowDeleteDialog(true)}
                disabled={!!actionLoading}
              >
                <Trash2 className="w-3 h-3" />
                Cancelar e remover instância
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza absoluta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá excluir permanentemente sua instância do WhatsApp nos nossos servidores e na API. 
              Você precisará escanear um novo QR Code para conectar novamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sim, remover instância
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
