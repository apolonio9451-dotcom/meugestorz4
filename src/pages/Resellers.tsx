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
  FlaskConical,
  CheckCircle2,
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
  can_resell: boolean;
  can_create_subreseller: boolean;
  can_create_trial: boolean;
  level: number;
}

export type ResellerRole = "admin" | "user";

export function getResellerRole(r: { can_resell: boolean; can_create_subreseller: boolean }): ResellerRole {
  if (r.can_resell || r.can_create_subreseller) return "admin";
  return "user";
}

export const roleLabels: Record<ResellerRole, string> = {
  admin: "Administrador",
  user: "Usuário",
};

interface CreditTransaction {
  id: string;
  reseller_id: string;
  amount: number;
  type: string;
  description: string;
  created_at: string;
}

export default function Resellers() {
  const { companyId, userRole, user } = useAuth();
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
  const [showRoleChange, setShowRoleChange] = useState(false);
  const [showTrialGen, setShowTrialGen] = useState(false);
  const [showTrials, setShowTrials] = useState(false);
  const [showTrialLink, setShowTrialLink] = useState(false);
  const [generatedTrialLink, setGeneratedTrialLink] = useState("");
  const [selected, setSelected] = useState<Reseller | null>(null);
  const [selectedRole, setSelectedRole] = useState<ResellerRole>("user");

  // Trial clients per reseller
  interface TrialClient { id: string; name: string; whatsapp: string; created_at: string; status: string; }
  const [trialClients, setTrialClients] = useState<TrialClient[]>([]);
  const [trialCounts, setTrialCounts] = useState<Record<string, number>>({});

  // Form
  const [form, setForm] = useState({ name: "", email: "", whatsapp: "", notes: "", status: "active" });
  const [creditForm, setCreditForm] = useState({ amount: "", type: "purchase", description: "" });
  const [trialForm, setTrialForm] = useState({ name: "", whatsapp: "" });
  const [trialResellerId, setTrialResellerId] = useState<string>("");

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

  const fetchTrialCounts = async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from("clients")
      .select("reseller_id")
      .eq("company_id", companyId)
      .eq("status", "trial");
    if (data) {
      const counts: Record<string, number> = {};
      data.forEach((c: any) => { if (c.reseller_id) counts[c.reseller_id] = (counts[c.reseller_id] || 0) + 1; });
      setTrialCounts(counts);
    }
  };

  useEffect(() => {
    fetchResellers();
    fetchCompanyCredits();
    fetchTrialCounts();
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

  const openTrialGen = () => {
    setSelected(null);
    setTrialForm({ name: "", whatsapp: "" });
    setShowTrialGen(true);
  };

  

  const handleGenerateTrial = async () => {
    if (!companyId || !trialForm.name.trim() || !user) return;
    const resId = trialResellerId && trialResellerId !== "none" ? trialResellerId : null;

    const { data, error } = await supabase.from("trial_links").insert({
      company_id: companyId,
      reseller_id: resId,
      created_by: user.id,
      client_name: trialForm.name,
      client_whatsapp: trialForm.whatsapp,
    }).select("token").single();

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      const baseUrl = window.location.origin;
      const link = `${baseUrl}/trial/${data.token}`;
      setGeneratedTrialLink(link);
      setShowTrialGen(false);
      setShowTrialLink(true);
      setTrialForm({ name: "", whatsapp: "" });
      setTrialResellerId("");
      fetchTrialCounts();
    }
  };

  const openTrials = async (r: Reseller) => {
    setSelected(r);
    const { data } = await supabase
      .from("clients")
      .select("id, name, whatsapp, created_at, status")
      .eq("reseller_id", r.id)
      .eq("status", "trial")
      .order("created_at", { ascending: false });
    if (data) setTrialClients(data);
    setShowTrials(true);
  };

  const handleActivateTrial = async (clientId: string) => {
    if (!companyId) return;
    const { error } = await supabase.from("clients").update({ status: "active" }).eq("id", clientId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      // Deduct 1 credit from reseller
      if (selected) {
        await supabase.from("resellers").update({ credit_balance: selected.credit_balance - 1 }).eq("id", selected.id);
        await supabase.from("reseller_credit_transactions").insert({
          reseller_id: selected.id,
          company_id: companyId,
          amount: -1,
          type: "activation",
          description: "Ativação de teste",
        });
      }
      toast({ title: "Acesso ativado!", description: "1 crédito foi debitado do revendedor." });
      // Refresh trials list
      setTrialClients((prev) => prev.filter((c) => c.id !== clientId));
      fetchResellers();
      fetchTrialCounts();
    }
  };

  const openRoleChange = (r: Reseller) => {
    setSelected(r);
    setSelectedRole(getResellerRole(r));
    setShowRoleChange(true);
  };

  const handleRoleChange = async () => {
    if (!selected) return;
    const permissions = {
      admin: { can_resell: true, can_create_subreseller: true, can_create_trial: true },
      user: { can_resell: false, can_create_subreseller: false, can_create_trial: true },
    };
    const { error } = await supabase.from("resellers").update(permissions[selectedRole]).eq("id", selected.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Cargo alterado para ${roleLabels[selectedRole]}` });
      setShowRoleChange(false);
      fetchResellers();
    }
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
            variant="outline"
            onClick={() => openTrialGen()}
            className="gap-2"
          >
            <FlaskConical className="w-4 h-4" /> Gerar Teste
          </Button>
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
              onChangeRole={openRoleChange}
              onViewTrials={openTrials}
              trialCount={trialCounts[r.id] || 0}
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

      {/* Role Change Dialog */}
      <Dialog open={showRoleChange} onOpenChange={setShowRoleChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Cargo — {selected?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Cargo</Label>
              <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as ResellerRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="user">Usuário</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-2">
                {selectedRole === "admin" && "Acesso completo: pode revender, criar sub-revendedores e acessar gestão de acessos."}
                {selectedRole === "user" && "Acesso básico: pode apenas gerar testes. Sem acesso à gestão de acessos."}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoleChange(false)}>Cancelar</Button>
            <Button onClick={handleRoleChange}>Salvar Cargo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Trial Dialog */}
      <Dialog open={showTrialGen} onOpenChange={setShowTrialGen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-amber-500" />
              Gerar Teste
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">O teste é gerado sem consumir créditos. Ao confirmar a venda, ative o acesso para debitar 1 crédito.</p>
          <div className="space-y-4">
            <div>
              <Label>Revendedor (opcional)</Label>
              <Select value={trialResellerId} onValueChange={setTrialResellerId}>
                <SelectTrigger><SelectValue placeholder="Sem revendedor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem revendedor</SelectItem>
                  {resellers.filter(r => r.status === "active").map(r => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Nome do cliente *</Label><Input value={trialForm.name} onChange={(e) => setTrialForm({ ...trialForm, name: e.target.value })} /></div>
            <div><Label>WhatsApp</Label><Input value={trialForm.whatsapp} onChange={(e) => setTrialForm({ ...trialForm, whatsapp: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTrialGen(false)}>Cancelar</Button>
            <Button onClick={handleGenerateTrial} className="gap-2">
              <FlaskConical className="w-4 h-4" /> Gerar Teste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generated Trial Link Dialog */}
      <Dialog open={showTrialLink} onOpenChange={setShowTrialLink}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              Link de Teste Gerado
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">O link abaixo é válido por <strong>7 dias</strong>. Compartilhe com o cliente para acesso temporário.</p>
          <div className="flex items-center gap-2">
            <Input readOnly value={generatedTrialLink} className="font-mono text-xs" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                navigator.clipboard.writeText(generatedTrialLink);
                toast({ title: "Link copiado!" });
              }}
            >
              Copiar
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowTrialLink(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Trials List Dialog */}
      <Dialog open={showTrials} onOpenChange={setShowTrials}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-amber-500" />
              Testes Pendentes — {selected?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-80 overflow-auto">
            {trialClients.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">Nenhum teste pendente</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trialClients.map((tc) => (
                    <TableRow key={tc.id}>
                      <TableCell className="font-medium text-sm">{tc.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{tc.whatsapp || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(tc.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" className="gap-1.5 h-7 text-xs" onClick={() => handleActivateTrial(tc.id)}>
                          <CheckCircle2 className="w-3.5 h-3.5" /> Ativar
                        </Button>
                      </TableCell>
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
