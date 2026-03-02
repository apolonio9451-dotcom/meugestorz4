import { useState, useEffect } from "react";
import { useReseller } from "@/hooks/useReseller";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Pencil, Trash2, Coins, RotateCcw } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  price: number;
  duration_days: number;
}

type StatusFilter = "all" | "ativo" | "vencido" | "teste" | "bloqueado";

export default function ResellerClients() {
  const { reseller, refreshReseller } = useReseller();
  const { toast } = useToast();
  const [clients, setClients] = useState<any[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showRenew, setShowRenew] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [renewPlanId, setRenewPlanId] = useState("");
  const [form, setForm] = useState({
    name: "", whatsapp: "", email: "", iptv_user: "", iptv_password: "", notes: "", plan_id: "", server: "",
  });

  const fetchClients = async () => {
    if (!reseller) return;
    const { data } = await supabase
      .from("clients")
      .select("*, client_subscriptions(id, end_date, plan_id, payment_status, amount)")
      .eq("reseller_id", reseller.id)
      .order("created_at", { ascending: false });
    if (data) setClients(data);
    setLoading(false);
  };

  const fetchPlans = async () => {
    if (!reseller) return;
    const { data } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("company_id", reseller.company_id)
      .eq("is_active", true);
    if (data) setPlans(data);
  };

  useEffect(() => { fetchClients(); fetchPlans(); }, [reseller]);

  const logActivity = async (action: string, entityType: string, entityId?: string, details?: any) => {
    if (!reseller) return;
    await supabase.from("reseller_activity_logs").insert({
      reseller_id: reseller.id,
      company_id: reseller.company_id,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details: details || {},
    });
  };

  const handleCreate = async () => {
    if (!reseller || !form.name.trim() || !form.plan_id) return;
    if (reseller.credit_balance < 1) {
      toast({ title: "Créditos insuficientes", description: "Você precisa de pelo menos 1 crédito.", variant: "destructive" });
      return;
    }
    const plan = plans.find((p) => p.id === form.plan_id);
    if (!plan) return;

    const { data: newClient, error: cErr } = await supabase.from("clients").insert({
      company_id: reseller.company_id, reseller_id: reseller.id,
      name: form.name, whatsapp: form.whatsapp, email: form.email,
      iptv_user: form.iptv_user, iptv_password: form.iptv_password,
      notes: form.notes, server: form.server,
    }).select("id").single();

    if (cErr) { toast({ title: "Erro", description: cErr.message, variant: "destructive" }); return; }

    const startDate = new Date().toISOString().split("T")[0];
    const endDate = new Date(Date.now() + plan.duration_days * 86400000).toISOString().split("T")[0];

    await supabase.from("client_subscriptions").insert({
      client_id: newClient.id, company_id: reseller.company_id,
      plan_id: plan.id, start_date: startDate, end_date: endDate,
      amount: plan.price, payment_status: "paid",
    });

    await supabase.from("resellers").update({ credit_balance: reseller.credit_balance - 1 }).eq("id", reseller.id);
    await supabase.from("reseller_credit_transactions").insert({
      reseller_id: reseller.id, company_id: reseller.company_id,
      amount: -1, type: "usage", description: `Cliente: ${form.name}`,
    });

    await logActivity("create_client", "client", newClient.id, { name: form.name });

    toast({ title: "Cliente criado com sucesso! (-1 crédito)" });
    setShowCreate(false);
    setForm({ name: "", whatsapp: "", email: "", iptv_user: "", iptv_password: "", notes: "", plan_id: "", server: "" });
    fetchClients();
    refreshReseller();
  };

  const handleUpdate = async () => {
    if (!selected) return;
    const { error } = await supabase.from("clients").update({
      name: form.name, whatsapp: form.whatsapp, email: form.email,
      iptv_user: form.iptv_user, iptv_password: form.iptv_password, notes: form.notes,
    }).eq("id", selected.id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else {
      await logActivity("update_client", "client", selected.id, { name: form.name });
      toast({ title: "Cliente atualizado" }); setShowEdit(false); fetchClients();
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm("Excluir este cliente?")) return;
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else {
      await logActivity("delete_client", "client", id, { name });
      toast({ title: "Cliente excluído" }); fetchClients();
    }
  };

  const handleRenew = async () => {
    if (!selected || !renewPlanId || !reseller) return;
    if (reseller.credit_balance < 1) {
      toast({ title: "Créditos insuficientes", variant: "destructive" }); return;
    }
    const plan = plans.find((p) => p.id === renewPlanId);
    if (!plan) return;

    const startDate = new Date().toISOString().split("T")[0];
    const endDate = new Date(Date.now() + plan.duration_days * 86400000).toISOString().split("T")[0];

    await supabase.from("client_subscriptions").insert({
      client_id: selected.id, company_id: reseller.company_id,
      plan_id: plan.id, start_date: startDate, end_date: endDate,
      amount: plan.price, payment_status: "paid",
    });

    // Unblock if blocked
    if (selected.status === "blocked") {
      await supabase.from("clients").update({ status: "active" }).eq("id", selected.id);
    }

    await supabase.from("resellers").update({ credit_balance: reseller.credit_balance - 1 }).eq("id", reseller.id);
    await supabase.from("reseller_credit_transactions").insert({
      reseller_id: reseller.id, company_id: reseller.company_id,
      amount: -1, type: "usage", description: `Renovação: ${selected.name}`,
    });

    await logActivity("renew_client", "client", selected.id, { name: selected.name, plan: plan.name });

    toast({ title: "Renovado com sucesso! (-1 crédito)" });
    setShowRenew(false);
    fetchClients();
    refreshReseller();
  };

  const openEdit = (c: any) => {
    setSelected(c);
    setForm({ name: c.name, whatsapp: c.whatsapp || "", email: c.email || "", iptv_user: c.iptv_user || "", iptv_password: c.iptv_password || "", notes: c.notes || "", plan_id: "", server: c.server || "" });
    setShowEdit(true);
  };

  const openRenew = (c: any) => {
    setSelected(c);
    setRenewPlanId("");
    setShowRenew(true);
  };

  const getClientStatus = (c: any): string => {
    if (c.status === "blocked") return "bloqueado";
    if (c.status === "test") return "teste";
    const today = new Date().toISOString().split("T")[0];
    const subs = c.client_subscriptions || [];
    if (subs.length === 0) return "sem plano";
    return subs.some((s: any) => s.end_date >= today) ? "ativo" : "vencido";
  };

  const statusVariant = (s: string) => {
    switch (s) {
      case "ativo": return "default" as const;
      case "vencido": return "destructive" as const;
      case "bloqueado": return "secondary" as const;
      case "teste": return "outline" as const;
      default: return "secondary" as const;
    }
  };

  const filtered = clients.filter((c) => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.whatsapp?.includes(search);
    if (!matchSearch) return false;
    if (statusFilter === "all") return true;
    return getClientStatus(c) === statusFilter;
  });

  const statusCounts = clients.reduce((acc, c) => {
    const s = getClientStatus(c);
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Meus Clientes</h1>
          <p className="text-muted-foreground text-sm mt-1">
            <span className="text-primary font-mono font-bold">{reseller?.credit_balance ?? 0}</span> créditos disponíveis
          </p>
        </div>
        <Button onClick={() => { setForm({ name: "", whatsapp: "", email: "", iptv_user: "", iptv_password: "", notes: "", plan_id: "", server: "" }); setShowCreate(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> Novo Cliente
        </Button>
      </div>

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: "all" as StatusFilter, label: "Todos", count: clients.length },
          { key: "ativo" as StatusFilter, label: "Ativos", count: statusCounts["ativo"] || 0 },
          { key: "vencido" as StatusFilter, label: "Vencidos", count: statusCounts["vencido"] || 0 },
          { key: "teste" as StatusFilter, label: "Teste", count: statusCounts["teste"] || 0 },
          { key: "bloqueado" as StatusFilter, label: "Bloqueados", count: statusCounts["bloqueado"] || 0 },
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              statusFilter === f.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou WhatsApp..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Usuário IPTV</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum cliente</TableCell></TableRow>
              ) : (
                filtered.map((c) => {
                  const st = getClientStatus(c);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium text-foreground">{c.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{c.whatsapp || "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm font-mono">{c.iptv_user || "—"}</TableCell>
                      <TableCell><Badge variant={statusVariant(st)}>{st}</Badge></TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {(st === "vencido" || st === "bloqueado") && (
                            <Button size="icon" variant="ghost" onClick={() => openRenew(c)} title="Renovar">
                              <RotateCcw className="w-4 h-4 text-primary" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="w-4 h-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDelete(c.id, c.name)} className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" /> Novo Cliente
              <Badge variant="secondary" className="ml-auto font-mono text-xs"><Coins className="w-3 h-3 mr-1" />-1 crédito</Badge>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></div>
            <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div>
              <Label>Plano *</Label>
              <Select value={form.plan_id} onValueChange={(v) => setForm({ ...form, plan_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione um plano" /></SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} — R${p.price.toFixed(2)} ({p.duration_days}d)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Usuário IPTV</Label><Input value={form.iptv_user} onChange={(e) => setForm({ ...form, iptv_user: e.target.value })} /></div>
            <div><Label>Senha IPTV</Label><Input value={form.iptv_password} onChange={(e) => setForm({ ...form, iptv_password: e.target.value })} /></div>
            <div><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!form.name || !form.plan_id}>Criar Cliente</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Cliente</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></div>
            <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Usuário IPTV</Label><Input value={form.iptv_user} onChange={(e) => setForm({ ...form, iptv_user: e.target.value })} /></div>
            <div><Label>Senha IPTV</Label><Input value={form.iptv_password} onChange={(e) => setForm({ ...form, iptv_password: e.target.value })} /></div>
            <div><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>Cancelar</Button>
            <Button onClick={handleUpdate}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Renew Dialog */}
      <Dialog open={showRenew} onOpenChange={setShowRenew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-primary" /> Renovar: {selected?.name}
              <Badge variant="secondary" className="ml-auto font-mono text-xs"><Coins className="w-3 h-3 mr-1" />-1 crédito</Badge>
            </DialogTitle>
          </DialogHeader>
          <div>
            <Label>Plano</Label>
            <Select value={renewPlanId} onValueChange={setRenewPlanId}>
              <SelectTrigger><SelectValue placeholder="Selecione um plano" /></SelectTrigger>
              <SelectContent>
                {plans.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name} — R${p.price.toFixed(2)} ({p.duration_days}d)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenew(false)}>Cancelar</Button>
            <Button onClick={handleRenew} disabled={!renewPlanId}>Renovar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
