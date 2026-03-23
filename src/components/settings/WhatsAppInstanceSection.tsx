import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
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
import {
  Loader2,
  Smartphone,
  CheckCircle2,
  WifiOff,
  RefreshCw,
  Save,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  LogOut,
} from "lucide-react";

interface Props {
  companyId: string | null;
  isOwner?: boolean;
}

export default function WhatsAppInstanceSection({ companyId, isOwner = false }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [hasInstance, setHasInstance] = useState(false);
  const [connected, setConnected] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [instanceName, setInstanceName] = useState("");
  const [profileName, setProfileName] = useState("");
  const [profilePic, setProfilePic] = useState("");
  const [owner, setOwner] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [tokenError, setTokenError] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const fetchStatus = useCallback(
    async (silent = false) => {
      if (!companyId) return;
      if (!silent) setChecking(true);
      try {
        const resp = await supabase.functions.invoke("manage-instance", {
          body: { action: "status", company_id: companyId },
        });
        if (resp.data?.success) {
          setHasInstance(resp.data.has_instance);
          setConnected(resp.data.connected);
          setInstanceName(resp.data.instance_name || "");
          setProfileName(resp.data.profile_name || "");
          setProfilePic(resp.data.profile_pic || "");
          setOwner(resp.data.owner || "");

          if (resp.data.error_detail && resp.data.has_instance && !resp.data.connected && !resp.data.qrcode) {
            setTokenError(true);
            if (!silent) {
              toast({
                title: "Token inválido ou expirado",
                description: "Cole um novo token e clique em 'Salvar e Configurar Webhook'.",
                variant: "destructive",
              });
            }
          } else {
            setTokenError(false);
          }

          if (resp.data.qrcode) {
            const qr = resp.data.qrcode;
            setQrCode(qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`);
            if (!resp.data.connected) setAutoRefresh(true);
          } else {
            setQrCode(null);
            if (resp.data.connected) setAutoRefresh(false);
          }
        }
      } catch (err) {
        console.error("Status check error:", err);
      } finally {
        if (!silent) setChecking(false);
        setLoading(false);
      }
    },
    [companyId]
  );

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    const loadToken = async () => {
      const { data } = await supabase
        .from("api_settings" as any)
        .select("api_token, instance_name")
        .eq("company_id", companyId)
        .maybeSingle();
      if (data) {
        if (isOwner) {
          setTokenInput((data as any).api_token || "");
        } else {
          setTokenInput((data as any).api_token ? "***" : "");
        }
        setInstanceName((data as any).instance_name || "");
      }
      fetchStatus();
    };
    loadToken();
  }, [companyId, fetchStatus]);

  useEffect(() => {
    if (!autoRefresh || connected) return;
    const interval = setInterval(() => fetchStatus(true), 12000);
    return () => clearInterval(interval);
  }, [autoRefresh, connected, fetchStatus]);

  const handleSave = async () => {
    if (!companyId || !tokenInput.trim()) return;
    setSaving(true);
    try {
      const resp = await supabase.functions.invoke("manage-instance", {
        body: {
          action: "save",
          company_id: companyId,
          instance_token: tokenInput.trim(),
          instance_name: instanceName || "instancia",
        },
      });

      if (resp.error) throw new Error(resp.error.message);
      if (resp.data?.error) throw new Error(resp.data.error);

      setHasInstance(true);
      setConnected(resp.data.connected);
      setProfileName(resp.data.profile_name || "");
      setProfilePic(resp.data.profile_pic || "");
      setOwner(resp.data.owner || "");
      setTokenError(false);

      if (resp.data.qrcode) {
        const qr = resp.data.qrcode;
        setQrCode(qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`);
        if (!resp.data.connected) setAutoRefresh(true);
      }

      toast({
        title: "Token salvo com sucesso!",
        description: resp.data.connected
          ? "WhatsApp já está conectado."
          : "Use o QR Code para conectar.",
      });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleCreateInstance = async () => {
    if (!companyId) return;
    setCreating(true);
    setQrCode(null);
    setConnected(false);
    try {
      const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chatbot-webhook?company_id=${companyId}`;

      const { data, error } = await supabase.functions.invoke("whatsapp-connect", {
        body: { userName: instanceName || "Minha Instância", webhookUrl, company_id: companyId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const newToken = data.token;
      if (!newToken) throw new Error("Token não retornado");

      await supabase.functions.invoke("manage-instance", {
        body: {
          action: "save",
          company_id: companyId,
          instance_token: newToken,
          instance_name: instanceName || "Minha Instância",
        },
      });

      setTokenInput(newToken);
      setHasInstance(true);
      setTokenError(false);

      if (data.qrCode) {
        const qr = data.qrCode;
        setQrCode(qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`);
        setAutoRefresh(true);
        setConnected(false);
      } else if (data.status === "connected") {
        setConnected(true);
        setQrCode(null);
      } else {
        setAutoRefresh(true);
        setConnected(false);
        setTimeout(() => fetchStatus(), 3000);
      }

      toast({
        title: "Instância criada com sucesso!",
        description: data.qrCode ? "Escaneie o QR Code para conectar." : "Aguardando QR Code...",
      });
    } catch (err: any) {
      console.error("Erro ao criar instância:", err);
      const rawMsg = err?.message || "Erro desconhecido";
      let userMsg = rawMsg;
      if (rawMsg.includes("401") || rawMsg.includes("Unauthorized") || rawMsg.toLowerCase().includes("token")) {
        userMsg = "🔑 Token de Admin inválido. Verifique o UAZAPI_ADMIN_TOKEN nas configurações.";
      } else if (rawMsg.includes("404")) {
        userMsg = "🔗 Endpoint da API não encontrado. Verifique a URL do servidor.";
      } else if (rawMsg.includes("500") || rawMsg.toLowerCase().includes("fora do ar")) {
        userMsg = "🔴 Servidor de WhatsApp fora do ar. Tente novamente em alguns minutos.";
      } else if (rawMsg.toLowerCase().includes("conexão") || rawMsg.toLowerCase().includes("network")) {
        userMsg = "📡 Erro de conexão com o servidor. Verifique sua internet.";
      }
      toast({ title: "Erro ao criar instância", description: userMsg, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteInstance = async () => {
    if (!companyId) return;
    setDeleting(true);
    setShowDeleteDialog(false);
    try {
      // Disconnect first
      await supabase.functions.invoke("manage-instance", {
        body: { action: "disconnect", company_id: companyId },
      });

      // Clear token from DB
      await supabase.functions.invoke("manage-instance", {
        body: { action: "delete", company_id: companyId },
      });

      setHasInstance(false);
      setConnected(false);
      setQrCode(null);
      setTokenInput("");
      setProfileName("");
      setProfilePic("");
      setOwner("");
      setTokenError(false);
      setAutoRefresh(false);

      toast({ title: "Instância removida", description: "Você pode criar uma nova instância agora." });
    } catch (err: any) {
      toast({ title: "Erro ao remover", description: err?.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!companyId) return;
    setDisconnecting(true);
    try {
      await supabase.functions.invoke("manage-instance", {
        body: { action: "disconnect", company_id: companyId },
      });
      setConnected(false);
      setQrCode(null);
      toast({ title: "WhatsApp desconectado", description: "Clique em 'Verificar Status' para reconectar via QR Code." });
      setTimeout(() => fetchStatus(), 2000);
    } catch (err: any) {
      toast({ title: "Erro ao desconectar", description: err?.message, variant: "destructive" });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleCheckStatus = async () => {
    setChecking(true);
    await fetchStatus();
    setChecking(false);
  };

  if (loading) return null;

  return (
    <div className="glass-card rounded-xl p-6 space-y-6 relative">
      <h2 className="text-lg font-display font-semibold text-foreground flex items-center gap-2">
        <Smartphone className="h-5 w-5 text-primary" />
        Conexão WhatsApp
      </h2>
      <p className="text-muted-foreground text-sm -mt-4">
        {isOwner
          ? "Cole o token da sua instância. O webhook será configurado automaticamente."
          : "Gerencie a conexão da sua instância WhatsApp."}
      </p>

      {/* Token input - visible for owners, masked for Pro admins */}
      {isOwner ? (
        <>
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-foreground">Token da Instância</Label>
            <div className="flex gap-2">
              <Input
                type={showToken ? "text" : "password"}
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Cole o token da instância aqui"
                className="bg-secondary/50 border-border font-mono"
              />
              <Button variant="outline" size="icon" onClick={() => setShowToken(!showToken)}>
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSave} disabled={saving || !tokenInput.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              {saving ? "Salvando..." : "Salvar e Configurar Webhook"}
            </Button>

            <Button variant="secondary" onClick={handleCreateInstance} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              {creating ? "Criando..." : hasInstance ? "➕ Gerar Nova Instância / QR Code" : "Criar Nova Instância"}
            </Button>

            {hasInstance && !connected && (
              <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)} disabled={deleting}>
                {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Remover Instância
              </Button>
            )}

            {hasInstance && connected && (
              <Button variant="destructive" size="sm" onClick={handleDisconnect} disabled={disconnecting}>
                {disconnecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogOut className="h-4 w-4 mr-2" />}
                Desconectar
              </Button>
            )}

            {hasInstance && (
              <Button variant="outline" onClick={handleCheckStatus} disabled={checking}>
                <RefreshCw className={`h-4 w-4 mr-2 ${checking ? "animate-spin" : ""}`} />
                Verificar Status
              </Button>
            )}
          </div>

        </>
      ) : (
        <>
          {/* Pro Admin view: can manage instance but token is masked */}
          {tokenInput && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">Token da Instância</Label>
              <div className="flex gap-2">
                <Input
                  type="password"
                  value="••••••••••••••••••••"
                  readOnly
                  className="bg-secondary/50 border-border font-mono cursor-not-allowed opacity-70"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                🔒 O token está protegido. Apenas o Proprietário pode visualizar ou alterar.
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={handleCreateInstance} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              {creating ? "Criando..." : hasInstance ? "➕ Gerar Nova Instância / QR Code" : "Criar Nova Instância"}
            </Button>

            {hasInstance && !connected && (
              <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)} disabled={deleting}>
                {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Remover Instância
              </Button>
            )}

            {hasInstance && connected && (
              <Button variant="destructive" size="sm" onClick={handleDisconnect} disabled={disconnecting}>
                {disconnecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogOut className="h-4 w-4 mr-2" />}
                Desconectar
              </Button>
            )}

            {hasInstance && (
              <Button variant="outline" onClick={handleCheckStatus} disabled={checking}>
                <RefreshCw className={`h-4 w-4 mr-2 ${checking ? "animate-spin" : ""}`} />
                Verificar Status
              </Button>
            )}
          </div>

        </>
      )}

      {/* Connection status + QR Code */}
      {hasInstance && (
        <div className="space-y-4 pt-4 border-t border-border/30">
          {connected ? (
            <div className="flex flex-col items-center gap-3 py-6">
              {profilePic ? (
                <img src={profilePic} alt="Profile" className="w-16 h-16 rounded-full border-2 border-primary/30" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                </div>
              )}
              <div className="text-center">
                <p className="text-emerald-400 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  WhatsApp Conectado!
                </p>
                {profileName && <p className="text-sm text-foreground mt-1">{profileName}</p>}
                {owner && <p className="text-xs text-muted-foreground">+{owner}</p>}
              </div>
              <p className="text-muted-foreground text-xs text-center">
                Sua instância está ativa e pronta para enviar/receber mensagens.
              </p>
            </div>
          ) : qrCode ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="bg-white rounded-xl p-3 shadow-lg">
                <img src={qrCode} alt="QR Code WhatsApp" className="w-64 h-64 object-contain" />
              </div>
              <p className="text-muted-foreground text-xs text-center max-w-sm">
                Abra o <strong>WhatsApp</strong> no celular → <strong>Aparelhos conectados</strong> →{" "}
                <strong>Conectar um aparelho</strong> → Escaneie o QR Code acima.
              </p>
              <p className="text-muted-foreground/50 text-[10px] flex items-center gap-1">
                <RefreshCw className="w-3 h-3 animate-spin" /> Atualizando automaticamente...
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="w-12 h-12 rounded-full bg-warning/15 flex items-center justify-center">
                <WifiOff className="w-6 h-6 text-warning" />
              </div>
              <p className="text-warning text-sm font-medium">
                {tokenError ? "Token inválido ou expirado" : "Instância desconectada"}
              </p>
              <p className="text-muted-foreground text-xs text-center">
                {tokenError
                  ? "O token salvo não é mais válido. Cole um novo token acima e clique em 'Salvar e Configurar Webhook'."
                  : "Clique em \"Verificar Status\" para gerar o QR Code."}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover instância?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso removerá sua conexão atual com o WhatsApp. Você precisará criar uma nova instância e escanear o QR Code novamente. Tem certeza que deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteInstance} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sim, remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
