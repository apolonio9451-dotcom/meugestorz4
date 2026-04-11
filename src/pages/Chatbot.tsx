import { useState, useEffect, useRef, useCallback } from "react";
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
  Eye, Volume2, Info, Search,
  ChevronDown, ChevronUp, Hash, Layers, Download,
  BookOpen, Route, Palette, Wifi, WifiOff
} from "lucide-react";
import { format } from "date-fns";
import AudioRecorder from "@/components/chatbot/AudioRecorder";
import ChatSimulator from "@/components/chatbot/ChatSimulator";
import TrainingRulesList from "@/components/chatbot/TrainingRulesList";

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
  training_rule: { label: "Regra Treinada", color: "default" },
};

export default function Chatbot() {
  const { effectiveCompanyId: companyId, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("simulador");
  const [trainingRulesRefresh, setTrainingRulesRefresh] = useState(0);
  const [dailySchedule, setDailySchedule] = useState<{ day: number; active: boolean; start: string; end: string }[]>(
    DAYS_OF_WEEK.map((d) => ({ day: d.value, active: [1, 2, 3, 4, 5].includes(d.value), start: "08:00", end: "18:00" }))
  );

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
  const [newContactInstructions, setNewContactInstructions] = useState("");
  const [clientInstructions, setClientInstructions] = useState("");
  const [presenceEnabled, setPresenceEnabled] = useState(true);
  const [aiDecisionLog, setAiDecisionLog] = useState(true);

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

  // WhatsApp Instance status
  const [instanceData, setInstanceData] = useState<{ profilePicture?: string; phone?: string; isConnected?: boolean; deviceName?: string } | null>(null);
  const [resyncingWebhook, setResyncingWebhook] = useState(false);
  const [webhookDiagnostics, setWebhookDiagnostics] = useState<{ webhook_registered?: boolean; api_status?: string; debug?: any } | null>(null);

  // Autosave timer for personality
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!companyId) { setLoading(false); return; }
    fetchAll();
  }, [companyId]);

  // Realtime subscription for instant status updates
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`whatsapp-status-${user.id}`)
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
            const connected = row.is_connected === true || row.status === 'connected';
            setInstanceData(prev => ({
              ...prev,
              isConnected: connected,
              deviceName: row.device_name || prev?.deviceName || '',
            }));
            // Fetch profile if newly connected
            if (connected && !instanceData?.profilePicture) {
              fetchProfileOnly();
            }
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  // Auto-refresh instance status every 60 seconds (lighter — no API overrides)
  useEffect(() => {
    if (!companyId || !user?.id) return;
    const interval = setInterval(() => {
      fetchInstanceStatus();
    }, 60000);
    return () => clearInterval(interval);
  }, [companyId, user?.id]);

  const fetchProfileOnly = async () => {
    if (!companyId) return;
    try {
      const { data: profileData } = await supabase.functions.invoke("whatsapp-manage", {
        body: { action: "profile-picture", company_id: companyId },
      });
      if (profileData) {
        setInstanceData(prev => ({
          ...prev,
          isConnected: prev?.isConnected ?? true,
          profilePicture: profileData.profile_picture || prev?.profilePicture || '',
          phone: profileData.phone || prev?.phone || '',
          deviceName: profileData.profile_name || prev?.deviceName || '',
        }));
      }
    } catch {}
  };

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchSettings(), fetchMedia(), fetchLogs(), fetchAutoReplies(), fetchBlockedContacts(), fetchApiStatus(), fetchInstanceStatus()]);
    setLoading(false);
  };

  const fetchInstanceStatus = async () => {
    if (!user?.id) return;
    try {
      // Primary source: DB status (single source of truth)
      const { data: dbInstance } = await supabase
        .from("whatsapp_instances")
        .select("is_connected, device_name, server_url, status")
        .eq("user_id", user.id)
        .maybeSingle();

      const dbConnected = dbInstance?.is_connected === true || dbInstance?.status === "connected";

      // Fetch profile data if connected (non-blocking, no status override)
      let profilePic = instanceData?.profilePicture || "";
      let profilePhone = instanceData?.phone || "";
      let profileName = "";

      if (dbConnected) {
        try {
          const { data: profileData } = await supabase.functions.invoke("whatsapp-manage", {
            body: { action: "profile-picture", company_id: companyId },
          });
          if (profileData) {
            profilePic = profileData.profile_picture || profilePic;
            profilePhone = profileData.phone || profilePhone;
            profileName = profileData.profile_name || "";
          }
        } catch {}
      }

      setInstanceData({
        isConnected: dbConnected,
        deviceName: profileName || (dbInstance?.device_name as string) || "",
        phone: profilePhone,
        profilePicture: profilePic,
      });
    } catch {
      setInstanceData(null);
    }
  };

  const handleResyncWebhook = async () => {
    setResyncingWebhook(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-manage", {
        body: { action: "resync-webhook", company_id: companyId },
      });
      if (error) throw error;
      setWebhookDiagnostics({
        webhook_registered: data?.webhook_registered === true,
        api_status: data?.api_status,
        debug: data?.debug,
      });
      if (data?.connected && data?.webhook_registered) {
        toast({ title: "✅ Webhook re-sincronizado!", description: "A conexão está ativa e o webhook foi registrado com sucesso." });
      } else if (data?.connected && !data?.webhook_registered) {
        toast({ title: "⚠️ Conectado, mas webhook falhou", description: `A instância está online, mas o registro do webhook falhou. ${data?.debug?.registration_response || "Tente novamente."}`, variant: "destructive" });
      } else {
        toast({ title: "❌ Instância desconectada", description: "Reconecte seu WhatsApp na aba Instância.", variant: "destructive" });
      }
      await fetchInstanceStatus();
    } catch (err: any) {
      toast({ title: "Erro ao re-sincronizar", description: err?.message, variant: "destructive" });
    } finally {
      setResyncingWebhook(false);
    }
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
      setNewContactInstructions(d.new_contact_instructions || "");
      setClientInstructions(d.client_instructions || "");
      setPresenceEnabled(d.presence_enabled !== false);
      setAiDecisionLog(d.ai_decision_log !== false);
      setMenuEnabled(d.interactive_menu_enabled ?? false);
      setMenuType(d.interactive_menu_type || "buttons");
      setMenuTitle(d.interactive_menu_title || "");
      setMenuBody(d.interactive_menu_body || "");
      setMenuFooter(d.interactive_menu_footer || "");
      setMenuButtonText(d.interactive_menu_button_text || "Ver Opções");
      setMenuItems(d.interactive_menu_items || []);
      // Load per-day schedule
      if (d.daily_schedule && Array.isArray(d.daily_schedule) && d.daily_schedule.length > 0) {
        setDailySchedule(d.daily_schedule as any);
      } else {
        // Init from legacy fields
        setDailySchedule(DAYS_OF_WEEK.map((day) => ({
          day: day.value,
          active: (d.business_days || [1, 2, 3, 4, 5]).includes(day.value),
          start: d.business_hours_start || "08:00",
          end: d.business_hours_end || "18:00",
        })));
      }
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
        new_contact_instructions: newContactInstructions.trim(),
        client_instructions: clientInstructions.trim(),
        presence_enabled: presenceEnabled,
        ai_decision_log: aiDecisionLog,
        interactive_menu_enabled: menuEnabled,
        interactive_menu_type: menuType,
        interactive_menu_title: menuTitle.trim(),
        interactive_menu_body: menuBody.trim(),
        interactive_menu_footer: menuFooter.trim(),
        interactive_menu_button_text: menuButtonText.trim(),
        interactive_menu_items: menuItems,
        daily_schedule: dailySchedule,
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

  const handleAutoSavePersonality = useCallback((value: string) => {
    setPersonality(value);
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(async () => {
      if (!companyId || !settingsId) return;
      try {
        await supabase.from("chatbot_settings").update({ personality: value.trim() }).eq("id", settingsId);
        toast({ title: "💾 Personalidade salva automaticamente" });
      } catch { /* silent */ }
    }, 2000);
  }, [companyId, settingsId]);

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
    const ref = `[ENVIAR_MEDIA:${media.file_name}]`;
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

  const isConnected = instanceData?.isConnected === true;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <audio ref={audioRef} onEnded={() => setPlayingMedia(null)} className="hidden" />

      {/* ═══════ COMPACT HEADER ═══════ */}
      <div className="space-y-2">
        {/* Row 1: Title + Toggle + Schedule */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Brain className="w-5 h-5 md:w-6 md:h-6 text-primary shrink-0" />
            <h1 className="text-base md:text-xl font-display font-bold text-foreground truncate">
              Agente IA
            </h1>
            {/* Inline connection badge */}
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
              isConnected ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-primary animate-pulse" : "bg-destructive"}`} />
              {isConnected ? "Online" : "Offline"}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Compact Bot Toggle */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border transition-all text-xs font-semibold ${
              isActive
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-destructive/5 border-destructive/20 text-destructive"
            }`}>
              <div className={`w-2 h-2 rounded-full ${isActive ? "bg-primary animate-pulse" : "bg-destructive"}`} />
              <span className="hidden sm:inline">{isActive ? "Ativo" : "Off"}</span>
              <Switch checked={isActive} onCheckedChange={async (v) => {
                if (v && !apiConfigured) {
                  setShowApiModal(true);
                  return;
                }
                if (v && !isConnected) {
                  toast({ title: "⚠️ Instância pode estar desconectada", description: "O bot será ativado, mas só responderá quando conectado." });
                }
                setIsActive(v);
                if (companyId) {
                  try {
                    if (settingsId) {
                      const { error: updateErr } = await supabase.from("chatbot_settings").update({ is_active: v }).eq("id", settingsId);
                      if (updateErr) throw updateErr;
                    } else {
                      const { data } = await supabase.from("chatbot_settings").insert({ company_id: companyId, is_active: v }).select().single();
                      if (data) setSettingsId((data as any).id);
                    }
                    toast({ title: v ? "✅ Bot ativado!" : "🤖 Bot desativado." });
                    if (v) handleResyncWebhook();
                  } catch (err: any) {
                    setIsActive(!v);
                    toast({ title: "Erro", description: err?.message, variant: "destructive" });
                  }
                }
              }} className="scale-75" />
            </div>
            <button
              onClick={() => setShowSchedulePanel(!showSchedulePanel)}
              className="p-1.5 rounded-lg hover:bg-secondary/60 transition-colors"
              title="Horário de atividade"
            >
              <Clock className="w-4 h-4 text-muted-foreground" />
            </button>
            <button
              onClick={handleResyncWebhook}
              disabled={resyncingWebhook}
              className="p-1.5 rounded-lg hover:bg-secondary/60 transition-colors"
              title="Re-sincronizar webhook"
            >
              <RefreshCw className={`w-4 h-4 text-muted-foreground ${resyncingWebhook ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Row 2: Instance detail (desktop only) */}
        <div className="hidden md:flex items-center gap-3 px-3 py-2 rounded-lg bg-secondary/20 border border-border/30">
          <div className="relative shrink-0">
            {instanceData?.profilePicture ? (
              <img
                src={instanceData.profilePicture}
                alt="WhatsApp"
                className={`w-8 h-8 rounded-full object-cover ring-2 ${isConnected ? "ring-primary/40" : "ring-destructive/40"}`}
              />
            ) : (
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isConnected ? "bg-primary/10" : "bg-destructive/10"}`}>
                <Phone className={`w-3.5 h-3.5 ${isConnected ? "text-primary" : "text-destructive"}`} />
              </div>
            )}
            <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background ${
              isConnected ? "bg-green-500" : "bg-red-500"
            }`} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground truncate">
              {instanceData?.deviceName || "Instância"}
            </p>
            <p className={`text-[10px] ${isConnected ? "text-primary" : "text-destructive"}`}>
              {isConnected
                ? instanceData?.phone
                  ? instanceData.phone.replace(/\D/g, "").replace(/^55(\d{2})(\d{4,5})(\d{4})$/, "+55 $1 $2-$3")
                  : "Conectado"
                : "Desconectado"}
            </p>
          </div>
          {webhookDiagnostics && !webhookDiagnostics.webhook_registered && isConnected && (
            <span className="text-[9px] text-destructive font-bold animate-pulse ml-auto">⚠ Webhook</span>
          )}
        </div>

        {/* Schedule Panel */}
        {showSchedulePanel && (
          <div className="glass-card rounded-xl p-5 space-y-5 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                <span className="text-sm font-bold text-foreground">Período de Atividade do Agente</span>
              </div>
              <Button
                variant={!businessHoursEnabled ? "default" : "outline"}
                size="sm"
                className={`text-xs h-8 gap-1.5 font-semibold transition-all ${
                  !businessHoursEnabled
                    ? "shadow-[0_0_12px_hsl(var(--primary)/0.3)]"
                    : ""
                }`}
                onClick={() => {
                  setBusinessHoursEnabled(false);
                  setDailySchedule(DAYS_OF_WEEK.map((d) => ({ day: d.value, active: true, start: "00:00", end: "23:59" })));
                }}
              >
                <Zap className="w-3.5 h-3.5" />
                Ativar 24h
              </Button>
            </div>

            {/* Toggle business hours */}
            <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-secondary/30 border border-border/40">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-foreground font-medium">Programação Personalizada</span>
              </div>
              <Switch checked={businessHoursEnabled} onCheckedChange={setBusinessHoursEnabled} />
            </div>

            {businessHoursEnabled && (
              <div className="space-y-2">
                {DAYS_OF_WEEK.map((dayInfo) => {
                  const schedule = dailySchedule.find((s) => s.day === dayInfo.value) || { day: dayInfo.value, active: false, start: "08:00", end: "18:00" };
                  const updateDay = (field: string, value: any) => {
                    setDailySchedule((prev) =>
                      prev.map((s) => s.day === dayInfo.value ? { ...s, [field]: value } : s)
                    );
                  };
                  return (
                    <div
                      key={dayInfo.value}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                        schedule.active
                          ? "bg-primary/5 border-primary/20"
                          : "bg-secondary/20 border-border/30 opacity-60"
                      }`}
                    >
                      <Switch
                        checked={schedule.active}
                        onCheckedChange={(v) => updateDay("active", v)}
                      />
                      <span className={`text-sm font-semibold w-10 ${schedule.active ? "text-foreground" : "text-muted-foreground"}`}>
                        {dayInfo.label}
                      </span>
                      {schedule.active && (
                        <div className="flex items-center gap-2 ml-auto">
                          <Input
                            type="time"
                            value={schedule.start}
                            onChange={(e) => updateDay("start", e.target.value)}
                            className="h-8 text-xs w-[100px] bg-background/50 border-border/40"
                          />
                          <span className="text-xs text-muted-foreground">até</span>
                          <Input
                            type="time"
                            value={schedule.end}
                            onChange={(e) => updateDay("end", e.target.value)}
                            className="h-8 text-xs w-[100px] bg-background/50 border-border/40"
                          />
                        </div>
                      )}
                      {!schedule.active && (
                        <span className="text-xs text-muted-foreground ml-auto">Inativo</span>
                      )}
                    </div>
                  );
                })}
                <p className="text-[11px] text-muted-foreground flex items-center gap-1 pt-1">
                  <Info className="w-3 h-3" />
                  Fora do horário, o bot enviará a mensagem de ausência configurada (fuso: Brasília).
                </p>
              </div>
            )}

            <div className="flex justify-end pt-1">
              <Button size="sm" onClick={handleSaveSettings} disabled={saving} className="gap-1.5">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
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
              <p>Para ativar o Chatbot IA, é necessário configurar a <strong>URL da API</strong> e o <strong>Token</strong> da sua instância UAZAPI.</p>
              <p>Acesse o menu <strong>Configuração Geral</strong> → seção <strong>API de WhatsApp (UAZAPI)</strong> e preencha os campos obrigatórios.</p>
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

      {/* ═══════ GLASSMORPHISM STATS ═══════ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { value: logStats.total, label: "Total Atendimentos", color: "text-foreground" },
          { value: logStats.success, label: "Sucesso", color: "text-primary" },
          { value: logStats.clients, label: "Clientes", color: "text-foreground" },
          { value: logStats.newContacts, label: "Novos Contatos", color: "text-foreground" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="relative overflow-hidden rounded-xl border border-border/30 p-4 text-center backdrop-blur-md bg-background/40"
            style={{
              background: "linear-gradient(135deg, hsl(var(--background) / 0.6), hsl(var(--card) / 0.3))",
              boxShadow: "0 8px 32px 0 hsl(var(--primary) / 0.06), inset 0 0 0 1px hsl(var(--border) / 0.1)",
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
            <p className={`text-2xl font-bold ${stat.color} relative z-10`}>{stat.value}</p>
            <p className="text-xs text-muted-foreground relative z-10">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* ═══════ MAIN TABS ═══════ */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto gap-1 p-1">
          <TabsTrigger value="interacao" className="text-[10px] md:text-xs py-1.5 px-1.5 shrink-0">
            <Music className="w-3 h-3 mr-1" />Mídia
          </TabsTrigger>
          <TabsTrigger value="simulador" className="text-[10px] md:text-xs py-1.5 px-1.5 shrink-0">
            <Brain className="w-3 h-3 mr-1" />Treinar IA
          </TabsTrigger>
          <TabsTrigger value="logs" className="text-[10px] md:text-xs py-1.5 px-1.5 shrink-0">
            <MessageCircle className="w-3 h-3 mr-1" />Logs
            {logStats.errors > 0 && (
              <span className="ml-1 bg-destructive text-destructive-foreground text-[9px] rounded-full px-1">{logStats.errors}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="avancado" className="text-[10px] md:text-xs py-1.5 px-1.5 shrink-0">
            <Settings2 className="w-3 h-3 mr-1" />Avançado
          </TabsTrigger>
        </TabsList>

        {/* ═══════ TAB: MÍDIA ═══════ */}
        <TabsContent value="interacao" className="space-y-4 mt-4">
          <div className="glass-card rounded-xl p-3 md:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm md:text-lg font-semibold text-foreground flex items-center gap-2">
                  <Music className="w-5 h-5 text-primary" />
                  Biblioteca de Mídia & Gravador
                </h2>
                <p className="text-muted-foreground text-[11px] md:text-xs mt-1">
                  Grave áudios pelo navegador ou faça upload. Use <code className="text-primary">[ENVIAR_MEDIA:nome]</code> nos scripts para a IA enviar automaticamente.
                </p>
              </div>
              <div>
                <input ref={fileInputRef} type="file" accept=".mp3,.mp4,.ogg,audio/mpeg,audio/ogg,video/mp4" className="hidden" onChange={handleUploadMedia} />
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                  Upload
                </Button>
              </div>
            </div>

            {companyId && <AudioRecorder companyId={companyId} onUploaded={fetchMedia} />}

            {mediaFiles.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Video className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>Nenhuma mídia enviada ainda.</p>
                <p className="text-xs mt-1">MP3 (áudio) ou MP4 (vídeo) até 50MB.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {mediaFiles.map((media) => (
                  <div key={media.id} className="flex items-center justify-between bg-secondary/30 rounded-lg px-4 py-3 border border-border/50">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${media.file_type === "audio" ? "bg-primary/10" : "bg-accent/20"}`}>
                        {media.file_type === "audio" ? <FileAudio className="w-4 h-4 text-primary" /> : <FileVideo className="w-4 h-4 text-foreground" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{media.file_name}</p>
                        <p className="text-[11px] text-muted-foreground">{formatFileSize(media.file_size)} • {format(new Date(media.created_at), "dd/MM/yy HH:mm")}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {media.file_type === "audio" && (
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handlePlayMedia(media)}>
                          {playingMedia === media.id ? <Pause className="w-3.5 h-3.5 text-primary" /> : <Play className="w-3.5 h-3.5" />}
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopyMediaRef(media)}>
                        {copiedMediaId === media.id ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteMedia(media)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ═══════ TAB: PLAYGROUND (Side-by-Side) ═══════ */}
        <TabsContent value="simulador" className="space-y-4 mt-4">
          {companyId && (
            <>
              {/* Side-by-side Playground layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* LEFT: System Prompt / Instructions Editor */}
                <div className="glass-card rounded-xl p-4 md:p-5 space-y-4 flex flex-col">
                  <div className="flex items-center justify-between shrink-0">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Pencil className="w-4 h-4 text-primary" />
                      Personalidade & Prompt de Sistema
                    </h3>
                    <div className="flex items-center gap-2">
                      <Select value={aiModel} onValueChange={setAiModel}>
                        <SelectTrigger className="h-7 text-[10px] w-[150px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {AI_MODELS.map((m) => (
                            <SelectItem key={m.value} value={m.value}>
                              <span className="text-xs">{m.label}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleRestoreDefaults} title="Restaurar padrão">
                        <RotateCcw className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  <Textarea
                    value={personality}
                    onChange={(e) => handleAutoSavePersonality(e.target.value)}
                    placeholder={DEFAULT_PERSONALITY}
                    className="flex-1 min-h-[200px] text-sm bg-secondary/20 border-border/30 resize-none font-mono leading-relaxed"
                  />

                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground">Instrução: Novos Contatos</Label>
                      <Textarea
                        value={newContactInstructions}
                        onChange={(e) => setNewContactInstructions(e.target.value)}
                        placeholder="Como a IA deve tratar novos contatos..."
                        className="min-h-[80px] text-xs bg-secondary/20 border-border/30"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold text-muted-foreground">Instrução: Clientes Existentes</Label>
                      <Textarea
                        value={clientInstructions}
                        onChange={(e) => setClientInstructions(e.target.value)}
                        placeholder="Como a IA deve tratar clientes existentes..."
                        className="min-h-[80px] text-xs bg-secondary/20 border-border/30"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between shrink-0 pt-2 border-t border-border/30">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <Label className="text-[10px] text-muted-foreground">Temperatura:</Label>
                        <span className="text-xs font-mono text-foreground">{aiTemperature}</span>
                      </div>
                      <Slider
                        value={[aiTemperature]}
                        onValueChange={([v]) => setAiTemperature(v)}
                        min={0}
                        max={1}
                        step={0.1}
                        className="w-24"
                      />
                    </div>
                    <Button size="sm" onClick={handleSaveSettings} disabled={saving}>
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                      Salvar Tudo
                    </Button>
                  </div>
                </div>

                {/* RIGHT: Chat Simulator */}
                <div className="min-h-[650px]">
                  <ChatSimulator companyId={companyId} onRuleSaved={() => setTrainingRulesRefresh(prev => prev + 1)} />
                </div>
              </div>

              {/* Training Rules below */}
              <div className="glass-card rounded-xl p-3 md:p-6">
                <TrainingRulesList companyId={companyId} refreshKey={trainingRulesRefresh} />
              </div>
            </>
          )}
          {!companyId && (
            <div className="glass-card rounded-xl p-6 text-center text-muted-foreground">Carregando...</div>
          )}
        </TabsContent>

        {/* ═══════ TAB: LOGS (Enhanced) ═══════ */}
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
                  <Input value={logSearch} onChange={(e) => setLogSearch(e.target.value)} placeholder="Buscar..." className="bg-secondary/50 pl-8 h-8 w-40 text-xs" />
                </div>
                <Select value={logFilter} onValueChange={setLogFilter}>
                  <SelectTrigger className="bg-secondary/50 h-8 w-36 text-xs"><Filter className="w-3 h-3 mr-1" /><SelectValue /></SelectTrigger>
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
                  // Confidence indicator based on context
                  const confidenceMap: Record<string, { label: string; color: string }> = {
                    training_rule: { label: "Regra Treinada", color: "bg-primary/20 text-primary" },
                    auto_reply: { label: "Gatilho Exato", color: "bg-primary/20 text-primary" },
                    client: { label: "IA + Contexto", color: "bg-accent/30 text-accent-foreground" },
                    new_contact: { label: "IA Geral", color: "bg-secondary text-muted-foreground" },
                    welcome: { label: "Script Fixo", color: "bg-primary/10 text-primary" },
                    away: { label: "Script Fixo", color: "bg-secondary text-muted-foreground" },
                  };
                  const confidence = confidenceMap[log.context_type];

                  return (
                    <div key={log.id} className={`rounded-lg border transition-all cursor-pointer ${log.status === "error" ? "bg-destructive/5 border-destructive/20" : "bg-secondary/30 border-border/50 hover:border-border"}`} onClick={() => setExpandedLog(isExpanded ? null : log.id)}>
                      <div className="flex items-center justify-between px-4 py-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="text-sm font-medium text-foreground truncate">{log.client_name}</span>
                          <Badge variant={ctx.color as any} className="text-[9px] shrink-0">{ctx.label}</Badge>
                          {confidence && (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0 hidden md:inline ${confidence.color}`}>
                              {confidence.label}
                            </span>
                          )}
                          <span className="text-[11px] font-mono text-muted-foreground hidden md:inline">{log.phone}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {log.status === "error" && <AlertCircle className="w-3.5 h-3.5 text-destructive" />}
                          <span className="text-[11px] text-muted-foreground">{format(new Date(log.created_at), "dd/MM HH:mm")}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                        </div>
                      </div>
                      {isExpanded && (
                        <div className="px-4 pb-3 space-y-2 border-t border-border/30 pt-2">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                            <div className="bg-background/50 rounded p-2.5">
                              <span className="text-muted-foreground block mb-1 font-semibold">📩 Recebida:</span>
                              <span className="text-foreground whitespace-pre-wrap">{log.message_received || "—"}</span>
                            </div>
                            <div className="bg-background/50 rounded p-2.5">
                              <span className="text-muted-foreground block mb-1 font-semibold">🤖 Enviada:</span>
                              <span className="text-foreground whitespace-pre-wrap">{log.message_sent || "—"}</span>
                            </div>
                          </div>
                          {log.error_message && <p className="text-xs text-destructive bg-destructive/10 rounded p-2">⚠️ {log.error_message}</p>}
                          <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
                            <span>📱 {log.phone}</span><span>•</span><span>Tipo: {ctx.label}</span><span>•</span><span>Status: {log.status}</span>
                            {confidence && (
                              <>
                                <span>•</span>
                                <span className={`px-1.5 py-0.5 rounded-full ${confidence.color}`}>
                                  🎯 Fonte: {confidence.label}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {logs.length >= logsLimit && (
                  <Button variant="ghost" className="w-full text-xs" onClick={() => { setLogsLimit((prev) => prev + 50); fetchLogs(); }}>Carregar mais...</Button>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ═══════ TAB: AVANÇADO ═══════ */}
        <TabsContent value="avancado" className="space-y-4 mt-4">
          <div className="glass-card rounded-xl p-6 space-y-6">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary" />
              Configurações Avançadas
            </h2>

            {/* Humanização delays */}
            <div className="bg-secondary/30 rounded-lg p-4 border border-border/50 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Timer className="w-4 h-4 text-primary" />Simulação de Presença</h3>
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
            </div>

            {/* Rate limit */}
            <div className="bg-secondary/30 rounded-lg p-4 border border-border/50 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Shield className="w-4 h-4 text-primary" />Limite de Mensagens por Contato</h3>
              <div className="space-y-2">
                <Label className="text-xs">Máximo: {maxMessagesPerContact === 0 ? "♾️ Ilimitado" : maxMessagesPerContact}</Label>
                <Slider value={[maxMessagesPerContact]} onValueChange={([v]) => setMaxMessagesPerContact(v)} min={0} max={50} step={1} />
                <p className="text-[11px] text-muted-foreground">0 = ilimitado. Ao atingir, envia mensagem de encerramento.</p>
              </div>
            </div>

            {/* Blocked contacts */}
            <div className="bg-secondary/30 rounded-lg p-4 border border-border/50 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Ban className="w-4 h-4 text-primary" />Contatos Bloqueados</h3>
              <div className="flex gap-2 flex-wrap">
                <Input value={newBlockPhone} onChange={(e) => setNewBlockPhone(e.target.value)} placeholder="5511999999999" className="bg-background flex-1 min-w-[140px]" />
                <Input value={newBlockReason} onChange={(e) => setNewBlockReason(e.target.value)} placeholder="Motivo (opcional)" className="bg-background flex-1 min-w-[140px]" />
                <Button size="sm" onClick={handleAddBlockedContact} disabled={!newBlockPhone.trim()}><Ban className="w-3.5 h-3.5 mr-1" />Bloquear</Button>
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
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemoveBlocked(bc.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Diagnostics Summary */}
            <div className="border-t border-border pt-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3"><AlertCircle className="w-4 h-4 text-primary" />Diagnóstico</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-secondary/30 rounded-lg p-3 border border-border/50 text-center">
                  <p className="text-2xl font-bold text-foreground">{logStats.total}</p>
                  <p className="text-[11px] text-muted-foreground">Total</p>
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
                  <p className="text-2xl font-bold text-foreground">{logs.filter((l) => l.context_type === "media_received" || l.context_type === "invalid_payload").length}</p>
                  <p className="text-[11px] text-muted-foreground">Ignorados</p>
                </div>
              </div>

              {(() => {
                const diagnosticLogs = logs.filter((l) => l.status === "error" || l.status === "ignored" || l.context_type === "invalid_payload" || l.context_type === "media_received");
                if (diagnosticLogs.length === 0) {
                  return (
                    <div className="text-center py-6 text-muted-foreground text-sm mt-3">
                      <Check className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p>Nenhum problema encontrado! 🎉</p>
                    </div>
                  );
                }
                return (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto mt-3">
                    {diagnosticLogs.slice(0, 20).map((log) => {
                      const ctx = CONTEXT_LABELS[log.context_type] || CONTEXT_LABELS.error;
                      return (
                        <div key={log.id} className={`rounded-lg border px-4 py-2.5 ${log.status === "error" ? "bg-destructive/5 border-destructive/20" : "bg-secondary/30 border-border/50"}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              {log.status === "error" ? <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" /> : <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                              <span className="text-sm font-medium text-foreground truncate">{log.client_name}</span>
                              <Badge variant={ctx.color as any} className="text-[9px] shrink-0">{ctx.label}</Badge>
                            </div>
                            <span className="text-[11px] text-muted-foreground">{format(new Date(log.created_at), "dd/MM HH:mm")}</span>
                          </div>
                          {log.error_message && <p className="text-xs text-destructive mt-1">⚠️ {log.error_message}</p>}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSaveSettings} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar Configurações
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
