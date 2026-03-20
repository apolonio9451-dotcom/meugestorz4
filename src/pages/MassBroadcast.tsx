import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  ExternalLink,
  ImagePlus,
  Info,
  Loader2,
  MessageSquareMore,
  Mic,
  PauseCircle,
  Pencil,
  Plus,
  Radio,
  RefreshCw,
  Rocket,
  Save,
  Terminal,
  Timer,
  Trash2,
  User,
  X,
} from "lucide-react";
import AnimatedPage from "@/components/AnimatedPage";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Slider } from "@/components/ui/slider";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/* ─── Types ─── */
type Campaign = {
  id: string;
  name: string;
  status: string;
  total_recipients: number;
  processed_recipients: number;
  success_count: number;
  failure_count: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  offer_templates: string[];
  greeting_templates: string[];
  message_delay_min_seconds: number;
  message_delay_max_seconds: number;
  seller_instructions: string;
  offer_timeout_minutes: number;
};

type Recipient = {
  id: string;
  campaign_id: string;
  phone: string;
  normalized_phone: string;
  offer_template: string;
  status: string;
  current_step: string;
  error_message: string | null;
};

type LogRow = {
  id: string;
  campaign_id: string;
  phone: string;
  step: string;
  status: string;
  message: string;
  error_message: string | null;
  created_at: string;
};

type Conversation = {
  id: string;
  campaign_id: string;
  recipient_id: string | null;
  phone: string;
  normalized_phone: string;
  contact_name: string;
  conversation_status: string;
  has_reply: boolean;
  last_message_at: string;
  last_outgoing_at: string | null;
  last_incoming_at: string | null;
};

type ConversationMessage = {
  id: string;
  conversation_id: string;
  campaign_id: string;
  phone: string;
  direction: string;
  sender_type: string;
  message_type: string;
  message: string;
  delivery_status: string | null;
  created_at: string;
};

type MediaKind = "audio" | "image";

/* ─── Helpers ─── */
const normalizePhone = (value: string) => value.replace(/\D/g, "");

const STORAGE_KEY_TEMPLATES = "mass_broadcast_saved_templates";
const MAX_TEMPLATES = 10;

const loadSavedTemplates = (): string[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TEMPLATES);
    if (!raw) return [];
    return JSON.parse(raw).slice(0, MAX_TEMPLATES);
  } catch {
    return [];
  }
};

const saveSavedTemplates = (templates: string[]) => {
  localStorage.setItem(STORAGE_KEY_TEMPLATES, JSON.stringify(templates.slice(0, MAX_TEMPLATES)));
};

const statusLabel: Record<string, string> = {
  queued: "Na fila",
  running: "Rodando",
  completed: "Concluída",
  paused: "Pausada",
};

const statusIcon: Record<string, { icon: typeof Check; cls: string }> = {
  sent: { icon: Check, cls: "text-primary" },
  success: { icon: Check, cls: "text-primary" },
  completed: { icon: Check, cls: "text-primary" },
  pending: { icon: Clock, cls: "text-warning" },
  processing: { icon: Loader2, cls: "text-warning animate-spin" },
  failed: { icon: X, cls: "text-destructive" },
};

const recipientStatusText: Record<string, string> = {
  pending: "Pendente",
  processing: "Enviando...",
  sent: "Enviado ✅",
  failed: "Erro ❌",
};

const recipientStepText: Record<string, string> = {
  greeting: "⏳ Na fila",
  offer: "⏳ Na fila",
  done: "✅ Enviado",
};

const conversationStatusMeta: Record<string, { label: string; className: string; pulse?: boolean; icon: string }> = {
  bot_active: { label: "🤖 Bot Ativo", className: "border-primary/40 bg-primary/10 text-primary", pulse: true, icon: "⚡" },
  awaiting_human: { label: "🔥 Cliente Respondeu", className: "border-orange-500/30 bg-orange-500/15 text-orange-400", pulse: true, icon: "💬" },
  human_takeover: { label: "👤 Assumida por humano", className: "border-warning/30 bg-warning/15 text-warning", icon: "👤" },
  not_interested: { label: "🚫 Não Interessado", className: "border-destructive/30 bg-destructive/10 text-destructive", icon: "🚫" },
};

const logStepLabel: Record<string, string> = {
  greeting: "Saudação enviada",
  offer: "Oferta enviada",
  offer_timeout: "Oferta (timeout)",
  incoming_message: "Mensagem recebida",
  ai_processing: "IA processando",
  ai_offer_cta_sent: "Oferta + CTA enviados",
  ai_offer_reply: "IA respondeu",
  ai_error: "Erro da IA",
  not_interested: "Cliente não interessado",
};

/* ─── Countdown Hook ─── */
function useCountdown(targetIso: string | null) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!targetIso) { setSeconds(0); return; }
    const calc = () => setSeconds(Math.max(0, Math.floor((new Date(targetIso).getTime() - Date.now()) / 1000)));
    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [targetIso]);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return { seconds, display: `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}` };
}

