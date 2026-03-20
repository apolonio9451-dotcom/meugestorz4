import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot, Check, ChevronDown, ChevronUp, Clock, Copy, ExternalLink, ImagePlus,
  Info, Loader2, MessageSquareMore, Mic, PauseCircle, Pencil, Plus, Radio,
  RefreshCw, Rocket, Save, Shield, Smartphone, Terminal, Timer, Trash2, User, X,
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
  id: string; name: string; status: string; total_recipients: number;
  processed_recipients: number; success_count: number; failure_count: number;
  created_at: string; started_at: string | null; completed_at: string | null;
  offer_templates: string[]; greeting_templates: string[];
  message_delay_min_seconds: number; message_delay_max_seconds: number;
  seller_instructions: string; offer_timeout_minutes: number;
};
type Recipient = {
  id: string; campaign_id: string; phone: string; normalized_phone: string;
  offer_template: string; status: string; current_step: string; error_message: string | null;
};
type LogRow = {
  id: string; campaign_id: string; phone: string; step: string; status: string;
  message: string; error_message: string | null; created_at: string;
};
type Conversation = {
  id: string; campaign_id: string; recipient_id: string | null; phone: string;
  normalized_phone: string; contact_name: string; conversation_status: string;
  has_reply: boolean; last_message_at: string; last_outgoing_at: string | null;
  last_incoming_at: string | null;
};
type ConversationMessage = {
  id: string; conversation_id: string; campaign_id: string; phone: string;
  direction: string; sender_type: string; message_type: string; message: string;
  delivery_status: string | null; created_at: string;
};
type MediaKind = "audio" | "image";

/* ─── Helpers ─── */
const normalizePhone = (v: string) => v.replace(/\D/g, "");
const STORAGE_KEY = "mass_broadcast_saved_templates";
const MAX_TEMPLATES = 10;
const BATCH_PAUSE_EVERY = 20;
const BATCH_PAUSE_SECONDS = 300;
const loadSavedTemplates = (): string[] => { try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r).slice(0, MAX_TEMPLATES) : []; } catch { return []; } };
const saveSavedTemplates = (t: string[]) => localStorage.setItem(STORAGE_KEY, JSON.stringify(t.slice(0, MAX_TEMPLATES)));
/** Shuffle array (Fisher-Yates) */
const shuffleArray = <T,>(arr: T[]): T[] => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const STATUS_LABEL: Record<string, string> = { queued: "Na fila", running: "Rodando", completed: "Concluída", paused: "Aguardando Início" };
const STATUS_COLOR: Record<string, string> = { queued: "border-warning/30 bg-warning/10 text-warning", running: "border-warning/30 bg-warning/10 text-warning", completed: "border-primary/30 bg-primary/10 text-primary", paused: "border-muted-foreground/30 bg-muted/20 text-muted-foreground" };
const CONV_STATUS: Record<string, { label: string; cls: string; icon: string }> = {
  bot_active: { label: "🤖 Bot", cls: "border-primary/40 bg-primary/10 text-primary", icon: "⚡" },
  awaiting_human: { label: "🔥 Respondeu", cls: "border-warning/30 bg-warning/15 text-warning", icon: "💬" },
  human_takeover: { label: "👤 Humano", cls: "border-warning/30 bg-warning/15 text-warning", icon: "👤" },
  not_interested: { label: "🚫 Não", cls: "border-destructive/30 bg-destructive/10 text-destructive", icon: "🚫" },
};

function useCountdown(iso: string | null) {
  const [s, setS] = useState(0);
  useEffect(() => {
    if (!iso) { setS(0); return; }
    const calc = () => setS(Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000)));
    calc(); const i = setInterval(calc, 1000); return () => clearInterval(i);
  }, [iso]);
  return { seconds: s, display: `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}` };
}

