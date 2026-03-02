import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Plus, Search, Phone, MoreVertical, Pencil, Trash2, Clock, Key, X, CalendarIcon, DollarSign } from "lucide-react";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";

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
}

export default function Clients() {
  const { companyId } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [subscriptions, setSubscriptions] = useState<Record<string, Subscription>>({});
  const [macKeys, setMacKeys] = useState<Record<string, MacKey[]>>({});
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [loading, setLoading] = useState(false);
  const [formMacKeys, setFormMacKeys] = useState<MacKey[]>([]);
  const [plans, setPlans] = useState<{ id: string; name: string; price: number; duration_days: number }[]>([]);
  const [formPlanId, setFormPlanId] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formEndDate, setFormEndDate] = useState<Date | undefined>(undefined);
  const [servers, setServers] = useState<{ id: string; name: string }[]>([]);

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
      .select("id, client_id, mac, key")
      .eq("company_id", companyId);
    
    if (data) {
      const map: Record<string, MacKey[]> = {};
      for (const mk of data) {
        if (!map[mk.client_id]) map[mk.client_id] = [];
        map[mk.client_id].push({ id: mk.id, mac: mk.mac, key: mk.key });
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

  useEffect(() => { fetchClients(); fetchSubscriptions(); fetchMacKeys(); fetchPlans(); fetchServers(); }, [companyId]);

  const openDialog = (client?: Client) => {
    if (client) {
      setEditing(client);
      setFormMacKeys(macKeys[client.id] || []);
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
      cpf: form.get("cpf") as string,
      notes: form.get("notes") as string,
      server: form.get("server") as string,
      iptv_user: form.get("iptv_user") as string,
      iptv_password: form.get("iptv_password") as string,
      phone: "",
      address: "",
      status: "active",
      company_id: companyId,
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
      const validMacKeys = formMacKeys.filter(mk => mk.mac.trim() || mk.key.trim());
      if (validMacKeys.length > 0) {
        await supabase.from("client_mac_keys").insert(
          validMacKeys.map(mk => ({
            client_id: clientId!,
            company_id: companyId,
            mac: mk.mac.trim(),
            key: mk.key.trim(),
          }))
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

    toast.success(editing ? "Cliente atualizado!" : "Cliente adicionado!");
    setLoading(false);
    setDialogOpen(false);
    setEditing(null);
    setFormMacKeys([]);
    setFormPlanId("");
    setFormAmount("");
    setFormEndDate(undefined);
    fetchClients();
    fetchMacKeys();
    fetchSubscriptions();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este cliente?")) return;
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Cliente excluído!"); fetchClients(); fetchMacKeys(); }
  };

  const addMacKey = () => setFormMacKeys([...formMacKeys, { mac: "", key: "" }]);
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

  const searchFiltered = clients.filter(
    (c) => c.name.toLowerCase().includes(search.toLowerCase()) || (c.whatsapp || "").includes(search) || 
    (macKeys[c.id] || []).some(mk => mk.mac.toLowerCase().includes(search.toLowerCase()))
  );

  const getClientDays = (clientId: string) => {
    const sub = subscriptions[clientId];
    return sub ? getDaysRemaining(sub.end_date) : null;
  };

  const filtered = searchFiltered.filter((c) => {
    const days = getClientDays(c.id);
    switch (filter) {
      case "ativos": return days !== null && days > 0;
      case "vence_hoje": return days !== null && days === 0;
      case "vence_amanha": return days !== null && days === 1;
      case "a_vencer": return days !== null && days >= 2 && days <= 7;
      case "vencidos": return days !== null && days < 0;
      default: return true;
    }
  });

  const filterCounts = {
    todos: searchFiltered.length,
    ativos: searchFiltered.filter(c => { const d = getClientDays(c.id); return d !== null && d > 0; }).length,
    vence_hoje: searchFiltered.filter(c => getClientDays(c.id) === 0).length,
    vence_amanha: searchFiltered.filter(c => getClientDays(c.id) === 1).length,
    a_vencer: searchFiltered.filter(c => { const d = getClientDays(c.id); return d !== null && d >= 2 && d <= 7; }).length,
    vencidos: searchFiltered.filter(c => { const d = getClientDays(c.id); return d !== null && d < 0; }).length,
  };

  const filters = [
    { key: "todos", label: "Todos", color: "bg-muted text-muted-foreground" },
    { key: "ativos", label: "Ativos", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    { key: "vence_hoje", label: "Vence Hoje", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
    { key: "vence_amanha", label: "Vence Amanhã", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
    { key: "a_vencer", label: "A Vencer", color: "bg-yellow-600/20 text-yellow-500 border-yellow-600/30" },
    { key: "vencidos", label: "Vencidos", color: "bg-destructive/20 text-destructive border-destructive/30" },
  ];

  const getBarColor = (days: number) => {
    if (days <= 0) return "bg-destructive";
    if (days <= 3) return "bg-orange-500";
    if (days <= 7) return "bg-yellow-500";
    return "bg-emerald-500";
  };

  const getBarPercent = (days: number, max: number = 30) => {
    if (days <= 0) return 0;
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Clientes</h1>
          <p className="text-muted-foreground text-sm">{clients.length} clientes cadastrados</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditing(null); setFormMacKeys([]); setFormPlanId(""); setFormAmount(""); setFormEndDate(undefined); } }}>
          <DialogTrigger asChild>
            <Button onClick={() => openDialog()}><Plus className="w-4 h-4 mr-2" /> Novo Cliente</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Dados Pessoais</p>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Nome *</Label>
                    <Input name="name" required placeholder="Nome completo" defaultValue={editing?.name || ""} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>WhatsApp *</Label>
                      <Input name="whatsapp" required placeholder="5521999990000" defaultValue={editing?.whatsapp || ""} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Email</Label>
                      <Input name="email" type="email" placeholder="email@exemplo.com" defaultValue={editing?.email || ""} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>CPF</Label>
                      <Input name="cpf" placeholder="000.000.000-00" defaultValue={editing?.cpf || ""} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Observações</Label>
                      <Input name="notes" placeholder="Notas internas..." defaultValue={editing?.notes || ""} />
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Servidor & Assinatura</p>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Servidor *</Label>
                    <Select name="server" defaultValue={editing?.server || ""}>
                      <SelectTrigger><SelectValue placeholder="Selecione o servidor" /></SelectTrigger>
                      <SelectContent>
                        {servers.map(s => (
                          <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label>Plano *</Label>
                      <Select value={formPlanId} onValueChange={(v) => {
                        setFormPlanId(v);
                        const plan = plans.find(p => p.id === v);
                        if (plan) {
                          setFormAmount(String(plan.price));
                          setFormEndDate(addDays(new Date(), plan.duration_days));
                        }
                      }}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {plans.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Valor (R$) *</Label>
                      <Input
                        value={formAmount}
                        onChange={(e) => setFormAmount(e.target.value)}
                        placeholder="30.00"
                        type="number"
                        step="0.01"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Vencimento *</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn("w-full justify-start text-left font-normal", !formEndDate && "text-muted-foreground")}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {formEndDate ? format(formEndDate, "dd/MM/yyyy") : "dd/mm/aaaa"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={formEndDate}
                            onSelect={setFormEndDate}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label>Usuário IPTV *</Label>
                      <Input name="iptv_user" required placeholder="usuario_iptv" defaultValue={editing?.iptv_user || ""} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Senha IPTV *</Label>
                      <Input name="iptv_password" required placeholder="senha_iptv" defaultValue={editing?.iptv_password || ""} />
                    </div>
                  </div>
                </div>
              </div>

              {/* MAC & KEY Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">MAC & KEY</p>
                  <Button type="button" variant="outline" size="sm" onClick={addMacKey} className="h-7 text-xs">
                    <Plus className="w-3 h-3 mr-1" /> Adicionar
                  </Button>
                </div>
                <div className="space-y-2">
                  {formMacKeys.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">Nenhum MAC & KEY adicionado</p>
                  )}
                  {formMacKeys.map((mk, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        placeholder="00:00:00:00:00:00"
                        value={mk.mac}
                        onChange={(e) => updateMacKey(index, "mac", e.target.value)}
                        className="text-sm"
                      />
                      <Input
                        placeholder="Key"
                        value={mk.key}
                        onChange={(e) => updateMacKey(index, "key", e.target.value)}
                        className="text-sm"
                      />
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeMacKey(index)}>
                        <X className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Salvando..." : "Salvar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome, WhatsApp ou MAC..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide touch-pan-x" style={{ WebkitOverflowScrolling: 'touch' }}>
        {filters.map((f) => {
          const count = filterCounts[f.key as keyof typeof filterCounts];
          const isActive = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap transition-all shrink-0",
                isActive ? f.color + " ring-1 ring-current" : "bg-card text-muted-foreground border-border/60 hover:bg-muted/50"
              )}
            >
              {f.label}
              {count > 0 && (
                <span className={cn(
                  "inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-bold px-1",
                  isActive ? "bg-current/20" : "bg-muted"
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">Nenhum cliente encontrado</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((client) => {
            const sub = subscriptions[client.id];
            const days = sub ? getDaysRemaining(sub.end_date) : null;
            const clientMacKeys = macKeys[client.id] || [];

            return (
              <div
                key={client.id}
                className="rounded-xl border border-border/60 bg-card p-4 space-y-3 relative overflow-hidden"
              >
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-display font-bold text-foreground text-base">{client.name}</h3>
                    {days !== null && getExpiryBadge(days)}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openDialog(client)}>
                        <Pencil className="w-3.5 h-3.5 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(client.id)}>
                        <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Cobrança */}
                {client.whatsapp && (
                  <div className="flex items-center justify-end text-sm">
                    <a
                      href={`https://wa.me/${client.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent("Olá! Passando para lembrar sobre o pagamento da sua assinatura. Podemos ajudar?")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-warning/15 text-warning hover:bg-warning/25 transition-colors text-xs font-semibold"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DollarSign className="w-3 h-3" />
                      Cobrar
                    </a>
                  </div>
                )}

                {/* Badges: server + plan + price */}
                <div className="flex items-center gap-2 flex-wrap">
                  {client.server && (
                    <Badge variant="outline" className="bg-accent/10 text-accent border-accent/30 text-xs">
                      {client.server}
                    </Badge>
                  )}
                  {sub && (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      {sub.plan_name} · R$ {Number(sub.amount).toFixed(2).replace(".", ",")}
                    </Badge>
                  )}
                </div>

                {/* MAC & KEY */}
                {clientMacKeys.length > 0 && (
                  <div className="space-y-1">
                    {clientMacKeys.map((mk, i) => (
                      <div key={mk.id || i} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Key className="w-3 h-3 shrink-0" />
                        <span className="truncate font-mono">{mk.mac}{mk.key ? ` · ${mk.key}` : ""}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Progress bar */}
                {days !== null && sub && (
                  <div className="space-y-1.5 pt-1">
                    <div className="w-full h-1.5 rounded-full bg-muted/50 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${getBarColor(days)}`}
                        style={{ width: `${getBarPercent(days)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{getDaysLabel(days)}</span>
                      </div>
                      <span>{format(parseISO(sub.end_date), "dd/MM/yyyy")}</span>
                    </div>
                  </div>
                )}

                {/* Red dot for expired */}
                {days !== null && days <= 0 && (
                  <div className="absolute bottom-3 right-3 w-2.5 h-2.5 rounded-full bg-destructive" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
