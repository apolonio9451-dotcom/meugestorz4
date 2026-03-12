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
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Bot, Save, Loader2, Upload, Trash2, Clock, Music, Video,
  MessageCircle, User, AlertCircle, RefreshCw,
  FileAudio, FileVideo, Settings2, Zap, Ban, ArrowRightLeft,
  Plus, Brain, Timer, Phone, Calendar, Send,
  MessageSquare, Shield, Pencil, ToggleLeft, Copy, Check,
  Play, Pause, ExternalLink, Filter, RotateCcw, Sparkles,
  Globe, Link2, Eye, EyeOff, Volume2, Info, Search,
  ChevronDown, ChevronUp, Hash, Layers, Download, Smartphone
} from "lucide-react";
import { format } from "date-fns";
import WhatsAppInstanceSection from "@/components/settings/WhatsAppInstanceSection";

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
  { value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash (Recomendado)", desc: "Rápido e inteligente — melhor custo-benefício" },
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", desc: "Rápido e econômico" },
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", desc: "Máxima qualidade, mais caro" },
  { value: "openai/gpt-5-mini", label: "GPT-5 Mini", desc: "Equilibrado, bom raciocínio" },
  { value: "openai/gpt-5", label: "GPT-5", desc: "Premium — máxima precisão" },
  { value: "openai/gpt-5.2", label: "GPT-5.2", desc: "Último modelo OpenAI" },
];

const DEFAULT_PERSONALITY = `Você é um assistente virtual profissional e amigável. Responda de forma natural e humanizada, como se fosse uma pessoa real digitando.

REGRAS:
- Mantenha respostas curtas e diretas (máximo 3 parágrafos)
- Use emojis com moderação
- NUNCA revele que é uma IA ou bot
- Se não souber algo, diga que vai verificar e retornar
- Seja educado, objetivo e prestativo`;

const CONTEXT_LABELS: Record<string, { label: string; color: string }> = {
  client: { label: "Cliente", color: "default" },
  new_contact: { label: "Novo Contato", color: "secondary" },
  welcome: { label: "Boas-Vindas", color: "outline" },
  away: { label: "Fora do Horário", color: "secondary" },
  transfer: { label: "Transferência", color: "outline" },
  auto_reply: { label: "Resposta Auto", color: "default" },
  error: { label: "Erro", color: "destructive" },
  invalid_payload: { label: "Payload Inválido", color: "destructive" },
  media_received: { label: "Mídia Recebida", color: "secondary" },
};