/* ─── Component ─── */
export default function MassBroadcast() {
  const { effectiveCompanyId: companyId, user } = useAuth();
  const audioRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const rtRef = useRef<number | null>(null);

  // State
  const [globalEnabled, setGlobalEnabled] = useState(false);
  const [savingToggle, setSavingToggle] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [delayRange, setDelayRange] = useState<[number, number]>([60, 120]);
  const [savedTemplates, setSavedTemplates] = useState<string[]>(loadSavedTemplates);
  const [editingTemplate, setEditingTemplate] = useState("");
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [expandedRecipients, setExpandedRecipients] = useState<Record<string, Recipient[]>>({});
  const [loadingRecipients, setLoadingRecipients] = useState<string | null>(null);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [editPhoneInput, setEditPhoneInput] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [batchLimits, setBatchLimits] = useState<Record<string, number>>({});
  const [sessionStarts, setSessionStarts] = useState<Record<string, number>>({});
  const [startingId, setStartingId] = useState<string | null>(null);

  // Broadcast instance
  const [bcConnected, setBcConnected] = useState(false);
  const [bcHasInstance, setBcHasInstance] = useState(false);
  const [bcQr, setBcQr] = useState<string | null>(null);
  const [bcProfile, setBcProfile] = useState("");
  const [bcOwner, setBcOwner] = useState("");
  const [bcChecking, setBcChecking] = useState(false);
  const [bcToken, setBcToken] = useState("");
  const [bcSaving, setBcSaving] = useState(false);
  const [bcCreating, setBcCreating] = useState(false);

  // Monitor
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [convMessages, setConvMessages] = useState<ConversationMessage[]>([]);
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null);
  const [mediaSending, setMediaSending] = useState<MediaKind | null>(null);
  const [takingOverId, setTakingOverId] = useState<string | null>(null);
  const [monitorCampaignId, setMonitorCampaignId] = useState<string | null>(null);

  // History modal
  const [historyPhone, setHistoryPhone] = useState<string | null>(null);
  const [historyCampaignId, setHistoryCampaignId] = useState<string | null>(null);
  const [historyMessages, setHistoryMessages] = useState<ConversationMessage[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [nextActionAt, setNextActionAt] = useState<string | null>(null);
  const countdown = useCountdown(nextActionAt);

  const cleanedPhones = useMemo(() => Array.from(new Set(phoneInput.split("\n").map(normalizePhone).filter(p => p.length >= 10))), [phoneInput]);
  const monitorCampaign = useMemo(() => campaigns.find(c => c.id === monitorCampaignId) ?? campaigns.find(c => c.status === "running" || c.status === "queued") ?? campaigns[0] ?? null, [campaigns, monitorCampaignId]);
  const activeLogs = useMemo(() => logs.slice(0, 20), [logs]);
  const activeConv = useMemo(() => conversations.find(c => c.id === selectedConvId) ?? null, [conversations, selectedConvId]);
  const activeConvMsgs = useMemo(() => convMessages.filter(m => m.conversation_id === selectedConvId), [convMessages, selectedConvId]);
  const latestMsgMap = useMemo(() => { const m = new Map<string, ConversationMessage>(); for (const msg of convMessages) m.set(msg.conversation_id, msg); return m; }, [convMessages]);

  /* ─── Data Loading ─── */
  const loadData = useCallback(async (spin = false) => {
    if (!companyId) return;
    if (spin) setRefreshing(true);
    try {
      const [sRes, cRes, lRes, nRes] = await Promise.all([
        supabase.from("api_settings" as any).select("id, bulk_send_enabled").eq("company_id", companyId).maybeSingle(),
        supabase.from("mass_broadcast_campaigns" as any).select("id, name, status, total_recipients, processed_recipients, success_count, failure_count, created_at, started_at, completed_at, offer_templates, greeting_templates, message_delay_min_seconds, message_delay_max_seconds, seller_instructions, offer_timeout_minutes").eq("company_id", companyId).order("created_at", { ascending: false }).limit(20),
        supabase.from("mass_broadcast_logs" as any).select("id, campaign_id, phone, step, status, message, error_message, created_at").eq("company_id", companyId).order("created_at", { ascending: false }).limit(60),
        supabase.from("mass_broadcast_recipients" as any).select("next_action_at").eq("company_id", companyId).in("status", ["pending", "processing"]).order("next_action_at", { ascending: true }).limit(1),
      ]);
      setGlobalEnabled(Boolean((sRes.data as any)?.bulk_send_enabled ?? false));
      setCampaigns(((cRes.data as unknown) as Campaign[]) || []);
      setLogs(((lRes.data as unknown) as LogRow[]) || []);
      setNextActionAt((nRes.data as any)?.[0]?.next_action_at ?? null);
    } finally { if (spin) setRefreshing(false); }
  }, [companyId]);

  const checkBc = useCallback(async (silent = false) => {
    if (!companyId) return;
    if (!silent) setBcChecking(true);
    try {
      const r = await supabase.functions.invoke("manage-instance", { body: { action: "status", company_id: companyId, scope: "broadcast" } });
      if (r.data?.success) {
        setBcHasInstance(r.data.has_instance); setBcConnected(r.data.connected);
        setBcProfile(r.data.profile_name || ""); setBcOwner(r.data.owner || "");
        setBcQr(r.data.qrcode || null);
      }
    } finally { if (!silent) setBcChecking(false); }
  }, [companyId]);

  const loadMonitor = useCallback(async () => {
    if (!companyId || !monitorCampaign?.id) { setConversations([]); setConvMessages([]); setSelectedConvId(null); return; }
    const [cR, mR] = await Promise.all([
      supabase.from("mass_broadcast_conversations" as any).select("id, campaign_id, recipient_id, phone, normalized_phone, contact_name, conversation_status, has_reply, last_message_at, last_outgoing_at, last_incoming_at").eq("company_id", companyId).eq("campaign_id", monitorCampaign.id).order("last_message_at", { ascending: false }).limit(60),
      supabase.from("mass_broadcast_conversation_messages" as any).select("id, conversation_id, campaign_id, phone, direction, sender_type, message_type, message, delivery_status, created_at").eq("company_id", companyId).eq("campaign_id", monitorCampaign.id).order("created_at", { ascending: true }).limit(300),
    ]);
    const nc = ((cR.data as unknown) as Conversation[]) || [];
    const nm = ((mR.data as unknown) as ConversationMessage[]) || [];
    setConversations(nc); setConvMessages(nm);
    setSelectedConvId(cur => cur && nc.some(c => c.id === cur) ? cur : nc[0]?.id ?? null);
  }, [monitorCampaign?.id, companyId]);

  const loadRecipients = useCallback(async (cid: string) => {
    if (!companyId) return;
    setLoadingRecipients(cid);
    try {
      const { data } = await supabase.from("mass_broadcast_recipients" as any).select("id, campaign_id, phone, normalized_phone, offer_template, status, current_step, error_message").eq("company_id", companyId).eq("campaign_id", cid).order("created_at", { ascending: true }).limit(500);
      setExpandedRecipients(p => ({ ...p, [cid]: ((data as unknown) as Recipient[]) || [] }));
    } finally { setLoadingRecipients(null); }
  }, [companyId]);

  const scheduleSync = useCallback((opts?: { withMonitor?: boolean; withRecipients?: boolean }) => {
    if (rtRef.current !== null) window.clearTimeout(rtRef.current);
    rtRef.current = window.setTimeout(() => {
      void loadData();
      if (opts?.withMonitor) void loadMonitor();
      if (opts?.withRecipients) Object.keys(expandedRecipients).forEach(id => void loadRecipients(id));
    }, 180);
  }, [expandedRecipients, loadRecipients, loadMonitor, loadData]);

  useEffect(() => { void loadData(); }, [loadData]);
  useEffect(() => { void checkBc(true); }, [checkBc]);
  useEffect(() => { void loadMonitor(); }, [loadMonitor]);

  useEffect(() => {
    if (!companyId) return;
    const ch = supabase.channel(`mass-broadcast-${companyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "api_settings", filter: `company_id=eq.${companyId}` }, () => scheduleSync())
      .on("postgres_changes", { event: "*", schema: "public", table: "mass_broadcast_campaigns", filter: `company_id=eq.${companyId}` }, () => scheduleSync({ withMonitor: true }))
      .on("postgres_changes", { event: "*", schema: "public", table: "mass_broadcast_logs", filter: `company_id=eq.${companyId}` }, () => scheduleSync())
      .on("postgres_changes", { event: "*", schema: "public", table: "mass_broadcast_recipients", filter: `company_id=eq.${companyId}` }, () => scheduleSync({ withRecipients: true }))
      .on("postgres_changes", { event: "*", schema: "public", table: "mass_broadcast_conversations", filter: `company_id=eq.${companyId}` }, () => scheduleSync({ withMonitor: true }))
      .on("postgres_changes", { event: "*", schema: "public", table: "mass_broadcast_conversation_messages", filter: `company_id=eq.${companyId}` }, () => scheduleSync({ withMonitor: true }))
      .subscribe();
    return () => { if (rtRef.current !== null) window.clearTimeout(rtRef.current); supabase.removeChannel(ch); };
  }, [companyId, scheduleSync]);

  /* ─── Handlers ─── */
  const handleToggle = async (checked: boolean) => {
    if (!companyId || savingToggle) return;
    setSavingToggle(true);
    try {
      const { data: ex } = await supabase.from("api_settings" as any).select("id").eq("company_id", companyId).maybeSingle();
      if ((ex as any)?.id) { await supabase.from("api_settings" as any).update({ bulk_send_enabled: checked }).eq("id", (ex as any).id); }
      else { await supabase.from("api_settings" as any).insert({ company_id: companyId, bulk_send_enabled: checked }); }
      setGlobalEnabled(checked);
      toast({ title: checked ? "Disparos ativados" : "Disparos pausados" });
    } catch (e: any) { toast({ title: "Erro", description: e?.message, variant: "destructive" }); }
    finally { setSavingToggle(false); }
  };

  const handleAddTemplate = () => {
    const t = editingTemplate.trim(); if (!t) return;
    if (savedTemplates.length >= MAX_TEMPLATES) { toast({ title: "Limite atingido", variant: "destructive" }); return; }
    const next = [...savedTemplates, t]; setSavedTemplates(next); saveSavedTemplates(next); setEditingTemplate("");
  };
  const handleRemoveTemplate = (i: number) => { const next = savedTemplates.filter((_, idx) => idx !== i); setSavedTemplates(next); saveSavedTemplates(next); };

  const handleCreate = async () => {
    if (!companyId || !user?.id) return;
    if (cleanedPhones.length === 0 || savedTemplates.length === 0) { toast({ title: "Adicione números e modelos", variant: "destructive" }); return; }
    setSubmitting(true);
    try {
      const name = campaignName.trim() || `Campanha ${new Date().toLocaleString("pt-BR")}`;
      const { data: c, error: cErr } = await supabase.from("mass_broadcast_campaigns" as any).insert({
        company_id: companyId, created_by: user.id, name, status: "paused",
        total_recipients: cleanedPhones.length, offer_templates: savedTemplates,
        greeting_templates: ["Olá!", "Tudo bem?", "Bom dia, como vai?"],
        message_delay_min_seconds: delayRange[0], message_delay_max_seconds: delayRange[1],
      }).select("id").single();
      if (cErr) throw cErr;
      const recs = cleanedPhones.map((p, i) => ({
        campaign_id: (c as any).id, company_id: companyId, phone: p, normalized_phone: p,
        offer_template: savedTemplates[i % savedTemplates.length], status: "pending",
        current_step: "offer", next_action_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      }));
      await supabase.from("mass_broadcast_recipients" as any).insert(recs);
      toast({ title: "Campanha criada!", description: `${cleanedPhones.length} contatos.` });
      setCampaignName(""); setPhoneInput(""); await loadData();
    } catch (e: any) { toast({ title: "Erro", description: e?.message, variant: "destructive" }); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    if (!companyId) return; setDeletingId(id);
    try {
      await Promise.all([
        supabase.from("mass_broadcast_conversation_messages" as any).delete().eq("campaign_id", id),
        supabase.from("mass_broadcast_conversations" as any).delete().eq("campaign_id", id),
        supabase.from("mass_broadcast_logs" as any).delete().eq("campaign_id", id),
        supabase.from("mass_broadcast_recipients" as any).delete().eq("campaign_id", id),
      ]);
      await supabase.from("mass_broadcast_campaigns" as any).delete().eq("id", id);
      toast({ title: "Campanha excluída" }); setExpandedRecipients(p => { const n = { ...p }; delete n[id]; return n; }); await loadData();
    } catch (e: any) { toast({ title: "Erro", description: e?.message, variant: "destructive" }); }
    finally { setDeletingId(null); }
  };

  const handleDuplicate = async (camp: Campaign) => {
    if (!companyId || !user?.id) return; setDuplicatingId(camp.id);
    try {
      const { data: orig } = await supabase.from("mass_broadcast_recipients" as any).select("phone, normalized_phone, offer_template").eq("campaign_id", camp.id).limit(1000);
      const recs = ((orig as unknown) as { phone: string; normalized_phone: string; offer_template: string }[]) || [];
      if (!recs.length) { toast({ title: "Sem contatos", variant: "destructive" }); return; }
      const { data: nc, error: cErr } = await supabase.from("mass_broadcast_campaigns" as any).insert({
        company_id: companyId, created_by: user.id, name: `${camp.name} (cópia)`, status: "paused",
        total_recipients: recs.length, offer_templates: camp.offer_templates, greeting_templates: camp.greeting_templates,
        message_delay_min_seconds: camp.message_delay_min_seconds, message_delay_max_seconds: camp.message_delay_max_seconds,
      }).select("id").single();
      if (cErr) throw cErr;
      await supabase.from("mass_broadcast_recipients" as any).insert(recs.map(r => ({
        campaign_id: (nc as any).id, company_id: companyId, phone: r.phone, normalized_phone: r.normalized_phone,
        offer_template: r.offer_template, status: "pending", current_step: "offer",
        next_action_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      })));
      toast({ title: "Campanha duplicada" }); await loadData();
    } catch (e: any) { toast({ title: "Erro", description: e?.message, variant: "destructive" }); }
    finally { setDuplicatingId(null); }
  };

  const handleEditRecipients = async (cid: string) => {
    if (!companyId) return;
    const phones = Array.from(new Set(editPhoneInput.split("\n").map(normalizePhone).filter(p => p.length >= 10)));
    if (!phones.length) { toast({ title: "Sem números válidos", variant: "destructive" }); return; }
    const camp = campaigns.find(c => c.id === cid); if (!camp) return;
    try {
      await supabase.from("mass_broadcast_recipients" as any).delete().eq("campaign_id", cid);
      const templates = camp.offer_templates?.length ? camp.offer_templates : savedTemplates;
      await supabase.from("mass_broadcast_recipients" as any).insert(phones.map((p, i) => ({
        campaign_id: cid, company_id: companyId, phone: p, normalized_phone: p,
        offer_template: templates[i % templates.length] || "", status: "pending", current_step: "offer",
        next_action_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      })));
      await supabase.from("mass_broadcast_campaigns" as any).update({ total_recipients: phones.length, processed_recipients: 0, success_count: 0, failure_count: 0, status: "paused" }).eq("id", cid);
      toast({ title: "Lista atualizada" }); setEditingCampaignId(null); setEditPhoneInput(""); await loadData(); await loadRecipients(cid);
    } catch (e: any) { toast({ title: "Erro", description: e?.message, variant: "destructive" }); }
  };

  const handleReset = async (cid: string) => {
    if (!companyId) return;
    try {
      await supabase.from("mass_broadcast_recipients" as any).update({ status: "pending", current_step: "offer", error_message: null, sent_greeting_at: null, sent_offer_at: null, last_attempt_at: null, next_action_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() }).eq("campaign_id", cid);
      await supabase.from("mass_broadcast_campaigns" as any).update({ status: "paused", processed_recipients: 0, success_count: 0, failure_count: 0, started_at: null, completed_at: null }).eq("id", cid);
      toast({ title: "Fila resetada" }); await loadData(); await loadRecipients(cid);
    } catch (e: any) { toast({ title: "Erro", description: e?.message, variant: "destructive" }); }
  };

  const handleStartBatch = async (cid: string) => {
    if (!companyId) return;
    if (!bcConnected) { toast({ title: "⚠️ Conecte a instância de disparo primeiro!", variant: "destructive" }); return; }
    const limit = batchLimits[cid] || 50;
    const camp = campaigns.find(c => c.id === cid); if (!camp) return;
    setStartingId(cid);
    try {
      setSessionStarts(p => ({ ...p, [cid]: camp.processed_recipients }));
      const { data: pending } = await supabase.from("mass_broadcast_recipients" as any).select("id").eq("campaign_id", cid).eq("status", "pending").order("created_at", { ascending: true }).limit(limit);
      if (!pending?.length) { toast({ title: "Sem contatos pendentes", variant: "destructive" }); return; }
      const ids = (pending as any[]).map(r => r.id);
      const dMin = camp.message_delay_min_seconds; const dMax = camp.message_delay_max_seconds;
      for (let i = 0; i < ids.length; i++) {
        const delay = i === 0 ? 0 : Math.floor(Math.random() * (dMax - dMin + 1)) + dMin;
        const nextAt = new Date(Date.now() + (i === 0 ? 0 : delay * 1000 * i)).toISOString();
        await supabase.from("mass_broadcast_recipients" as any).update({ next_action_at: nextAt }).eq("id", ids[i]);
      }
      await supabase.from("mass_broadcast_campaigns" as any).update({ status: "queued", started_at: new Date().toISOString() }).eq("id", cid);
      toast({ title: "🚀 Disparos iniciados!", description: `Enviando para ${ids.length} contatos.` }); await loadData();
    } catch (e: any) { toast({ title: "Erro", description: e?.message, variant: "destructive" }); }
    finally { setStartingId(null); }
  };

  const handlePause = async (cid: string) => {
    if (!companyId) return;
    try {
      await supabase.from("mass_broadcast_campaigns" as any).update({ status: "paused" }).eq("id", cid);
      await supabase.from("mass_broadcast_recipients" as any).update({ next_action_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() }).eq("campaign_id", cid).eq("status", "pending");
      toast({ title: "Campanha pausada" }); await loadData();
    } catch (e: any) { toast({ title: "Erro", description: e?.message, variant: "destructive" }); }
  };

  // Broadcast instance handlers
  const handleSaveBcToken = async () => {
    if (!companyId || !bcToken.trim()) return; setBcSaving(true);
    try {
      const r = await supabase.functions.invoke("manage-instance", { body: { action: "save", company_id: companyId, instance_token: bcToken.trim(), scope: "broadcast" } });
      if (r.data?.success) { setBcConnected(r.data.connected); setBcHasInstance(true); if (r.data.qrcode) setBcQr(r.data.qrcode); setBcProfile(r.data.profile_name || ""); setBcOwner(r.data.owner || ""); toast({ title: "Token salvo!" }); }
      else toast({ title: "Erro", description: r.data?.error, variant: "destructive" });
    } catch (e: any) { toast({ title: "Erro", description: e?.message, variant: "destructive" }); }
    finally { setBcSaving(false); }
  };

  const handleCreateBcInstance = async () => {
    if (!companyId) return; setBcCreating(true);
    try {
      const r = await supabase.functions.invoke("whatsapp-connect", { body: { userName: "Disparo em Massa", company_id: companyId } });
      if (r.data?.success && r.data?.token) {
        const sr = await supabase.functions.invoke("manage-instance", { body: { action: "save", company_id: companyId, instance_token: r.data.token, instance_name: "Disparo", scope: "broadcast" } });
        setBcHasInstance(true); if (r.data.qrCode) setBcQr(r.data.qrCode); if (sr.data?.connected) setBcConnected(true);
        toast({ title: "Instância criada!", description: "Escaneie o QR Code." });
      } else toast({ title: "Erro", description: r.data?.error, variant: "destructive" });
    } catch (e: any) { toast({ title: "Erro", description: e?.message, variant: "destructive" }); }
    finally { setBcCreating(false); }
  };

  const handleDeleteBcInstance = async () => {
    if (!companyId) return;
    try {
      await supabase.functions.invoke("manage-instance", { body: { action: "disconnect", company_id: companyId, scope: "broadcast" } });
      await supabase.functions.invoke("manage-instance", { body: { action: "delete", company_id: companyId, scope: "broadcast" } });
      setBcConnected(false); setBcHasInstance(false); setBcQr(null); setBcProfile(""); setBcOwner("");
      toast({ title: "Instância removida" });
    } catch (e: any) { toast({ title: "Erro", description: e?.message, variant: "destructive" }); }
  };

  // Monitor handlers
  const handleAssumeConv = async () => {
    if (!activeConv) return; setTakingOverId(activeConv.id);
    setConversations(c => c.map(x => x.id === activeConv.id ? { ...x, conversation_status: "human_takeover", has_reply: true } : x));
    try {
      await supabase.from("mass_broadcast_conversations" as any).update({ conversation_status: "human_takeover", has_reply: true, updated_at: new Date().toISOString() }).eq("id", activeConv.id);
      toast({ title: "Conversa assumida" });
    } catch (e: any) { toast({ title: "Erro", description: e?.message, variant: "destructive" }); void loadMonitor(); }
    finally { setTakingOverId(null); }
  };

  const handleMedia = async (kind: MediaKind, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file || !companyId || !activeConv) return;
    const ok = kind === "audio" ? file.type.startsWith("audio/") : file.type.startsWith("image/");
    if (!ok) { toast({ title: "Formato inválido", variant: "destructive" }); return; }
    if (file.size > 20 * 1024 * 1024) { toast({ title: "Max 20MB", variant: "destructive" }); return; }
    setMediaSending(kind);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
      const path = `${companyId}/manual/${Date.now()}_${safeName}`;
      const { error: upErr } = await supabase.storage.from("chatbot-media").upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from("chatbot-media").getPublicUrl(path);
      await supabase.from("chatbot_media").insert({ company_id: companyId, file_name: file.name, file_url: urlData.publicUrl, file_type: kind, file_size: file.size });
      await supabase.functions.invoke("mass-broadcast-manual-send", { body: { conversationId: activeConv.id, mediaUrl: urlData.publicUrl, mediaType: kind, fileName: file.name } });
      await loadMonitor(); toast({ title: kind === "audio" ? "Áudio enviado" : "Imagem enviada" });
    } catch (e: any) { toast({ title: "Erro", description: e?.message, variant: "destructive" }); }
    finally { setMediaSending(null); }
  };

  const handleViewHistory = async (phone: string, campaignId: string) => {
    setHistoryPhone(phone); setHistoryCampaignId(campaignId); setHistoryLoading(true); setHistoryMessages([]);
    try {
      const { data } = await supabase.from("mass_broadcast_conversation_messages" as any).select("id, conversation_id, campaign_id, phone, direction, sender_type, message_type, message, delivery_status, created_at").eq("company_id", companyId).eq("campaign_id", campaignId).eq("normalized_phone", phone.replace(/\D/g, "")).order("created_at", { ascending: true }).limit(10);
      setHistoryMessages(((data as unknown) as ConversationMessage[]) || []);
    } finally { setHistoryLoading(false); }
  };

  /* ═══════════════════════════════════════════════════
     RENDER — 100% Mobile-First
     ═══════════════════════════════════════════════════ */
  return (
    <AnimatedPage>
      <div className="w-full max-w-[100vw] min-w-0 overflow-x-hidden box-border p-4 space-y-4">

        {/* ─── HEADER ─── */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-foreground font-display truncate">Marketing Pro</h1>
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" className="shrink-0 rounded-full p-1.5 hover:bg-muted/40 transition-colors">
                  <Info className="h-4 w-4 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="start" className="max-w-[17rem] text-xs text-muted-foreground">
                <p className="font-semibold text-foreground mb-1">Disparo em Massa</p>
                <p>Rotação inteligente de até 10 mensagens por campanha. Atendimento IA automático quando o cliente responde.</p>
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className={`h-2.5 w-2.5 rounded-full ${globalEnabled ? "bg-primary animate-pulse shadow-[0_0_8px_hsl(var(--primary)/0.8)]" : "bg-muted-foreground/30"}`} />
            <Label htmlFor="api-switch" className="text-xs text-muted-foreground hidden sm:inline">API</Label>
            <Switch id="api-switch" checked={globalEnabled} onCheckedChange={handleToggle} disabled={savingToggle} />
          </div>
        </div>

        {/* ─── HISTORY DIALOG ─── */}
        <Dialog open={!!historyPhone} onOpenChange={open => { if (!open) { setHistoryPhone(null); setHistoryCampaignId(null); setHistoryMessages([]); } }}>
          <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-foreground">
                <MessageSquareMore className="h-4 w-4 text-primary" /> Histórico · {historyPhone}
              </DialogTitle>
            </DialogHeader>
            {historyLoading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            : historyMessages.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">Nenhuma mensagem.</p>
            : <div className="space-y-3">{historyMessages.map(msg => {
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
              })}</div>}
          </DialogContent>
        </Dialog>

        {/* ─── TABS ─── */}
        <Tabs defaultValue="config" className="space-y-4 min-w-0">
          <TabsList className="grid w-full grid-cols-3 gap-1 rounded-xl border border-border/40 bg-muted/30 p-1">
            <TabsTrigger value="config" className="gap-1 text-xs sm:text-sm data-[state=active]:bg-primary/15 data-[state=active]:text-primary min-w-0 px-2">
              <Rocket className="h-3.5 w-3.5 shrink-0" /><span className="truncate">Nova</span>
            </TabsTrigger>
            <TabsTrigger value="library" className="gap-1 text-xs sm:text-sm data-[state=active]:bg-primary/15 data-[state=active]:text-primary min-w-0 px-2">
              <Radio className="h-3.5 w-3.5 shrink-0" /><span className="truncate">Campanhas</span>
            </TabsTrigger>
            <TabsTrigger value="monitor" className="gap-1 text-xs sm:text-sm data-[state=active]:bg-primary/15 data-[state=active]:text-primary min-w-0 px-2">
              <MessageSquareMore className="h-3.5 w-3.5 shrink-0" /><span className="truncate">Monitor</span>
            </TabsTrigger>
          </TabsList>

          {/* ═══ TAB: NOVA CAMPANHA ═══ */}
          <TabsContent value="config" className="space-y-4 min-w-0">
            {/* Templates */}
            <Card className="border-border/30 bg-card/80">
              <Collapsible open={templatesOpen} onOpenChange={setTemplatesOpen}>
                <CardHeader className="pb-3">
                  <CollapsibleTrigger className="flex items-center justify-between w-full text-left">
                    <CardTitle className="flex items-center gap-2 text-sm text-foreground">
                      <MessageSquareMore className="h-4 w-4 text-primary" />
                      Modelos de Mensagem
                      <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary ml-1 text-[10px]">{savedTemplates.length}/{MAX_TEMPLATES}</Badge>
                    </CardTitle>
                    {templatesOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                  </CollapsibleTrigger>
                  <CardDescription className="text-xs">Até {MAX_TEMPLATES} variações com rotação automática.</CardDescription>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="space-y-3 pt-0">
                    {savedTemplates.length > 0 && (
                      <div className="space-y-2 max-h-[20rem] overflow-y-auto">
                        {savedTemplates.map((t, i) => (
                          <div key={i} className="group rounded-xl border border-border/40 bg-muted/20 p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary mb-1.5 text-[10px]">M{i + 1}</Badge>
                                <p className="text-sm text-foreground whitespace-pre-wrap break-words line-clamp-3">{t}</p>
                              </div>
                              <Button size="icon" variant="ghost" className="shrink-0 text-destructive hover:text-destructive h-8 w-8" onClick={() => handleRemoveTemplate(i)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {savedTemplates.length < MAX_TEMPLATES && (
                      <div className="space-y-2">
                        <Textarea value={editingTemplate} onChange={e => setEditingTemplate(e.target.value)} placeholder="Texto do novo modelo..." className="w-full min-h-[5rem] border-dashed border-primary/20" />
                        <Button onClick={handleAddTemplate} disabled={!editingTemplate.trim()} variant="outline" className="w-full min-h-[3rem] gap-2 border-primary/30 hover:bg-primary/10">
                          <Plus className="h-4 w-4" /> Salvar Modelo ({savedTemplates.length + 1}/{MAX_TEMPLATES})
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>

            {/* Campaign Creation */}
            <Card className="border-border/30 bg-card/80">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm text-foreground">
                  <Radio className="h-4 w-4 text-primary" /> Lista de Contatos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome da campanha</Label>
                  <Input value={campaignName} onChange={e => setCampaignName(e.target.value)} placeholder="Ex: Leads Facebook" className="w-full" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Números (um por linha)</Label>
                  <Textarea value={phoneInput} onChange={e => setPhoneInput(e.target.value)} placeholder={"5511999999999\n(11) 98888-7777"} className="w-full min-h-[8rem] font-mono text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-primary" /> Delay entre mensagens</Label>
                  <Slider min={30} max={300} step={5} value={delayRange} onValueChange={v => setDelayRange(v as [number, number])} />
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Mín: {delayRange[0]}s</span><span>Máx: {delayRange[1]}s</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Válidos: <span className="font-semibold text-foreground">{cleanedPhones.length}</span> · Modelos: <span className="font-semibold text-foreground">{savedTemplates.length}</span>
                </p>
                <div className="flex flex-col gap-2">
                  <Button onClick={handleCreate} disabled={submitting || !cleanedPhones.length || !savedTemplates.length} className="w-full min-h-[3rem] gap-2">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />} Criar Campanha
                  </Button>
                  <Button variant="outline" onClick={() => void loadData(true)} disabled={refreshing} className="w-full min-h-[3rem] gap-2">
                    <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Atualizar
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Stats + Console */}
            <Card className="border-primary/15 bg-card/80">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm text-foreground"><Radio className="h-4 w-4 text-primary" /> Resumo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { l: "Campanhas", v: campaigns.length, c: "text-foreground" },
                    { l: "Contatos", v: campaigns.reduce((a, c) => a + c.total_recipients, 0), c: "text-foreground" },
                    { l: "Sucesso", v: campaigns.reduce((a, c) => a + c.success_count, 0), c: "text-primary" },
                    { l: "Falhas", v: campaigns.reduce((a, c) => a + c.failure_count, 0), c: "text-destructive" },
                  ].map(s => (
                    <div key={s.l} className="rounded-xl border border-border/30 bg-muted/20 p-2.5">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.l}</p>
                      <p className={`mt-0.5 text-lg font-bold ${s.c}`}>{s.v}</p>
                    </div>
                  ))}
                </div>
                {countdown.seconds > 0 && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                      <Timer className="h-3 w-3 text-primary" /> Próximo envio em
                    </div>
                    <p className="text-xl font-bold text-primary font-mono">{countdown.display}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/30 bg-card/80">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm text-foreground"><Terminal className="h-4 w-4 text-primary" /> Console</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border border-border/30 bg-background/80 p-2.5 max-h-[15rem] overflow-y-auto font-mono text-[11px] leading-relaxed space-y-0.5">
                  {activeLogs.length === 0 ? <p className="text-muted-foreground/60">Aguardando eventos...</p>
                  : activeLogs.map(log => (
                    <div key={log.id} className={`flex gap-2 ${log.status === "error" || log.error_message ? "text-destructive" : "text-primary"}`}>
                      <span className="text-muted-foreground/50 shrink-0">[{new Date(log.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}]</span>
                      <span className="break-words min-w-0">{log.message?.trim() || log.step}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══ TAB: CAMPANHAS ═══ */}
          <TabsContent value="library" className="space-y-4 min-w-0">
            {/* Top bar */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border/20 bg-background/95 p-3 backdrop-blur">
              <h2 className="text-base font-bold text-foreground">Campanhas</h2>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant={globalEnabled ? "default" : "outline"} onClick={() => void handleToggle(!globalEnabled)} disabled={savingToggle} className="w-full sm:w-auto min-h-[3rem] gap-2">
                  <div className={`h-2 w-2 rounded-full ${globalEnabled ? "bg-primary-foreground" : "bg-muted-foreground/60"}`} />
                  {globalEnabled ? "Pausar API" : "Ativar API"}
                </Button>
                <Button variant="outline" onClick={() => void loadData(true)} disabled={refreshing} className="w-full sm:w-auto min-h-[3rem] gap-2">
                  <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Atualizar
                </Button>
              </div>
            </div>

            {/* Broadcast Instance Accordion */}
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="bc" className="rounded-xl border border-border/30 bg-card/80 overflow-hidden">
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-primary/5">
                  <div className="flex w-full items-center gap-2 min-w-0 pr-2">
                    <div className={`h-3 w-3 rounded-full shrink-0 ${bcConnected ? "bg-primary animate-pulse shadow-[0_0_8px_hsl(var(--primary)/0.8)]" : "bg-destructive shadow-[0_0_6px_hsl(var(--destructive)/0.5)]"}`} />
                    <Smartphone className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm font-semibold text-foreground truncate">Instância de Disparo</span>
                    <Badge variant="outline" className={`ml-auto shrink-0 text-[10px] whitespace-nowrap ${bcConnected ? "border-primary/30 bg-primary/10 text-primary" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>
                      {bcConnected ? "🟢 Pronta" : "🔴 Desconectado"}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">Instância exclusiva para disparos. O chip principal não será afetado.</p>
                    {bcConnected && bcProfile && (
                      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0"><Smartphone className="h-4 w-4 text-primary" /></div>
                        <div className="min-w-0"><p className="text-sm font-medium text-foreground truncate">{bcProfile}</p></div>
                      </div>
                    )}
                    {bcQr && !bcConnected && (
                      <div className="rounded-xl border border-primary/20 bg-background p-4 text-center">
                        <p className="text-xs text-muted-foreground mb-2">Escaneie com o WhatsApp de disparos:</p>
                        <img src={bcQr} alt="QR Code" className="mx-auto w-full max-w-[12rem] rounded-lg" />
                      </div>
                    )}
                    {!bcHasInstance ? (
                      <div className="space-y-3">
                        <Button onClick={handleCreateBcInstance} disabled={bcCreating} className="w-full min-h-[3rem] gap-2">
                          {bcCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Gerar QR Code
                        </Button>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Ou cole um token:</Label>
                          <div className="flex flex-col gap-2 sm:flex-row">
                            <Input value={bcToken} onChange={e => setBcToken(e.target.value)} placeholder="Token da instância" className="w-full font-mono text-xs" />
                            <Button onClick={handleSaveBcToken} disabled={bcSaving || !bcToken.trim()} className="w-full sm:w-auto min-h-[3rem] shrink-0 gap-2">
                              {bcSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button variant="outline" onClick={() => void checkBc()} disabled={bcChecking} className="w-full sm:w-auto min-h-[3rem] gap-2">
                          <RefreshCw className={`h-3.5 w-3.5 ${bcChecking ? "animate-spin" : ""}`} /> Verificar
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" className="w-full sm:w-auto min-h-[3rem] gap-2 border-destructive/30 text-destructive hover:bg-destructive/10">
                              <Trash2 className="h-3.5 w-3.5" /> Remover
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remover instância?</AlertDialogTitle><AlertDialogDescription>Os disparos não poderão ser enviados até reconectar.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDeleteBcInstance} className="bg-destructive text-destructive-foreground">Remover</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            {/* Campaign Cards */}
            {campaigns.length === 0 ? (
              <Card className="border-dashed border-border/40 bg-muted/10">
                <CardContent className="p-6 text-center text-sm text-muted-foreground">
                  Nenhuma campanha criada. Vá para "Nova" para começar.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {campaigns.map(camp => {
                  const pct = camp.total_recipients > 0 ? Math.round((camp.processed_recipients / camp.total_recipients) * 100) : 0;
                  const recs = expandedRecipients[camp.id];
                  const isEditing = editingCampaignId === camp.id;
                  const isActive = camp.status === "queued" || camp.status === "running";

                  return (
                    <Card key={camp.id} className="border-border/30 bg-card/80 overflow-hidden">
                      {/* Card Header */}
                      <button type="button" className="w-full text-left p-4 hover:bg-primary/5 transition-colors" onClick={() => { if (!recs) void loadRecipients(camp.id); setExpandedRecipients(p => p[camp.id] ? (() => { const n = { ...p }; delete n[camp.id]; return n; })() : p); if (!recs) void loadRecipients(camp.id); }}>
                        <div className="flex items-start gap-3 min-w-0">
                          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/30 bg-muted/20 ${isActive ? "text-warning" : camp.status === "completed" ? "text-primary" : "text-muted-foreground"}`}>
                            {camp.status === "completed" ? <Check className="h-5 w-5" /> : isActive ? <Loader2 className="h-5 w-5 animate-spin" /> : <Clock className="h-5 w-5" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-foreground truncate">{camp.name}</p>
                              <Badge variant="outline" className={`text-[10px] shrink-0 ${STATUS_COLOR[camp.status] || ""}`}>
                                {STATUS_LABEL[camp.status] || camp.status}
                              </Badge>
                            </div>
                            <div className="mt-1 space-y-1">
                              <span className="text-[11px] text-muted-foreground">{new Date(camp.created_at).toLocaleDateString("pt-BR")}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-medium text-foreground">{camp.processed_recipients}/{camp.total_recipients}</span>
                                <Progress value={pct} className="h-1.5 flex-1" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </button>

                      {/* Expanded Content */}
                      {recs !== undefined && (
                        <div className="border-t border-border/20 p-4 space-y-4">
                          {/* Delay control */}
                          <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-primary" /> Delay</Label>
                            <Slider min={30} max={300} step={5} value={[camp.message_delay_min_seconds, camp.message_delay_max_seconds]} onValueChange={async v => {
                              setCampaigns(p => p.map(c => c.id === camp.id ? { ...c, message_delay_min_seconds: v[0], message_delay_max_seconds: v[1] } : c));
                              await supabase.from("mass_broadcast_campaigns" as any).update({ message_delay_min_seconds: v[0], message_delay_max_seconds: v[1] }).eq("id", camp.id);
                            }} />
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                              <span>Mín: {camp.message_delay_min_seconds}s</span><span>Máx: {camp.message_delay_max_seconds}s</span>
                            </div>
                          </div>

                          {/* START + BATCH */}
                          <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-3 space-y-3">
                            <div className="space-y-2">
                              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                                <Rocket className="h-3.5 w-3.5 text-primary" /> Enviar agora (Qtd)
                              </Label>
                              <Input type="number" min={1} max={camp.total_recipients - camp.processed_recipients}
                                value={batchLimits[camp.id] ?? Math.min(50, camp.total_recipients - camp.processed_recipients)}
                                onChange={e => setBatchLimits(p => ({ ...p, [camp.id]: Math.max(1, parseInt(e.target.value) || 1) }))}
                                className="w-full font-mono" placeholder="50" />
                            </div>
                            {isActive ? (
                              <Button className="w-full min-h-[3rem] gap-2 bg-warning/90 hover:bg-warning text-warning-foreground" onClick={() => void handlePause(camp.id)}>
                                <PauseCircle className="h-4 w-4" /> Pausar Disparos
                              </Button>
                            ) : (
                              <Button className="w-full min-h-[3rem] gap-2 bg-success hover:bg-success/90 text-success-foreground shadow-[0_0_16px_-6px_hsl(var(--success)/0.7)]"
                                disabled={startingId === camp.id || camp.processed_recipients >= camp.total_recipients}
                                onClick={() => void handleStartBatch(camp.id)}>
                                {startingId === camp.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                                🚀 Iniciar Disparos
                              </Button>
                            )}
                            {sessionStarts[camp.id] !== undefined && (
                              <div className="rounded-lg border border-primary/20 bg-background/60 px-3 py-2 flex items-center justify-between gap-2">
                                <span className="text-xs text-muted-foreground">Sessão:</span>
                                <Badge className="bg-primary/15 text-primary border-primary/30 font-mono text-sm">
                                  {Math.max(0, camp.processed_recipients - (sessionStarts[camp.id] || 0))} / {batchLimits[camp.id] ?? 50}
                                </Badge>
                              </div>
                            )}
                            {camp.processed_recipients >= camp.total_recipients && camp.total_recipients > 0 && (
                              <p className="text-xs text-primary font-medium text-center">✅ Todos processados.</p>
                            )}
                          </div>

                          {/* Action buttons */}
                          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                            <Button variant="outline" size="sm" className="min-h-[3rem] gap-1.5" onClick={() => { if (isEditing) { setEditingCampaignId(null); setEditPhoneInput(""); } else { setEditingCampaignId(camp.id); setEditPhoneInput(recs?.map(r => r.phone).join("\n") || ""); } }}>
                              <Pencil className="h-3.5 w-3.5" /> {isEditing ? "Cancelar" : "Editar"}
                            </Button>
                            <Button variant="outline" size="sm" className="min-h-[3rem] gap-1.5" disabled={duplicatingId === camp.id} onClick={() => void handleDuplicate(camp)}>
                              {duplicatingId === camp.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />} Duplicar
                            </Button>
                            <Button variant="outline" size="sm" className="min-h-[3rem] gap-1.5" onClick={() => setMonitorCampaignId(camp.id)}>
                              <MessageSquareMore className="h-3.5 w-3.5" /> Monitor
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm" className="min-h-[3rem] gap-1.5 border-warning/30 text-warning"><RefreshCw className="h-3.5 w-3.5" /> Resetar</Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Resetar fila?</AlertDialogTitle><AlertDialogDescription>Todos voltarão para "Pendente".</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => void handleReset(camp.id)} className="bg-warning text-warning-foreground">Resetar</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                            </AlertDialog>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm" className="min-h-[3rem] gap-1.5 border-destructive/30 text-destructive col-span-2 sm:col-span-1" disabled={deletingId === camp.id}>
                                  {deletingId === camp.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Excluir
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir campanha?</AlertDialogTitle><AlertDialogDescription>Ação permanente.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => void handleDelete(camp.id)} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                            </AlertDialog>
                          </div>

                          {/* Edit recipients */}
                          {isEditing && (
                            <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
                              <Label className="text-xs">Editar números (um por linha)</Label>
                              <Textarea value={editPhoneInput} onChange={e => setEditPhoneInput(e.target.value)} className="w-full min-h-[7rem] font-mono text-sm" />
                              <Button onClick={() => void handleEditRecipients(camp.id)} className="w-full min-h-[3rem] gap-2"><Save className="h-4 w-4" /> Salvar</Button>
                            </div>
                          )}

                          {/* Recipient cards */}
                          {loadingRecipients === camp.id ? (
                            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                          ) : recs?.length ? (
                            <div className="max-h-[20rem] space-y-2 overflow-y-auto rounded-xl border border-border/30 bg-muted/10 p-2">
                              {recs.map(r => (
                                <div key={r.id} className={`w-full rounded-xl border border-border/20 bg-background/70 p-3 ${r.status === "failed" ? "bg-destructive/5" : ""}`}>
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                      <p className="truncate font-mono text-sm text-foreground">{r.phone}</p>
                                      <span className={`text-[11px] font-medium ${r.status === "sent" ? "text-primary" : r.status === "failed" ? "text-destructive" : "text-muted-foreground"}`}>
                                        {r.status === "sent" ? "✅ Enviado" : r.status === "failed" ? "❌ Erro" : "⏳ Pendente"}
                                      </span>
                                    </div>
                                    <a href={`https://wa.me/${r.phone}`} target="_blank" rel="noopener noreferrer" className="shrink-0 inline-flex items-center gap-1 rounded-md border border-border/30 px-2 py-1 text-[11px] text-primary hover:bg-primary/10">
                                      <ExternalLink className="h-3 w-3" /> Abrir
                                    </a>
                                  </div>
                                  <p className="mt-1 break-words text-[10px] text-muted-foreground line-clamp-2">{r.offer_template}</p>
                                  {r.error_message && <p className="mt-0.5 text-[10px] text-destructive break-words">❌ {r.error_message}</p>}
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ═══ TAB: MONITOR ═══ */}
          <TabsContent value="monitor" className="space-y-4 min-w-0">
            <Card className="border-border/30 bg-card/80">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm text-foreground">
                  <MessageSquareMore className="h-4 w-4 text-primary" /> Monitor de Conversas
                </CardTitle>
                <CardDescription className="text-xs">{monitorCampaign ? `Campanha: ${monitorCampaign.name}` : "Crie uma campanha primeiro."}</CardDescription>
              </CardHeader>
              <CardContent>
                {!monitorCampaign ? (
                  <div className="rounded-xl border border-dashed border-border/40 bg-muted/10 p-6 text-center text-sm text-muted-foreground">
                    Nenhuma campanha disponível.
                  </div>
                ) : (
                  <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[17rem_1fr] min-w-0">
                    {/* Chat list */}
                    <div className="rounded-xl border border-border/30 bg-muted/10 p-2.5">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-semibold text-foreground">Chats</p>
                        <Badge variant="outline" className="border-border/40 text-foreground text-[10px]">{conversations.length}</Badge>
                      </div>
                      <div className="space-y-1.5 max-h-[24rem] lg:max-h-[32rem] overflow-y-auto">
                        {conversations.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-border/30 p-3 text-xs text-muted-foreground text-center">Sem conversas.</div>
                        ) : conversations.map(conv => {
                          const meta = CONV_STATUS[conv.conversation_status] || CONV_STATUS.bot_active;
                          const isSel = conv.id === selectedConvId;
                          const last = latestMsgMap.get(conv.id);
                          const snippet = last ? `${last.direction === "inbound" ? "Cliente" : "Bot"}: ${last.message?.slice(0, 40)}${(last.message?.length || 0) > 40 ? "…" : ""}` : "...";
                          return (
                            <button key={conv.id} type="button" onClick={() => setSelectedConvId(conv.id)}
                              className={`w-full rounded-lg border p-2.5 text-left transition-all ${isSel ? "border-primary/30 bg-primary/10" : "border-border/30 bg-background/60 hover:bg-primary/5"}`}>
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="text-sm shrink-0">{meta.icon}</span>
                                  <div className="min-w-0">
                                    <p className="truncate text-xs font-semibold text-foreground">{conv.contact_name || conv.phone}</p>
                                    <p className="truncate text-[10px] text-muted-foreground font-mono">{conv.phone}</p>
                                  </div>
                                </div>
                                <Badge variant="outline" className={`${meta.cls} text-[9px] shrink-0`}>{meta.label}</Badge>
                              </div>
                              <p className="mt-1 line-clamp-1 text-[10px] text-muted-foreground italic">{snippet}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Chat viewer */}
                    <div className="rounded-xl border border-border/30 bg-muted/10 p-2.5">
                      {!activeConv ? (
                        <div className="flex min-h-[20rem] lg:min-h-[32rem] items-center justify-center rounded-lg border border-dashed border-border/30 p-4 text-center text-sm text-muted-foreground">
                          Selecione um chat.
                        </div>
                      ) : (
                        <div className="flex min-h-[20rem] lg:min-h-[32rem] flex-col">
                          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/30 bg-background/60 px-3 py-2.5">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">{activeConv.contact_name || activeConv.phone}</p>
                              <p className="text-[10px] text-muted-foreground font-mono">{activeConv.phone}</p>
                            </div>
                            <Badge variant="outline" className={(CONV_STATUS[activeConv.conversation_status] || CONV_STATUS.bot_active).cls + " text-[10px]"}>
                              {(CONV_STATUS[activeConv.conversation_status] || CONV_STATUS.bot_active).label}
                            </Badge>
                          </div>
                          <div className="mt-2 flex-1 space-y-2 overflow-y-auto rounded-lg border border-border/30 bg-background/60 p-3">
                            {activeConvMsgs.length === 0 ? <p className="text-sm text-muted-foreground text-center">Nenhuma mensagem.</p>
                            : activeConvMsgs.map(msg => {
                              const isOut = msg.direction === "outbound";
                              const isHuman = isOut && msg.sender_type === "human";
                              return (
                                <div key={msg.id} className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
                                  <div className={`max-w-[85%] rounded-2xl border px-3 py-2 ${isHuman ? "border-warning/20 bg-warning/10" : isOut ? "border-primary/20 bg-primary/10" : "border-border/30 bg-muted/20"}`}>
                                    <div className="mb-1 flex items-center gap-1 text-[10px] font-medium">
                                      {isHuman ? <><User className="h-3 w-3 text-warning" /><span className="text-warning">Humano</span></> : isOut ? <><Bot className="h-3 w-3 text-primary" /><span className="text-primary">Robô</span></> : <><User className="h-3 w-3 text-muted-foreground" /><span className="text-muted-foreground">Cliente</span></>}
                                      <span className="text-muted-foreground/60">· {new Date(msg.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                                    </div>
                                    <p className="whitespace-pre-wrap break-words text-sm text-foreground">{msg.message}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <div className="mt-2 rounded-lg border border-border/30 bg-background/60 p-2.5">
                            <input ref={audioRef} type="file" accept="audio/*" className="hidden" onChange={e => void handleMedia("audio", e)} />
                            <input ref={imageRef} type="file" accept="image/*" className="hidden" onChange={e => void handleMedia("image", e)} />
                            <div className="flex flex-col gap-2 sm:flex-row">
                              <Button variant="outline" onClick={() => audioRef.current?.click()} disabled={mediaSending !== null} className="w-full sm:w-auto min-h-[3rem] gap-2">
                                {mediaSending === "audio" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />} Áudio
                              </Button>
                              <Button variant="outline" onClick={() => imageRef.current?.click()} disabled={mediaSending !== null} className="w-full sm:w-auto min-h-[3rem] gap-2">
                                {mediaSending === "image" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} Imagem
                              </Button>
                              <Button
                                variant={activeConv.conversation_status === "human_takeover" ? "secondary" : "default"}
                                onClick={() => void handleAssumeConv()}
                                disabled={takingOverId === activeConv.id || activeConv.conversation_status === "human_takeover"}
                                className="w-full sm:w-auto min-h-[3rem] gap-2">
                                {takingOverId === activeConv.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <PauseCircle className="h-4 w-4" />}
                                {activeConv.conversation_status === "human_takeover" ? "Assumida" : "Assumir"}
                              </Button>
                            </div>
                            <p className="mt-1.5 text-[10px] text-muted-foreground">
                              {activeConv.conversation_status === "human_takeover" ? "Bot pausado. Negocie manualmente." : "'Assumir' pausa o bot neste chat."}
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