/* ─── Component ─── */
export default function MassBroadcast() {
  const { effectiveCompanyId: companyId, user } = useAuth();
  const audioInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const realtimeRefreshTimerRef = useRef<number | null>(null);

  // Global controls
  const [globalEnabled, setGlobalEnabled] = useState(false);
  const [savingToggle, setSavingToggle] = useState(false);

  // Campaign creation
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [delayRange, setDelayRange] = useState<[number, number]>([60, 120]);
  const [startHour, setStartHour] = useState("08:00");
  const [sellerInstructions, setSellerInstructions] = useState("");
  const [offerTimeout, setOfferTimeout] = useState(5);

  // Template management
  const [savedTemplates, setSavedTemplates] = useState<string[]>(loadSavedTemplates);
  const [editingTemplate, setEditingTemplate] = useState<string>("");
  const [templatesOpen, setTemplatesOpen] = useState(false);

  // Data
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);

  // Campaign library: expanded campaign recipients
  const [expandedCampaignRecipients, setExpandedCampaignRecipients] = useState<Record<string, Recipient[]>>({});
  const [loadingRecipients, setLoadingRecipients] = useState<string | null>(null);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [editPhoneInput, setEditPhoneInput] = useState("");
  const [deletingCampaignId, setDeletingCampaignId] = useState<string | null>(null);
  const [duplicatingCampaignId, setDuplicatingCampaignId] = useState<string | null>(null);

  // Monitor
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationMessages, setConversationMessages] = useState<ConversationMessage[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [mediaSending, setMediaSending] = useState<MediaKind | null>(null);
  const [takingOverConversationId, setTakingOverConversationId] = useState<string | null>(null);
  const [monitorCampaignId, setMonitorCampaignId] = useState<string | null>(null);

  // Chat history modal
  const [historyPhone, setHistoryPhone] = useState<string | null>(null);
  const [historyCampaignId, setHistoryCampaignId] = useState<string | null>(null);
  const [historyMessages, setHistoryMessages] = useState<ConversationMessage[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Next action countdown
  const [nextActionAt, setNextActionAt] = useState<string | null>(null);
  const countdown = useCountdown(nextActionAt);

  const cleanedPhones = useMemo(
    () => Array.from(new Set(phoneInput.split("\n").map(normalizePhone).filter((p) => p.length >= 10))),
    [phoneInput],
  );

  const monitorCampaign = useMemo(
    () => campaigns.find((c) => c.id === monitorCampaignId) ?? campaigns.find((c) => c.status === "running" || c.status === "queued") ?? campaigns[0] ?? null,
    [campaigns, monitorCampaignId],
  );

  const activeLogs = useMemo(
    () => logs.slice(0, 20),
    [logs],
  );

  const campaignRealtimeLogs = useMemo(
    () => logs.filter((log) => ["incoming_message", "ai_processing", "ai_offer_cta_sent", "ai_offer_reply", "ai_error"].includes(log.step)).slice(0, 20),
    [logs],
  );

  const latestMessageByConversation = useMemo(() => {
    const map = new Map<string, ConversationMessage>();
    for (const m of conversationMessages) map.set(m.conversation_id, m);
    return map;
  }, [conversationMessages]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId],
  );

  const activeConversationMessages = useMemo(
    () => conversationMessages.filter((m) => m.conversation_id === selectedConversationId),
    [conversationMessages, selectedConversationId],
  );

  /* ─── Data Loading ─── */
  const loadData = useCallback(async (showSpinner = false) => {
    if (!companyId) return;
    if (showSpinner) setRefreshing(true);
    try {
      const [settingsRes, campaignsRes, logsRes, nextActionRes] = await Promise.all([
        supabase.from("api_settings" as any).select("id, bulk_send_enabled").eq("company_id", companyId).maybeSingle(),
        supabase.from("mass_broadcast_campaigns" as any)
          .select("id, name, status, total_recipients, processed_recipients, success_count, failure_count, created_at, started_at, completed_at, offer_templates, greeting_templates, message_delay_min_seconds, message_delay_max_seconds, seller_instructions, offer_timeout_minutes")
          .eq("company_id", companyId).order("created_at", { ascending: false }).limit(20),
        supabase.from("mass_broadcast_logs" as any)
          .select("id, campaign_id, phone, step, status, message, error_message, created_at")
          .eq("company_id", companyId).order("created_at", { ascending: false }).limit(60),
        supabase.from("mass_broadcast_recipients" as any)
          .select("next_action_at")
          .eq("company_id", companyId).in("status", ["pending", "processing"])
          .order("next_action_at", { ascending: true }).limit(1),
      ]);
      setGlobalEnabled(Boolean((settingsRes.data as any)?.bulk_send_enabled ?? false));
      setCampaigns(((campaignsRes.data as unknown) as Campaign[]) || []);
      setLogs(((logsRes.data as unknown) as LogRow[]) || []);
      const nextRow = (nextActionRes.data as any)?.[0];
      setNextActionAt(nextRow?.next_action_at ?? null);
    } finally {
      if (showSpinner) setRefreshing(false);
    }
  }, [companyId]);

  const loadConversationMonitor = useCallback(async () => {
    if (!companyId || !monitorCampaign?.id) {
      setConversations([]); setConversationMessages([]); setSelectedConversationId(null);
      return;
    }
    const [cRes, mRes] = await Promise.all([
      supabase.from("mass_broadcast_conversations" as any)
        .select("id, campaign_id, recipient_id, phone, normalized_phone, contact_name, conversation_status, has_reply, last_message_at, last_outgoing_at, last_incoming_at")
        .eq("company_id", companyId).eq("campaign_id", monitorCampaign.id)
        .order("last_message_at", { ascending: false }).limit(60),
      supabase.from("mass_broadcast_conversation_messages" as any)
        .select("id, conversation_id, campaign_id, phone, direction, sender_type, message_type, message, delivery_status, created_at")
        .eq("company_id", companyId).eq("campaign_id", monitorCampaign.id)
        .order("created_at", { ascending: true }).limit(300),
    ]);
    const nextConvs = ((cRes.data as unknown) as Conversation[]) || [];
    const nextMsgs = ((mRes.data as unknown) as ConversationMessage[]) || [];
    setConversations(nextConvs);
    setConversationMessages(nextMsgs);
    setSelectedConversationId((cur) => cur && nextConvs.some((c) => c.id === cur) ? cur : nextConvs[0]?.id ?? null);
  }, [monitorCampaign?.id, companyId]);

  const loadCampaignRecipients = useCallback(async (campaignId: string) => {
    if (!companyId) return;
    setLoadingRecipients(campaignId);
    try {
      const { data } = await supabase.from("mass_broadcast_recipients" as any)
        .select("id, campaign_id, phone, normalized_phone, offer_template, status, current_step, error_message")
        .eq("company_id", companyId).eq("campaign_id", campaignId)
        .order("created_at", { ascending: true }).limit(500);
      setExpandedCampaignRecipients((prev) => ({ ...prev, [campaignId]: ((data as unknown) as Recipient[]) || [] }));
    } finally {
      setLoadingRecipients(null);
    }
  }, [companyId]);

  const scheduleRealtimeSync = useCallback((options?: { withMonitor?: boolean; withRecipients?: boolean }) => {
    if (realtimeRefreshTimerRef.current !== null) {
      window.clearTimeout(realtimeRefreshTimerRef.current);
    }

    realtimeRefreshTimerRef.current = window.setTimeout(() => {
      void loadData();
      if (options?.withMonitor) {
        void loadConversationMonitor();
      }
      if (options?.withRecipients) {
        Object.keys(expandedCampaignRecipients).forEach((campaignId) => void loadCampaignRecipients(campaignId));
      }
    }, 180);
  }, [expandedCampaignRecipients, loadCampaignRecipients, loadConversationMonitor, loadData]);

  useEffect(() => { void loadData(); }, [loadData]);
  useEffect(() => { void loadConversationMonitor(); }, [loadConversationMonitor]);

  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel(`mass-broadcast-${companyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "api_settings", filter: `company_id=eq.${companyId}` }, () => scheduleRealtimeSync())
      .on("postgres_changes", { event: "*", schema: "public", table: "mass_broadcast_campaigns", filter: `company_id=eq.${companyId}` }, () => scheduleRealtimeSync({ withMonitor: true }))
      .on("postgres_changes", { event: "*", schema: "public", table: "mass_broadcast_logs", filter: `company_id=eq.${companyId}` }, () => scheduleRealtimeSync())
      .on("postgres_changes", { event: "*", schema: "public", table: "mass_broadcast_recipients", filter: `company_id=eq.${companyId}` }, () => scheduleRealtimeSync({ withRecipients: true }))
      .on("postgres_changes", { event: "*", schema: "public", table: "mass_broadcast_conversations", filter: `company_id=eq.${companyId}` }, () => scheduleRealtimeSync({ withMonitor: true }))
      .on("postgres_changes", { event: "*", schema: "public", table: "mass_broadcast_conversation_messages", filter: `company_id=eq.${companyId}` }, () => scheduleRealtimeSync({ withMonitor: true }))
      .subscribe();

    return () => {
      if (realtimeRefreshTimerRef.current !== null) {
        window.clearTimeout(realtimeRefreshTimerRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [companyId, scheduleRealtimeSync]);

  /* ─── Handlers ─── */
  const handleToggleGlobal = async (checked: boolean) => {
    if (!companyId || savingToggle) return;
    setSavingToggle(true);
    try {
      const { data: existing } = await supabase.from("api_settings" as any).select("id").eq("company_id", companyId).maybeSingle();
      if ((existing as any)?.id) {
        const { error } = await supabase.from("api_settings" as any).update({ bulk_send_enabled: checked }).eq("id", (existing as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("api_settings" as any).insert({ company_id: companyId, bulk_send_enabled: checked });
        if (error) throw error;
      }
      setGlobalEnabled(checked);
      toast({ title: checked ? "Disparos ativados" : "Disparos pausados", description: checked ? "A fila voltará a processar." : "Envios congelados." });
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error?.message, variant: "destructive" });
    } finally {
      setSavingToggle(false);
    }
  };

  const handleAddTemplate = () => {
    const text = editingTemplate.trim();
    if (!text) return;
    if (savedTemplates.length >= MAX_TEMPLATES) {
      toast({ title: "Limite atingido", description: `Máximo de ${MAX_TEMPLATES} modelos.`, variant: "destructive" });
      return;
    }
    const next = [...savedTemplates, text];
    setSavedTemplates(next);
    saveSavedTemplates(next);
    setEditingTemplate("");
    toast({ title: "Modelo salvo", description: `${next.length}/${MAX_TEMPLATES} modelos.` });
  };

  const handleRemoveTemplate = (index: number) => {
    const next = savedTemplates.filter((_, i) => i !== index);
    setSavedTemplates(next);
    saveSavedTemplates(next);
  };

  const handleCreateCampaign = async () => {
    if (!companyId || !user?.id) return;
    if (cleanedPhones.length === 0) {
      toast({ title: "Adicione números válidos", variant: "destructive" });
      return;
    }
    if (savedTemplates.length === 0) {
      toast({ title: "Cadastre modelos de mensagem", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const name = campaignName.trim() || `Campanha ${new Date().toLocaleString("pt-BR")}`;
      const { data: campaign, error: campaignError } = await supabase
        .from("mass_broadcast_campaigns" as any)
        .insert({
          company_id: companyId,
          created_by: user.id,
          name,
          status: "queued",
          total_recipients: cleanedPhones.length,
          offer_templates: savedTemplates,
          greeting_templates: ["Olá!", "Tudo bem?", "Bom dia, como vai?"],
          message_delay_min_seconds: delayRange[0],
          message_delay_max_seconds: delayRange[1],
          seller_instructions: sellerInstructions,
          offer_timeout_minutes: offerTimeout,
        })
        .select("id")
        .single();
      if (campaignError) throw campaignError;

      const recipients = cleanedPhones.map((phone, index) => {
        const idx = index % savedTemplates.length;
        return {
          campaign_id: (campaign as any).id,
          company_id: companyId,
          phone,
          normalized_phone: phone,
          offer_template: savedTemplates[idx],
          status: "pending",
          current_step: "offer",
          next_action_at: new Date().toISOString(),
        };
      });

      const { error: recipientsError } = await supabase.from("mass_broadcast_recipients" as any).insert(recipients);
      if (recipientsError) throw recipientsError;

      toast({ title: "Campanha criada", description: `${cleanedPhones.length} contatos com ${savedTemplates.length} modelos.` });
      setCampaignName("");
      setPhoneInput("");
      await loadData();
    } catch (error: any) {
      toast({ title: "Erro ao criar", description: error?.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!companyId) return;
    setDeletingCampaignId(campaignId);
    try {
      // Delete recipients, logs, conversations, messages first
      await Promise.all([
        supabase.from("mass_broadcast_conversation_messages" as any).delete().eq("campaign_id", campaignId),
        supabase.from("mass_broadcast_conversations" as any).delete().eq("campaign_id", campaignId),
        supabase.from("mass_broadcast_logs" as any).delete().eq("campaign_id", campaignId),
        supabase.from("mass_broadcast_recipients" as any).delete().eq("campaign_id", campaignId),
      ]);
      const { error } = await supabase.from("mass_broadcast_campaigns" as any).delete().eq("id", campaignId);
      if (error) throw error;
      toast({ title: "Campanha excluída" });
      setExpandedCampaignRecipients((prev) => { const n = { ...prev }; delete n[campaignId]; return n; });
      await loadData();
    } catch (error: any) {
      toast({ title: "Erro ao excluir", description: error?.message, variant: "destructive" });
    } finally {
      setDeletingCampaignId(null);
    }
  };

  const handleDuplicateCampaign = async (campaign: Campaign) => {
    if (!companyId || !user?.id) return;
    setDuplicatingCampaignId(campaign.id);
    try {
      // Load original recipients
      const { data: origRecipients } = await supabase.from("mass_broadcast_recipients" as any)
        .select("phone, normalized_phone, offer_template")
        .eq("campaign_id", campaign.id).limit(1000);
      const recs = ((origRecipients as unknown) as { phone: string; normalized_phone: string; offer_template: string }[]) || [];
      if (recs.length === 0) { toast({ title: "Sem contatos para duplicar", variant: "destructive" }); return; }

      const { data: newCampaign, error: cErr } = await supabase
        .from("mass_broadcast_campaigns" as any)
        .insert({
          company_id: companyId,
          created_by: user.id,
          name: `${campaign.name} (cópia)`,
          status: "queued",
          total_recipients: recs.length,
          offer_templates: campaign.offer_templates,
          greeting_templates: campaign.greeting_templates,
          message_delay_min_seconds: campaign.message_delay_min_seconds,
          message_delay_max_seconds: campaign.message_delay_max_seconds,
        })
        .select("id")
        .single();
      if (cErr) throw cErr;

      const newRecipients = recs.map((r) => ({
        campaign_id: (newCampaign as any).id,
        company_id: companyId,
        phone: r.phone,
        normalized_phone: r.normalized_phone,
        offer_template: r.offer_template,
        status: "pending",
        current_step: "greeting",
        next_action_at: new Date().toISOString(),
      }));
      const { error: rErr } = await supabase.from("mass_broadcast_recipients" as any).insert(newRecipients);
      if (rErr) throw rErr;

      toast({ title: "Campanha duplicada", description: `${recs.length} contatos copiados.` });
      await loadData();
    } catch (error: any) {
      toast({ title: "Erro ao duplicar", description: error?.message, variant: "destructive" });
    } finally {
      setDuplicatingCampaignId(null);
    }
  };

  const handleEditCampaignRecipients = async (campaignId: string) => {
    if (!companyId) return;
    const newPhones = Array.from(new Set(editPhoneInput.split("\n").map(normalizePhone).filter((p) => p.length >= 10)));
    if (newPhones.length === 0) { toast({ title: "Adicione números válidos", variant: "destructive" }); return; }
    const campaign = campaigns.find((c) => c.id === campaignId);
    if (!campaign) return;
    try {
      // Delete old recipients & re-insert
      await supabase.from("mass_broadcast_recipients" as any).delete().eq("campaign_id", campaignId);
      const templates = campaign.offer_templates?.length > 0 ? campaign.offer_templates : savedTemplates;
      const recipients = newPhones.map((phone, index) => {
        const idx = templates.length > 0 ? index % templates.length : 0;
        return {
          campaign_id: campaignId,
          company_id: companyId,
          phone,
          normalized_phone: phone,
          offer_template: templates[idx] || "",
          status: "pending",
          current_step: "offer",
          next_action_at: new Date().toISOString(),
        };
      });
      const { error } = await supabase.from("mass_broadcast_recipients" as any).insert(recipients);
      if (error) throw error;
      // Update campaign total
      await supabase.from("mass_broadcast_campaigns" as any).update({ total_recipients: newPhones.length, processed_recipients: 0, success_count: 0, failure_count: 0, status: "queued" }).eq("id", campaignId);
      toast({ title: "Lista atualizada", description: `${newPhones.length} contatos.` });
      setEditingCampaignId(null);
      setEditPhoneInput("");
      await loadData();
      await loadCampaignRecipients(campaignId);
    } catch (error: any) {
      toast({ title: "Erro", description: error?.message, variant: "destructive" });
    }
  };

  const handleResetQueue = async (campaignId: string) => {
    if (!companyId) return;
    try {
      const { error } = await supabase.from("mass_broadcast_recipients" as any)
        .update({ status: "pending", current_step: "offer", error_message: null, sent_greeting_at: null, sent_offer_at: null, last_attempt_at: null, next_action_at: new Date().toISOString() })
        .eq("campaign_id", campaignId);
      if (error) throw error;
      await supabase.from("mass_broadcast_campaigns" as any)
        .update({ status: "queued", processed_recipients: 0, success_count: 0, failure_count: 0, started_at: null, completed_at: null })
        .eq("id", campaignId);
      toast({ title: "Fila resetada", description: "Todos os contatos voltaram para 'Pendente'." });
      await loadData();
      await loadCampaignRecipients(campaignId);
    } catch (error: any) {
      toast({ title: "Erro ao resetar", description: error?.message, variant: "destructive" });
    }
  };

  const handleAssumeConversation = async () => {
    if (!activeConversation) return;
    setTakingOverConversationId(activeConversation.id);
    setConversations((cur) => cur.map((c) => c.id === activeConversation.id ? { ...c, conversation_status: "human_takeover", has_reply: true } : c));
    try {
      const { error } = await supabase.from("mass_broadcast_conversations" as any).update({ conversation_status: "human_takeover", has_reply: true, updated_at: new Date().toISOString() }).eq("id", activeConversation.id);
      if (error) throw error;
      toast({ title: "Conversa assumida" });
    } catch (error: any) {
      toast({ title: "Erro", description: error?.message, variant: "destructive" });
      void loadConversationMonitor();
    } finally {
      setTakingOverConversationId(null);
    }
  };

  const handleQuickMediaUpload = async (kind: MediaKind, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !companyId || !activeConversation) return;
    const validType = kind === "audio" ? file.type.startsWith("audio/") : file.type.startsWith("image/");
    if (!validType) { toast({ title: "Formato inválido", variant: "destructive" }); return; }
    if (file.size > 20 * 1024 * 1024) { toast({ title: "Arquivo muito grande (max 20MB)", variant: "destructive" }); return; }
    setMediaSending(kind);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
      const path = `${companyId}/manual/${Date.now()}_${safeName}`;
      const { error: uploadError } = await supabase.storage.from("chatbot-media").upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("chatbot-media").getPublicUrl(path);
      await supabase.from("chatbot_media").insert({ company_id: companyId, file_name: file.name, file_url: urlData.publicUrl, file_type: kind, file_size: file.size });
      const { error: sendError } = await supabase.functions.invoke("mass-broadcast-manual-send", { body: { conversationId: activeConversation.id, mediaUrl: urlData.publicUrl, mediaType: kind, fileName: file.name } });
      if (sendError) throw sendError;
      await loadConversationMonitor();
      toast({ title: kind === "audio" ? "Áudio enviado" : "Imagem enviada" });
    } catch (error: any) {
      toast({ title: "Erro ao enviar", description: error?.message, variant: "destructive" });
    } finally {
      setMediaSending(null);
    }
  };

   /* ─── Chat History Modal Handler ─── */
  const handleViewHistory = async (phone: string, campaignId: string) => {
    setHistoryPhone(phone);
    setHistoryCampaignId(campaignId);
    setHistoryLoading(true);
    setHistoryMessages([]);
    try {
      const normalized = phone.replace(/\D/g, "");
      const { data } = await supabase
        .from("mass_broadcast_conversation_messages" as any)
        .select("id, conversation_id, campaign_id, phone, direction, sender_type, message_type, message, delivery_status, created_at")
        .eq("company_id", companyId)
        .eq("campaign_id", campaignId)
        .eq("normalized_phone", normalized)
        .order("created_at", { ascending: true })
        .limit(10);
      setHistoryMessages(((data as unknown) as ConversationMessage[]) || []);
    } finally {
      setHistoryLoading(false);
    }
  };

  /* ─── Render ─── */
  return (
    <AnimatedPage>
      <div className="w-full max-w-full overflow-x-hidden space-y-4 px-1 sm:px-0">
        {/* Ultra-clean Header: Title + Info Popover + Master Switch */}
        <div className="flex items-center justify-between gap-2 flex-wrap min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-foreground">SPECIAL · Disparo</h1>
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className="rounded-full p-1.5 hover:bg-muted/40 transition-colors">
                  <Info className="h-4 w-4 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="start" className="max-w-[300px] text-xs text-muted-foreground">
                <p className="font-semibold text-foreground mb-1">Disparo em Massa</p>
                <p>Simulação humana com rotação inteligente de mensagens. Atendimento IA automático quando o cliente responde. Use com moderação.</p>
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex items-center gap-2">
            <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${globalEnabled ? "bg-primary animate-pulse shadow-[0_0_8px_hsl(var(--primary)/0.8)]" : "bg-muted-foreground/30"}`} />
            <Label htmlFor="master-switch-top" className="text-xs font-medium text-muted-foreground hidden sm:inline">API</Label>
            <Switch id="master-switch-top" checked={globalEnabled} onCheckedChange={handleToggleGlobal} disabled={savingToggle} />
          </div>
        </div>

        {/* Chat History Dialog */}
        <Dialog open={!!historyPhone} onOpenChange={(open) => { if (!open) { setHistoryPhone(null); setHistoryCampaignId(null); setHistoryMessages([]); } }}>
          <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-foreground">
                <MessageSquareMore className="h-4 w-4 text-primary" />
                Histórico · {historyPhone}
              </DialogTitle>
            </DialogHeader>
            {historyLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : historyMessages.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma mensagem registrada.</p>
            ) : (
              <div className="space-y-3">
                {historyMessages.map((msg) => {
                  const isOut = msg.direction === "outbound";
                  return (
                    <div key={msg.id} className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] rounded-2xl border px-3 py-2 ${isOut ? "border-primary/20 bg-primary/10" : "border-border/30 bg-muted/20"}`}>
                        <div className="flex items-center gap-1.5 text-[10px] font-medium mb-1">
                          {isOut ? <Bot className="h-3 w-3 text-primary" /> : <User className="h-3 w-3 text-muted-foreground" />}
                          <span className={isOut ? "text-primary" : "text-muted-foreground"}>{isOut ? "Robô" : "Cliente"}</span>
                          <span className="text-muted-foreground/60">· {new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        <p className="whitespace-pre-wrap break-words text-sm text-foreground">{msg.message}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Tabs defaultValue="config" className="space-y-4">
          <TabsList className="h-auto gap-1 bg-muted/30 p-1 backdrop-blur border border-border/40 rounded-xl w-full flex overflow-x-auto">
            <TabsTrigger value="config" className="gap-1.5 text-xs sm:text-sm data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-[0_0_12px_-6px_hsl(var(--primary)/0.6)] flex-1 min-w-0 px-2 sm:px-3">
              <Rocket className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span className="truncate">Nova</span>
            </TabsTrigger>
            <TabsTrigger value="library" className="gap-1.5 text-xs sm:text-sm data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-[0_0_12px_-6px_hsl(var(--primary)/0.6)] flex-1 min-w-0 px-2 sm:px-3">
              <Radio className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span className="truncate">Campanhas ({campaigns.length})</span>
            </TabsTrigger>
            <TabsTrigger value="monitor" className="gap-1.5 text-xs sm:text-sm data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-[0_0_12px_-6px_hsl(var(--primary)/0.6)] flex-1 min-w-0 px-2 sm:px-3">
              <MessageSquareMore className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
              <span className="truncate">Monitor</span>
            </TabsTrigger>
          </TabsList>

          {/* ═══ TAB: NOVA CAMPANHA ═══ */}
          <TabsContent value="config" className="space-y-6 w-full max-w-full overflow-x-hidden">
            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr] w-full max-w-full">
              {/* Left Column: Config */}
              <div className="space-y-6">

                {/* AI Seller Config */}
                <Card className="relative overflow-hidden border-primary/20 bg-card/80 backdrop-blur shadow-[0_0_24px_-16px_hsl(var(--primary)/0.4)]">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
                  <CardHeader className="relative pb-3">
                    <CardTitle className="flex items-center gap-2 text-base text-foreground">
                      <Bot className="h-4 w-4 text-primary" />
                      Vendedor IA Conversacional
                    </CardTitle>
                    <CardDescription>Configure o comportamento do vendedor inteligente.</CardDescription>
                  </CardHeader>
                  <CardContent className="relative space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="seller-instructions">Instruções para o Vendedor IA</Label>
                      <Textarea
                        id="seller-instructions"
                        value={sellerInstructions}
                        onChange={(e) => setSellerInstructions(e.target.value)}
                        placeholder="Ex: Você é um vendedor simpático da Meu Gestor, focado em planos de streaming. Seja direto e convincente."
                        className="min-h-[100px] border-primary/20 focus:border-primary/40"
                      />
                      <p className="text-[10px] text-muted-foreground">A IA usará estas instruções para gerar respostas naturais e fechar vendas.</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Tempo de espera para oferta (min)</Label>
                      <div className="flex items-center gap-3">
                        <Slider min={1} max={30} step={1} value={[offerTimeout]} onValueChange={(v) => setOfferTimeout(v[0])} className="flex-1" />
                        <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary shrink-0 min-w-[50px] justify-center">{offerTimeout}m</Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Se o cliente não responder à saudação, a oferta será enviada após este tempo com uma transição natural gerada pela IA.</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/30 bg-card/80 backdrop-blur">
                  <Collapsible open={templatesOpen} onOpenChange={setTemplatesOpen}>
                    <CardHeader className="pb-3">
                      <CollapsibleTrigger className="flex items-center justify-between w-full text-left">
                        <CardTitle className="flex items-center gap-2 text-base text-foreground">
                          <MessageSquareMore className="h-4 w-4 text-primary" />
                          Modelos de Mensagem
                          <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary ml-2">{savedTemplates.length}/{MAX_TEMPLATES}</Badge>
                        </CardTitle>
                        {templatesOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                      </CollapsibleTrigger>
                      <CardDescription>Gerencie até {MAX_TEMPLATES} variações com rotação automática.</CardDescription>
                    </CardHeader>
                    <CollapsibleContent>
                      <CardContent className="space-y-4">
                        {savedTemplates.length > 0 && (
                          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                            {savedTemplates.map((tmpl, i) => (
                              <div key={i} className="group relative rounded-xl border border-border/40 bg-muted/20 p-3 hover:border-primary/20 transition-colors">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary mb-2">M{i + 1}</Badge>
                                    <p className="text-sm text-foreground whitespace-pre-wrap break-words line-clamp-4">{tmpl}</p>
                                  </div>
                                  <Button size="icon" variant="ghost" className="shrink-0 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive transition-opacity" onClick={() => handleRemoveTemplate(i)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {savedTemplates.length < MAX_TEMPLATES && (
                          <div className="space-y-2">
                            <Textarea value={editingTemplate} onChange={(e) => setEditingTemplate(e.target.value)} placeholder="Digite o texto do novo modelo..." className="min-h-[100px] border-dashed border-primary/20 focus:border-primary/40" />
                            <Button onClick={handleAddTemplate} disabled={!editingTemplate.trim()} variant="outline" className="gap-2 border-primary/30 hover:bg-primary/10">
                              <Plus className="h-4 w-4" />
                              Salvar Modelo ({savedTemplates.length + 1}/{MAX_TEMPLATES})
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>

                {/* Contact List */}
                <Card className="border-border/30 bg-card/80 backdrop-blur">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base text-foreground">
                      <Radio className="h-4 w-4 text-primary" />
                      Lista de Contatos
                    </CardTitle>
                    <CardDescription>Cole números e nomeie a campanha.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="campaign-name">Nome da campanha</Label>
                      <Input id="campaign-name" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="Ex: Clientes Janeiro, Leads Facebook" className="max-w-[90vw]" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phones">Números (um por linha)</Label>
                      <Textarea id="phones" value={phoneInput} onChange={(e) => setPhoneInput(e.target.value)} placeholder={"5511999999999\n(11) 98888-7777"} className="min-h-[140px] font-mono text-sm" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Válidos: <span className="font-semibold text-foreground">{cleanedPhones.length}</span> · Modelos: <span className="font-semibold text-foreground">{savedTemplates.length}</span>
                    </p>
                    <div className="flex flex-col sm:flex-row flex-wrap gap-3 w-full">
                      <Button onClick={handleCreateCampaign} disabled={submitting || cleanedPhones.length === 0 || savedTemplates.length === 0} className="w-full sm:w-auto sm:min-w-[200px] gap-2 shadow-[0_0_16px_-8px_hsl(var(--primary)/0.6)]">
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                        Criar Campanha
                      </Button>
                      <Button variant="outline" onClick={() => void loadData(true)} disabled={refreshing} className="gap-2">
                        <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                        Atualizar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Dashboard */}
              <div className="space-y-6">
                {/* Progress Stats (global) */}
                <Card className="relative overflow-hidden border-primary/15 bg-card/80 backdrop-blur shadow-[0_0_24px_-16px_hsl(var(--primary)/0.4)]">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
                  <CardHeader className="relative pb-3">
                    <CardTitle className="flex items-center gap-2 text-base text-foreground">
                      <Radio className="h-4 w-4 text-primary" />
                      Resumo Global
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="relative space-y-4">
                    <div className="grid gap-3 grid-cols-2">
                      {[
                        { label: "Campanhas", value: campaigns.length, cls: "text-foreground" },
                        { label: "Total Contatos", value: campaigns.reduce((a, c) => a + c.total_recipients, 0), cls: "text-foreground" },
                        { label: "Sucesso", value: campaigns.reduce((a, c) => a + c.success_count, 0), cls: "text-primary" },
                        { label: "Falhas", value: campaigns.reduce((a, c) => a + c.failure_count, 0), cls: "text-destructive" },
                      ].map((item) => (
                        <div key={item.label} className="rounded-xl border border-border/30 bg-muted/20 p-3">
                          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{item.label}</p>
                          <p className={`mt-1 text-lg font-bold ${item.cls}`}>{item.value}</p>
                        </div>
                      ))}
                    </div>
                    {countdown.seconds > 0 && (
                      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center shadow-[0_0_16px_-10px_hsl(var(--primary)/0.5)]">
                        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mb-1">
                          <Timer className="h-3.5 w-3.5 text-primary" />
                          Próximo envio em
                        </div>
                        <p className="text-2xl font-bold text-primary font-mono tracking-wider">{countdown.display}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Audit Log Console */}
                <Card className="border-border/30 bg-card/80 backdrop-blur">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base text-foreground">
                      <Terminal className="h-4 w-4 text-primary" />
                      Console de Auditoria
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-xl border border-border/30 bg-black/80 p-3 max-h-[320px] overflow-y-auto font-mono text-[11px] leading-relaxed space-y-0.5">
                      {activeLogs.length === 0 ? (
                        <p className="text-muted-foreground/60">Aguardando eventos...</p>
                      ) : (
                        activeLogs.map((log) => {
                          const time = new Date(log.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
                          const stepDesc = logStepLabel[log.step] || log.step;
                          const isProcessing = log.status === "processing" || log.step === "ai_processing";
                          const isError = log.status === "error" || Boolean(log.error_message);
                          const fallbackMessage = isProcessing
                            ? `🤖 Robô processando resposta para ${log.phone}...`
                            : isError
                              ? `❌ Falha ao responder ${log.phone}.`
                              : `✅ ${stepDesc} para ${log.phone}`;
                          const displayMessage = log.message?.trim() || fallbackMessage;
                          return (
                            <div key={log.id} className={`flex gap-2 ${isError ? "text-destructive" : isProcessing ? "text-warning" : "text-primary"}`}>
                              <span className="text-muted-foreground/50 shrink-0">[{time}]</span>
                              <span className="truncate">{displayMessage}</span>
                              {log.error_message && <span className="text-destructive/80 truncate">— {log.error_message}</span>}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ═══ TAB: BIBLIOTECA DE CAMPANHAS ═══ */}
          <TabsContent value="library" className="space-y-4 w-full max-w-full overflow-x-hidden">
            {/* Sticky API toggle + title */}
            <div className="sticky top-0 z-10 bg-background/95 backdrop-blur py-2 -mx-1 px-1 border-b border-border/20">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <h2 className="text-base sm:text-lg font-bold text-foreground truncate">Campanhas</h2>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-2 rounded-lg border border-border/30 bg-muted/20 px-3 py-1.5">
                    <div className={`h-2 w-2 rounded-full shrink-0 ${globalEnabled ? "bg-primary animate-pulse" : "bg-muted-foreground/30"}`} />
                    <Label htmlFor="master-switch-lib" className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">Disparo</Label>
                    <Switch id="master-switch-lib" checked={globalEnabled} onCheckedChange={handleToggleGlobal} disabled={savingToggle} />
                  </div>
                  <Button variant="outline" size="icon" onClick={() => void loadData(true)} disabled={refreshing} className="h-8 w-8">
                    <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                  </Button>
                </div>
              </div>
            </div>

            <Card className="border-border/30 bg-card/80 backdrop-blur">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm text-foreground">
                  <Bot className="h-4 w-4 text-primary" />
                  Status em tempo real da IA
                </CardTitle>
                <CardDescription>Monitoramento instantâneo da resposta automática por contato.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border border-border/30 bg-muted/20 p-3 max-h-[220px] overflow-y-auto font-mono text-[11px] space-y-1">
                  {campaignRealtimeLogs.length === 0 ? (
                    <p className="text-muted-foreground/70">Aguardando atividade da IA...</p>
                  ) : (
                    campaignRealtimeLogs.map((log) => {
                      const isProcessing = log.status === "processing" || log.step === "ai_processing";
                      const isError = log.status === "error" || Boolean(log.error_message);
                      const fallbackByStep = log.step === "incoming_message"
                        ? `[LOG] Mensagem recebida de ${log.phone}`
                        : log.step === "ai_processing"
                          ? "[LOG] Processando resposta via IA..."
                          : log.step === "ai_offer_cta_sent"
                            ? "[LOG] Oferta e CTA de Teste Grátis enviados."
                            : isError
                              ? `[LOG] Erro na IA para ${log.phone}`
                              : `[LOG] Resposta enviada para ${log.phone}`;
                      const lineMessage = log.message?.trim() || fallbackByStep;

                      return (
                        <div key={log.id} className={`flex items-start gap-2 ${isError ? "text-destructive" : isProcessing ? "text-warning" : "text-primary"}`}>
                          <span className="text-muted-foreground/60 shrink-0">[{new Date(log.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}]</span>
                          <span className="break-words">{lineMessage}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>

            {campaigns.length === 0 ? (
              <Card className="border-dashed border-border/40 bg-muted/10">
                <CardContent className="p-8 text-center text-sm text-muted-foreground">
                  Nenhuma campanha criada ainda. Vá para "Nova Campanha" para começar.
                </CardContent>
              </Card>
            ) : (
              <Accordion type="single" collapsible className="space-y-3">
                {campaigns.map((campaign) => {
                  const progress = campaign.total_recipients > 0
                    ? Math.round((campaign.processed_recipients / campaign.total_recipients) * 100)
                    : 0;
                  const recipients = expandedCampaignRecipients[campaign.id];
                  const isEditing = editingCampaignId === campaign.id;
                  const statusMeta = statusIcon[campaign.status] || statusIcon.pending;
                  const StatusIconComp = statusMeta.icon;

                  return (
                    <AccordionItem
                      key={campaign.id}
                      value={campaign.id}
                      className="rounded-2xl border border-border/30 bg-card/80 backdrop-blur overflow-hidden shadow-[0_0_20px_-14px_hsl(var(--primary)/0.3)] data-[state=open]:border-primary/20"
                    >
                      <AccordionTrigger
                        className="px-5 py-4 hover:no-underline hover:bg-primary/5 transition-colors [&[data-state=open]>svg]:rotate-180"
                        onClick={() => {
                          if (!recipients) void loadCampaignRecipients(campaign.id);
                        }}
                      >
                        <div className="flex flex-1 items-center gap-4 text-left">
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/30 bg-muted/20 ${statusMeta.cls}`}>
                            <StatusIconComp className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-foreground truncate">{campaign.name}</p>
                              <Badge variant="outline" className={`text-[10px] shrink-0 ${campaign.status === "completed" ? "border-primary/30 bg-primary/10 text-primary" : campaign.status === "running" ? "border-warning/30 bg-warning/10 text-warning" : "border-border/40 text-muted-foreground"}`}>
                                {statusLabel[campaign.status] || campaign.status}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 mt-1.5">
                              <span className="text-[11px] text-muted-foreground">
                                {new Date(campaign.created_at).toLocaleDateString("pt-BR")}
                              </span>
                              <span className="text-[11px] text-muted-foreground">·</span>
                              <span className="text-[11px] font-medium text-foreground">
                                {campaign.processed_recipients}/{campaign.total_recipients} enviados
                              </span>
                              <div className="flex-1 max-w-[120px]">
                                <Progress value={progress} className="h-1.5" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-5 pb-5">
                        <div className="space-y-4">
                        {/* Per-campaign Delay & Timeout controls */}
                        <div className="space-y-4 pt-2 border-t border-border/20">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5 text-primary" />
                                Delay entre mensagens
                              </Label>
                              <div className="pt-1">
                                <Slider
                                  min={30} max={300} step={5}
                                  value={[campaign.message_delay_min_seconds, campaign.message_delay_max_seconds]}
                                  onValueChange={async (v) => {
                                    setCampaigns((prev) => prev.map((c) => c.id === campaign.id ? { ...c, message_delay_min_seconds: v[0], message_delay_max_seconds: v[1] } : c));
                                    await supabase.from("mass_broadcast_campaigns" as any).update({ message_delay_min_seconds: v[0], message_delay_max_seconds: v[1] }).eq("id", campaign.id);
                                  }}
                                />
                                <div className="flex justify-between mt-1.5">
                                  <span className="text-[10px] text-muted-foreground">Mín: {campaign.message_delay_min_seconds}s</span>
                                  <span className="text-[10px] text-muted-foreground">Máx: {campaign.message_delay_max_seconds}s</span>
                                </div>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                                <Timer className="h-3.5 w-3.5 text-primary" />
                                Timeout p/ oferta (min)
                              </Label>
                              <div className="flex items-center gap-2">
                                <Slider
                                  min={1} max={30} step={1}
                                  value={[campaign.offer_timeout_minutes]}
                                  onValueChange={async (v) => {
                                    setCampaigns((prev) => prev.map((c) => c.id === campaign.id ? { ...c, offer_timeout_minutes: v[0] } : c));
                                    await supabase.from("mass_broadcast_campaigns" as any).update({ offer_timeout_minutes: v[0] }).eq("id", campaign.id);
                                  }}
                                  className="flex-1"
                                />
                                <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary shrink-0 min-w-[40px] justify-center text-[10px]">{campaign.offer_timeout_minutes}m</Badge>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Action buttons */}
                          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/20 w-full overflow-x-auto">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2 border-border/40 hover:bg-primary/5"
                              onClick={() => {
                                if (isEditing) {
                                  setEditingCampaignId(null);
                                  setEditPhoneInput("");
                                } else {
                                  setEditingCampaignId(campaign.id);
                                  setEditPhoneInput(recipients?.map((r) => r.phone).join("\n") || "");
                                }
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              {isEditing ? "Cancelar" : "Editar Lista"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2 border-border/40 hover:bg-primary/5"
                              disabled={duplicatingCampaignId === campaign.id}
                              onClick={() => void handleDuplicateCampaign(campaign)}
                            >
                              {duplicatingCampaignId === campaign.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
                              Duplicar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2 border-border/40 hover:bg-primary/5"
                              onClick={() => { setMonitorCampaignId(campaign.id); }}
                            >
                              <MessageSquareMore className="h-3.5 w-3.5" />
                              Monitor
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm" className="gap-2 border-warning/30 text-warning hover:bg-warning/10">
                                  <RefreshCw className="h-3.5 w-3.5" />
                                  Resetar Fila
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Resetar fila?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Todos os contatos voltarão para o status "Pendente". Isso permite reenviar para toda a lista.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => void handleResetQueue(campaign.id)} className="bg-warning text-warning-foreground hover:bg-warning/90">
                                    Resetar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm" className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10" disabled={deletingCampaignId === campaign.id}>
                                  {deletingCampaignId === campaign.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                  Excluir
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Todos os contatos, logs e conversas desta campanha serão removidos permanentemente.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => void handleDeleteCampaign(campaign.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    Excluir
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>

                          {/* Edit mode */}
                          {isEditing && (
                            <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
                              <Label>Editar números (um por linha)</Label>
                              <Textarea value={editPhoneInput} onChange={(e) => setEditPhoneInput(e.target.value)} className="min-h-[120px] font-mono text-sm" />
                              <Button onClick={() => void handleEditCampaignRecipients(campaign.id)} className="gap-2">
                                <Save className="h-4 w-4" />
                                Salvar Alterações
                              </Button>
                            </div>
                          )}

                          {/* Recipients table */}
                          {loadingRecipients === campaign.id ? (
                            <div className="flex items-center justify-center py-6">
                              <Loader2 className="h-5 w-5 animate-spin text-primary" />
                            </div>
                          ) : recipients ? (
                            <div className="rounded-xl border border-border/30 bg-muted/10 max-h-[360px] overflow-y-auto">
                              {/* Desktop table header */}
                              <div className="hidden sm:grid grid-cols-[1fr_auto_1fr_auto] gap-2 p-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/30 sticky top-0 bg-card/95 backdrop-blur">
                                <span>Número</span>
                                <span>Status</span>
                                <span>Mensagem</span>
                                <span>Link</span>
                              </div>
                              {recipients.map((r) => {
                                const si = statusIcon[r.status] || statusIcon.pending;
                                const SiComp = si.icon;
                                const stepText = recipientStepText[r.current_step] || recipientStatusText[r.status] || "Pendente";
                                return (
                                  <div key={r.id} className={`border-b border-border/20 last:border-0 hover:bg-primary/5 transition-colors ${r.status === "failed" ? "bg-destructive/5" : ""}`}>
                                    {/* Mobile card layout */}
                                    <div className="sm:hidden p-3 space-y-1.5 w-full min-w-0">
                                      <div className="flex items-center justify-between gap-2 min-w-0">
                                        <span className="text-sm font-mono text-foreground truncate">{r.phone}</span>
                                        <a href={`https://wa.me/${r.phone}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 p-1 shrink-0">
                                          <ExternalLink className="h-4 w-4" />
                                        </a>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <SiComp className={`h-4 w-4 ${si.cls}`} />
                                        <span className={`text-[11px] font-medium ${si.cls}`}>{stepText}</span>
                                      </div>
                                      <p className="text-[10px] text-muted-foreground line-clamp-2 break-words">{r.offer_template}</p>
                                      {r.error_message && (
                                        <span className="text-[10px] text-destructive line-clamp-1 block" title={r.error_message}>❌ {r.error_message}</span>
                                      )}
                                    </div>
                                    {/* Desktop grid layout */}
                                    <div className="hidden sm:grid grid-cols-[1fr_auto_1fr_auto] gap-2 items-center p-2.5">
                                      <div className="min-w-0">
                                        <span className="text-sm font-mono text-foreground truncate block">{r.phone}</span>
                                        {r.error_message && (
                                          <span className="text-[10px] text-destructive line-clamp-1" title={r.error_message}>❌ {r.error_message}</span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <SiComp className={`h-4 w-4 ${si.cls}`} />
                                        <span className={`text-[10px] font-medium ${si.cls}`}>{stepText}</span>
                                      </div>
                                      <p className="text-[10px] text-muted-foreground truncate">{r.offer_template?.substring(0, 50)}</p>
                                      <a href={`https://wa.me/${r.phone}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">
                                        <ExternalLink className="h-3.5 w-3.5" />
                                      </a>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
          </TabsContent>

          {/* ═══ TAB: MONITOR DE CONVERSAS ═══ */}
          <TabsContent value="monitor" className="space-y-6">
            <Card className="border-border/30 bg-card/80 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <MessageSquareMore className="h-5 w-5 text-primary" />
                  Monitor de Conversas
                </CardTitle>
                <CardDescription>
                  {monitorCampaign ? `Acompanhe: ${monitorCampaign.name}` : "Crie uma campanha para usar o monitor."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!monitorCampaign ? (
                  <div className="rounded-2xl border border-dashed border-border/40 bg-muted/10 p-8 text-center text-sm text-muted-foreground">
                    Nenhuma campanha disponível.
                  </div>
                ) : (
                  <div className="grid gap-4 grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] w-full max-w-full overflow-x-hidden">
                    {/* Chat List */}
                    <div className="rounded-2xl border border-border/30 bg-muted/10 p-3">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-semibold text-foreground">Chats</p>
                        <Badge variant="outline" className="border-border/40 text-foreground">{conversations.length}</Badge>
                      </div>
                      <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
                        {conversations.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-border/30 p-4 text-sm text-muted-foreground text-center">
                            Sem conversas ainda.
                          </div>
                        ) : (
                          conversations.map((conv) => {
                            const latestMsg = latestMessageByConversation.get(conv.id);
                            const meta = conversationStatusMeta[conv.conversation_status] || conversationStatusMeta.bot_active;
                            const isSel = conv.id === selectedConversationId;
                            const isTyping = conv.conversation_status === "bot_active" && conv.has_reply;
                            const lastSnippet = latestMsg
                              ? `${latestMsg.direction === "inbound" ? "Cliente" : "Bot"}: ${latestMsg.message?.slice(0, 50)}${(latestMsg.message?.length || 0) > 50 ? "…" : ""}`
                              : "...";
                            return (
                              <button key={conv.id} type="button" onClick={() => setSelectedConversationId(conv.id)}
                                className={`w-full rounded-xl border p-3 text-left transition-all ${isSel ? "border-primary/30 bg-primary/10 shadow-[0_0_14px_-8px_hsl(var(--primary)/0.6)]" : "border-border/30 bg-background/60 hover:border-primary/15 hover:bg-primary/5"}`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    {/* Animated status icon */}
                                    <span className="text-lg shrink-0">{meta.icon}</span>
                                    {meta.pulse && conv.has_reply && (
                                      <span className="relative flex h-2.5 w-2.5 shrink-0">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500" />
                                      </span>
                                    )}
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-semibold text-foreground">{conv.contact_name || conv.phone}</p>
                                      <p className="text-[10px] text-muted-foreground font-mono">{conv.phone}</p>
                                    </div>
                                  </div>
                                  <Badge variant="outline" className={`${meta.className} text-[10px] shrink-0`}>{meta.label}</Badge>
                                </div>
                                {/* Last interaction snippet */}
                                <p className="mt-1.5 line-clamp-1 text-[11px] text-muted-foreground italic">{lastSnippet}</p>
                                {/* Typing indicator */}
                                {isTyping && (
                                  <div className="mt-1 flex items-center gap-1.5">
                                    <span className="relative flex h-2 w-2 shrink-0">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                                    </span>
                                    <span className="text-[10px] text-primary font-medium animate-pulse">IA digitando...</span>
                                  </div>
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Chat Viewer */}
                    <div className="rounded-2xl border border-border/30 bg-muted/10 p-3">
                      {!activeConversation ? (
                        <div className="flex min-h-[360px] sm:min-h-[560px] items-center justify-center rounded-xl border border-dashed border-border/30 p-6 text-center text-sm text-muted-foreground">
                          Selecione um chat.
                        </div>
                      ) : (
                        <div className="flex min-h-[360px] sm:min-h-[560px] flex-col">
                          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/30 bg-background/60 px-4 py-3">
                            <div>
                              <p className="text-sm font-semibold text-foreground">{activeConversation.contact_name || activeConversation.phone}</p>
                              <p className="text-[11px] text-muted-foreground font-mono">{activeConversation.phone}</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className={(conversationStatusMeta[activeConversation.conversation_status] || conversationStatusMeta.bot_active).className}>
                                {(conversationStatusMeta[activeConversation.conversation_status] || conversationStatusMeta.bot_active).label}
                              </Badge>
                              <Badge variant="outline" className="border-border/40 text-foreground text-[10px]">
                                {activeConversation.has_reply ? "Respondeu" : "Sem resposta"}
                              </Badge>
                            </div>
                          </div>
                          <div className="mt-3 flex-1 space-y-3 overflow-y-auto rounded-xl border border-border/30 bg-background/60 p-4">
                            {activeConversationMessages.length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center">Nenhuma mensagem.</p>
                            ) : (
                              activeConversationMessages.map((msg) => {
                                const isOut = msg.direction === "outbound";
                                const isHuman = isOut && msg.sender_type === "human";
                                return (
                                  <div key={msg.id} className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
                                    <div className={`max-w-[85%] rounded-2xl border px-4 py-3 ${isHuman ? "border-warning/20 bg-warning/10" : isOut ? "border-primary/20 bg-primary/10" : "border-border/30 bg-muted/20"}`}>
                                      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-medium">
                                        {isHuman ? (<><User className="h-3 w-3 text-warning" /><span className="text-warning">Humano</span></>) : isOut ? (<><Bot className="h-3 w-3 text-primary" /><span className="text-primary">Robô</span></>) : (<><User className="h-3 w-3 text-muted-foreground" /><span className="text-muted-foreground">Cliente</span></>)}
                                        <span className="text-muted-foreground">· {new Date(msg.created_at).toLocaleString("pt-BR")}</span>
                                      </div>
                                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">{msg.message}</p>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                          <div className="mt-3 rounded-xl border border-border/30 bg-background/60 p-3">
                            <input ref={audioInputRef} type="file" accept="audio/*" className="hidden" onChange={(e) => void handleQuickMediaUpload("audio", e)} />
                            <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => void handleQuickMediaUpload("image", e)} />
                            <div className="flex flex-wrap items-center gap-2">
                              <Button variant="outline" onClick={() => audioInputRef.current?.click()} disabled={mediaSending !== null} className="gap-2 border-border/40">
                                {mediaSending === "audio" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
                                Áudio
                              </Button>
                              <Button variant="outline" onClick={() => imageInputRef.current?.click()} disabled={mediaSending !== null} className="gap-2 border-border/40">
                                {mediaSending === "image" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                                Imagem
                              </Button>
                              <Button
                                variant={activeConversation.conversation_status === "human_takeover" ? "secondary" : "default"}
                                onClick={() => void handleAssumeConversation()}
                                disabled={takingOverConversationId === activeConversation.id || activeConversation.conversation_status === "human_takeover"}
                                className="gap-2"
                              >
                                {takingOverConversationId === activeConversation.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <PauseCircle className="h-4 w-4" />}
                                {activeConversation.conversation_status === "human_takeover" ? "Assumida" : "Assumir"}
                              </Button>
                            </div>
                            <p className="mt-2 text-[11px] text-muted-foreground">
                              {activeConversation.conversation_status === "human_takeover" ? "Bot pausado. Negocie manualmente." : "Áudio simula gravação. 'Assumir' pausa o bot."}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AnimatedPage>
  );
}
