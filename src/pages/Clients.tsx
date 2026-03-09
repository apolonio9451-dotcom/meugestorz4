import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { SlotDatePicker } from "@/components/ui/slot-date-picker";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Plus, Search, MoreVertical, Pencil, Trash2, Clock, Key, X, DollarSign, RefreshCw, MessageCircle, LayoutGrid, Activity, AlertTriangle, History, Handshake, Eye, HeadsetIcon, CheckCircle2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { addDays, differenceInCalendarDays, format, parse, parseISO } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  cpf: string;
  notes: string;
  server: string;
  iptv_user: string;
  iptv_password: string;
  address: string;
  status: string;
  created_at: string;
  referred_by: string;
}

interface Subscription {
  id: string;
  client_id: string;
  end_date: string;
  amount: number;
  plan_id: string;
  plan_name?: string;
}

interface MacKey {
  id?: string;
  mac: string;
  key: string;
  app_name: string;
  expires_at: string;
}

export default function Clients() {
  const { companyId, user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [subscriptions, setSubscriptions] = useState<Record<string, Subscription>>({});
  const [macKeys, setMacKeys] = useState<Record<string, MacKey[]>>({});
  const [search, setSearch] = useState("");
  const [mainFilter, setMainFilter] = useState<"todos" | "status" | "vencidos" | "excluidos" | "log">("todos");
  const [statusSubFilter, setStatusSubFilter] = useState<"ativos" | "vence_hoje" | "vence_amanha" | "a_vencer" | "followup" | "suporte">("ativos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [loading, setLoading] = useState(false);
  const [formMacKeys, setFormMacKeys] = useState<MacKey[]>([]);
  const [plans, setPlans] = useState<{ id: string; name: string; price: number; duration_days: number }[]>([]);
  const [formPlanId, setFormPlanId] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formEndDate, setFormEndDate] = useState<Date | undefined>(undefined);
  const [servers, setServers] = useState<{ id: string; name: string }[]>([]);
  const [formBirthDate, setFormBirthDate] = useState<Date | undefined>(undefined);
  const [messageTemplates, setMessageTemplates] = useState<Record<string, string>>({});
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [welcomeModalOpen, setWelcomeModalOpen] = useState(false);
  const [welcomeData, setWelcomeData] = useState<{
    name: string; planName: string; amount: string; endDate: string; user: string; password: string; whatsapp: string;
  } | null>(null);
  const [formReferredBy, setFormReferredBy] = useState("");
  const [referralSearch, setReferralSearch] = useState("");
  const [macModalClientId, setMacModalClientId] = useState<string | null>(null);
  const [showReferralDropdown, setShowReferralDropdown] = useState(false);
  const [formFollowUpActive, setFormFollowUpActive] = useState(true);
  const fetchClients = async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    setClients(data || []);
  };

  const fetchSubscriptions = async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from("client_subscriptions")
      .select("id, client_id, end_date, amount, plan_id")
      .eq("company_id", companyId);
    
    if (data) {
      const planIds = [...new Set(data.map(s => s.plan_id))];
      const { data: plans } = await supabase
        .from("subscription_plans")
        .select("id, name")
        .in("id", planIds);
      const planMap = Object.fromEntries((plans || []).map(p => [p.id, p.name]));

      const map: Record<string, Subscription> = {};
      for (const sub of data) {
        if (!map[sub.client_id] || sub.end_date > map[sub.client_id].end_date) {
          map[sub.client_id] = { ...sub, plan_name: planMap[sub.plan_id] || "Plano" };
        }
      }
      setSubscriptions(map);
    }
  };

  const fetchMacKeys = async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from("client_mac_keys")
      .select("id, client_id, mac, key, app_name, expires_at")
      .eq("company_id", companyId);
    
    if (data) {
      const map: Record<string, MacKey[]> = {};
      for (const mk of data) {
        if (!map[mk.client_id]) map[mk.client_id] = [];
        map[mk.client_id].push({ id: mk.id, mac: mk.mac, key: mk.key, app_name: (mk as any).app_name || "", expires_at: (mk as any).expires_at || "" });
      }
      setMacKeys(map);
    }
  };

  const fetchPlans = async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from("subscription_plans")
      .select("id, name, price, duration_days")
      .eq("company_id", companyId)
      .eq("is_active", true);
    setPlans(data || []);
  };

  const fetchServers = async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from("servers")
      .select("id, name")
      .eq("company_id", companyId)
      .order("name");
    setServers(data || []);
  };

  const fetchMessageTemplates = async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from("message_templates")
      .select("category, message")
      .eq("company_id", companyId);
    const map: Record<string, string> = {};
    (data || []).forEach((t) => { map[t.category] = t.message; });
    setMessageTemplates(map);
  };

  const fetchActivityLogs = async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from("client_activity_logs")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(50);
    setActivityLogs(data || []);
  };

  const logActivity = async (action: string, clientName: string, clientId?: string, details?: string) => {
    if (!companyId) return;
    await supabase.from("client_activity_logs").insert({
      company_id: companyId,
      client_id: clientId || null,
      client_name: clientName,
      action,
      details: details || "",
      created_by: user?.id || null,
    });
  };

  useEffect(() => { fetchClients(); fetchSubscriptions(); fetchMacKeys(); fetchPlans(); fetchServers(); fetchMessageTemplates(); fetchActivityLogs(); }, [companyId]);

  const getMessageCategory = (days: number | null): string => {
    if (days === null) return "vencidos";
    if (days < 0) return "vencidos";
    if (days === 0) return "vence_hoje";
    if (days === 1) return "vence_amanha";
    if (days <= 7) return "a_vencer";
    return "a_vencer";
  };

  const buildCobrancaMessage = (client: Client, sub: Subscription | undefined, days: number | null): string => {
    const category = getMessageCategory(days);
    const defaultMessages: Record<string, string> = {
      vence_hoje: "Olá {nome}! Seu plano vence hoje. Plano: {plano} Valor: R$ {valor}",
      vence_amanha: "Olá {nome}! Seu plano vence amanhã. Plano: {plano} Valor: R$ {valor}",
      a_vencer: "Olá {nome}! Seu plano vence em {dias} dias. Plano: {plano} Valor: R$ {valor}",
      vencidos: "Olá {nome}! Seu plano está vencido há {dias} dias. Plano: {plano} Valor: R$ {valor}",
      followup: "Olá {nome}! Estamos entrando em contato sobre seu plano. Plano: {plano} Valor: R$ {valor}",
    };
    let msg = messageTemplates[category] || defaultMessages[category] || defaultMessages.vencidos;
    const clientMks = macKeys[client.id] || [];
    msg = msg
      .replace(/{nome}/g, client.name || "")
      .replace(/{plano}/g, sub?.plan_name || "")
      .replace(/{valor}/g, sub ? Number(sub.amount).toFixed(2).replace(".", ",") : "")
      .replace(/{vencimento}/g, sub ? format(parseISO(sub.end_date), "dd/MM/yyyy") : "")
      .replace(/{dias}/g, days !== null ? String(Math.abs(days)) : "")
      .replace(/{mac}/g, clientMks[0]?.mac || "")
      .replace(/{usuario}/g, client.iptv_user || "")
      .replace(/{senha}/g, client.iptv_password || "")
      .replace(/{servidor}/g, client.server || "");
    return msg;
  };

  const openDialog = (client?: Client) => {
    if (client) {
      setEditing(client);
      setFormMacKeys(macKeys[client.id] || []);
      setFormFollowUpActive((client as any).follow_up_active !== false);
      setFormBirthDate(client.cpf ? (() => { try { return parse(client.cpf, "dd/MM/yyyy", new Date()); } catch { return undefined; } })() : undefined);
      setFormReferredBy(client.referred_by || "");
      setReferralSearch(client.referred_by || "");
      const sub = subscriptions[client.id];
      if (sub) {
        setFormPlanId(sub.plan_id);
        setFormAmount(String(sub.amount));
        setFormEndDate(parseISO(sub.end_date));
      } else {
        setFormPlanId("");
        setFormAmount("");
        setFormEndDate(undefined);
      }
    } else {
      setEditing(null);
      setFormMacKeys([]);
      setFormBirthDate(undefined);
      setFormReferredBy("");
      setReferralSearch("");
      setFormFollowUpActive(true);
      setFormPlanId("");
      setFormAmount("");
      setFormEndDate(undefined);
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!companyId) return;
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const payload = {
      name: form.get("name") as string,
      email: form.get("email") as string,
      whatsapp: form.get("whatsapp") as string,
      cpf: formBirthDate ? format(formBirthDate, "dd/MM/yyyy") : "",
      notes: form.get("notes") as string,
      server: form.get("server") as string,
      iptv_user: form.get("iptv_user") as string,
      iptv_password: form.get("iptv_password") as string,
      phone: "",
      address: "",
      status: "active",
      company_id: companyId,
      referred_by: formReferredBy.trim(),
      follow_up_active: formFollowUpActive,
    };

    let clientId = editing?.id;

    if (editing) {
      const { error } = await supabase.from("clients").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); setLoading(false); return; }
    } else {
      const { data, error } = await supabase.from("clients").insert(payload).select("id").single();
      if (error) { toast.error(error.message); setLoading(false); return; }
      clientId = data.id;
    }

    // Save MAC & KEY entries
    if (clientId) {
      // Delete existing mac keys for this client
      await supabase.from("client_mac_keys").delete().eq("client_id", clientId);
      
      // Insert new ones
      const validMacKeys = formMacKeys.filter(mk => mk.mac.trim() || mk.key.trim() || mk.app_name.trim());
      if (validMacKeys.length > 0) {
        await supabase.from("client_mac_keys").insert(
          validMacKeys.map(mk => ({
            client_id: clientId!,
            company_id: companyId,
            mac: mk.mac.trim(),
            key: mk.key.trim(),
            app_name: mk.app_name.trim(),
            expires_at: mk.expires_at || null,
          } as any))
        );
      }

      // Save subscription
      if (formPlanId && formEndDate) {
        await supabase.from("client_subscriptions").delete().eq("client_id", clientId);
        await supabase.from("client_subscriptions").insert({
          client_id: clientId!,
          company_id: companyId,
          plan_id: formPlanId,
          amount: parseFloat(formAmount) || 0,
          end_date: format(formEndDate, "yyyy-MM-dd"),
        });
      }
    }

    const isNew = !editing;
    const selectedPlan = plans.find(p => p.id === formPlanId);

    setLoading(false);
    setDialogOpen(false);
    setEditing(null);
    setFormMacKeys([]);
    setFormPlanId("");
    setFormAmount("");
    setFormEndDate(undefined);
    setFormReferredBy("");
    setReferralSearch("");
    fetchClients();
    fetchMacKeys();
    fetchSubscriptions();

    if (isNew) {
      await logActivity("criação", payload.name, clientId, `Plano: ${selectedPlan?.name || "—"}`);
      setWelcomeData({
        name: payload.name,
        planName: selectedPlan?.name || "—",
        amount: formAmount ? parseFloat(formAmount).toFixed(2).replace(".", ",") : "0,00",
        endDate: formEndDate ? format(formEndDate, "dd/MM/yyyy") : "—",
        user: payload.iptv_user,
        password: payload.iptv_password,
        whatsapp: payload.whatsapp,
      });
      setWelcomeModalOpen(true);
    } else {
      await logActivity("edição", payload.name, clientId, "Dados do cliente atualizados");
      toast.success("Cliente atualizado!");
    }
    fetchActivityLogs();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este cliente?")) return;
    const client = clients.find(c => c.id === id);
    const { error } = await supabase.from("clients").update({ status: "excluded" }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Cliente excluído!");
      await logActivity("exclusão", client?.name || "", id, "Cliente movido para excluídos");
      fetchClients(); fetchMacKeys(); fetchActivityLogs();
    }
  };

  const handleRenew = async (clientId: string, days: number) => {
    const sub = subscriptions[clientId];
    if (!sub) { toast.error("Cliente sem assinatura ativa"); return; }
    const currentEnd = parseISO(sub.end_date);
    const baseDate = currentEnd > new Date() ? currentEnd : new Date();
    const newEnd = addDays(baseDate, days);
    const { error } = await supabase
      .from("client_subscriptions")
      .update({ end_date: format(newEnd, "yyyy-MM-dd"), updated_at: new Date().toISOString() })
      .eq("id", sub.id);
    if (error) toast.error(error.message);
    else {
      const client = clients.find(c => c.id === clientId);
      await logActivity("renovação", client?.name || "", clientId, `Renovado +${days} dias`);
      toast.success(`Renovado por +${days} dias!`); fetchSubscriptions(); fetchActivityLogs();
    }
  };

  const handleRenewSameDate = async (clientId: string) => {
    const sub = subscriptions[clientId];
    if (!sub) { toast.error("Cliente sem assinatura ativa"); return; }
    const currentEnd = parseISO(sub.end_date);
    const dayOfMonth = currentEnd.getDate();
    let newEnd = new Date(currentEnd);
    newEnd.setMonth(newEnd.getMonth() + 1);
    newEnd.setDate(dayOfMonth);
    if (newEnd <= new Date()) {
      newEnd = new Date();
      newEnd.setMonth(newEnd.getMonth() + 1);
      newEnd.setDate(dayOfMonth);
    }
    const { error } = await supabase
      .from("client_subscriptions")
      .update({ end_date: format(newEnd, "yyyy-MM-dd"), updated_at: new Date().toISOString() })
      .eq("id", sub.id);
    if (error) toast.error(error.message);
    else {
      const client = clients.find(c => c.id === clientId);
      await logActivity("renovação", client?.name || "", clientId, `Renovado para dia ${dayOfMonth}`);
      toast.success(`Renovado para dia ${dayOfMonth} do próximo mês!`); fetchSubscriptions(); fetchActivityLogs();
    }
  };

  const addMacKey = () => setFormMacKeys([...formMacKeys, { mac: "", key: "", app_name: "", expires_at: "" }]);
  const removeMacKey = (index: number) => setFormMacKeys(formMacKeys.filter((_, i) => i !== index));
  const formatMac = (value: string) => {
    const raw = value.replace(/[^0-9]/g, "").slice(0, 12);
    return raw.match(/.{1,2}/g)?.join(":") || raw;
  };

  const updateMacKey = (index: number, field: "mac" | "key", value: string) => {
    const updated = [...formMacKeys];
    updated[index] = { ...updated[index], [field]: field === "mac" ? formatMac(value) : value };
    setFormMacKeys(updated);
  };

  const getDaysRemaining = (endDate: string) => differenceInCalendarDays(parseISO(endDate), new Date());

  // Separate excluded clients
  const activeClients = clients.filter(c => c.status !== "excluded");
  const excludedClients = clients.filter(c => c.status === "excluded");

  const searchFiltered = activeClients.filter(
    (c) => c.name.toLowerCase().includes(search.toLowerCase()) || (c.whatsapp || "").includes(search) || 
    (macKeys[c.id] || []).some(mk => mk.mac.toLowerCase().includes(search.toLowerCase()))
  );

  const searchFilteredExcluded = excludedClients.filter(
    (c) => c.name.toLowerCase().includes(search.toLowerCase()) || (c.whatsapp || "").includes(search)
  );

  const getClientDays = (clientId: string) => {
    const sub = subscriptions[clientId];
    return sub ? getDaysRemaining(sub.end_date) : null;
  };

  const getClientActiveDays = (clientId: string) => {
    const sub = subscriptions[clientId];
    if (!sub) return null;
    const days = getDaysRemaining(sub.end_date);
    if (days === null || days <= 0) return null;
    const client = clients.find(c => c.id === clientId);
    if (!client) return null;
    return differenceInCalendarDays(new Date(), parseISO(client.created_at));
  };

  const filtered = (() => {
    if (mainFilter === "excluidos") return searchFilteredExcluded;
    if (mainFilter === "log") return [];
    if (mainFilter === "vencidos") return searchFiltered.filter(c => { const d = getClientDays(c.id); return d !== null && d < 0; });
    if (mainFilter === "status") {
      return searchFiltered.filter((c) => {
        const days = getClientDays(c.id);
        switch (statusSubFilter) {
          case "ativos": return days !== null && days > 0;
          case "vence_hoje": return days !== null && days === 0;
          case "vence_amanha": return days !== null && days === 1;
          case "a_vencer": return days !== null && days >= 2 && days <= 7;
          case "followup": {
            const activeDays = getClientActiveDays(c.id);
            return activeDays !== null && activeDays >= 15 && (c as any).follow_up_active !== false;
          }
          case "suporte": {
            const supportDate = (c as any).support_started_at;
            return !!supportDate;
          }
          default: return true;
        }
      });
    }
    return searchFiltered; // "todos"
  })();

  const filterCounts = {
    todos: activeClients.length,
    vencidos: searchFiltered.filter(c => { const d = getClientDays(c.id); return d !== null && d < 0; }).length,
    excluidos: excludedClients.length,
    ativos: searchFiltered.filter(c => { const d = getClientDays(c.id); return d !== null && d > 0; }).length,
    vence_hoje: searchFiltered.filter(c => getClientDays(c.id) === 0).length,
    vence_amanha: searchFiltered.filter(c => getClientDays(c.id) === 1).length,
    a_vencer: searchFiltered.filter(c => { const d = getClientDays(c.id); return d !== null && d >= 2 && d <= 7; }).length,
    followup: searchFiltered.filter(c => { const ad = getClientActiveDays(c.id); return ad !== null && ad >= 15 && (c as any).follow_up_active !== false; }).length,
    suporte: searchFiltered.filter(c => !!(c as any).support_started_at).length,
  };

  const mainBlocks = [
    { key: "todos" as const, label: "Todos", icon: LayoutGrid, count: filterCounts.todos },
    { key: "status" as const, label: "Status", icon: Activity, count: filterCounts.ativos },
    { key: "vencidos" as const, label: "Vencidos", icon: AlertTriangle, count: filterCounts.vencidos },
    { key: "excluidos" as const, label: "Excluídos", icon: Trash2, count: filterCounts.excluidos },
    { key: "log" as const, label: "Log", icon: History, count: activityLogs.length },
  ];

  const statusSubFilters = [
    { key: "ativos" as const, label: "Ativos", count: filterCounts.ativos, color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    { key: "vence_hoje" as const, label: "Vence Hoje", count: filterCounts.vence_hoje, color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
    { key: "vence_amanha" as const, label: "Vence Amanhã", count: filterCounts.vence_amanha, color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
    { key: "a_vencer" as const, label: "A Vencer", count: filterCounts.a_vencer, color: "bg-yellow-600/20 text-yellow-500 border-yellow-600/30" },
    { key: "followup" as const, label: "Follow-up", count: filterCounts.followup, color: "bg-cyan-400/20 text-cyan-400 border-cyan-400/50" },
    { key: "suporte" as const, label: "Suporte", count: filterCounts.suporte, color: "bg-violet-400/20 text-violet-400 border-violet-400/50" },
  ];

  const getBarColor = (days: number) => {
    if (days <= 0) return "bg-destructive/60";
    if (days <= 1) return "bg-orange-500";
    if (days <= 7) return "bg-yellow-500";
    return "bg-emerald-500";
  };

  const getBarTrackColor = (days: number) => {
    if (days <= 0) return "bg-destructive/20";
    if (days <= 1) return "bg-orange-500/20";
    if (days <= 7) return "bg-yellow-500/20";
    return "bg-emerald-500/20";
  };

  const getBarPercent = (days: number, max: number = 30) => {
    if (days <= 0) return 100;
    return Math.min(100, (days / max) * 100);
  };

  const getDaysLabel = (days: number) => {
    if (days <= 0) return "Vencido";
    if (days === 1) return "1 dia restante";
    return `${days} dias restantes`;
  };

  const getExpiryBadge = (days: number) => {
    if (days < 0) return <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-[10px] font-bold uppercase">Vencido</Badge>;
    if (days === 0) return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-[10px] font-bold uppercase">Vence Hoje</Badge>;
    if (days === 1) return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[10px] font-bold uppercase">Vence Amanhã</Badge>;
    if (days <= 7) return <Badge className="bg-yellow-600/20 text-yellow-500 border-yellow-600/30 text-[10px] font-bold uppercase">A Vencer ({days}D)</Badge>;
    return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] font-bold uppercase">Ativo</Badge>;
  };

  return (
    <div className="space-y-3 sm:space-y-6">
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditing(null); setFormMacKeys([]); setFormPlanId(""); setFormAmount(""); setFormEndDate(undefined); setFormBirthDate(undefined); setFormReferredBy(""); setReferralSearch(""); } }}>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar por nome, WhatsApp ou MAC..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <DialogTrigger asChild>
              <Button size="icon" className="h-9 w-9 rounded-full shrink-0" onClick={() => openDialog()}><Plus className="w-5 h-5" /></Button>
            </DialogTrigger>
          </div>
          <DialogContent className="max-w-xl max-h-[98vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle className="text-base">{editing ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-5 overflow-y-auto max-h-[calc(98vh-80px)] scrollbar-hide">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Dados Pessoais</p>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm">Nome *</Label>
                    <Input name="name" required placeholder="Nome completo" defaultValue={editing?.name || ""} className="h-10 text-sm border-primary/20 focus:border-primary/50" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-sm">WhatsApp *</Label>
                      <Input name="whatsapp" required placeholder="5521999990000" defaultValue={editing?.whatsapp || ""} className="h-10 text-sm border-primary/20 focus:border-primary/50" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Email</Label>
                      <Input name="email" type="email" placeholder="email@ex.com" defaultValue={editing?.email || ""} className="h-10 text-sm border-primary/20 focus:border-primary/50" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-sm">CPF</Label>
                      <Input name="cpf" placeholder="000.000.000-00" defaultValue={editing?.cpf || ""} className="h-10 text-sm border-primary/20 focus:border-primary/50" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Nascimento</Label>
                      <SlotDatePicker date={formBirthDate} onDateChange={setFormBirthDate} placeholder="Selecione..." fromYear={1940} toYear={new Date().getFullYear()} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5 relative">
                      <Label className="text-sm">Indicado por</Label>
                      <Input
                        placeholder="Nome..."
                        value={referralSearch}
                        onChange={(e) => {
                          setReferralSearch(e.target.value);
                          setFormReferredBy(e.target.value);
                          setShowReferralDropdown(true);
                        }}
                        onFocus={() => setShowReferralDropdown(true)}
                        onBlur={() => setTimeout(() => setShowReferralDropdown(false), 200)}
                        className="h-10 text-sm border-primary/20 focus:border-primary/50"
                      />
                      {showReferralDropdown && referralSearch.length > 0 && (() => {
                        const matches = activeClients.filter(c => 
                          c.name.toLowerCase().includes(referralSearch.toLowerCase()) &&
                          c.id !== editing?.id
                        ).slice(0, 5);
                        if (matches.length === 0) return null;
                        return (
                          <div className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-md shadow-lg max-h-28 overflow-y-auto">
                            {matches.map(c => (
                              <button
                                key={c.id}
                                type="button"
                                className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors"
                                onMouseDown={() => {
                                  setFormReferredBy(c.name);
                                  setReferralSearch(c.name);
                                  setShowReferralDropdown(false);
                                }}
                              >
                                {c.name}
                              </button>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Observações</Label>
                      <Input name="notes" placeholder="Notas internas..." defaultValue={editing?.notes || ""} className="h-10 text-sm border-primary/20 focus:border-primary/50" />
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Acesso ao Portal</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-sm">Usuário *</Label>
                      <Input name="iptv_user" required placeholder="usuario" defaultValue={editing?.iptv_user || ""} className="h-10 text-sm border-primary/20 focus:border-primary/50" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Senha</Label>
                      <Input name="iptv_password" placeholder="senha" defaultValue={editing?.iptv_password || ""} className="h-10 text-sm border-primary/20 focus:border-primary/50" />
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Assinatura</p>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm">Servidor *</Label>
                    <Select name="server" defaultValue={editing?.server || ""}>
                      <SelectTrigger className="h-10 text-sm border-primary/20 focus:border-primary/50"><SelectValue placeholder="Selecione o servidor" /></SelectTrigger>
                      <SelectContent>
                        {servers.map(s => (
                          <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-sm text-primary font-semibold">Plano *</Label>
                      <Select value={formPlanId} onValueChange={(v) => {
                        setFormPlanId(v);
                        const plan = plans.find(p => p.id === v);
                        if (plan) {
                          setFormAmount(String(plan.price));
                          setFormEndDate(addDays(new Date(), plan.duration_days));
                        }
                      }}>
                        <SelectTrigger className="h-10 text-sm border-primary/30 focus:ring-primary/40"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {plans.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm text-primary font-semibold">Valor (R$) *</Label>
                      <Input
                        value={formAmount}
                        onChange={(e) => setFormAmount(e.target.value)}
                        placeholder="30.00"
                        type="number"
                        step="0.01"
                        className="h-10 text-sm border-primary/30 focus:ring-primary/40"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Vencimento *</Label>
                    <SlotDatePicker date={formEndDate} onDateChange={setFormEndDate} placeholder="Data..." />
                  </div>
                </div>
              </div>
              <div>
                <p className="text-[11px] italic font-medium text-muted-foreground/70 uppercase tracking-wider mb-3">APP · MAC & KEY</p>
                <div className="space-y-3">
                  {formMacKeys.map((mk, i) => (
                    <div key={i} className="p-3 rounded-lg border border-primary/15 bg-primary/5">
                      <div className="flex gap-2">
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <Input
                            placeholder="Nome do App"
                            value={mk.app_name}
                            onChange={(e) => {
                              const updated = [...formMacKeys];
                              updated[i] = { ...updated[i], app_name: e.target.value };
                              setFormMacKeys(updated);
                            }}
                            className="h-9 text-sm border-primary/20 focus:border-primary/50"
                          />
                          <SlotDatePicker
                            date={mk.expires_at ? parseISO(mk.expires_at) : undefined}
                            onDateChange={(d) => {
                              const updated = [...formMacKeys];
                              updated[i] = { ...updated[i], expires_at: d ? format(d, "yyyy-MM-dd") : "" };
                              setFormMacKeys(updated);
                            }}
                            placeholder="Expiração..."
                          />
                          <Input
                            placeholder="MAC Address"
                            value={mk.mac}
                            onChange={(e) => {
                              const updated = [...formMacKeys];
                              updated[i] = { ...updated[i], mac: formatMac(e.target.value) };
                              setFormMacKeys(updated);
                            }}
                            className="h-9 text-sm border-primary/20 focus:border-primary/50"
                          />
                          <Input
                            placeholder="KEY"
                            value={mk.key}
                            onChange={(e) => {
                              const updated = [...formMacKeys];
                              updated[i] = { ...updated[i], key: e.target.value };
                              setFormMacKeys(updated);
                            }}
                            className="h-9 text-sm border-primary/20 focus:border-primary/50"
                          />
                        </div>
                        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 self-center" onClick={() => setFormMacKeys(formMacKeys.filter((_, idx) => idx !== i))}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => setFormMacKeys([...formMacKeys, { mac: "", key: "", app_name: "", expires_at: "" }])}>
                    <Plus className="w-3 h-3 mr-1" /> Adicionar MAC
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border border-primary/15 bg-primary/5">
                <div>
                  <Label className="text-sm font-medium">Ativar Follow-up Automático?</Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Se ativo, o cliente aparecerá na lista de acompanhamento 15 dias após o cadastro.</p>
                </div>
                <Switch checked={formFollowUpActive} onCheckedChange={setFormFollowUpActive} />
              </div>
              <Button type="submit" disabled={loading} className="w-full h-11 text-sm">{loading ? "Salvando..." : editing ? "Salvar" : "Cadastrar"}</Button>
            </form>
          </DialogContent>
      </Dialog>

      <div className="grid grid-cols-5 gap-2">
        {mainBlocks.map((block) => {
          const Icon = block.icon;
          const isActive = mainFilter === block.key;
          return (
            <button
              key={block.key}
              onClick={() => setMainFilter(block.key)}
              className={cn(
                "relative flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl border text-[11px] font-semibold transition-all duration-300",
                isActive
                  ? "bg-primary/15 border-primary/40 text-primary shadow-[0_0_12px_-3px_hsl(var(--primary)/0.4)]"
                  : "bg-card border-border/30 text-muted-foreground hover:bg-muted/50 hover:border-primary/20"
              )}
            >
              {block.count > 0 && (
                <span className={cn(
                  "absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-bold px-1 shadow-sm",
                  block.key === "log"
                    ? "bg-muted text-muted-foreground"
                    : "bg-primary text-primary-foreground"
                )}>
                  {block.count}
                </span>
              )}
              <Icon className="w-5 h-5" />
              <span className="truncate max-w-full">{block.label}</span>
            </button>
          );
        })}
      </div>

      {/* Status sub-filters (only visible when Status is selected) */}
      {mainFilter === "status" && (
        <div className="flex gap-2 flex-wrap sm:flex-nowrap sm:overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
          {statusSubFilters.map((sf) => {
            const isActive = statusSubFilter === sf.key;
            return (
              <button
                key={sf.key}
                onClick={() => setStatusSubFilter(sf.key)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap transition-all duration-300 shrink-0",
                  isActive
                    ? sf.color + " ring-1 ring-current shadow-[0_0_10px_-3px_currentColor]"
                    : "bg-card text-muted-foreground border-border/30 hover:bg-muted/50"
                )}
              >
                {sf.label}
                {sf.count > 0 && (
                  <span className={cn(
                    "inline-flex items-center justify-center min-w-[16px] h-[16px] rounded-full text-[10px] font-bold px-1",
                    isActive ? "bg-current/20" : "bg-muted"
                  )}>
                    {sf.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Follow-up info text */}
      {mainFilter === "status" && statusSubFilter === "followup" && (
        <p className="text-xs text-muted-foreground bg-cyan-400/5 border border-cyan-400/20 rounded-lg px-3 py-2">
          📋 <span className="font-semibold text-cyan-400">Follow-up</span> — Exibe clientes ativos com 15 dias ou mais de cadastro. Ideal para acompanhamento e fidelização após o período inicial.
        </p>
      )}

      {/* Suporte info text */}
      {mainFilter === "status" && statusSubFilter === "suporte" && (
        <p className="text-xs text-muted-foreground bg-violet-400/5 border border-violet-400/20 rounded-lg px-3 py-2">
          🎧 <span className="font-semibold text-violet-400">Suporte</span> — Clientes encaminhados para check-up de satisfação. Aparecem aqui 48h após serem enviados ao suporte. Foque na experiência, não em vendas.
        </p>
      )}

      {/* Log view */}
      {mainFilter === "log" ? (
        <div className="space-y-2">
          {activityLogs.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">Nenhum registro de atividade</p>
          ) : (
            <ScrollArea className="h-[60vh]">
              <div className="space-y-2 pr-2">
                {activityLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/30 bg-card">
                    <History className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        <span className="text-primary">{log.client_name}</span>
                        {" — "}
                        <span className="text-muted-foreground">{log.action}</span>
                      </p>
                      {log.details && <p className="text-xs text-muted-foreground mt-0.5">{log.details}</p>}
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        {format(parseISO(log.created_at), "dd/MM/yyyy HH:mm")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">Nenhum cliente encontrado</p>
      ) : (
        <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((client) => {
            const sub = subscriptions[client.id];
            const days = sub ? getDaysRemaining(sub.end_date) : null;
            const clientMacKeys = macKeys[client.id] || [];

            const neonColor = days === null
              ? "border-muted-foreground/20 shadow-[0_0_12px_-3px_hsl(var(--muted-foreground)/0.15)] hover:shadow-[0_0_20px_-3px_hsl(var(--muted-foreground)/0.3)]"
              : days < 0
                ? "border-destructive/30 shadow-[0_0_12px_-3px_hsl(var(--destructive)/0.3)] hover:shadow-[0_0_20px_-3px_hsl(var(--destructive)/0.5)]"
                : days === 0
                  ? "border-orange-500/30 shadow-[0_0_12px_-3px_rgb(249_115_22/0.3)] hover:shadow-[0_0_20px_-3px_rgb(249_115_22/0.5)]"
                  : days <= 7
                    ? "border-yellow-500/30 shadow-[0_0_12px_-3px_rgb(234_179_8/0.3)] hover:shadow-[0_0_20px_-3px_rgb(234_179_8/0.5)]"
                    : "border-emerald-500/30 shadow-[0_0_12px_-3px_rgb(16_185_129/0.3)] hover:shadow-[0_0_20px_-3px_rgb(16_185_129/0.5)]";

            return (
              <div
                key={client.id}
                className={`rounded-xl border bg-card p-3 sm:p-4 space-y-2.5 relative overflow-hidden transition-all duration-300 ${neonColor}`}
              >
                {/* Row 1: Name + username + status + menu */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-bold text-foreground text-base leading-tight truncate">{client.name}</h3>
                    {client.iptv_user && (
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">@{client.iptv_user}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {days !== null && getExpiryBadge(days)}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"><MoreVertical className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openDialog(client)}><Pencil className="w-3.5 h-3.5 mr-2" /> Editar</DropdownMenuItem>
                        {sub && (<>
                          <DropdownMenuItem onClick={() => handleRenewSameDate(client.id)}><RefreshCw className="w-3.5 h-3.5 mr-2" /> Renovar mesma data</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleRenew(client.id, 30)}><RefreshCw className="w-3.5 h-3.5 mr-2" /> Renovar +1 mês</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleRenew(client.id, 60)}><RefreshCw className="w-3.5 h-3.5 mr-2" /> Renovar +2 meses</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleRenew(client.id, 90)}><RefreshCw className="w-3.5 h-3.5 mr-2" /> Renovar +3 meses</DropdownMenuItem>
                        </>)}
                        <DropdownMenuSeparator />
                        {!(client as any).support_started_at && (
                          <DropdownMenuItem onClick={async () => {
                            const { error } = await supabase.from("clients").update({ support_started_at: new Date().toISOString() } as any).eq("id", client.id);
                            if (error) toast.error("Erro ao enviar para suporte");
                            else {
                              toast.success(`${client.name} enviado para Suporte`);
                              await logActivity("suporte", client.name, client.id, "Cliente encaminhado para check-up de suporte");
                              fetchClients(); fetchActivityLogs();
                            }
                          }}><HeadsetIcon className="w-3.5 h-3.5 mr-2" /> Enviar para Suporte</DropdownMenuItem>
                        )}
                        <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(client.id)}><Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Row 2: Vencimento + Valor (soft muted boxes) */}
                {sub && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-muted/40 px-3 py-2">
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1 mb-0.5"><Clock className="w-3 h-3" /> Vencimento</p>
                      <p className="text-sm font-semibold text-foreground">{format(parseISO(sub.end_date), "dd/MM/yyyy")}</p>
                    </div>
                    <div className="rounded-lg bg-muted/40 px-3 py-2">
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1 mb-0.5"><DollarSign className="w-3 h-3" /> Valor</p>
                      <p className="text-sm font-semibold text-primary">R$ {Number(sub.amount).toFixed(2).replace(".", ",")}</p>
                    </div>
                  </div>
                )}

                {/* Row 3: Servidor + Plano + Eye button */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-lg bg-muted/40 px-3 py-2 flex items-center justify-between min-w-0">
                    <span className="text-xs text-foreground font-medium truncate">{client.server || "—"}</span>
                    {sub && (
                      <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20 font-semibold ml-2 shrink-0">{sub.plan_name}</Badge>
                    )}
                  </div>
                  {clientMacKeys.length > 0 && (
                    <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground hover:text-primary rounded-lg bg-muted/40 hover:bg-muted/60" onClick={() => setMacModalClientId(client.id)}>
                      <Eye className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                {/* Row 4: App names + Indicação */}
                {(clientMacKeys.some(mk => mk.app_name) || client.referred_by) && (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                      {clientMacKeys.map((mk, i) => mk.app_name && (
                        <Badge key={mk.id || i} variant="outline" className="text-[10px] bg-muted/50 text-muted-foreground border-border/50 font-medium">{mk.app_name}</Badge>
                      ))}
                    </div>
                    {client.referred_by && (
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                        <Handshake className="w-3 h-3" />
                        <span className="font-medium text-foreground/70">{client.referred_by}</span>
                      </span>
                    )}
                  </div>
                )}

                {/* Row 5: Progress bar */}
                {days !== null && sub && (
                  <div className="space-y-1.5 pt-0.5">
                    <div className={cn("w-full h-1.5 rounded-full overflow-hidden", getBarTrackColor(days))}>
                      <div className={`h-full rounded-full transition-all ${getBarColor(days)}`} style={{ width: `${getBarPercent(days)}%` }} />
                    </div>
                    <div className={cn("flex items-center text-[11px]", days <= 0 ? "text-destructive" : days <= 7 ? "text-yellow-400" : "text-emerald-400")}>
                      <div className="flex items-center gap-1"><Clock className="w-3 h-3" /><span>{getDaysLabel(days)}</span></div>
                    </div>
                  </div>
                )}

                {/* Row 6: Action buttons */}
                {client.whatsapp && (
                  <div className="pt-2 border-t border-border/40 space-y-2">
                    {/* Suporte mode: show support message + finalize */}
                    {mainFilter === "status" && statusSubFilter === "suporte" && (client as any).support_started_at ? (
                      <div className="flex gap-2">
                        <a
                          href={`https://wa.me/${client.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
                            (() => {
                              const defaultSupportMsg = "Olá, {nome}! 👋\n\nFaço questão de entrar em contato para saber como ficou o seu sinal após o nosso último suporte. Como está a sua experiência hoje? 🌟\n\nPassando apenas para confirmar se ficou tudo 100% resolvido, pois sua satisfação é nossa prioridade e queremos garantir que você esteja em boas mãos. 🤝";
                              let msg = messageTemplates["suporte"] || defaultSupportMsg;
                              msg = msg
                                .replace(/{nome}/g, client.name || "")
                                .replace(/{plano}/g, sub?.plan_name || "")
                                .replace(/{valor}/g, sub ? Number(sub.amount).toFixed(2).replace(".", ",") : "")
                                .replace(/{vencimento}/g, sub ? format(parseISO(sub.end_date), "dd/MM/yyyy") : "")
                                .replace(/{usuario}/g, client.iptv_user || "")
                                .replace(/{senha}/g, client.iptv_password || "")
                                .replace(/{servidor}/g, client.server || "");
                              return msg;
                            })()
                          )}`}
                          target="_blank" rel="noopener noreferrer"
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-violet-500/15 text-violet-400 hover:bg-violet-500/25 border border-violet-500/30 transition-all text-xs font-bold"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <HeadsetIcon className="w-3.5 h-3.5" />
                          Enviar Check-up
                        </a>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                          onClick={async (e) => {
                            e.stopPropagation();
                            const { error } = await supabase.from("clients").update({ support_started_at: null } as any).eq("id", client.id);
                            if (error) toast.error("Erro ao finalizar suporte");
                            else {
                              toast.success(`Suporte finalizado para ${client.name}`);
                              await logActivity("suporte_finalizado", client.name, client.id, "Check-up de satisfação realizado");
                              fetchClients(); fetchActivityLogs();
                            }
                          }}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          Finalizar
                        </Button>
                      </div>
                    ) : (
                      <a
                        href={`https://wa.me/${client.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(buildCobrancaMessage(client, sub, days))}`}
                        target="_blank" rel="noopener noreferrer"
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30 transition-all text-xs font-bold shadow-[0_0_8px_-2px_rgb(16_185_129/0.3)] hover:shadow-[0_0_14px_-2px_rgb(16_185_129/0.5)]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.944 11.944 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.386 0-4.586-.826-6.32-2.208l-.442-.362-3.263 1.093 1.093-3.263-.362-.442A9.956 9.956 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/></svg>
                        Cobrar
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Welcome Modal */}
      <Dialog open={welcomeModalOpen} onOpenChange={setWelcomeModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <MessageCircle className="h-5 w-5 text-primary" />
              Cliente Criado!
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Envie uma mensagem de boas-vindas via WhatsApp com os dados de acesso.
            </p>
          </DialogHeader>

          {welcomeData && (
            <div className="rounded-lg border bg-muted/50 p-4 space-y-1 text-sm">
              <p>Cliente: <strong>{welcomeData.name}</strong></p>
              <p>Plano: <strong>{welcomeData.planName}</strong></p>
              <p>Valor: <strong>R$ {welcomeData.amount}</strong></p>
              <p>Vencimento: <strong>{welcomeData.endDate}</strong></p>
              <p>Usuário: <strong>{welcomeData.user || "—"}</strong></p>
              <p>Senha: <strong>{welcomeData.password || "—"}</strong></p>
            </div>
          )}

          <div className="flex flex-col gap-2 mt-2">
            <Button
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={() => {
                if (welcomeData?.whatsapp) {
                  const msg = `Olá ${welcomeData.name}! 🎉\n\nSeus dados de acesso:\n\n📋 Plano: ${welcomeData.planName}\n💰 Valor: R$ ${welcomeData.amount}\n📅 Vencimento: ${welcomeData.endDate}\n👤 Usuário: ${welcomeData.user || "—"}\n🔑 Senha: ${welcomeData.password || "—"}\n\nBem-vindo!`;
                  const phone = welcomeData.whatsapp.replace(/\D/g, "");
                  window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, "_blank");
                } else {
                  toast.error("WhatsApp não informado para este cliente.");
                }
                setWelcomeModalOpen(false);
                setWelcomeData(null);
              }}
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Enviar Boas-vindas WhatsApp
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => { setWelcomeModalOpen(false); setWelcomeData(null); }}
            >
              Pular
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MAC/KEY Details Modal */}
      <Dialog open={!!macModalClientId} onOpenChange={(open) => { if (!open) setMacModalClientId(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Key className="h-5 w-5 text-primary" />
              Detalhes MAC & KEY
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {(() => {
              const mks = macModalClientId ? (macKeys[macModalClientId] || []) : [];
              return mks.map((mk, i) => {
                const macDays = mk.expires_at ? differenceInCalendarDays(parseISO(mk.expires_at), new Date()) : null;
                const isExpired = macDays !== null && macDays < 0;
                const isExpiring = macDays !== null && macDays >= 0 && macDays <= 7;
                return (
                  <div key={mk.id || i} className="rounded-lg border border-border/50 bg-muted/30 p-3 space-y-2">
                    {mk.app_name && (
                      <p className="text-sm font-bold text-primary">{mk.app_name}</p>
                    )}
                    <div className="grid grid-cols-1 gap-1.5 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs w-12">MAC:</span>
                        <span className="font-mono text-foreground">{mk.mac || "—"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs w-12">KEY:</span>
                        <span className="font-mono text-foreground">{mk.key || "—"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs w-12">Venc.:</span>
                        <span className={cn(
                          "font-semibold",
                          isExpired ? "text-destructive" : isExpiring ? "text-orange-400" : "text-foreground"
                        )}>
                          {mk.expires_at ? format(parseISO(mk.expires_at), "dd/MM/yyyy") : "—"}
                          {isExpired && ` (vencido há ${Math.abs(macDays!)} dias)`}
                          {isExpiring && macDays === 0 && " (vence hoje!)"}
                          {isExpiring && macDays! > 0 && ` (vence em ${macDays} dias)`}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