export default function Chatbot() {
  const { companyId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("personality");

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
  const [aiModel, setAiModel] = useState("google/gemini-3-flash-preview");
  const [aiTemperature, setAiTemperature] = useState(0.7);

  // Auto replies
  const [autoReplies, setAutoReplies] = useState<any[]>([]);
  const [showAddReply, setShowAddReply] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");
  const [newTriggerType, setNewTriggerType] = useState("contains");
  const [newResponseText, setNewResponseText] = useState("");
  const [newReplyPriority, setNewReplyPriority] = useState(0);
  const [editingReply, setEditingReply] = useState<string | null>(null);
  const [editingReplyText, setEditingReplyText] = useState<string | null>(null);

  // Blocked contacts
  const [blockedContacts, setBlockedContacts] = useState<any[]>([]);
  const [newBlockPhone, setNewBlockPhone] = useState("");
  const [newBlockReason, setNewBlockReason] = useState("");

  // Media
  const [mediaFiles, setMediaFiles] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [playingMedia, setPlayingMedia] = useState<string | null>(null);
  const [copiedMediaId, setCopiedMediaId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Logs
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logFilter, setLogFilter] = useState("all");
  const [logSearch, setLogSearch] = useState("");
  const [expandedLog, setExpandedLog] = useState<string | null>(null);
  const [logsLimit, setLogsLimit] = useState(50);

  // Webhook
  const [webhookCopied, setWebhookCopied] = useState(false);
  const [showWebhookUrl, setShowWebhookUrl] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("Olá, isso é um teste do chatbot!");
  const [testResult, setTestResult] = useState<{ status: string; data: any } | null>(null);

  // API check
  const [apiConfigured, setApiConfigured] = useState(false);
  const [showApiModal, setShowApiModal] = useState(false);
  const [showSchedulePanel, setShowSchedulePanel] = useState(false);

  // Interactive menu
  const [menuEnabled, setMenuEnabled] = useState(false);
  const [menuType, setMenuType] = useState("buttons");
  const [menuTitle, setMenuTitle] = useState("");
  const [menuBody, setMenuBody] = useState("");
  const [menuFooter, setMenuFooter] = useState("");
  const [menuButtonText, setMenuButtonText] = useState("Ver Opções");
  const [menuItems, setMenuItems] = useState<{ id: string; title: string; description?: string }[]>([]);

  useEffect(() => {
    if (!companyId) { setLoading(false); return; }
    fetchAll();
  }, [companyId]);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchSettings(), fetchMedia(), fetchLogs(), fetchAutoReplies(), fetchBlockedContacts(), fetchApiStatus()]);
    setLoading(false);
  };

  const fetchApiStatus = async () => {
    const { data } = await supabase
      .from("api_settings" as any)
      .select("api_url, api_token")
      .eq("company_id", companyId!)
      .maybeSingle();
    setApiConfigured(!!(data && (data as any).api_url && (data as any).api_token));
  };

  const fetchSettings = async () => {
    const { data } = await supabase
      .from("chatbot_settings")
      .select("*")
      .eq("company_id", companyId!)
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
      setAiModel(d.ai_model || "google/gemini-3-flash-preview");
      setAiTemperature(d.ai_temperature ?? 0.7);
      setMenuEnabled(d.interactive_menu_enabled ?? false);
      setMenuType(d.interactive_menu_type || "buttons");
      setMenuTitle(d.interactive_menu_title || "");
      setMenuBody(d.interactive_menu_body || "");
      setMenuFooter(d.interactive_menu_footer || "");
      setMenuButtonText(d.interactive_menu_button_text || "Ver Opções");
      setMenuItems(d.interactive_menu_items || []);
      setSettingsId(d.id);
    }
  };

  const fetchAutoReplies = async () => {
    const { data } = await supabase
      .from("chatbot_auto_replies")
      .select("*")
      .eq("company_id", companyId!)
      .order("priority", { ascending: false });
    if (data) setAutoReplies(data as any[]);
  };

  const fetchBlockedContacts = async () => {
    const { data } = await supabase
      .from("chatbot_blocked_contacts")
      .select("*")
      .eq("company_id", companyId!)
      .order("created_at", { ascending: false });
    if (data) setBlockedContacts(data as any[]);
  };

  const fetchMedia = async () => {
    const { data } = await supabase
      .from("chatbot_media")
      .select("*")
      .eq("company_id", companyId!)
      .order("created_at", { ascending: false });
    if (data) setMediaFiles(data as any[]);
  };

  const fetchLogs = async () => {
    setLogsLoading(true);
    const { data } = await supabase
      .from("chatbot_logs")
      .select("*")
      .eq("company_id", companyId!)
      .order("created_at", { ascending: false })
      .limit(logsLimit);
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
        interactive_menu_enabled: menuEnabled,
        interactive_menu_type: menuType,
        interactive_menu_title: menuTitle.trim(),
        interactive_menu_body: menuBody.trim(),
        interactive_menu_footer: menuFooter.trim(),
        interactive_menu_button_text: menuButtonText.trim(),
        interactive_menu_items: menuItems,
      };
      let error;
      if (settingsId) {
        ({ error } = await supabase.from("chatbot_settings").update(payload).eq("id", settingsId));
      } else {
        const { data, error: e } = await supabase.from("chatbot_settings").insert(payload).select().single();
        error = e;
        if (data) setSettingsId((data as any).id);
      }
      if (error) throw error;
      toast({ title: "✅ Configurações salvas com sucesso!" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreDefaults = () => {
    setPersonality(DEFAULT_PERSONALITY);
    setAiModel("google/gemini-3-flash-preview");
    setAiTemperature(0.7);
    setMinDelay(3);
    setMaxDelay(6);
    setBusinessHoursEnabled(false);
    setBusinessHoursStart("08:00");
    setBusinessHoursEnd("18:00");
    setBusinessDays([1, 2, 3, 4, 5]);
    setTransferKeyword("atendente");
    setTransferMessage("Estou transferindo você para um atendente humano. Aguarde um momento...");
    setUnknownMessage("Desculpe, não entendi. Pode reformular sua pergunta?");
    setMaxMessagesPerContact(0);
    toast({ title: "🔄 Padrão de fábrica restaurado", description: "Clique em Salvar para aplicar." });
  };

  const handleAddAutoReply = async () => {
    if (!companyId || !newKeyword.trim()) return;
    try {
      const { error } = await supabase.from("chatbot_auto_replies").insert({
        company_id: companyId,
        trigger_keyword: newKeyword.trim(),
        trigger_type: newTriggerType,
        response_text: newResponseText.trim(),
        priority: newReplyPriority,
      });
      if (error) throw error;
      toast({ title: "✅ Resposta automática adicionada!" });
      setNewKeyword("");
      setNewResponseText("");
      setNewReplyPriority(0);
      setShowAddReply(false);
      fetchAutoReplies();
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message, variant: "destructive" });
    }
  };

  const handleToggleReply = async (reply: any) => {
    try {
      const { error } = await supabase.from("chatbot_auto_replies")
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
      const { error } = await supabase.from("chatbot_auto_replies").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Resposta removida!" });
      fetchAutoReplies();
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message, variant: "destructive" });
    }
  };

  const handleUpdateReply = async (id: string, field: string, value: string) => {
    try {
      const { error } = await supabase.from("chatbot_auto_replies")
        .update({ [field]: value })
        .eq("id", id);
      if (error) throw error;
      fetchAutoReplies();
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message, variant: "destructive" });
    }
  };

  const handleAddBlockedContact = async () => {
    if (!companyId || !newBlockPhone.trim()) return;
    try {
      const { error } = await supabase.from("chatbot_blocked_contacts").insert({
        company_id: companyId,
        phone: newBlockPhone.trim().replace(/\D/g, ""),
        reason: newBlockReason.trim(),
      });
      if (error) throw error;
      toast({ title: "🚫 Contato bloqueado!" });
      setNewBlockPhone("");
      setNewBlockReason("");
      fetchBlockedContacts();
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message, variant: "destructive" });
    }
  };

  const handleRemoveBlocked = async (id: string) => {
    try {
      const { error } = await supabase.from("chatbot_blocked_contacts").delete().eq("id", id);
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
      const { error: dbError } = await supabase.from("chatbot_media").insert({
        company_id: companyId,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_type: isAudio ? "audio" : "video",
        file_size: file.size,
      });
      if (dbError) throw dbError;
      toast({ title: "✅ Mídia enviada com sucesso!" });
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
      const { error } = await supabase.from("chatbot_media").delete().eq("id", media.id);
      if (error) throw error;
      toast({ title: "Mídia removida!" });
      fetchMedia();
    } catch (err: any) {
      toast({ title: "Erro ao remover", description: err?.message, variant: "destructive" });
    }
  };

  const handlePlayMedia = (media: any) => {
    if (playingMedia === media.id) {
      audioRef.current?.pause();
      setPlayingMedia(null);
    } else {
      if (audioRef.current) {
        audioRef.current.src = media.file_url;
        audioRef.current.play();
      }
      setPlayingMedia(media.id);
    }
  };

  const handleCopyMediaRef = (media: any) => {
    const ref = media.file_type === "audio"
      ? `[ENVIAR_MEDIA:${media.file_name}]`
      : `[ENVIAR_MEDIA:${media.file_name}]`;
    navigator.clipboard.writeText(ref);
    setCopiedMediaId(media.id);
    setTimeout(() => setCopiedMediaId(null), 2000);
    toast({ title: "📋 Referência copiada!", description: `Use "${ref}" na personalidade ou respostas automáticas.` });
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

  const webhookUrl = companyId
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chatbot-webhook?company_id=${companyId}`
    : "";

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setWebhookCopied(true);
    setTimeout(() => setWebhookCopied(false), 2000);
    toast({ title: "📋 URL do Webhook copiada!" });
  };

  const handleTestWebhook = async () => {
    if (!companyId || !testPhone.trim()) {
      toast({ title: "Preencha o número de telefone para teste", variant: "destructive" });
      return;
    }
    setTestingWebhook(true);
    setTestResult(null);
    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: { text: testMessage, from: testPhone.replace(/\D/g, "") },
        }),
      });
      const data = await response.json();
      setTestResult({ status: response.ok ? "success" : "error", data });
      if (response.ok) {
        toast({ title: "✅ Teste enviado com sucesso!", description: `Status: ${data.status || data.context}` });
        fetchLogs();
      } else {
        toast({ title: "❌ Erro no teste", description: data.error || JSON.stringify(data), variant: "destructive" });
      }
    } catch (err: any) {
      setTestResult({ status: "error", data: { error: err.message } });
      toast({ title: "❌ Falha na conexão", description: err.message, variant: "destructive" });
    } finally {
      setTestingWebhook(false);
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (logFilter !== "all" && log.context_type !== logFilter) return false;
    if (logSearch) {
      const search = logSearch.toLowerCase();
      return (
        log.phone?.toLowerCase().includes(search) ||
        log.client_name?.toLowerCase().includes(search) ||
        log.message_received?.toLowerCase().includes(search) ||
        log.message_sent?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  const logStats = {
    total: logs.length,
    success: logs.filter((l) => l.status === "success").length,
    errors: logs.filter((l) => l.status === "error").length,
    clients: logs.filter((l) => l.context_type === "client").length,
    newContacts: logs.filter((l) => l.context_type === "new_contact").length,
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
      <audio ref={audioRef} onEnded={() => setPlayingMedia(null)} className="hidden" />

      {/* Header */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-3">
              <Bot className="w-7 h-7 text-primary" />
              Chatbot IA
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Atendimento automático inteligente via WhatsApp — Configuração completa
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all ${
              isActive
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-secondary border-border text-muted-foreground"
            }`}>
              <div className={`w-2.5 h-2.5 rounded-full ${isActive ? "bg-primary animate-pulse" : "bg-muted-foreground"}`} />
              <span className="text-sm font-medium">{isActive ? "Bot Ativo" : "Bot Desativado"}</span>
              <Switch checked={isActive} onCheckedChange={async (v) => {
                if (v && !apiConfigured) {
                  setShowApiModal(true);
                  return;
                }
                setIsActive(v);
                if (companyId) {
                  try {
                    if (settingsId) {
                      await supabase.from("chatbot_settings").update({ is_active: v }).eq("id", settingsId);
                    } else {
                      const { data } = await supabase.from("chatbot_settings").insert({ company_id: companyId, is_active: v }).select().single();
                      if (data) setSettingsId((data as any).id);
                    }
                    toast({ title: v ? "✅ Bot ativado!" : "Bot desativado" });
                  } catch (err: any) {
                    setIsActive(!v);
                    toast({ title: "Erro ao alterar status", description: err?.message, variant: "destructive" });
                  }
                }
              }} />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs gap-1"
              onClick={() => setShowSchedulePanel(!showSchedulePanel)}
            >
              <Clock className="w-3.5 h-3.5" />
              Horário
              {showSchedulePanel ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </Button>
          </div>
        </div>

        {/* Schedule Panel */}
        {showSchedulePanel && (
          <div className="glass-card rounded-xl p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Período de Atividade do Bot</span>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant={!businessHoursEnabled ? "default" : "outline"}
                  size="sm"
                  className="text-xs h-7 gap-1"
                  onClick={() => {
                    setBusinessHoursEnabled(false);
                    setBusinessDays([0, 1, 2, 3, 4, 5, 6]);
                  }}
                >
                  <Zap className="w-3 h-3" />
                  24/7
                </Button>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Horário comercial</Label>
                  <Switch checked={businessHoursEnabled} onCheckedChange={setBusinessHoursEnabled} />
                </div>
              </div>
            </div>

            {businessHoursEnabled && (
              <>
                <div className="flex flex-wrap gap-4 items-end">
                  <div>
                    <Label className="text-xs text-muted-foreground">Início</Label>
                    <Input
                      type="time"
                      value={businessHoursStart}
                      onChange={(e) => setBusinessHoursStart(e.target.value)}
                      className="h-8 text-sm w-32 mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Fim</Label>
                    <Input
                      type="time"
                      value={businessHoursEnd}
                      onChange={(e) => setBusinessHoursEnd(e.target.value)}
                      className="h-8 text-sm w-32 mt-1"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Dias ativos</Label>
                  <div className="flex flex-wrap gap-2">
                    {DAYS_OF_WEEK.map((day) => (
                      <button
                        key={day.value}
                        onClick={() => toggleDay(day.value)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                          businessDays.includes(day.value)
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-secondary text-muted-foreground border-border hover:border-primary/50"
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  Fora do horário, o bot enviará a mensagem de ausência configurada na aba "Mensagens".
                </p>
              </>
            )}

            <div className="flex justify-end">
              <Button size="sm" onClick={handleSaveSettings} disabled={saving}>
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                Salvar Horário
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* API Not Configured Modal */}
      <Dialog open={showApiModal} onOpenChange={setShowApiModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-destructive" />
              API não configurada
            </DialogTitle>
            <DialogDescription className="space-y-3 pt-2">
              <p>
                Para ativar o Chatbot IA, é necessário configurar a <strong>URL da API</strong> e o <strong>Token</strong> da sua instância UAZAPI.
              </p>
              <p>
                Acesse o menu <strong>Configuração Geral</strong> → seção <strong>API de WhatsApp (UAZAPI)</strong> e preencha os campos obrigatórios.
              </p>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowApiModal(false)}>Entendi</Button>
            <Button onClick={() => { setShowApiModal(false); window.location.href = "/dashboard/settings"; }}>
              <Settings2 className="w-4 h-4 mr-1" />
              Ir para Configuração
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="glass-card rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{logStats.total}</p>
          <p className="text-xs text-muted-foreground">Total Atendimentos</p>
        </div>
        <div className="glass-card rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-primary">{logStats.success}</p>
          <p className="text-xs text-muted-foreground">Sucesso</p>
        </div>
        <div className="glass-card rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{logStats.clients}</p>
          <p className="text-xs text-muted-foreground">Clientes</p>
        </div>
        <div className="glass-card rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{logStats.newContacts}</p>
          <p className="text-xs text-muted-foreground">Novos Contatos</p>
        </div>
      </div>

      {/* Webhook URL */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">URL do Webhook (UAZAPI)</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowWebhookUrl(!showWebhookUrl)}>
              {showWebhookUrl ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleCopyWebhook}>
              {webhookCopied ? <Check className="w-3.5 h-3.5 mr-1 text-primary" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
              {webhookCopied ? "Copiado!" : "Copiar"}
            </Button>
          </div>
        </div>
        <div className="bg-secondary/50 rounded-lg px-3 py-2 font-mono text-xs text-muted-foreground overflow-x-auto">
          {showWebhookUrl ? webhookUrl : "••••••••••••••••••••••••••••••••••••••••••••••"}
        </div>
        <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
          <Info className="w-3 h-3" />
          Configure esta URL no painel da UAZAPI como webhook de mensagens recebidas.
        </p>

        {/* Teste do Webhook */}
        <div className="mt-4 pt-4 border-t border-border/50">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-primary" />
            Testar Webhook
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Telefone de teste</Label>
              <Input
                placeholder="Digite o número (ex: 5511999999999)"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                className="h-8 text-sm mt-1"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Mensagem de teste</Label>
              <Input
                placeholder="Olá, isso é um teste!"
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                className="h-8 text-sm mt-1"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleTestWebhook}
                disabled={testingWebhook}
                className="h-8 w-full"
                variant="outline"
              >
                {testingWebhook ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                ) : (
                  <Send className="w-3.5 h-3.5 mr-1" />
                )}
                {testingWebhook ? "Testando..." : "Enviar Teste"}
              </Button>
            </div>
          </div>
          {testResult && (
            <div className={`mt-3 rounded-lg p-3 text-xs font-mono overflow-x-auto ${
              testResult.status === "success"
                ? "bg-primary/10 border border-primary/30 text-primary"
                : "bg-destructive/10 border border-destructive/30 text-destructive"
            }`}>
              <p className="font-semibold mb-1">{testResult.status === "success" ? "✅ Resposta:" : "❌ Erro:"}</p>
              <pre className="whitespace-pre-wrap">{JSON.stringify(testResult.data, null, 2)}</pre>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            O teste simula uma mensagem recebida. Se o bot estiver ativo e a API configurada, ele responderá via WhatsApp ao número informado.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 md:grid-cols-9 h-auto">
          <TabsTrigger value="connection" className="text-xs py-2">
            <Smartphone className="w-3.5 h-3.5 mr-1" />Conexão
          </TabsTrigger>
          <TabsTrigger value="personality" className="text-xs py-2">
            <Brain className="w-3.5 h-3.5 mr-1" />Personalidade
          </TabsTrigger>
          <TabsTrigger value="messages" className="text-xs py-2">
            <MessageSquare className="w-3.5 h-3.5 mr-1" />Mensagens
          </TabsTrigger>
          <TabsTrigger value="menu" className="text-xs py-2">
            <Layers className="w-3.5 h-3.5 mr-1" />Menu
          </TabsTrigger>
          <TabsTrigger value="autoreplies" className="text-xs py-2">
            <Zap className="w-3.5 h-3.5 mr-1" />Gatilhos
          </TabsTrigger>
          <TabsTrigger value="media" className="text-xs py-2">
            <Music className="w-3.5 h-3.5 mr-1" />Mídia
          </TabsTrigger>
          <TabsTrigger value="advanced" className="text-xs py-2">
            <Settings2 className="w-3.5 h-3.5 mr-1" />Avançado
          </TabsTrigger>
          <TabsTrigger value="logs" className="text-xs py-2">
            <MessageCircle className="w-3.5 h-3.5 mr-1" />Logs
            {logStats.errors > 0 && (
              <span className="ml-1 bg-destructive text-destructive-foreground text-[9px] rounded-full px-1.5">{logStats.errors}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="diagnostics" className="text-xs py-2">
            <AlertCircle className="w-3.5 h-3.5 mr-1" />Diagnóstico
          </TabsTrigger>
        </TabsList>

        {/* CONNECTION TAB */}
        <TabsContent value="connection" className="space-y-4 mt-4">
          <WhatsAppInstanceSection companyId={companyId} />
        </TabsContent>

        {/* PERSONALITY TAB */}
        <TabsContent value="personality" className="space-y-4 mt-4">
          <div className="glass-card rounded-xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Brain className="w-5 h-5 text-primary" />
                Personalidade & Treino da IA
              </h2>
              <Button variant="outline" size="sm" onClick={handleRestoreDefaults}>
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                Restaurar Padrão
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                Instruções do Sistema (System Prompt)
              </Label>
              <Textarea
                value={personality}
                onChange={(e) => setPersonality(e.target.value)}
                placeholder={DEFAULT_PERSONALITY}
                className="bg-secondary/50 border-border min-h-[220px] text-sm font-mono"
              />
              <div className="flex items-center justify-between">
                <p className="text-muted-foreground text-[11px]">
                  Este texto define como a IA se comporta. Inclua: tom de voz, nome, regras, informações sobre o serviço e instruções de vendas/suporte.
                </p>
                <span className="text-[11px] text-muted-foreground">{personality.length} caracteres</span>
              </div>
            </div>

            <div className="bg-secondary/30 rounded-lg p-4 border border-border/50 space-y-3">
              <h3 className="text-xs font-semibold text-foreground flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-primary" />
                Como a IA usa o contexto automaticamente
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-muted-foreground">
                <div className="bg-background/50 rounded p-3 space-y-1">
                  <span className="font-semibold text-foreground flex items-center gap-1">
                    <User className="w-3 h-3 text-primary" /> Cliente Existente
                  </span>
                  <p>A IA recebe automaticamente: nome, plano, vencimento e valor. Foca em suporte personalizado.</p>
                </div>
                <div className="bg-background/50 rounded p-3 space-y-1">
                  <span className="font-semibold text-foreground flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-primary" /> Novo Contato
                  </span>
                  <p>A IA é instruída a focar em vendas: apresentar o serviço, benefícios e como contratar.</p>
                </div>
              </div>
            </div>

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
                      <SelectItem key={m.value} value={m.value}>
                        <div>
                          <span>{m.label}</span>
                          <span className="text-muted-foreground text-xs ml-2">— {m.desc}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Settings2 className="w-4 h-4 text-primary" />
                  Criatividade: {aiTemperature.toFixed(1)}
                </Label>
                <Slider
                  value={[aiTemperature]}
                  onValueChange={([v]) => setAiTemperature(v)}
                  min={0}
                  max={1.5}
                  step={0.1}
                  className="mt-2"
                />
                <p className="text-muted-foreground text-[11px]">
                  0 = preciso e previsível • 0.7 = equilibrado • 1.5 = muito criativo
                </p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSaveSettings} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar Personalidade
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
                Mensagem de Boas-Vindas (Primeiro Contato)
              </Label>
              <Textarea
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                placeholder="Olá! 👋 Bem-vindo(a)! Como posso ajudar você hoje?"
                className="bg-secondary/50 border-border min-h-[80px] text-sm"
              />
              <p className="text-muted-foreground text-[11px]">
                Enviada automaticamente apenas no primeiro contato de um número desconhecido. Deixe vazio para a IA responder diretamente.
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
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-primary" />
                Mensagem para Perguntas Não Compreendidas
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
              <p className="text-muted-foreground text-[11px]">
                Enviada quando o limite de mensagens por contato é atingido.
              </p>
            </div>

            <div className="border-t border-border pt-4 space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-primary" />
                Transferência para Atendente Humano
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">Palavra-chave de transferência</Label>
                  <Input
                    value={transferKeyword}
                    onChange={(e) => setTransferKeyword(e.target.value)}
                    placeholder="atendente"
                    className="bg-secondary/50"
                  />
                  <p className="text-muted-foreground text-[11px]">
                    Quando o cliente digitar essa palavra, o bot para e envia a mensagem de transferência.
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

        {/* INTERACTIVE MENU TAB */}
        <TabsContent value="menu" className="space-y-4 mt-4">
          <div className="glass-card rounded-xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" />
                Menu Interativo WhatsApp
              </h2>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">Ativo</Label>
                <Switch checked={menuEnabled} onCheckedChange={setMenuEnabled} />
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              Configure um menu interativo que será enviado como primeira resposta a cada mensagem recebida. O cliente escolhe uma opção antes da IA responder.
            </p>

            <div className="space-y-4">
              <div>
                <Label className="text-sm font-semibold">Tipo de Menu</Label>
                <Select value={menuType} onValueChange={(v) => {
                  setMenuType(v);
                  if (v === "buttons" && menuItems.length > 3) {
                    setMenuItems(menuItems.slice(0, 3));
                  }
                }}>
                  <SelectTrigger className="bg-secondary/50 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buttons">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Botões Rápidos</span>
                        <span className="text-xs text-muted-foreground">— Máx 3 botões</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="list">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Menu de Lista</span>
                        <span className="text-xs text-muted-foreground">— Até 10 opções</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Título da Mensagem</Label>
                  <Input
                    value={menuTitle}
                    onChange={(e) => setMenuTitle(e.target.value)}
                    placeholder="Ex: Olá! Como posso ajudar?"
                    className="bg-secondary/50"
                    maxLength={60}
                  />
                  <p className="text-[10px] text-muted-foreground">{menuTitle.length}/60</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Rodapé (opcional)</Label>
                  <Input
                    value={menuFooter}
                    onChange={(e) => setMenuFooter(e.target.value)}
                    placeholder="Ex: Escolha uma opção abaixo"
                    className="bg-secondary/50"
                    maxLength={60}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Corpo da Mensagem</Label>
                <Textarea
                  value={menuBody}
                  onChange={(e) => setMenuBody(e.target.value)}
                  placeholder="Ex: Selecione o motivo do seu contato para que eu possa te atender melhor 😊"
                  className="bg-secondary/50 min-h-[80px]"
                  maxLength={1024}
                />
              </div>

              {menuType === "list" && (
                <div className="space-y-2">
                  <Label className="text-sm">Texto do Botão da Lista</Label>
                  <Input
                    value={menuButtonText}
                    onChange={(e) => setMenuButtonText(e.target.value)}
                    placeholder="Ver Opções"
                    className="bg-secondary/50"
                    maxLength={20}
                  />
                  <p className="text-[10px] text-muted-foreground">Texto exibido no botão que abre a lista</p>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">
                    Opções do Menu ({menuItems.length}/{menuType === "buttons" ? 3 : 10})
                  </Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const maxItems = menuType === "buttons" ? 3 : 10;
                      if (menuItems.length >= maxItems) {
                        toast({ title: `Máximo de ${maxItems} opções`, variant: "destructive" });
                        return;
                      }
                      setMenuItems([...menuItems, { id: `opt_${Date.now()}`, title: "", description: "" }]);
                    }}
                    disabled={menuItems.length >= (menuType === "buttons" ? 3 : 10)}
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Adicionar Opção
                  </Button>
                </div>

                {menuItems.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground text-sm bg-secondary/30 rounded-lg">
                    <Layers className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p>Nenhuma opção adicionada.</p>
                  </div>
                )}

                {menuItems.map((item, index) => (
                  <div key={item.id || index} className="bg-secondary/30 rounded-lg p-3 border border-border/50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">Opção {index + 1}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setMenuItems(menuItems.filter((_, i) => i !== index))}
                      >
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[11px] text-muted-foreground">Título *</Label>
                        <Input
                          value={item.title}
                          onChange={(e) => {
                            const updated = [...menuItems];
                            updated[index] = { ...updated[index], title: e.target.value };
                            setMenuItems(updated);
                          }}
                          placeholder={menuType === "buttons" ? "Ex: Ver Catálogo" : "Ex: 📋 Ver Catálogo"}
                          className="h-8 text-sm bg-background/50"
                          maxLength={menuType === "buttons" ? 20 : 24}
                        />
                      </div>
                      {menuType === "list" && (
                        <div>
                          <Label className="text-[11px] text-muted-foreground">Descrição (opcional)</Label>
                          <Input
                            value={item.description || ""}
                            onChange={(e) => {
                              const updated = [...menuItems];
                              updated[index] = { ...updated[index], description: e.target.value };
                              setMenuItems(updated);
                            }}
                            placeholder="Ex: Confira nossos planos"
                            className="h-8 text-sm bg-background/50"
                            maxLength={72}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Preview */}
            {menuItems.filter(i => i.title).length > 0 && (
              <div className="bg-secondary/20 rounded-xl p-4 border border-border/30">
                <p className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5" />
                  Pré-visualização
                </p>
                <div className="bg-background rounded-lg p-4 max-w-sm border border-border/50 shadow-sm">
                  {menuTitle && <p className="font-semibold text-sm text-foreground">{menuTitle}</p>}
                  {menuBody && <p className="text-sm text-muted-foreground mt-1">{menuBody}</p>}
                  {menuFooter && <p className="text-[11px] text-muted-foreground/70 mt-2">{menuFooter}</p>}
                  <div className="mt-3 space-y-1.5">
                    {menuType === "buttons" ? (
                      menuItems.filter(i => i.title).map((item, idx) => (
                        <div key={idx} className="bg-primary/10 text-primary text-center py-2 rounded-lg text-sm font-medium border border-primary/20">
                          {item.title}
                        </div>
                      ))
                    ) : (
                      <div className="bg-primary/10 text-primary text-center py-2 rounded-lg text-sm font-medium border border-primary/20 flex items-center justify-center gap-2">
                        <Layers className="w-3.5 h-3.5" />
                        {menuButtonText || "Ver Opções"}
                      </div>
                    )}
                  </div>
                </div>
                {menuType === "list" && (
                  <div className="mt-3 bg-background rounded-lg p-3 max-w-sm border border-border/50">
                    <p className="text-[10px] text-muted-foreground mb-2 font-semibold">Ao clicar, o cliente vê:</p>
                    {menuItems.filter(i => i.title).map((item, idx) => (
                      <div key={idx} className="py-2 border-b border-border/30 last:border-0">
                        <p className="text-sm font-medium text-foreground">{item.title}</p>
                        {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="bg-secondary/30 rounded-lg p-3 border border-border/50">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="w-3.5 h-3.5 text-primary shrink-0" />
                Quando ativado, o menu será enviado como primeira resposta a cada mensagem. Use as <strong className="text-foreground mx-0.5">Respostas Automáticas (Gatilhos)</strong> para responder a opções específicas do menu.
              </p>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSaveSettings} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar Menu
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
                  Gatilhos & Respostas Automáticas
                </h2>
                <p className="text-muted-foreground text-xs mt-1">
                  Respostas imediatas sem passar pela IA. Prioridade maior = disparada primeiro.
                </p>
              </div>
              <Button onClick={() => setShowAddReply(!showAddReply)} size="sm">
                <Plus className="w-4 h-4 mr-1" />
                Novo Gatilho
              </Button>
            </div>

            {showAddReply && (
              <div className="bg-secondary/30 rounded-lg p-4 border border-primary/20 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
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
                  <div className="space-y-1">
                    <Label className="text-xs">Prioridade</Label>
                    <Input
                      type="number"
                      value={newReplyPriority}
                      onChange={(e) => setNewReplyPriority(Number(e.target.value))}
                      className="bg-background"
                      min={0}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Texto da resposta</Label>
                  <Textarea
                    value={newResponseText}
                    onChange={(e) => setNewResponseText(e.target.value)}
                    placeholder="Texto da resposta automática... Pode incluir [ENVIAR_MEDIA:nome_do_arquivo.mp3] para enviar mídia junto."
                    className="bg-background min-h-[80px] text-sm"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" onClick={() => setShowAddReply(false)}>Cancelar</Button>
                  <Button size="sm" onClick={handleAddAutoReply} disabled={!newKeyword.trim()}>
                    <Save className="w-3.5 h-3.5 mr-1" />Salvar Gatilho
                  </Button>
                </div>
              </div>
            )}

            {autoReplies.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">
                <Zap className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum gatilho configurado.</p>
                <p className="text-xs mt-1">Gatilhos respondem instantaneamente sem usar a IA.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {autoReplies.map((reply) => (
                  <div key={reply.id} className={`rounded-lg px-4 py-3 border transition-all ${
                    reply.is_active ? "bg-secondary/30 border-border/50" : "bg-secondary/10 border-border/20 opacity-60"
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px] font-mono">
                          P{reply.priority}
                        </Badge>
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
                              handleUpdateReply(reply.id, "trigger_keyword", reply.trigger_keyword);
                              setEditingReply(null);
                            }}
                            className="h-7 text-sm w-40"
                            autoFocus
                          />
                        ) : (
                          <span className="text-sm font-semibold text-foreground">"{reply.trigger_keyword}"</span>
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
                    {editingReplyText === reply.id ? (
                      <Textarea
                        value={reply.response_text}
                        onChange={(e) => {
                          setAutoReplies((prev) =>
                            prev.map((r) => r.id === reply.id ? { ...r, response_text: e.target.value } : r)
                          );
                        }}
                        onBlur={() => {
                          handleUpdateReply(reply.id, "response_text", reply.response_text);
                          setEditingReplyText(null);
                        }}
                        className="text-sm min-h-[60px]"
                        autoFocus
                      />
                    ) : (
                      <div
                        className="text-xs text-muted-foreground bg-background/50 rounded p-2 cursor-pointer hover:bg-background/70 transition-colors"
                        onClick={() => setEditingReplyText(reply.id)}
                      >
                        {reply.response_text || <span className="italic">Clique para editar a resposta</span>}
                      </div>
                    )}
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
                  <Layers className="w-5 h-5 text-primary" />
                  Biblioteca de Mídia
                </h2>
                <p className="text-muted-foreground text-xs mt-1">
                  Áudios e vídeos que o bot pode enviar. Use o botão "Copiar Ref." para obter o código de referência.
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

            <div className="bg-secondary/30 rounded-lg p-3 border border-border/50 text-xs text-muted-foreground">
              <p className="flex items-center gap-1 font-semibold text-foreground mb-1">
                <Info className="w-3 h-3 text-primary" />
                Como usar mídia nas respostas:
              </p>
              <p>
                A IA pode enviar mídia automaticamente. Basta incluir na personalidade ou resposta automática:
                <code className="bg-background rounded px-1.5 py-0.5 mx-1 font-mono text-primary">[ENVIAR_MEDIA:nome_do_arquivo.mp3]</code>
              </p>
            </div>

            {mediaFiles.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">
                <Video className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Nenhuma mídia enviada ainda.</p>
                <p className="text-xs mt-1">Envie arquivos MP3 (áudio) ou MP4 (vídeo) de até 50MB.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {mediaFiles.map((media) => (
                  <div key={media.id} className="flex items-center justify-between bg-secondary/30 rounded-lg px-4 py-3 border border-border/50">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {media.file_type === "audio" ? (
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <FileAudio className="w-5 h-5 text-primary" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <FileVideo className="w-5 h-5 text-primary" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{media.file_name}</p>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span>{media.file_type === "audio" ? "🎵 Áudio" : "🎬 Vídeo"}</span>
                          <span>•</span>
                          <span>{formatFileSize(media.file_size)}</span>
                          <span>•</span>
                          <span className="font-mono text-primary">{media.file_name}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {media.file_type === "audio" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handlePlayMedia(media)}
                        >
                          {playingMedia === media.id ? (
                            <Pause className="w-4 h-4 text-primary" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </Button>
                      )}
                      {media.file_type === "video" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => window.open(media.file_url, "_blank")}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleCopyMediaRef(media)}
                      >
                        {copiedMediaId === media.id ? (
                          <Check className="w-4 h-4 text-primary" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteMedia(media)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4 mt-4">
          <div className="glass-card rounded-xl p-6 space-y-6">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary" />
              Configurações Avançadas
            </h2>

            <div className="space-y-4">
              <div className="bg-secondary/30 rounded-lg p-4 border border-border/50 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Timer className="w-4 h-4 text-primary" />
                  Humanização — Simulação de Presença
                </h3>
                <p className="text-xs text-muted-foreground">
                  Antes de cada resposta, o bot simula "digitando..." ou "gravando áudio..." na UAZAPI para parecer humano.
                </p>
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
                <div className="bg-background/50 rounded p-2 text-[11px] text-muted-foreground">
                  <strong>Texto:</strong> "Digitando..." por {minDelay}-{maxDelay}s &nbsp;•&nbsp;
                  <strong>Áudio:</strong> "Gravando..." por {minDelay + 2}-{maxDelay + 3}s
                </div>
              </div>

              <div className="bg-secondary/30 rounded-lg p-4 border border-border/50 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" />
                  Limite de Mensagens por Contato
                </h3>
                <div className="space-y-2">
                  <Label className="text-xs">Máximo por conversa: {maxMessagesPerContact === 0 ? "♾️ Ilimitado" : maxMessagesPerContact}</Label>
                  <Slider value={[maxMessagesPerContact]} onValueChange={([v]) => setMaxMessagesPerContact(v)} min={0} max={50} step={1} />
                  <p className="text-[11px] text-muted-foreground">
                    0 = ilimitado. Ao atingir o limite, a mensagem de encerramento é enviada e o bot para de responder.
                  </p>
                </div>
              </div>

              <div className="bg-secondary/30 rounded-lg p-4 border border-border/50 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Ban className="w-4 h-4 text-primary" />
                  Contatos Bloqueados
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  O bot ignora completamente mensagens destes números.
                </p>
                <div className="flex gap-2 flex-wrap">
                  <Input
                    value={newBlockPhone}
                    onChange={(e) => setNewBlockPhone(e.target.value)}
                    placeholder="5511999999999"
                    className="bg-background flex-1 min-w-[140px]"
                  />
                  <Input
                    value={newBlockReason}
                    onChange={(e) => setNewBlockReason(e.target.value)}
                    placeholder="Motivo (opcional)"
                    className="bg-background flex-1 min-w-[140px]"
                  />
                  <Button size="sm" onClick={handleAddBlockedContact} disabled={!newBlockPhone.trim()}>
                    <Ban className="w-3.5 h-3.5 mr-1" />Bloquear
                  </Button>
                </div>
                {blockedContacts.length > 0 && (
                  <div className="space-y-1 max-h-[200px] overflow-y-auto">
                    {blockedContacts.map((bc) => (
                      <div key={bc.id} className="flex items-center justify-between bg-background/50 rounded-lg px-3 py-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Ban className="w-3.5 h-3.5 text-destructive" />
                          <span className="font-mono text-foreground text-xs">{bc.phone}</span>
                          {bc.reason && <span className="text-muted-foreground text-[11px]">— {bc.reason}</span>}
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
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-primary" />
                Painel de Monitorização
              </h2>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    placeholder="Buscar..."
                    className="bg-secondary/50 pl-8 h-8 w-40 text-xs"
                  />
                </div>
                <Select value={logFilter} onValueChange={setLogFilter}>
                  <SelectTrigger className="bg-secondary/50 h-8 w-36 text-xs">
                    <Filter className="w-3 h-3 mr-1" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="client">Clientes</SelectItem>
                    <SelectItem value="new_contact">Novos Contatos</SelectItem>
                    <SelectItem value="welcome">Boas-Vindas</SelectItem>
                    <SelectItem value="auto_reply">Respostas Auto</SelectItem>
                    <SelectItem value="transfer">Transferência</SelectItem>
                    <SelectItem value="away">Fora do Horário</SelectItem>
                    <SelectItem value="media_received">Mídia Recebida</SelectItem>
                    <SelectItem value="invalid_payload">Payload Inválido</SelectItem>
                    <SelectItem value="error">Erros</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="sm" onClick={fetchLogs} disabled={logsLoading} className="h-8">
                  <RefreshCw className={`w-3.5 h-3.5 ${logsLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>

            {filteredLogs.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-sm">
                <Bot className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum atendimento encontrado.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {filteredLogs.map((log) => {
                  const ctx = CONTEXT_LABELS[log.context_type] || CONTEXT_LABELS.new_contact;
                  const isExpanded = expandedLog === log.id;
                  return (
                    <div
                      key={log.id}
                      className={`rounded-lg border transition-all cursor-pointer ${
                        log.status === "error"
                          ? "bg-destructive/5 border-destructive/20"
                          : "bg-secondary/30 border-border/50 hover:border-border"
                      }`}
                      onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                    >
                      <div className="flex items-center justify-between px-4 py-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="text-sm font-medium text-foreground truncate">{log.client_name}</span>
                          <Badge variant={ctx.color as any} className="text-[9px] shrink-0">
                            {ctx.label}
                          </Badge>
                          <span className="text-[11px] font-mono text-muted-foreground hidden md:inline">{log.phone}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {log.status === "error" && <AlertCircle className="w-3.5 h-3.5 text-destructive" />}
                          <span className="text-[11px] text-muted-foreground">
                            {format(new Date(log.created_at), "dd/MM HH:mm")}
                          </span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="px-4 pb-3 space-y-2 border-t border-border/30 pt-2">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                            <div className="bg-background/50 rounded p-2.5">
                              <span className="text-muted-foreground block mb-1 font-semibold">📩 Mensagem Recebida:</span>
                              <span className="text-foreground whitespace-pre-wrap">{log.message_received || "—"}</span>
                            </div>
                            <div className="bg-background/50 rounded p-2.5">
                              <span className="text-muted-foreground block mb-1 font-semibold">🤖 Resposta Enviada:</span>
                              <span className="text-foreground whitespace-pre-wrap">{log.message_sent || "—"}</span>
                            </div>
                          </div>
                          {log.error_message && (
                            <p className="text-xs text-destructive bg-destructive/10 rounded p-2">⚠️ {log.error_message}</p>
                          )}
                          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                            <span>📱 {log.phone}</span>
                            <span>•</span>
                            <span>Tipo: {ctx.label}</span>
                            <span>•</span>
                            <span>Status: {log.status}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {logs.length >= logsLimit && (
                  <Button
                    variant="ghost"
                    className="w-full text-xs"
                    onClick={() => {
                      setLogsLimit((prev) => prev + 50);
                      fetchLogs();
                    }}
                  >
                    Carregar mais...
                  </Button>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        {/* DIAGNOSTICS TAB */}
        <TabsContent value="diagnostics" className="space-y-4 mt-4">
          <div className="glass-card rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-primary" />
                  Painel de Diagnóstico
                </h2>
                <p className="text-muted-foreground text-xs mt-1">
                  Eventos recentes do webhook — falhas, payloads inválidos e mídias não processáveis.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={fetchLogs} disabled={logsLoading} className="h-8">
                <RefreshCw className={`w-3.5 h-3.5 mr-1 ${logsLoading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-secondary/30 rounded-lg p-3 border border-border/50 text-center">
                <p className="text-2xl font-bold text-foreground">{logStats.total}</p>
                <p className="text-[11px] text-muted-foreground">Total de Eventos</p>
              </div>
              <div className="bg-primary/5 rounded-lg p-3 border border-primary/20 text-center">
                <p className="text-2xl font-bold text-primary">{logStats.success}</p>
                <p className="text-[11px] text-muted-foreground">Processados</p>
              </div>
              <div className="bg-destructive/5 rounded-lg p-3 border border-destructive/20 text-center">
                <p className="text-2xl font-bold text-destructive">{logStats.errors}</p>
                <p className="text-[11px] text-muted-foreground">Erros</p>
              </div>
              <div className="bg-secondary/30 rounded-lg p-3 border border-border/50 text-center">
                <p className="text-2xl font-bold text-foreground">
                  {logs.filter((l) => l.context_type === "media_received" || l.context_type === "invalid_payload").length}
                </p>
                <p className="text-[11px] text-muted-foreground">Ignorados/Inválidos</p>
              </div>
            </div>

            {/* Diagnostic events list */}
            {(() => {
              const diagnosticLogs = logs.filter(
                (l) => l.status === "error" || l.status === "ignored" || l.context_type === "invalid_payload" || l.context_type === "media_received"
              );
              if (diagnosticLogs.length === 0) {
                return (
                  <div className="text-center py-10 text-muted-foreground text-sm">
                    <Check className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Nenhum problema encontrado! 🎉</p>
                    <p className="text-xs mt-1">Todos os webhooks foram processados com sucesso.</p>
                  </div>
                );
              }
              return (
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {diagnosticLogs.map((log) => {
                    const ctx = CONTEXT_LABELS[log.context_type] || CONTEXT_LABELS.error;
                    const isExpanded = expandedLog === log.id;
                    return (
                      <div
                        key={log.id}
                        className={`rounded-lg border transition-all cursor-pointer ${
                          log.status === "error"
                            ? "bg-destructive/5 border-destructive/20"
                            : log.status === "ignored"
                            ? "bg-muted/30 border-border/50"
                            : "bg-secondary/30 border-border/50"
                        }`}
                        onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                      >
                        <div className="flex items-center justify-between px-4 py-2.5">
                          <div className="flex items-center gap-2 min-w-0">
                            {log.status === "error" ? (
                              <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
                            ) : (
                              <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            )}
                            <span className="text-sm font-medium text-foreground truncate">{log.client_name}</span>
                            <Badge variant={ctx.color as any} className="text-[9px] shrink-0">
                              {ctx.label}
                            </Badge>
                            <Badge variant="outline" className="text-[9px] shrink-0">
                              {log.status}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[11px] font-mono text-muted-foreground hidden md:inline">{log.phone}</span>
                            <span className="text-[11px] text-muted-foreground">
                              {format(new Date(log.created_at), "dd/MM HH:mm:ss")}
                            </span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                          </div>
                        </div>
                        {isExpanded && (
                          <div className="px-4 pb-3 space-y-2 border-t border-border/30 pt-2">
                            {log.error_message && (
                              <div className="bg-destructive/10 rounded p-2.5 text-xs">
                                <span className="text-destructive font-semibold block mb-1">⚠️ Motivo da falha:</span>
                                <span className="text-foreground font-mono text-[11px] break-all">{log.error_message}</span>
                              </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                              <div className="bg-background/50 rounded p-2.5">
                                <span className="text-muted-foreground block mb-1 font-semibold">📩 Mensagem Recebida:</span>
                                <span className="text-foreground whitespace-pre-wrap">{log.message_received || "—"}</span>
                              </div>
                              <div className="bg-background/50 rounded p-2.5">
                                <span className="text-muted-foreground block mb-1 font-semibold">🤖 Resposta Enviada:</span>
                                <span className="text-foreground whitespace-pre-wrap">{log.message_sent || "—"}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                              <span>📱 {log.phone}</span>
                              <span>•</span>
                              <span>Tipo: {ctx.label}</span>
                              <span>•</span>
                              <span>Status: {log.status}</span>
                              <span>•</span>
                              <span>ID: <span className="font-mono">{log.id.slice(0, 8)}</span></span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
