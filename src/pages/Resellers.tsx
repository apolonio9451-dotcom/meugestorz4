import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  Coins,
  Search,
  Pencil,
  Trash2,
  TrendingUp,
  History,
  Users,
  Settings,
} from "lucide-react";

interface Reseller {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  credit_balance: number;
  status: string;
  notes: string;
  created_at: string;
  can_resell: boolean;
  can_create_subreseller: boolean;
  can_create_trial: boolean;
  level: number;
  parent_reseller_id: string | null;
}

interface CreditTransaction {
  id: string;
  reseller_id: string;
  amount: number;
  type: string;
  description: string;
  created_at: string;
}

interface CreditSettings {
  credit_cost_client: number;
  credit_cost_trial: number;
  credit_cost_subreseller: number;
  default_credit_value: number;
}

export default function Resellers() {
  const { companyId } = useAuth();
  const { toast } = useToast();
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [creditSettings, setCreditSettings] = useState<CreditSettings>({
    credit_cost_client: 1,
    credit_cost_trial: 1,
    credit_cost_subreseller: 5,
    default_credit_value: 1,
  });

  // Dialogs
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selected, setSelected] = useState<Reseller | null>(null);

  // Form
  const [form, setForm] = useState({
    name: "", email: "", whatsapp: "", notes: "", status: "active",
    can_resell: true, can_create_subreseller: false, can_create_trial: true,
  });
  const [creditForm, setCreditForm] = useState({ amount: "", type: "purchase", description: "" });

  const fetchResellers = async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from("resellers")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (data) setResellers(data as Reseller[]);
    setLoading(false);
  };

  const fetchCreditSettings = async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from("credit_settings")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle();
    if (data) setCreditSettings(data as CreditSettings);
  };

  useEffect(() => {
    fetchResellers();
    fetchCreditSettings();
  }, [companyId]);

  const handleCreate = async () => {
    if (!companyId || !form.name.trim()) return;
    const { error } = await supabase.from("resellers").insert({
      company_id: companyId,
      name: form.name,
      email: form.email,
      whatsapp: form.whatsapp,
      notes: form.notes,
      can_resell: form.can_resell,
      can_create_subreseller: form.can_create_subreseller,
      can_create_trial: form.can_create_trial,
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Revendedor criado com sucesso" });
      setShowCreate(false);
      resetForm();
      fetchResellers();
    }
  };

  const handleUpdate = async () => {
    if (!selected) return;
    const { error } = await supabase
      .from("resellers")
      .update({
        name: form.name, email: form.email, whatsapp: form.whatsapp,
        notes: form.notes, status: form.status,
        can_resell: form.can_resell,
        can_create_subreseller: form.can_create_subreseller,
        can_create_trial: form.can_create_trial,
      })
      .eq("id", selected.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Revendedor atualizado" });
      setShowEdit(false);
      fetchResellers();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este revendedor?")) return;
    const { error } = await supabase.from("resellers").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Revendedor excluído" });
      fetchResellers();
    }
  };

  const handleAddCredits = async () => {
    if (!selected || !companyId || !creditForm.amount) return;
    const amount = parseInt(creditForm.amount);
    if (isNaN(amount) || amount === 0) return;

    const finalAmount = creditForm.type === "debit" ? -Math.abs(amount) : Math.abs(amount);

    // Prevent negative balance
    if (finalAmount < 0 && selected.credit_balance + finalAmount < 0) {
      toast({ title: "Erro", description: "Saldo insuficiente para débito", variant: "destructive" });
      return;
    }

    const { error: txError } = await supabase.from("reseller_credit_transactions").insert({
      reseller_id: selected.id,
      company_id: companyId,
      amount: finalAmount,
      type: creditForm.type,
      description: creditForm.description || (creditForm.type === "purchase" ? "Compra de créditos" : "Débito de créditos"),
    });

    if (txError) {
      toast({ title: "Erro", description: txError.message, variant: "destructive" });
      return;
    }

    // Log the action
    await supabase.from("reseller_activity_logs").insert({
      reseller_id: selected.id,
      company_id: companyId,
      action: creditForm.type === "purchase" ? "credit_added" : "credit_debited",
      entity_type: "credit",
      details: { amount: finalAmount, new_balance: selected.credit_balance + finalAmount },
    });

    const { error: upError } = await supabase
      .from("resellers")
      .update({ credit_balance: selected.credit_balance + finalAmount })
      .eq("id", selected.id);

    if (upError) {
      toast({ title: "Erro ao atualizar saldo", description: upError.message, variant: "destructive" });
    } else {
      toast({ title: `${finalAmount > 0 ? "Créditos adicionados" : "Créditos debitados"} com sucesso` });
      setShowCredits(false);
      setCreditForm({ amount: "", type: "purchase", description: "" });
      fetchResellers();
    }
  };

  const handleSaveSettings = async () => {
    if (!companyId) return;
    const { error } = await supabase.from("credit_settings").upsert({
      company_id: companyId,
      ...creditSettings,
    }, { onConflict: "company_id" });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Configurações salvas" });
      setShowSettings(false);
    }
  };

  const openHistory = async (reseller: Reseller) => {
    setSelected(reseller);
    const { data } = await supabase
      .from("reseller_credit_transactions")
      .select("*")
      .eq("reseller_id", reseller.id)
      .order("created_at", { ascending: false });
    if (data) setTransactions(data);
    setShowHistory(true);
  };

  const openEdit = (r: Reseller) => {
    setSelected(r);
    setForm({
      name: r.name, email: r.email || "", whatsapp: r.whatsapp || "",
      notes: r.notes || "", status: r.status,
      can_resell: r.can_resell, can_create_subreseller: r.can_create_subreseller, can_create_trial: r.can_create_trial,
    });
    setShowEdit(true);
  };

  const openCredits = (r: Reseller) => {
    setSelected(r);
    setCreditForm({ amount: "", type: "purchase", description: "" });
    setShowCredits(true);
  };

  const resetForm = () => {
    setForm({ name: "", email: "", whatsapp: "", notes: "", status: "active", can_resell: true, can_create_subreseller: false, can_create_trial: true });
  };

  const filtered = resellers.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.email?.toLowerCase().includes(search.toLowerCase()) ||
      r.whatsapp?.includes(search)
  );

  const totalCredits = resellers.reduce((s, r) => s + r.credit_balance, 0);
  const activeCount = resellers.filter((r) => r.status === "active").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Revendedores</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie seus revendedores e créditos de revenda</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowSettings(true)} className="gap-2">
            <Settings className="w-4 h-4" /> Configurações
          </Button>
          <Button onClick={() => { resetForm(); setShowCreate(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Novo Revendedor
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Revendedores</p>
              <p className="text-xl font-bold text-foreground">{resellers.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ativos</p>
              <p className="text-xl font-bold text-foreground">{activeCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
              <Coins className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Créditos em Circulação</p>
              <p className="text-xl font-bold text-foreground">{totalCredits}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar revendedor..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Créditos</TableHead>
                <TableHead>Permissões</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum revendedor encontrado</TableCell></TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{r.name}</p>
                        {r.email && <p className="text-xs text-muted-foreground">{r.email}</p>}
                        {r.level > 1 && <Badge variant="outline" className="text-[10px] mt-1">Nível {r.level}</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{r.whatsapp || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={r.credit_balance > 0 ? "default" : "destructive"} className="font-mono">
                        {r.credit_balance}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {r.can_resell && <Badge variant="outline" className="text-[10px]">Revenda</Badge>}
                        {r.can_create_subreseller && <Badge variant="outline" className="text-[10px]">Sub-rev</Badge>}
                        {r.can_create_trial && <Badge variant="outline" className="text-[10px]">Teste</Badge>}
                        {!r.can_resell && <Badge variant="secondary" className="text-[10px]">Bloqueado</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.status === "active" ? "default" : "secondary"}>
                        {r.status === "active" ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openCredits(r)} title="Gerenciar créditos">
                          <Coins className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => openHistory(r)} title="Histórico">
                          <History className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => openEdit(r)} title="Editar">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(r.id)} title="Excluir" className="text-destructive hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
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
          <DialogHeader><DialogTitle>Novo Revendedor</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></div>
            <div><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="border rounded-lg p-4 space-y-3">
              <p className="text-sm font-semibold text-foreground">Permissões</p>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Pode revender</Label>
                <Switch checked={form.can_resell} onCheckedChange={(v) => setForm({ ...form, can_resell: v })} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Pode criar sub-revendedores</Label>
                <Switch checked={form.can_create_subreseller} onCheckedChange={(v) => setForm({ ...form, can_create_subreseller: v })} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Pode criar testes</Label>
                <Switch checked={form.can_create_trial} onCheckedChange={(v) => setForm({ ...form, can_create_trial: v })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button onClick={handleCreate}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Revendedor</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></div>
            <div><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="border rounded-lg p-4 space-y-3">
              <p className="text-sm font-semibold text-foreground">Permissões</p>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Pode revender</Label>
                <Switch checked={form.can_resell} onCheckedChange={(v) => setForm({ ...form, can_resell: v })} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Pode criar sub-revendedores</Label>
                <Switch checked={form.can_create_subreseller} onCheckedChange={(v) => setForm({ ...form, can_create_subreseller: v })} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Pode criar testes</Label>
                <Switch checked={form.can_create_trial} onCheckedChange={(v) => setForm({ ...form, can_create_trial: v })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>Cancelar</Button>
            <Button onClick={handleUpdate}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credits Dialog */}
      <Dialog open={showCredits} onOpenChange={setShowCredits}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-primary" />
              Gerenciar Créditos — {selected?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="text-center py-2">
            <p className="text-xs text-muted-foreground">Saldo Atual</p>
            <p className="text-3xl font-bold font-mono text-primary">{selected?.credit_balance ?? 0}</p>
          </div>
          {selected && selected.credit_balance <= 0 && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-center">
              <p className="text-sm text-destructive font-medium">⚠️ Saldo insuficiente para gerar novos acessos</p>
            </div>
          )}
          <div className="space-y-4">
            <div>
              <Label>Tipo</Label>
              <Select value={creditForm.type} onValueChange={(v) => setCreditForm({ ...creditForm, type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="purchase">Adicionar Créditos</SelectItem>
                  <SelectItem value="debit">Debitar Créditos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Quantidade</Label><Input type="number" min="1" value={creditForm.amount} onChange={(e) => setCreditForm({ ...creditForm, amount: e.target.value })} /></div>
            <div><Label>Descrição (opcional)</Label><Input value={creditForm.description} onChange={(e) => setCreditForm({ ...creditForm, description: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCredits(false)}>Cancelar</Button>
            <Button onClick={handleAddCredits}>{creditForm.type === "purchase" ? "Adicionar" : "Debitar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              Histórico — {selected?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-80 overflow-auto">
            {transactions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">Nenhuma transação encontrada</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Qtd</TableHead>
                    <TableHead>Descrição</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(tx.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell>
                        <Badge variant={tx.amount > 0 ? "default" : "destructive"} className="text-xs">
                          {tx.amount > 0 ? "Crédito" : "Débito"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono font-medium">{tx.amount > 0 ? `+${tx.amount}` : tx.amount}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{tx.description || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Credit Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-primary" />
              Configurações de Créditos
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Custo para criar cliente (créditos)</Label>
              <Input type="number" min="1" value={creditSettings.credit_cost_client}
                onChange={(e) => setCreditSettings({ ...creditSettings, credit_cost_client: parseInt(e.target.value) || 1 })} />
            </div>
            <div>
              <Label>Custo para criar teste (créditos)</Label>
              <Input type="number" min="1" value={creditSettings.credit_cost_trial}
                onChange={(e) => setCreditSettings({ ...creditSettings, credit_cost_trial: parseInt(e.target.value) || 1 })} />
            </div>
            <div>
              <Label>Custo para criar sub-revendedor (créditos)</Label>
              <Input type="number" min="1" value={creditSettings.credit_cost_subreseller}
                onChange={(e) => setCreditSettings({ ...creditSettings, credit_cost_subreseller: parseInt(e.target.value) || 5 })} />
            </div>
            <div>
              <Label>Valor padrão do crédito (R$)</Label>
              <Input type="number" min="0.01" step="0.01" value={creditSettings.default_credit_value}
                onChange={(e) => setCreditSettings({ ...creditSettings, default_credit_value: parseFloat(e.target.value) || 1 })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettings(false)}>Cancelar</Button>
            <Button onClick={handleSaveSettings}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
