import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  ImagePlus,
  Loader2,
  MessageSquareMore,
  Mic,
  PauseCircle,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Rocket,
  Save,
  ShieldAlert,
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
const splitOfferTemplates = (value: string) =>
  value
    .split(/\n\s*\n+/)
    .map((block) => block.trim())
    .filter(Boolean);

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

const conversationStatusMeta: Record<string, { label: string; className: string }> = {
  bot_active: {
    label: "Gerenciada pelo bot",
    className: "border-primary/40 bg-primary/10 text-primary",
  },
  awaiting_human: {
    label: "Aguardando humano",
    className: "border-warning/30 bg-warning/15 text-warning",
  },
  human_takeover: {
    label: "Assumida por humano",
    className: "border-warning/30 bg-warning/15 text-warning",
  },
};

/* ─── Countdown Hook ─── */
function useCountdown(targetIso: string | null) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!targetIso) {
      setSeconds(0);
      return;
    }
    const calc = () => {
      const diff = Math.max(0, Math.floor((new Date(targetIso).getTime() - Date.now()) / 1000));
      setSeconds(diff);
    };
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

  // Template management
  const [savedTemplates, setSavedTemplates] = useState<string[]>(loadSavedTemplates);
  const [editingTemplate, setEditingTemplate] = useState<string>("");
  const [templatesOpen, setTemplatesOpen] = useState(false);

  // Data
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationMessages, setConversationMessages] = useState<ConversationMessage[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [mediaSending, setMediaSending] = useState<MediaKind | null>(null);
  const [takingOverConversationId, setTakingOverConversationId] = useState<string | null>(null);

  // Next action countdown
  const [nextActionAt, setNextActionAt] = useState<string | null>(null);
  const countdown = useCountdown(nextActionAt);

  const cleanedPhones = useMemo(
    () => Array.from(new Set(phoneInput.split("\n").map(normalizePhone).filter((p) => p.length >= 10))),
    [phoneInput],
  );

  const activeCampaign = useMemo(
    () => campaigns.find((c) => c.status === "running" || c.status === "queued") ?? campaigns[0] ?? null,
    [campaigns],
  );

  const progressValue = activeCampaign
    ? Math.min(100, Math.round((activeCampaign.processed_recipients / Math.max(activeCampaign.total_recipients, 1)) * 100))
    : 0;

  const activeLogs = useMemo(
    () => (activeCampaign ? logs.filter((l) => l.campaign_id === activeCampaign.id) : logs).slice(0, 20),
    [activeCampaign, logs],
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
          .select("id, name, status, total_recipients, processed_recipients, success_count, failure_count, created_at, started_at, completed_at")
          .eq("company_id", companyId).order("created_at", { ascending: false }).limit(8),
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
    if (!companyId || !activeCampaign?.id) {
      setConversations([]); setConversationMessages([]); setSelectedConversationId(null);
      return;
    }
    const [cRes, mRes] = await Promise.all([
      supabase.from("mass_broadcast_conversations" as any)
        .select("id, campaign_id, recipient_id, phone, normalized_phone, contact_name, conversation_status, has_reply, last_message_at, last_outgoing_at, last_incoming_at")
        .eq("company_id", companyId).eq("campaign_id", activeCampaign.id)
        .order("last_message_at", { ascending: false }).limit(60),
      supabase.from("mass_broadcast_conversation_messages" as any)
        .select("id, conversation_id, campaign_id, phone, direction, sender_type, message_type, message, delivery_status, created_at")
        .eq("company_id", companyId).eq("campaign_id", activeCampaign.id)
        .order("created_at", { ascending: true }).limit(300),
    ]);
    const nextConvs = ((cRes.data as unknown) as Conversation[]) || [];
    const nextMsgs = ((mRes.data as unknown) as ConversationMessage[]) || [];
    setConversations(nextConvs);
    setConversationMessages(nextMsgs);
    setSelectedConversationId((cur) => cur && nextConvs.some((c) => c.id === cur) ? cur : nextConvs[0]?.id ?? null);
  }, [activeCampaign?.id, companyId]);

  useEffect(() => { void loadData(); }, [loadData]);
  useEffect(() => { void loadConversationMonitor(); }, [loadConversationMonitor]);

  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel(`mass-broadcast-${companyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "api_settings", filter: `company_id=eq.${companyId}` }, () => void loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "mass_broadcast_campaigns", filter: `company_id=eq.${companyId}` }, () => { void loadData(); void loadConversationMonitor(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "mass_broadcast_logs", filter: `company_id=eq.${companyId}` }, () => void loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "mass_broadcast_conversations", filter: `company_id=eq.${companyId}` }, () => void loadConversationMonitor())
      .on("postgres_changes", { event: "*", schema: "public", table: "mass_broadcast_conversation_messages", filter: `company_id=eq.${companyId}` }, () => void loadConversationMonitor())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [companyId, loadConversationMonitor, loadData]);

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
      toast({ title: checked ? "Disparos ativados" : "Disparos pausados", description: checked ? "A fila voltará a processar em segundo plano." : "Todos os envios foram congelados imediatamente." });
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error?.message || "Não foi possível atualizar.", variant: "destructive" });
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
    toast({ title: "Modelo salvo", description: `${next.length}/${MAX_TEMPLATES} modelos cadastrados.` });
  };

  const handleRemoveTemplate = (index: number) => {
    const next = savedTemplates.filter((_, i) => i !== index);
    setSavedTemplates(next);
    saveSavedTemplates(next);
  };

  const handleCreateCampaign = async () => {
    if (!companyId || !user?.id) return;
    if (cleanedPhones.length === 0) {
      toast({ title: "Adicione números válidos", description: "Cole ao menos um telefone por linha.", variant: "destructive" });
      return;
    }
    if (savedTemplates.length === 0) {
      toast({ title: "Cadastre os modelos", description: "Salve ao menos um modelo de mensagem na seção de modelos.", variant: "destructive" });
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
        })
        .select("id")
        .single();
      if (campaignError) throw campaignError;

      // Rotation logic: assign templates in round-robin, never same for consecutive contacts
      let lastIndex = -1;
      const recipients = cleanedPhones.map((phone) => {
        let idx = (lastIndex + 1) % savedTemplates.length;
        // If only 1 template, can't avoid repetition
        if (savedTemplates.length > 1 && idx === lastIndex) {
          idx = (idx + 1) % savedTemplates.length;
        }
        lastIndex = idx;
        return {
          campaign_id: (campaign as any).id,
          company_id: companyId,
          phone,
          normalized_phone: phone,
          offer_template: savedTemplates[idx],
          status: "pending",
          current_step: "greeting",
          next_action_at: new Date().toISOString(),
        };
      });

      const { error: recipientsError } = await supabase.from("mass_broadcast_recipients" as any).insert(recipients);
      if (recipientsError) throw recipientsError;

      toast({ title: "Fila criada", description: `${cleanedPhones.length} contatos na fila com rotação de ${savedTemplates.length} modelos.` });
      setCampaignName("");
      setPhoneInput("");
      await loadData();
      await loadConversationMonitor();
    } catch (error: any) {
      toast({ title: "Erro ao criar fila", description: error?.message || "Não foi possível preparar a campanha.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAssumeConversation = async () => {
    if (!activeConversation) return;
    setTakingOverConversationId(activeConversation.id);
    setConversations((cur) => cur.map((c) => c.id === activeConversation.id ? { ...c, conversation_status: "human_takeover", has_reply: true, last_message_at: new Date().toISOString() } : c));
    try {
      const { error } = await supabase.from("mass_broadcast_conversations" as any).update({ conversation_status: "human_takeover", has_reply: true, updated_at: new Date().toISOString() }).eq("id", activeConversation.id);
      if (error) throw error;
      toast({ title: "Conversa assumida", description: "Bot pausado neste chat para negociação manual." });
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

  /* ─── Render ─── */
  return (
    <AnimatedPage>
      <div className="space-y-6">
        {/* Warning Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-destructive/30 bg-destructive/5 p-4 sm:p-5 shadow-[0_0_30px_-15px_hsl(var(--destructive)/0.6)]">
          <div className="absolute inset-0 bg-gradient-to-r from-destructive/5 via-transparent to-destructive/5 pointer-events-none" />
          <div className="relative flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 text-destructive shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-destructive">⚠️ SPECIAL · Disparo em Massa</p>
              <p className="text-xs text-muted-foreground">
                Simulação humana em duas etapas com rotação inteligente de mensagens. Use com moderação e intervalos longos.
              </p>
            </div>
          </div>
        </div>

        <Tabs defaultValue="config" className="space-y-4">
          <TabsList className="h-auto gap-1 bg-muted/30 p-1 backdrop-blur border border-border/40 rounded-xl">
            <TabsTrigger value="config" className="gap-2 data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-[0_0_12px_-6px_hsl(var(--primary)/0.6)]">
              <Rocket className="h-4 w-4" />
              Painel de Disparo
            </TabsTrigger>
            <TabsTrigger value="monitor" className="gap-2 data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:shadow-[0_0_12px_-6px_hsl(var(--primary)/0.6)]">
              <MessageSquareMore className="h-4 w-4" />
              Monitor
            </TabsTrigger>
          </TabsList>

          {/* ═══ TAB: PAINEL DE DISPARO ═══ */}
          <TabsContent value="config" className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              {/* Left Column: Config */}
              <div className="space-y-6">
                {/* Master Switch */}
                <Card className="relative overflow-hidden border-primary/20 bg-card/80 backdrop-blur shadow-[0_0_30px_-18px_hsl(var(--primary)/0.5)]">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/3 pointer-events-none" />
                  <CardContent className="relative p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className={`h-3 w-3 rounded-full ${globalEnabled ? "bg-primary animate-pulse shadow-[0_0_8px_hsl(var(--primary)/0.8)]" : "bg-muted-foreground/30"}`} />
                          <Label htmlFor="master-switch" className="text-base font-bold text-foreground">Ativar/Pausar Disparos API</Label>
                        </div>
                        <p className="text-xs text-muted-foreground">Se desligado, toda a fila congela imediatamente.</p>
                      </div>
                      <Switch id="master-switch" checked={globalEnabled} onCheckedChange={handleToggleGlobal} disabled={savingToggle} className="scale-125" />
                    </div>
                  </CardContent>
                </Card>

                {/* Time & Delay Selectors */}
                <Card className="border-border/30 bg-card/80 backdrop-blur">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base text-foreground">
                      <Clock className="h-4 w-4 text-primary" />
                      Horário e Delay
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="start-hour">Horário de início</Label>
                        <Input id="start-hour" type="time" value={startHour} onChange={(e) => setStartHour(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label>Delay entre mensagens</Label>
                        <div className="pt-2">
                          <Slider
                            min={30}
                            max={300}
                            step={5}
                            value={delayRange}
                            onValueChange={(v) => setDelayRange(v as [number, number])}
                          />
                          <div className="flex justify-between mt-2">
                            <span className="text-xs text-muted-foreground">Mín: {delayRange[0]}s</span>
                            <span className="text-xs text-muted-foreground">Máx: {delayRange[1]}s</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Message Templates Editor */}
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
                      <CardDescription>Gerencie até {MAX_TEMPLATES} variações. O sistema alterna automaticamente para nunca repetir em sequência.</CardDescription>
                    </CardHeader>
                    <CollapsibleContent>
                      <CardContent className="space-y-4">
                        {/* Existing templates */}
                        {savedTemplates.length > 0 && (
                          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                            {savedTemplates.map((tmpl, i) => (
                              <div key={i} className="group relative rounded-xl border border-border/40 bg-muted/20 p-3 hover:border-primary/20 transition-colors">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary mb-2">Modelo {i + 1}</Badge>
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

                        {/* Add new template */}
                        {savedTemplates.length < MAX_TEMPLATES && (
                          <div className="space-y-2">
                            <Textarea
                              value={editingTemplate}
                              onChange={(e) => setEditingTemplate(e.target.value)}
                              placeholder="Digite o texto do novo modelo aqui..."
                              className="min-h-[100px] border-dashed border-primary/20 focus:border-primary/40"
                            />
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
                    <CardDescription>Cole os números. Cada um receberá um modelo diferente em rotação.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="campaign-name">Nome da campanha</Label>
                      <Input id="campaign-name" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="Ex: Oferta IPTV Março" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phones">Números de telefone (um por linha)</Label>
                      <Textarea
                        id="phones"
                        value={phoneInput}
                        onChange={(e) => setPhoneInput(e.target.value)}
                        placeholder={"5511999999999\n(11) 98888-7777\n+55 21 97777-6666"}
                        className="min-h-[160px] font-mono text-sm"
                      />
                    </div>

                    {/* Cleaned phones table */}
                    {cleanedPhones.length > 0 && (
                      <div className="rounded-xl border border-border/40 bg-muted/10 max-h-[300px] overflow-y-auto">
                        <div className="grid grid-cols-[1fr_auto_auto] gap-2 p-2 text-xs font-semibold text-muted-foreground border-b border-border/30 sticky top-0 bg-card/95 backdrop-blur">
                          <span>Número</span>
                          <span>Modelo</span>
                          <span>WhatsApp</span>
                        </div>
                        {cleanedPhones.map((phone, i) => {
                          const templateIndex = savedTemplates.length > 0 ? i % savedTemplates.length : -1;
                          return (
                            <div key={phone} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center p-2 border-b border-border/20 last:border-0 hover:bg-primary/5 transition-colors">
                              <span className="text-sm font-mono text-foreground truncate">{phone}</span>
                              <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary text-[10px]">
                                {templateIndex >= 0 ? `M${templateIndex + 1}` : "—"}
                              </Badge>
                              <a
                                href={`https://wa.me/${phone}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary hover:text-primary/80 transition-colors"
                                title="Abrir no WhatsApp"
                              >
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                      Válidos: <span className="font-semibold text-foreground">{cleanedPhones.length}</span> · Modelos: <span className="font-semibold text-foreground">{savedTemplates.length}</span>
                    </p>

                    <div className="flex flex-wrap gap-3">
                      <Button onClick={handleCreateCampaign} disabled={submitting || cleanedPhones.length === 0 || savedTemplates.length === 0} className="min-w-[200px] gap-2 shadow-[0_0_16px_-8px_hsl(var(--primary)/0.6)]">
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                        Criar Fila de Disparo
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
                {/* Progress Stats */}
                <Card className="relative overflow-hidden border-primary/15 bg-card/80 backdrop-blur shadow-[0_0_24px_-16px_hsl(var(--primary)/0.4)]">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
                  <CardHeader className="relative pb-3">
                    <CardTitle className="flex items-center gap-2 text-base text-foreground">
                      <Radio className="h-4 w-4 text-primary" />
                      Dashboard de Progresso
                    </CardTitle>
                    <CardDescription>
                      {activeCampaign
                        ? activeCampaign.status === "completed"
                          ? `Concluída: ${activeCampaign.name}`
                          : `Processando ${activeCampaign.name}...`
                        : "Nenhuma campanha ativa."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="relative space-y-4">
                    <Progress value={progressValue} className="h-3" />
                    {activeCampaign ? (
                      <>
                        <div className="grid gap-3 grid-cols-2">
                          {[
                            { label: "Na Fila", value: activeCampaign.total_recipients, cls: "text-foreground" },
                            { label: "Processados", value: `${activeCampaign.processed_recipients}/${activeCampaign.total_recipients}`, cls: "text-foreground" },
                            { label: "Sucesso", value: activeCampaign.success_count, cls: "text-primary" },
                            { label: "Falhas", value: activeCampaign.failure_count, cls: "text-destructive" },
                          ].map((item) => (
                            <div key={item.label} className="rounded-xl border border-border/30 bg-muted/20 p-3">
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{item.label}</p>
                              <p className={`mt-1 text-lg font-bold ${item.cls}`}>{item.value}</p>
                            </div>
                          ))}
                        </div>

                        {/* Countdown */}
                        {countdown.seconds > 0 && (
                          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center shadow-[0_0_16px_-10px_hsl(var(--primary)/0.5)]">
                            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mb-1">
                              <Timer className="h-3.5 w-3.5 text-primary" />
                              Próximo envio em
                            </div>
                            <p className="text-2xl font-bold text-primary font-mono tracking-wider">{countdown.display}</p>
                          </div>
                        )}

                        <Badge variant="outline" className={`${statusLabel[activeCampaign.status] ? "border-primary/30 bg-primary/10 text-primary" : "border-border/30 bg-muted/20 text-muted-foreground"}`}>
                          {statusLabel[activeCampaign.status] || activeCampaign.status}
                        </Badge>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">Crie uma fila para monitorar.</p>
                    )}
                  </CardContent>
                </Card>

                {/* Real-time Log */}
                <Card className="border-border/30 bg-card/80 backdrop-blur">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base text-foreground">Log em Tempo Real</CardTitle>
                    <CardDescription>Últimos eventos de envio.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                      {activeLogs.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Sem eventos ainda.</p>
                      ) : (
                        activeLogs.map((log) => (
                          <div key={log.id} className="rounded-xl border border-border/30 bg-muted/15 p-3 hover:border-primary/15 transition-colors">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground font-mono">{log.phone}</p>
                                <p className="text-[11px] text-muted-foreground">
                                  {log.step === "greeting" ? "Saudação" : `Modelo`} · {new Date(log.created_at).toLocaleString("pt-BR")}
                                </p>
                              </div>
                              <Badge variant="outline" className={log.status === "success" ? "border-primary/30 bg-primary/10 text-primary" : "border-destructive/30 bg-destructive/10 text-destructive"}>
                                {log.status === "success" ? "✓" : "✗"}
                              </Badge>
                            </div>
                            <p className="mt-1.5 line-clamp-2 text-xs text-foreground/80">{log.message}</p>
                            {log.error_message && <p className="mt-1 text-[11px] text-destructive">{log.error_message}</p>}
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
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
                  {activeCampaign ? `Acompanhe respostas em tempo real: ${activeCampaign.name}` : "Crie uma campanha para usar o monitor."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!activeCampaign ? (
                  <div className="rounded-2xl border border-dashed border-border/40 bg-muted/10 p-8 text-center text-sm text-muted-foreground">
                    Nenhuma campanha disponível.
                  </div>
                ) : (
                  <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
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
                            return (
                              <button
                                key={conv.id}
                                type="button"
                                onClick={() => setSelectedConversationId(conv.id)}
                                className={`w-full rounded-xl border p-3 text-left transition-all ${
                                  isSel
                                    ? "border-primary/30 bg-primary/10 shadow-[0_0_14px_-8px_hsl(var(--primary)/0.6)]"
                                    : "border-border/30 bg-background/60 hover:border-primary/15 hover:bg-primary/5"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-semibold text-foreground">{conv.contact_name || conv.phone}</p>
                                    <p className="text-[10px] text-muted-foreground font-mono">{conv.phone}</p>
                                  </div>
                                  <Badge variant="outline" className={`${meta.className} text-[10px] shrink-0`}>{meta.label}</Badge>
                                </div>
                                <p className="mt-1.5 line-clamp-1 text-[11px] text-muted-foreground">{latestMsg?.message || "..."}</p>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Chat Viewer */}
                    <div className="rounded-2xl border border-border/30 bg-muted/10 p-3">
                      {!activeConversation ? (
                        <div className="flex min-h-[560px] items-center justify-center rounded-xl border border-dashed border-border/30 p-6 text-center text-sm text-muted-foreground">
                          Selecione um chat para visualizar.
                        </div>
                      ) : (
                        <div className="flex min-h-[560px] flex-col">
                          {/* Header */}
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

                          {/* Messages */}
                          <div className="mt-3 flex-1 space-y-3 overflow-y-auto rounded-xl border border-border/30 bg-background/60 p-4">
                            {activeConversationMessages.length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center">Nenhuma mensagem registrada.</p>
                            ) : (
                              activeConversationMessages.map((msg) => {
                                const isOut = msg.direction === "outbound";
                                const isHuman = isOut && msg.sender_type === "human";
                                return (
                                  <div key={msg.id} className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
                                    <div className={`max-w-[85%] rounded-2xl border px-4 py-3 ${
                                      isHuman
                                        ? "border-warning/20 bg-warning/10"
                                        : isOut
                                          ? "border-primary/20 bg-primary/10"
                                          : "border-border/30 bg-muted/20"
                                    }`}>
                                      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-medium">
                                        {isHuman ? (
                                          <><User className="h-3 w-3 text-warning" /><span className="text-warning">Humano</span></>
                                        ) : isOut ? (
                                          <><Bot className="h-3 w-3 text-primary" /><span className="text-primary">Robô</span></>
                                        ) : (
                                          <><User className="h-3 w-3 text-muted-foreground" /><span className="text-muted-foreground">Cliente</span></>
                                        )}
                                        <span className="text-muted-foreground">· {new Date(msg.created_at).toLocaleString("pt-BR")}</span>
                                      </div>
                                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">{msg.message}</p>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>

                          {/* Action Bar */}
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
                              {activeConversation.conversation_status === "human_takeover"
                                ? "Bot pausado neste chat. Negocie manualmente."
                                : "Áudio simula gravação. Use 'Assumir' para pausar o bot."}
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
