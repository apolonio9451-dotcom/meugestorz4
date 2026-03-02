import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  History,
  Users,
  TrendingUp,
  ShieldCheck,
  Ban,
} from "lucide-react";
import ResellerCard from "@/components/resellers/ResellerCard";

interface Reseller {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  credit_balance: number;
  status: string;
  notes: string;
  created_at: string;
}

interface CreditTransaction {
  id: string;
  reseller_id: string;
  amount: number;
  type: string;
  description: string;
  created_at: string;
}

export default function Resellers() {
  const { companyId, userRole } = useAuth();
  const { toast } = useToast();
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [companyCredits, setCompanyCredits] = useState<number>(0);

  // Dialogs
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selected, setSelected] = useState<Reseller | null>(null);

  // Form
  const [form, setForm] = useState({ name: "", email: "", whatsapp: "", notes: "", status: "active" });
  const [creditForm, setCreditForm] = useState({ amount: "", type: "purchase", description: "" });

  const fetchCompanyCredits = async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from("companies")
      .select("credit_balance")
      .eq("id", companyId)
      .single();
    if (data) setCompanyCredits(data.credit_balance);
  };

  const fetchResellers = async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from("resellers")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (data) setResellers(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchResellers();
    fetchCompanyCredits();
  }, [companyId]);

  const isOwnerRole = userRole === "Proprietário";

  const handleCreate = async () => {
    if (!companyId || !form.name.trim()) return;
    if (!isOwnerRole && companyCredits <= 0) {
      toast({ title: "Sem créditos", description: "Adicione créditos ao painel para criar novos revendedores.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("resellers").insert({
      company_id: companyId,
      name: form.name,
      email: form.email,
      whatsapp: form.whatsapp,
      notes: form.notes,
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      if (!isOwnerRole) {
        await supabase.from("companies").update({ credit_balance: companyCredits - 1 }).eq("id", companyId);
      }
      toast({ title: "Revendedor criado com sucesso" });
      setShowCreate(false);
      setForm({ name: "", email: "", whatsapp: "", notes: "", status: "active" });
      fetchResellers();
      fetchCompanyCredits();
    }
  };

  const handleUpdate = async () => {
    if (!selected) return;
    const { error } = await supabase
      .from("resellers")
      .update({ name: form.name, email: form.email, whatsapp: form.whatsapp, notes: form.notes, status: form.status })
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

  const handleToggleStatus = async (r: Reseller) => {
    const newStatus = r.status === "active" ? "blocked" : "active";
    const { error } = await supabase
      .from("resellers")
      .update({ status: newStatus })
      .eq("id", r.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: newStatus === "active" ? "Revendedor desbloqueado" : "Revendedor bloqueado" });
      fetchResellers();
    }
  };

  const handleAddCredits = async () => {
    if (!selected || !companyId || !creditForm.amount) return;
    const amount = parseInt(creditForm.amount);
    if (isNaN(amount) || amount === 0) return;
    const finalAmount = creditForm.type === "debit" ? -Math.abs(amount) : Math.abs(amount);

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
    setForm({ name: r.name, email: r.email || "", whatsapp: r.whatsapp || "", notes: r.notes || "", status: r.status });
    setShowEdit(true);
  };

  const openCredits = (r: Reseller) => {
    setSelected(r);
    setCreditForm({ amount: "", type: "purchase", description: "" });
    setShowCredits(true);
  };

  const handleViewClients = (r: Reseller) => {
    toast({ title: "Em breve", description: `Visualização de clientes do revendedor ${r.name} será implementada.` });
  };

  const filtered = resellers.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.email?.toLowerCase().includes(search.toLowerCase()) ||
      r.whatsapp?.includes(search)
  );

  const totalCredits = resellers.reduce((s, r) => s + r.credit_balance, 0);
  const activeCount = resellers.filter((r) => r.status === "active").length;
  const blockedCount = resellers.filter((r) => r.status === "blocked").length;

  const isAdmin = userRole === "Proprietário" || userRole === "Administrador";
  const isOwner = userRole === "Proprietário";
  const hasCredits = isOwner || companyCredits > 0;

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-2">
          <ShieldCheck className="w-12 h-12 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-bold text-foreground">Acesso Restrito</h2>
          <p className="text-muted-foreground text-sm">Apenas administradores e proprietários podem acessar esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Revendedores</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie seus revendedores e créditos de revenda</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm font-mono">
            <Coins className="w-4 h-4 text-primary" />
            {isOwner ? "∞" : companyCredits} crédito{!isOwner && companyCredits !== 1 ? "s" : "s"}
          </Badge>
          <Button
            onClick={() => { setForm({ name: "", email: "", whatsapp: "", notes: "", status: "active" }); setShowCreate(true); }}
            className="gap-2"
            disabled={!hasCredits}
          >
            <Plus className="w-4 h-4" /> Novo Revendedor
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
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
            <div className="w-10 h-10 rounded-lg bg-destructive/15 flex items-center justify-center">
              <Ban className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Bloqueados</p>
              <p className="text-xl font-bold text-foreground">{blockedCount}</p>
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

      {/* Cards Grid */}
      {loading ? (
        <p className="text-center text-muted-foreground py-8">Carregando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">Nenhum revendedor encontrado</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((r) => (
            <ResellerCard
              key={r.id}
              reseller={r}
              onEdit={openEdit}
              onDelete={handleDelete}
              onCredits={openCredits}
              onHistory={openHistory}
              onToggleStatus={handleToggleStatus}
              onViewClients={handleViewClients}
            />
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Revendedor</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></div>
            <div><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
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
                  <SelectItem value="blocked">Bloqueado</SelectItem>
                </SelectContent>
              </Select>
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
    </div>
  );
}
