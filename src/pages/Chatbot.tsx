import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Bot, Save, Loader2, Upload, Trash2, Clock, Music, Video,
  MessageCircle, User, ShieldCheck, AlertCircle, RefreshCw,
  FileAudio, FileVideo
} from "lucide-react";
import { format } from "date-fns";

export default function Chatbot() {
  const { companyId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Settings
  const [isActive, setIsActive] = useState(false);
  const [personality, setPersonality] = useState("");
  const [billingHour, setBillingHour] = useState(8);
  const [billingMinute, setBillingMinute] = useState(0);
  const [settingsId, setSettingsId] = useState<string | null>(null);

  // Media
  const [mediaFiles, setMediaFiles] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Logs
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  useEffect(() => {
    if (!companyId) { setLoading(false); return; }
    fetchAll();
  }, [companyId]);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchSettings(), fetchMedia(), fetchLogs()]);
    setLoading(false);
  };

  const fetchSettings = async () => {
    const { data } = await supabase
      .from("chatbot_settings" as any)
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle();
    if (data) {
      const d = data as any;
      setIsActive(d.is_active);
      setPersonality(d.personality || "");
      setBillingHour(d.billing_cron_hour ?? 8);
      setBillingMinute(d.billing_cron_minute ?? 0);
      setSettingsId(d.id);
    }
  };

  const fetchMedia = async () => {
    const { data } = await supabase
      .from("chatbot_media" as any)
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (data) setMediaFiles(data as any[]);
  };

  const fetchLogs = async () => {
    setLogsLoading(true);
    const { data } = await supabase
      .from("chatbot_logs" as any)
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setLogs(data as any[]);
    setLogsLoading(false);
  };

  const handleSaveSettings = async () => {
    if (!companyId) return;
    setSaving(true);
    try {
      const payload = {
        company_id: companyId,
        is_active: isActive,
        personality: personality.trim(),
        billing_cron_hour: billingHour,
        billing_cron_minute: billingMinute,
      };
      let error;
      if (settingsId) {
        ({ error } = await supabase.from("chatbot_settings" as any).update(payload).eq("id", settingsId));
      } else {
        const { data, error: e } = await supabase.from("chatbot_settings" as any).insert(payload).select().single();
        error = e;
        if (data) setSettingsId((data as any).id);
      }
      if (error) throw error;
      toast({ title: "Configurações do Chatbot salvas!" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleUploadMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !companyId) return;

    const isAudio = file.type.startsWith("audio/");
    const isVideo = file.type.startsWith("video/");
    if (!isAudio && !isVideo) {
      toast({ title: "Formato inválido", description: "Apenas MP3 e MP4 são permitidos.", variant: "destructive" });
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Máximo de 50MB.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${companyId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("chatbot-media").upload(path, file);
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("chatbot-media").getPublicUrl(path);

      const { error: dbError } = await supabase.from("chatbot_media" as any).insert({
        company_id: companyId,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_type: isAudio ? "audio" : "video",
        file_size: file.size,
      });
      if (dbError) throw dbError;

      toast({ title: "Mídia enviada com sucesso!" });
      fetchMedia();
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err?.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteMedia = async (media: any) => {
    try {
      // Extract path from URL
      const urlParts = media.file_url.split("/chatbot-media/");
      if (urlParts[1]) {
        await supabase.storage.from("chatbot-media").remove([urlParts[1]]);
      }
      const { error } = await supabase.from("chatbot_media" as any).delete().eq("id", media.id);
      if (error) throw error;
      toast({ title: "Mídia removida!" });
      fetchMedia();
    } catch (err: any) {
      toast({ title: "Erro ao remover", description: err?.message, variant: "destructive" });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-3">
            <Bot className="w-7 h-7 text-primary" />
            Chatbot IA
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configure o atendimento automático inteligente via WhatsApp.
          </p>
        </div>
        <Badge variant={isActive ? "default" : "secondary"} className="text-sm px-3 py-1">
          {isActive ? "Ativo" : "Desativado"}
        </Badge>
      </div>

      {/* Status & Personality */}
      <div className="glass-card rounded-xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-display font-semibold text-foreground flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Status do Bot
            </h2>
            <p className="text-muted-foreground text-xs mt-1">Ative ou desative o atendimento automático.</p>
          </div>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-primary" />
            Personalidade do Bot
          </Label>
          <Textarea
            value={personality}
            onChange={(e) => setPersonality(e.target.value)}
            placeholder={`Ex: "Você é o assistente virtual do Meu Gestor. Seja educado, objetivo e profissional. Seu nome é Ana. Sempre ofereça ajuda proativa e tente converter novos contatos em clientes."`}
            className="bg-secondary/50 border-border min-h-[160px] text-sm"
          />
          <p className="text-muted-foreground text-xs">
            Defina o tom de voz, nome, regras de conduta e instruções específicas. Este texto será usado como instrução de sistema para a IA.
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Horário de Cobrança Automática
          </Label>
          <Input
            type="time"
            value={`${String(billingHour).padStart(2, "0")}:${String(billingMinute).padStart(2, "0")}`}
            onChange={(e) => {
              const [h, m] = e.target.value.split(":").map(Number);
              if (!isNaN(h)) setBillingHour(h);
              if (!isNaN(m)) setBillingMinute(m);
            }}
            className="bg-secondary/50 border-border w-40"
          />
          <p className="text-muted-foreground text-xs">
            Horário exato (HH:mm) para disparo automático de cobranças (horário de Brasília).
          </p>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSaveSettings} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar Configurações
          </Button>
        </div>
      </div>

      {/* Media Management */}
      <div className="glass-card rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-display font-semibold text-foreground flex items-center gap-2">
              <Music className="w-5 h-5 text-primary" />
              Gestão de Mídia
            </h2>
            <p className="text-muted-foreground text-xs mt-1">
              Envie áudios (.mp3) e vídeos (.mp4) que o bot poderá usar nas respostas.
            </p>
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".mp3,.mp4,audio/mpeg,video/mp4"
              className="hidden"
              onChange={handleUploadMedia}
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              Upload
            </Button>
          </div>
        </div>

        {mediaFiles.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <Video className="w-10 h-10 mx-auto mb-2 opacity-40" />
            Nenhuma mídia enviada ainda.
          </div>
        ) : (
          <div className="space-y-2">
            {mediaFiles.map((media) => (
              <div key={media.id} className="flex items-center justify-between bg-secondary/30 rounded-lg px-4 py-3 border border-border/50">
                <div className="flex items-center gap-3 min-w-0">
                  {media.file_type === "audio" ? (
                    <FileAudio className="w-5 h-5 text-primary shrink-0" />
                  ) : (
                    <FileVideo className="w-5 h-5 text-primary shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{media.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {media.file_type === "audio" ? "Áudio" : "Vídeo"} • {formatFileSize(media.file_size)}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDeleteMedia(media)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Logs */}
      <div className="glass-card rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-display font-semibold text-foreground flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-primary" />
            Histórico de Atendimentos
          </h2>
          <Button variant="ghost" size="sm" onClick={fetchLogs} disabled={logsLoading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${logsLoading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <Bot className="w-10 h-10 mx-auto mb-2 opacity-40" />
            Nenhum atendimento registrado ainda.
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {logs.map((log) => (
              <div key={log.id} className="bg-secondary/30 rounded-lg px-4 py-3 border border-border/50 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">{log.client_name}</span>
                    <Badge variant={log.context_type === "client" ? "default" : "secondary"} className="text-[10px]">
                      {log.context_type === "client" ? "Cliente" : "Novo Contato"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {log.status === "error" && <AlertCircle className="w-4 h-4 text-destructive" />}
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(log.created_at), "dd/MM HH:mm")}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  <div className="bg-background/50 rounded p-2">
                    <span className="text-muted-foreground block mb-0.5">Recebido:</span>
                    <span className="text-foreground">{log.message_received?.slice(0, 120)}{log.message_received?.length > 120 ? "..." : ""}</span>
                  </div>
                  <div className="bg-background/50 rounded p-2">
                    <span className="text-muted-foreground block mb-0.5">Resposta:</span>
                    <span className="text-foreground">{log.message_sent?.slice(0, 120)}{log.message_sent?.length > 120 ? "..." : ""}</span>
                  </div>
                </div>
                {log.error_message && (
                  <p className="text-xs text-destructive">{log.error_message}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
