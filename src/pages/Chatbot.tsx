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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Bot, Save, Loader2, Upload, Trash2, Clock, Music, Video,
  MessageCircle, User, ShieldCheck, AlertCircle, RefreshCw,
  FileAudio, FileVideo, Settings2, Zap, Ban, ArrowRightLeft,
  Plus, Power, Brain, Timer, Phone, Calendar, Send,
  MessageSquare, Shield, Pencil, ToggleLeft
} from "lucide-react";
import { format } from "date-fns";

const DAYS_OF_WEEK = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
];

const AI_MODELS = [
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (Rápido)" },
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (Qualidade)" },
  { value: "openai/gpt-5-mini", label: "GPT-5 Mini (Equilibrado)" },
  { value: "openai/gpt-5", label: "GPT-5 (Premium)" },
];

export default function Chatbot() {
  const { companyId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Settings
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [personality, setPersonality] = useState("");
  const [billingHour, setBillingHour] = useState(8);
  const [billingMinute, setBillingMinute] = useState(0);
  const [welcomeMessage, setWelcomeMessage] = useState("");
  const [awayMessage, setAwayMessage] = useState("");
  const [businessHoursEnabled, setBusinessHoursEnabled] = useState(false);
  const [businessHoursStart, setBusinessHoursStart] = useState("08:00");
  const [businessHoursEnd, setBusinessHoursEnd] = useState("18:00");
  const [businessDays, setBusinessDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [minDelay, setMinDelay] = useState(3);
  const [maxDelay, setMaxDelay] = useState(6);
  const [transferKeyword, setTransferKeyword] = useState("atendente");
  const [transferMessage, setTransferMessage] = useState("");
  const [transferPhone, setTransferPhone] = useState("");
  const [maxMessagesPerContact, setMaxMessagesPerContact] = useState(0);
  const [unknownMessage, setUnknownMessage] = useState("");
  const [closingMessage, setClosingMessage] = useState("");
  const [aiModel, setAiModel] = useState("google/gemini-2.5-flash");
  const [aiTemperature, setAiTemperature] = useState(0.7);

  // Auto replies
  const [autoReplies, setAutoReplies] = useState<any[]>([]);
  const [showAddReply, setShowAddReply] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");
  const [newTriggerType, setNewTriggerType] = useState("contains");
  const [newResponseText, setNewResponseText] = useState("");
  const [editingReply, setEditingReply] = useState<string | null>(null);

  // Blocked contacts
  const [blockedContacts, setBlockedContacts] = useState<any[]>([]);
  const [newBlockPhone, setNewBlockPhone] = useState("");
  const [newBlockReason, setNewBlockReason] = useState("");

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
    await Promise.all([fetchSettings(), fetchMedia(), fetchLogs(), fetchAutoReplies(), fetchBlockedContacts()]);
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
      setWelcomeMessage(d.welcome_message || "");
      setAwayMessage(d.away_message || "");
      setBusinessHoursEnabled(d.business_hours_enabled ?? false);
      setBusinessHoursStart(d.business_hours_start || "08:00");
      setBusinessHoursEnd(d.business_hours_end || "18:00");
      setBusinessDays(d.business_days || [1, 2, 3, 4, 5]);
      setMinDelay(d.min_delay_seconds ?? 3);
      setMaxDelay(d.max_delay_seconds ?? 6);
      setTransferKeyword(d.transfer_keyword || "atendente");
      setTransferMessage(d.transfer_message || "");
      setTransferPhone(d.transfer_phone || "");
      setMaxMessagesPerContact(d.max_messages_per_contact ?? 0);
      setUnknownMessage(d.unknown_message || "");
      setClosingMessage(d.closing_message || "");
      setAiModel(d.ai_model || "google/gemini-2.5-flash");
      setAiTemperature(d.ai_temperature ?? 0.7);
      setSettingsId(d.id);
    }
  };

  const fetchAutoReplies = async () => {
    const { data } = await supabase
      .from("chatbot_auto_replies" as any)
      .select("*")
      .eq("company_id", companyId)
      .order("priority", { ascending: false });
    if (data) setAutoReplies(data as any[]);
  };

  const fetchBlockedContacts = async () => {
    const { data } = await supabase
      .from("chatbot_blocked_contacts" as any)
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (data) setBlockedContacts(data as any[]);
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
      const payload: any = {
        company_id: companyId,
        is_active: isActive,
        personality: personality.trim(),
        billing_cron_hour: billingHour,
        billing_cron_minute: billingMinute,
        welcome_message: welcomeMessage.trim(),
        away_message: awayMessage.trim(),
        business_hours_enabled: businessHoursEnabled,
        business_hours_start: businessHoursStart,
        business_hours_end: businessHoursEnd,
        business_days: businessDays,
        min_delay_seconds: minDelay,
        max_delay_seconds: maxDelay,
        transfer_keyword: transferKeyword.trim(),
        transfer_message: transferMessage.trim(),
        transfer_phone: transferPhone.trim(),
        max_messages_per_contact: maxMessagesPerContact,
        unknown_message: unknownMessage.trim(),
        closing_message: closingMessage.trim(),
        ai_model: aiModel,
        ai_temperature: aiTemperature,
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
      toast({ title: "Configurações salvas com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleAddAutoReply = async () => {
    if (!companyId || !newKeyword.trim()) return;
    try {
      const { error } = await supabase.from("chatbot_auto_replies" as any).insert({
        company_id: companyId,
        trigger_keyword: newKeyword.trim(),
        trigger_type: newTriggerType,
        response_text: newResponseText.trim(),
        priority: autoReplies.length,
      });
      if (error) throw error;
      toast({ title: "Resposta automática adicionada!" });
      setNewKeyword("");
      setNewResponseText("");
      setShowAddReply(false);
      fetchAutoReplies();
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message, variant: "destructive" });
    }
  };

  const handleToggleReply = async (reply: any) => {
    try {
      const { error } = await supabase.from("chatbot_auto_replies" as any)
        .update({ is_active: !reply.is_active })
        .eq("id", reply.id);
      if (error) throw error;
      fetchAutoReplies();
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message, variant: "destructive" });
    }
  };

  const handleDeleteReply = async (id: string) => {
    try {
      const { error } = await supabase.from("chatbot_auto_replies" as any).delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Resposta removida!" });
      fetchAutoReplies();
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message, variant: "destructive" });
    }
  };

  const handleUpdateReply = async (reply: any, field: string, value: string) => {
    try {
      const { error } = await supabase.from("chatbot_auto_replies" as any)
        .update({ [field]: value })
        .eq("id", reply.id);
      if (error) throw error;
      fetchAutoReplies();
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message, variant: "destructive" });
    }
  };

  const handleAddBlockedContact = async () => {
    if (!companyId || !newBlockPhone.trim()) return;
    try {
      const { error } = await supabase.from("chatbot_blocked_contacts" as any).insert({
        company_id: companyId,
        phone: newBlockPhone.trim().replace(/\D/g, ""),
        reason: newBlockReason.trim(),
      });
      if (error) throw error;
      toast({ title: "Contato bloqueado!" });
      setNewBlockPhone("");
      setNewBlockReason("");
      fetchBlockedContacts();
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message, variant: "destructive" });
    }
  };

  const handleRemoveBlocked = async (id: string) => {
    try {
      const { error } = await supabase.from("chatbot_blocked_contacts" as any).delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Contato desbloqueado!" });
      fetchBlockedContacts();
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message, variant: "destructive" });
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
      const urlParts = media.file_url.split("/chatbot-media/");
      if (urlParts[1]) await supabase.storage.from("chatbot-media").remove([urlParts[1]]);
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

  const toggleDay = (day: number) => {
    setBusinessDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-3">
            <Bot className="w-7 h-7 text-primary" />
            Chatbot IA
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configure o atendimento automático inteligente via WhatsApp com todos os recursos da API.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={isActive ? "default" : "secondary"} className="text-sm px-3 py-1">
            {isActive ? "🟢 Ativo" : "🔴 Desativado"}
          </Badge>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </div>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-6 h-auto">
          <TabsTrigger value="general" className="text-xs py-2">
            <Settings2 className="w-3.5 h-3.5 mr-1" />Geral
          </TabsTrigger>
          <TabsTrigger value="messages" className="text-xs py-2">
            <MessageSquare className="w-3.5 h-3.5 mr-1" />Mensagens
          </TabsTrigger>
          <TabsTrigger value="autoreplies" className="text-xs py-2">
            <Zap className="w-3.5 h-3.5 mr-1" />Respostas
          </TabsTrigger>
          <TabsTrigger value="media" className="text-xs py-2">
            <Music className="w-3.5 h-3.5 mr-1" />Mídia
          </TabsTrigger>
          <TabsTrigger value="advanced" className="text-xs py-2">
            <Brain className="w-3.5 h-3.5 mr-1" />Avançado
          </TabsTrigger>
          <TabsTrigger value="logs" className="text-xs py-2">
            <MessageCircle className="w-3.5 h-3.5 mr-1" />Logs
          </TabsTrigger>
        </TabsList>

        {/* GENERAL TAB */}
        <TabsContent value="general" className="space-y-4 mt-4">
          <div className="glass-card rounded-xl p-6 space-y-6">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              Personalidade da IA
            </h2>
            <Textarea
              value={personality}
              onChange={(e) => setPersonality(e.target.value)}
              placeholder={`Ex: "Você é a Ana, assistente virtual do Meu Gestor IPTV. Seja educada, objetiva e profissional. Sempre use emojis com moderação. Nunca revele que é uma IA. Se não souber algo, diga que vai verificar."`}
              className="bg-secondary/50 border-border min-h-[180px] text-sm"
            />
            <p className="text-muted-foreground text-xs">
              Este texto será usado como instrução de sistema (System Prompt) para a IA. Defina tom de voz, nome do assistente, regras de conduta e instruções específicas.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Brain className="w-4 h-4 text-primary" />
                  Modelo de IA
                </Label>
                <Select value={aiModel} onValueChange={setAiModel}>
                  <SelectTrigger className="bg-secondary/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AI_MODELS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-primary" />
                  Criatividade (Temperature): {aiTemperature}
                </Label>
                <Slider
                  value={[aiTemperature]}
                  onValueChange={([v]) => setAiTemperature(v)}
                  min={0}
                  max={1.5}
                  step={0.1}
                  className="mt-2"
                />
                <p className="text-muted-foreground text-xs">
                  0 = respostas mais previsíveis • 1.5 = mais criativo e variado
                </p>
              </div>
            </div>

            <div className="border-t border-border pt-4 space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                Horário de Funcionamento
              </h3>
              <div className="flex items-center gap-3">
                <Switch checked={businessHoursEnabled} onCheckedChange={setBusinessHoursEnabled} />
                <span className="text-sm text-foreground">
                  {businessHoursEnabled ? "Ativado — bot responde apenas no horário configurado" : "Desativado — bot responde 24h"}
                </span>
              </div>
              {businessHoursEnabled && (
                <div className="space-y-3 pl-4 border-l-2 border-primary/30">
                  <div className="flex gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs">Início</Label>
                      <Input type="time" value={businessHoursStart} onChange={(e) => setBusinessHoursStart(e.target.value)} className="bg-secondary/50 w-32" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Fim</Label>
                      <Input type="time" value={businessHoursEnd} onChange={(e) => setBusinessHoursEnd(e.target.value)} className="bg-secondary/50 w-32" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Dias da semana</Label>
                    <div className="flex gap-2">
                      {DAYS_OF_WEEK.map((day) => (
                        <button
                          key={day.value}
                          onClick={() => toggleDay(day.value)}
                          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                            businessDays.includes(day.value)
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                          }`}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-border pt-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-2">
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
                  className="bg-secondary/50 w-40"
                />
                <p className="text-muted-foreground text-xs">Horário exato para disparo automático de cobranças.</p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSaveSettings} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar Configurações
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* MESSAGES TAB */}
        <TabsContent value="messages" className="space-y-4 mt-4">
          <div className="glass-card rounded-xl p-6 space-y-6">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-primary" />
              Mensagens Automáticas
            </h2>

            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Send className="w-4 h-4 text-primary" />
                Mensagem de Boas-Vindas
              </Label>
              <Textarea
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                placeholder="Olá! 👋 Bem-vindo(a)! Como posso ajudar você hoje?"
                className="bg-secondary/50 border-border min-h-[80px] text-sm"
              />
              <p className="text-muted-foreground text-xs">
                Enviada automaticamente no primeiro contato. Deixe vazio para usar a IA desde a primeira mensagem.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                Mensagem Fora do Horário
              </Label>
              <Textarea
                value={awayMessage}
                onChange={(e) => setAwayMessage(e.target.value)}
                placeholder="Olá! No momento estamos fora do horário de atendimento. Retornaremos em breve! ⏰"
                className="bg-secondary/50 border-border min-h-[80px] text-sm"
              />
              <p className="text-muted-foreground text-xs">
                Enviada quando o contato manda mensagem fora do horário de funcionamento.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-primary" />
                Mensagem para Perguntas não Compreendidas
              </Label>
              <Textarea
                value={unknownMessage}
                onChange={(e) => setUnknownMessage(e.target.value)}
                placeholder="Desculpe, não entendi sua pergunta. Pode reformular? 🤔"
                className="bg-secondary/50 border-border min-h-[60px] text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-primary" />
                Mensagem de Encerramento
              </Label>
              <Textarea
                value={closingMessage}
                onChange={(e) => setClosingMessage(e.target.value)}
                placeholder="Obrigado pelo contato! Se precisar de algo mais, estamos à disposição. 😊"
                className="bg-secondary/50 border-border min-h-[60px] text-sm"
              />
              <p className="text-muted-foreground text-xs">
                Enviada ao encerrar o atendimento ou quando o limite de mensagens é atingido.
              </p>
            </div>

            <div className="border-t border-border pt-4 space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-primary" />
                Transferência para Atendente Humano
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Palavra-chave para transferir</Label>
                  <Input
                    value={transferKeyword}
                    onChange={(e) => setTransferKeyword(e.target.value)}
                    placeholder="atendente"
                    className="bg-secondary/50"
                  />
                  <p className="text-muted-foreground text-xs">
                    Quando o cliente digitar esta palavra, será transferido.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">WhatsApp do atendente</Label>
                  <Input
                    value={transferPhone}
                    onChange={(e) => setTransferPhone(e.target.value)}
                    placeholder="5511999999999"
                    className="bg-secondary/50"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Mensagem de transferência</Label>
                <Textarea
                  value={transferMessage}
                  onChange={(e) => setTransferMessage(e.target.value)}
                  placeholder="Estou transferindo você para um atendente humano. Aguarde um momento..."
                  className="bg-secondary/50 min-h-[60px] text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSaveSettings} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar Mensagens
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* AUTO REPLIES TAB */}
        <TabsContent value="autoreplies" className="space-y-4 mt-4">
          <div className="glass-card rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Zap className="w-5 h-5 text-primary" />
                  Respostas Automáticas por Palavra-Chave
                </h2>
                <p className="text-muted-foreground text-xs mt-1">
                  Defina respostas automáticas que são disparadas antes da IA, baseadas em palavras-chave.
                </p>
              </div>
              <Button onClick={() => setShowAddReply(!showAddReply)} size="sm">
                <Plus className="w-4 h-4 mr-1" />
                Adicionar
              </Button>
            </div>

            {showAddReply && (
              <div className="bg-secondary/30 rounded-lg p-4 border border-border/50 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Palavra-chave</Label>
                    <Input
                      value={newKeyword}
                      onChange={(e) => setNewKeyword(e.target.value)}
                      placeholder="preço, plano, teste..."
                      className="bg-background"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tipo de gatilho</Label>
                    <Select value={newTriggerType} onValueChange={setNewTriggerType}>
                      <SelectTrigger className="bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="contains">Contém</SelectItem>
                        <SelectItem value="exact">Exata</SelectItem>
                        <SelectItem value="starts_with">Começa com</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Resposta</Label>
                  <Textarea
                    value={newResponseText}
                    onChange={(e) => setNewResponseText(e.target.value)}
                    placeholder="Texto da resposta automática..."
                    className="bg-background min-h-[80px] text-sm"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={() => setShowAddReply(false)}>Cancelar</Button>
                  <Button size="sm" onClick={handleAddAutoReply} disabled={!newKeyword.trim()}>
                    <Save className="w-3.5 h-3.5 mr-1" />Salvar
                  </Button>
                </div>
              </div>
            )}

            {autoReplies.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Zap className="w-10 h-10 mx-auto mb-2 opacity-40" />
                Nenhuma resposta automática configurada.
              </div>
            ) : (
              <div className="space-y-2">
                {autoReplies.map((reply) => (
                  <div key={reply.id} className="bg-secondary/30 rounded-lg px-4 py-3 border border-border/50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={reply.is_active ? "default" : "secondary"} className="text-[10px]">
                          {reply.trigger_type === "contains" ? "Contém" : reply.trigger_type === "exact" ? "Exata" : "Começa com"}
                        </Badge>
                        {editingReply === reply.id ? (
                          <Input
                            value={reply.trigger_keyword}
                            onChange={(e) => {
                              setAutoReplies((prev) =>
                                prev.map((r) => r.id === reply.id ? { ...r, trigger_keyword: e.target.value } : r)
                              );
                            }}
                            onBlur={() => {
                              handleUpdateReply(reply, "trigger_keyword", reply.trigger_keyword);
                              setEditingReply(null);
                            }}
                            className="h-7 text-sm w-40"
                            autoFocus
                          />
                        ) : (
                          <span className="text-sm font-medium text-foreground">"{reply.trigger_keyword}"</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingReply(reply.id)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleToggleReply(reply)}>
                          <ToggleLeft className={`w-3.5 h-3.5 ${reply.is_active ? "text-primary" : "text-muted-foreground"}`} />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteReply(reply.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground bg-background/50 rounded p-2">
                      {reply.response_text || <span className="italic">Sem resposta definida</span>}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* MEDIA TAB */}
        <TabsContent value="media" className="space-y-4 mt-4">
          <div className="glass-card rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Music className="w-5 h-5 text-primary" />
                  Gestão de Mídia
                </h2>
                <p className="text-muted-foreground text-xs mt-1">
                  Envie áudios (.mp3) e vídeos (.mp4) que o bot poderá usar nas respostas. A IA pode enviar esses arquivos quando relevante.
                </p>
              </div>
              <div>
                <input ref={fileInputRef} type="file" accept=".mp3,.mp4,audio/mpeg,video/mp4" className="hidden" onChange={handleUploadMedia} />
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                  Upload Mídia
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
                      {media.file_type === "audio" ? <FileAudio className="w-5 h-5 text-primary shrink-0" /> : <FileVideo className="w-5 h-5 text-primary shrink-0" />}
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
        </TabsContent>

        {/* ADVANCED TAB */}
        <TabsContent value="advanced" className="space-y-4 mt-4">
          <div className="glass-card rounded-xl p-6 space-y-6">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary" />
              Configurações Avançadas
            </h2>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                  <Timer className="w-4 h-4 text-primary" />
                  Delay de Resposta (Humanização)
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Delay mínimo: {minDelay}s</Label>
                    <Slider value={[minDelay]} onValueChange={([v]) => setMinDelay(v)} min={1} max={15} step={1} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Delay máximo: {maxDelay}s</Label>
                    <Slider value={[maxDelay]} onValueChange={([v]) => setMaxDelay(v)} min={2} max={20} step={1} />
                  </div>
                </div>
                <p className="text-muted-foreground text-xs mt-2">
                  Simula presença "digitando..." ou "gravando áudio..." por um tempo aleatório entre estes valores antes de responder.
                </p>
              </div>

              <div className="border-t border-border pt-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  Limite de Mensagens por Contato
                </h3>
                <div className="space-y-2">
                  <Label className="text-xs">Máx. mensagens por conversa: {maxMessagesPerContact === 0 ? "Ilimitado" : maxMessagesPerContact}</Label>
                  <Slider value={[maxMessagesPerContact]} onValueChange={([v]) => setMaxMessagesPerContact(v)} min={0} max={50} step={1} />
                  <p className="text-muted-foreground text-xs">
                    0 = ilimitado. Após atingir o limite, a mensagem de encerramento é enviada.
                  </p>
                </div>
              </div>

              <div className="border-t border-border pt-4 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Ban className="w-4 h-4 text-primary" />
                  Contatos Bloqueados
                </h3>
                <p className="text-muted-foreground text-xs">
                  O bot não responderá mensagens destes números.
                </p>
                <div className="flex gap-2">
                  <Input
                    value={newBlockPhone}
                    onChange={(e) => setNewBlockPhone(e.target.value)}
                    placeholder="5511999999999"
                    className="bg-secondary/50 flex-1"
                  />
                  <Input
                    value={newBlockReason}
                    onChange={(e) => setNewBlockReason(e.target.value)}
                    placeholder="Motivo (opcional)"
                    className="bg-secondary/50 flex-1"
                  />
                  <Button size="sm" onClick={handleAddBlockedContact} disabled={!newBlockPhone.trim()}>
                    <Ban className="w-3.5 h-3.5 mr-1" />Bloquear
                  </Button>
                </div>
                {blockedContacts.length > 0 && (
                  <div className="space-y-1">
                    {blockedContacts.map((bc) => (
                      <div key={bc.id} className="flex items-center justify-between bg-secondary/30 rounded-lg px-3 py-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Ban className="w-3.5 h-3.5 text-destructive" />
                          <span className="font-mono text-foreground">{bc.phone}</span>
                          {bc.reason && <span className="text-muted-foreground text-xs">— {bc.reason}</span>}
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemoveBlocked(bc.id)}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSaveSettings} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar Configurações
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* LOGS TAB */}
        <TabsContent value="logs" className="space-y-4 mt-4">
          <div className="glass-card rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
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
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {logs.map((log) => (
                  <div key={log.id} className="bg-secondary/30 rounded-lg px-4 py-3 border border-border/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">{log.client_name}</span>
                        <Badge variant={log.context_type === "client" ? "default" : log.context_type === "error" ? "destructive" : "secondary"} className="text-[10px]">
                          {log.context_type === "client" ? "Cliente" : log.context_type === "error" ? "Erro" : "Novo Contato"}
                        </Badge>
                        <span className="text-xs font-mono text-muted-foreground">{log.phone}</span>
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
                        <span className="text-muted-foreground block mb-0.5">📩 Recebido:</span>
                        <span className="text-foreground">{log.message_received?.slice(0, 200)}{log.message_received?.length > 200 ? "..." : ""}</span>
                      </div>
                      <div className="bg-background/50 rounded p-2">
                        <span className="text-muted-foreground block mb-0.5">🤖 Resposta:</span>
                        <span className="text-foreground">{log.message_sent?.slice(0, 200)}{log.message_sent?.length > 200 ? "..." : ""}</span>
                      </div>
                    </div>
                    {log.error_message && (
                      <p className="text-xs text-destructive bg-destructive/10 rounded p-2">⚠️ {log.error_message}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
