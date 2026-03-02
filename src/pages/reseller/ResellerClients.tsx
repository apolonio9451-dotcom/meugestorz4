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
import { Plus, Search, Pencil, Trash2, Coins } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  price: number;
  duration_days: number;
}

export default function ResellerClients() {
  const { reseller, refreshReseller } = useReseller();
  const { toast } = useToast();
  const [clients, setClients] = useState<any[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [form, setForm] = useState({
    name: "", whatsapp: "", email: "", iptv_user: "", iptv_password: "", notes: "", plan_id: "", server: "",
  });

  const fetchClients = async () => {
    if (!reseller) return;
    const { data } = await supabase
      .from("clients")
      .select("*, client_subscriptions(id, end_date, plan_id, payment_status)")
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

  useEffect(() => {
    fetchClients();
    fetchPlans();
  }, [reseller]);

  const handleCreate = async () => {
    if (!reseller || !form.name.trim() || !form.plan_id) return;

    // Check credits
    if (reseller.credit_balance < 1) {
      toast({ title: "Créditos insuficientes", description: "Você precisa de pelo menos 1 crédito para criar um cliente.", variant: "destructive" });
      return;
    }

    const plan = plans.find((p) => p.id === form.plan_id);
    if (!plan) return;

    // Create client
    const { data: newClient, error: cErr } = await supabase.from("clients").insert({
      company_id: reseller.company_id,
      reseller_id: reseller.id,
      name: form.name,
      whatsapp: form.whatsapp,
      email: form.email,
      iptv_user: form.iptv_user,
      iptv_password: form.iptv_password,
      notes: form.notes,
      server: form.server,
    }).select("id").single();

    if (cErr) {
      toast({ title: "Erro", description: cErr.message, variant: "destructive" });
      return;
    }

    // Create subscription
    const startDate = new Date().toISOString().split("T")[0];
    const endDate = new Date(Date.now() + plan.duration_days * 86400000).toISOString().split("T")[0];

    await supabase.from("client_subscriptions").insert({
      client_id: newClient.id,
      company_id: reseller.company_id,
      plan_id: plan.id,
      start_date: startDate,
      end_date: endDate,
      amount: plan.price,
      payment_status: "paid",
    });

    // Deduct credit
    await supabase.from("resellers").update({ credit_balance: reseller.credit_balance - 1 }).eq("id", reseller.id);

    // Log transaction
    await supabase.from("reseller_credit_transactions").insert({
      reseller_id: reseller.id,
      company_id: reseller.company_id,
      amount: -1,
      type: "usage",
      description: `Cliente: ${form.name}`,
    });

    toast({ title: "Cliente criado com sucesso! (-1 crédito)" });
    setShowCreate(false);
    setForm({ name: "", whatsapp: "", email: "", iptv_user: "", iptv_password: "", notes: "", plan_id: "", server: "" });
    fetchClients();
    refreshReseller();
  };

  const handleUpdate = async () => {
    if (!selected) return;
    const { error } = await supabase.from("clients").update({
      name: form.name,
      whatsapp: form.whatsapp,
      email: form.email,
      iptv_user: form.iptv_user,
      iptv_password: form.iptv_password,
      notes: form.notes,
    }).eq("id", selected.id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Cliente atualizado" }); setShowEdit(false); fetchClients(); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este cliente?")) return;
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Cliente excluído" }); fetchClients(); }
  };

  const openEdit = (c: any) => {
    setSelected(c);
    setForm({ name: c.name, whatsapp: c.whatsapp || "", email: c.email || "", iptv_user: c.iptv_user || "", iptv_password: c.iptv_password || "", notes: c.notes || "", plan_id: "", server: c.server || "" });
    setShowEdit(true);
  };

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.whatsapp?.includes(search)
  );

  const getSubStatus = (client: any) => {
    const subs = client.client_subscriptions;
    if (!subs || subs.length === 0) return "sem plano";
    const today = new Date().toISOString().split("T")[0];
    const active = subs.find((s: any) => s.end_date >= today);
    return active ? "ativo" : "vencido";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Meus Clientes</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gerencie seus clientes • <span className="text-primary font-mono font-bold">{reseller?.credit_balance ?? 0}</span> créditos disponíveis
          </p>
        </div>
        <Button onClick={() => { setForm({ name: "", whatsapp: "", email: "", iptv_user: "", iptv_password: "", notes: "", plan_id: "", server: "" }); setShowCreate(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> Novo Cliente
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
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
                filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium text-foreground">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{c.whatsapp || "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm font-mono">{c.iptv_user || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={getSubStatus(c) === "ativo" ? "default" : "secondary"}>
                        {getSubStatus(c)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(c.id)} className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
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
    </div>
  );
}
