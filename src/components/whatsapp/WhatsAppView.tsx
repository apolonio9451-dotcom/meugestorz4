import { useState, useEffect, useCallback, useRef } from "react";
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
  Wifi,
  WifiOff,
  Trash2,
  RefreshCw,
  Loader2,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Save,
  Key,
  User,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type InstanceStatus = "created" | "connecting" | "connected" | "disconnected" | "error";

function formatPhoneNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) {
    const ddd = digits.slice(2, 4);
    const number = digits.slice(4);
    const part1 = number.slice(0, number.length - 4);
    const part2 = number.slice(-4);
    return `+55 ${ddd} ${part1}-${part2}`;
  }
  return `+${digits}`;
}

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
  const [apiValidationError, setApiValidationError] = useState<string | null>(null);

  // Token fields
  const { effectiveCompanyId: companyId, user } = useAuth();
  const [apiUrl, setApiUrl] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [savingToken, setSavingToken] = useState(false);
  const [tokenLoaded, setTokenLoaded] = useState(false);
  const [existingSettingsId, setExistingSettingsId] = useState<string | null>(null);

  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [profilePhone, setProfilePhone] = useState<string | null>(null);

  const pollingRef = useRef<number | null>(null);
  const lockRef = useRef(false);

  const toSafeErrorMessage = (value: unknown): string => {
    if (typeof value === "string" && value.trim().length > 0) return value;
    if (value && typeof value === "object") {
      const maybe = (value as any).message || (value as any).error || (value as any).detail;
      if (typeof maybe === "string" && maybe.trim().length > 0) return maybe;
      try {
        return JSON.stringify(value);
      } catch {
        return "Erro inesperado";
      }
    }
    return "Erro inesperado";
  };

  // Load existing token
  useEffect(() => {
    if (!companyId) return;
    const load = async () => {
      const { data } = await supabase
        .from("api_settings" as any)
        .select("id, api_url, api_token")
        .eq("company_id", companyId)
        .maybeSingle();
      if (data) {
        setApiUrl((data as any).api_url || "");
        setApiToken((data as any).api_token || "");
        setExistingSettingsId((data as any).id);
      }
      setTokenLoaded(true);
    };
    load();
  }, [companyId]);

  const handleSaveToken = async () => {
    if (!companyId) return;
    setSavingToken(true);
    try {
      const payload = {
        company_id: companyId,
        api_url: apiUrl.trim().replace(/\/$/, ""),
        api_token: apiToken.trim(),
      };
      let error;
      if (existingSettingsId) {
        ({ error } = await supabase.from("api_settings" as any).update(payload).eq("id", existingSettingsId));
      } else {
        const { data, error: e } = await supabase.from("api_settings" as any).insert(payload).select().single();
        error = e;
        if (data) setExistingSettingsId((data as any).id);
      }
      if (error) throw error;

      // Reset error queue
      await supabase.functions.invoke("auto-send-messages", {
        body: { action: "reset-error-queue", companyId },
      });

      toast.success("Token salvo com sucesso! Fila de erros resetada.");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar token");
    } finally {
      setSavingToken(false);
    }
  };

  const clearLocalReconnectState = useCallback(() => {
    setApiValidationError(null);
    setQrCode(null);
    setPolling(false);
    setProfilePic(null);
    setProfileName(null);
    setProfilePhone(null);
    try {
      localStorage.removeItem("auth_cache");
    } catch {
      // ignore local cache cleanup failures
    }
  }, []);

  const callManage = useCallback(async (action: string, options?: { forceNew?: boolean }) => {
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-manage", {
        body: {
          action,
          force_new: options?.forceNew === true,
          company_id: companyId,
        },
      });

      if (error) {
        const details = (error as any)?.context || (error as any)?.details || error.message;
        const safeMessage = toSafeErrorMessage(details) || toSafeErrorMessage(error.message) || `Erro ao executar ${action}`;
        console.error(`[WhatsApp] Error calling ${action}:`, details);
        toast.error(safeMessage);
        return null;
      }

      if (data?.error) {
        const safeMessage = toSafeErrorMessage((data as any).detail) || toSafeErrorMessage((data as any).error) || `Erro ao executar ${action}`;
        console.error(`[WhatsApp] Backend error for ${action}:`, data);
        toast.error(safeMessage);
        return null;
      }

      return data;
    } catch (err: any) {
      const safeMessage = toSafeErrorMessage(err?.message) || `Erro ao executar ${action}`;
      console.error(`[WhatsApp] Unexpected error:`, err);
      toast.error(safeMessage);
      return null;
    }
  }, [companyId]);

  const fetchProfilePicture = useCallback(async () => {
    const data = await callManage("profile-picture");
    if (data?.profile_picture) setProfilePic(data.profile_picture);
    if (data?.profile_name) setProfileName(data.profile_name);
    if (data?.phone) setProfilePhone(data.phone);
  }, [callManage]);

  const fetchQrCode = useCallback(async () => {
    setActionLoading("qrcode");
    setQrCode(null); // Clear old QR while loading
    const data = await callManage("qrcode");

    if (data?.connected) {
      setInstance((prev) =>
        prev ? { ...prev, is_connected: true, status: "connected" } : null
      );
      setQrCode(null);
      fetchProfilePicture();
      toast.success("WhatsApp já está conectado!");
    } else if (data?.qrcode) {
      setQrCode(data.qrcode);
      setPolling(true);
    } else {
      toast.error("Não foi possível gerar o QR Code. Verifique se o Token Admin está correto nas configurações.");
    }

    setActionLoading(null);
  }, [callManage, fetchProfilePicture]);

  const handleReconnect = useCallback(async () => {
    setActionLoading("reconnect");
    clearLocalReconnectState();

    const data = await callManage("reconnect");

    if (data?.connected) {
      setInstance((prev) =>
        prev ? { ...prev, is_connected: true, status: "connected" } : prev
      );
      await fetchProfilePicture();
      toast.success("Instância validada e re-sincronizada.");
    } else if (data?.qrcode) {
      setInstance((prev) =>
        prev ? { ...prev, is_connected: false, status: "connecting" } : prev
      );
      setQrCode(data.qrcode);
      setPolling(true);
      toast.success("Escaneie o QR Code para reconectar a instância.");
    }

    setActionLoading(null);
  }, [callManage, clearLocalReconnectState, fetchProfilePicture]);

  const loadInstance = useCallback(
    async (options?: { forceNew?: boolean; clearCache?: boolean }) => {
      if (lockRef.current) return;
      lockRef.current = true;
      setLoading(true);

      if (options?.clearCache) {
        setInstance(null);
        setQrCode(null);
        setPolling(false);
      }

      const data = await callManage("get-or-create", { forceNew: options?.forceNew });

      if (data?.instance) {
        setInstance(data.instance);
        setApiValidationError(null);
        if (data.is_new) {
          toast.success("Instância WhatsApp inicializada!");
        }
        // Trust DB status directly — no validate-connection override
        if (data.instance.is_connected) {
          fetchProfilePicture();
        } else {
          await fetchQrCode();
        }
      }

      setLoading(false);
      lockRef.current = false;
    },
    [callManage, fetchQrCode, fetchProfilePicture]
  );

  const handleDisconnect = async () => {
    setActionLoading("disconnect");
    const data = await callManage("disconnect");
    if (data?.success) {
      setInstance((prev) =>
        prev ? { ...prev, is_connected: false, status: "disconnected" } : null
      );
      setQrCode(null);
      setPolling(false);
      setProfilePic(null);
      setProfileName(null);
      setProfilePhone(null);
      toast.success("WhatsApp desconectado.");
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
        fetchProfilePicture();
      }
    }
  }, [callManage, fetchProfilePicture]);

  // Realtime subscription for instant status updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`whatsapp-instance-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_instances',
          filter: `user_id=eq.${user.id}`,
        },
        (payload: any) => {
          const row = payload.new;
          if (row) {
            setInstance(prev => prev ? {
              ...prev,
              is_connected: row.is_connected === true,
              status: row.status || prev.status,
            } : prev);
            if (row.is_connected && row.status === 'connected') {
              setPolling(false);
              setQrCode(null);
              fetchProfilePicture();
            }
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, fetchProfilePicture]);

  useEffect(() => {
    // Apenas carrega se não houver instância ou se estiver tentando sincronizar pela primeira vez
    if (!instance) {
      loadInstance();
    }
  }, [loadInstance]);

  useEffect(() => {
    if (!polling || !instance || instance.is_connected) return;

    pollingRef.current = window.setInterval(() => {
      checkStatus();
    }, 10000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [polling, instance, checkStatus]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">
          Carregando configurações do WhatsApp...
        </p>
      </div>
    );
  }

  const getStatusBadge = () => {
    if (!instance)
      return <Badge variant="outline">Nenhuma instância</Badge>;
    if (instance.is_connected)
      return <Badge className="bg-emerald-600 hover:bg-emerald-600/80 text-white">Conectado</Badge>;
    if (instance.status === "disconnected")
      return <Badge variant="destructive">Desconectado</Badge>;
    return (
      <Badge variant="secondary" className="animate-pulse">
        Aguardando Conexão
      </Badge>
    );
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* WhatsApp Instance Card */}
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
        <CardContent className="space-y-6 pt-6">
          {!instance ? (
            <div className="text-center py-8 space-y-4">
              <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto" />
              <p className="text-muted-foreground">
                Ocorreu um erro ao carregar sua instância.
              </p>
              <Button onClick={() => loadInstance({ clearCache: true, forceNew: true })}>
                Tentar Novamente
              </Button>
            </div>
          ) : instance.is_connected ? (
            <div className="space-y-6">
              {apiValidationError && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-center">
                  <p className="text-sm text-destructive font-medium">{apiValidationError}</p>
                </div>
              )}
              <div className="bg-emerald-500/10 border-2 border-emerald-500/40 rounded-xl p-6 text-center space-y-4">
                <div className="flex flex-col items-center gap-3">
                  <div className="relative">
                    <Avatar className="w-24 h-24 border-[3px] border-emerald-500 shadow-lg shadow-emerald-500/20">
                      {profilePic ? (
                        <AvatarImage src={profilePic} alt="WhatsApp Profile" />
                      ) : null}
                      <AvatarFallback className="bg-emerald-500/20 text-emerald-600">
                        <User className="w-10 h-10" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center border-2 border-background">
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    </div>
                  </div>
                </div>

                {profileName && (
                  <h3 className="text-xl font-bold text-foreground">{profileName}</h3>
                )}

                {profilePhone && (
                  <p className="text-lg font-mono font-semibold text-emerald-500 tracking-wide">
                    {formatPhoneNumber(profilePhone.replace(/@.*/, ""))}
                  </p>
                )}

                <div className="text-sm text-muted-foreground space-y-0.5">
                  <p>
                    <strong className="text-foreground/80">Dispositivo:</strong> {instance.device_name}
                  </p>
                  <p className="flex items-center justify-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Ativo e pronto para uso
                  </p>
                  {instance.last_connection_at && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Última atividade:{" "}
                      {new Date(instance.last_connection_at).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Button
                  variant="secondary"
                  className="w-full gap-2"
                  onClick={handleReconnect}
                  disabled={!!actionLoading}
                >
                  {actionLoading === "reconnect" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Reconectar Instância
                </Button>
                <Button
                  variant="outline"
                  className="w-full gap-2 text-amber-500 hover:bg-amber-500/10 border-amber-500/30"
                  onClick={handleDisconnect}
                  disabled={!!actionLoading}
                >
                  {actionLoading === "disconnect" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <WifiOff className="w-4 h-4" />
                  )}
                  Desconectar Temporariamente
                </Button>
                <Button
                  variant="outline"
                  className="w-full gap-2 text-destructive hover:bg-destructive/10 border-destructive/30"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={!!actionLoading}
                >
                  {actionLoading === "delete" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
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
                      Abra o WhatsApp no seu celular {">"} Dispositivos
                      Conectados {">"} Conectar um dispositivo.
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
                      <RefreshCw
                        className={`w-3 h-3 ${actionLoading === "qrcode" ? "animate-spin" : ""}`}
                      />
                      Gerar novo código
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-12 space-y-4">
                  <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
                  <p className="text-muted-foreground">
                    Gerando conexão segura com a API...
                  </p>
                </div>
              )}

              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={handleReconnect}
                disabled={!!actionLoading}
              >
                {actionLoading === "reconnect" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Reconectar Instância
              </Button>

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
              Esta ação irá excluir permanentemente sua instância do WhatsApp nos
              nossos servidores e na API. Você precisará escanear um novo QR Code
              para conectar novamente.
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
