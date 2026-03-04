import { useState, useEffect, useMemo } from "react";
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
  Clock,
  UserCheck,
  Trash2,
  Copy,
  Pencil,
  Eye,
  PercentCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { differenceInHours, parseISO, format } from "date-fns";

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
  trial_expires_at?: string | null;
  user_id?: string | null;
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

interface PendingLink {
  id: string;
  token: string;
  expires_at: string;
  created_at: string;
  status: string;
}

const ITEMS_PER_PAGE = 10;

export default function Resellers() {
  const { companyId, userRole, user } = useAuth();
  const { toast } = useToast();
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [companyCredits, setCompanyCredits] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);

  // Dialogs
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showRoleChange, setShowRoleChange] = useState(false);
  const [showTrialLink, setShowTrialLink] = useState(false);
  const [generatedTrialLink, setGeneratedTrialLink] = useState("");
  const [selected, setSelected] = useState<Reseller | null>(null);
  const [selectedRole, setSelectedRole] = useState<ResellerRole>("user");

  // Trial links
  const [pendingLinks, setPendingLinks] = useState<PendingLink[]>([]);
  const [trialCounts, setTrialCounts] = useState<Record<string, number>>({});

  // Form
  const [form, setForm] = useState({ name: "", email: "", whatsapp: "", notes: "", status: "active" });
  const [creditForm, setCreditForm] = useState({ amount: "", type: "purchase", description: "" });
  const [trialGenerating, setTrialGenerating] = useState(false);

  const fetchCompanyCredits = async () => {
    if (!companyId) return;
    const { data } = await supabase.from("companies").select("credit_balance").eq("id", companyId).single();
    if (data) setCompanyCredits(data.credit_balance);
  };

  const fetchResellers = async () => {
    if (!companyId) return;
    const { data } = await supabase.from("resellers").select("*").eq("company_id", companyId).order("created_at", { ascending: false });
    if (!data) { setLoading(false); return; }

    const trialResellers = data.filter(r => r.status === "trial" && r.user_id);
    if (trialResellers.length > 0) {
      const userIds = trialResellers.map(r => r.user_id!);
      const { data: memberships } = await supabase
        .from("company_memberships")
        .select("user_id, trial_expires_at")
        .eq("company_id", companyId)
        .eq("is_trial", true)
        .in("user_id", userIds);
      const expiryMap = new Map((memberships || []).map(m => [m.user_id, m.trial_expires_at]));
      data.forEach(r => {
        if (r.status === "trial" && r.user_id) {
          (r as any).trial_expires_at = expiryMap.get(r.user_id) || null;
        }
      });
    }
    setResellers(data);
    setLoading(false);
  };

  const fetchTrialCounts = async () => {
    if (!companyId) return;
    const { data } = await supabase.from("clients").select("reseller_id").eq("company_id", companyId).eq("status", "trial");
    if (data) {
      const counts: Record<string, number> = {};
      data.forEach((c: any) => { if (c.reseller_id) counts[c.reseller_id] = (counts[c.reseller_id] || 0) + 1; });
      setTrialCounts(counts);
    }
  };

  const fetchPendingLinks = async () => {
    if (!companyId) return;
    const { data } = await supabase.from("trial_links").select("id, token, expires_at, created_at, status").eq("company_id", companyId).eq("status", "pending").order("created_at", { ascending: false });
    if (data) setPendingLinks(data);
  };

  useEffect(() => {
    fetchResellers();
    fetchCompanyCredits();
    fetchTrialCounts();
    fetchPendingLinks();
  }, [companyId]);

  const isOwnerRole = userRole === "Proprietário";
  const isAdmin = userRole === "Proprietário" || userRole === "Administrador";
  const isOwner = userRole === "Proprietário";
  const hasCredits = isOwner || companyCredits > 0;

  // Handlers
  const handleCreate = async () => {
    if (!companyId || !form.name.trim()) return;
    if (!isOwnerRole && companyCredits <= 0) {
      toast({ title: "Sem créditos", description: "Adicione créditos ao painel para criar novos revendedores.", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("resellers").insert({ company_id: companyId, name: form.name, email: form.email, whatsapp: form.whatsapp, notes: form.notes });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      if (!isOwnerRole) await supabase.from("companies").update({ credit_balance: companyCredits - 1 }).eq("id", companyId);
      toast({ title: "Revendedor criado com sucesso" });
      setShowCreate(false);
      setForm({ name: "", email: "", whatsapp: "", notes: "", status: "active" });
      fetchResellers();
      fetchCompanyCredits();
    }
  };

  const handleUpdate = async () => {
    if (!selected) return;
    const { error } = await supabase.from("resellers").update({ name: form.name, email: form.email, whatsapp: form.whatsapp, notes: form.notes, status: form.status }).eq("id", selected.id);
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
    const { error } = await supabase.from("resellers").update({ status: newStatus }).eq("id", r.id);
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
      reseller_id: selected.id, company_id: companyId, amount: finalAmount, type: creditForm.type,
      description: creditForm.description || (creditForm.type === "purchase" ? "Compra de créditos" : "Débito de créditos"),
    });
    if (txError) { toast({ title: "Erro", description: txError.message, variant: "destructive" }); return; }
    const { error: upError } = await supabase.from("resellers").update({ credit_balance: selected.credit_balance + finalAmount }).eq("id", selected.id);
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
    const { data } = await supabase.from("reseller_credit_transactions").select("*").eq("reseller_id", reseller.id).order("created_at", { ascending: false });
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

  const handleGenerateTrialInstant = async () => {
    if (!companyId || !user) return;
    setTrialGenerating(true);
    const { data, error } = await supabase.from("trial_links").insert({ company_id: companyId, created_by: user.id, client_name: "Pendente" }).select("token").single();
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      const link = `${window.location.origin}/trial/${data.token}`;
      setGeneratedTrialLink(link);
      setShowTrialLink(true);
      fetchPendingLinks();
    }
    setTrialGenerating(false);
  };

  const handleActivateTrialReseller = async (r: Reseller) => {
    if (!companyId) return;
    if (!isOwnerRole && companyCredits <= 0) {
      toast({ title: "Sem créditos", description: "Saldo insuficiente para ativar este revendedor.", variant: "destructive" });
      return;
    }
    const { error: resErr } = await supabase.from("resellers").update({ status: "active", can_resell: true, can_create_trial: true }).eq("id", r.id);
    if (resErr) { toast({ title: "Erro", description: resErr.message, variant: "destructive" }); return; }
    if (!isOwnerRole) {
      await supabase.from("companies").update({ credit_balance: companyCredits - 1 }).eq("id", companyId);
      setCompanyCredits(companyCredits - 1);
    }
    if (r.user_id) {
      await supabase.from("company_memberships").update({ is_trial: false, trial_expires_at: null }).eq("user_id", r.user_id).eq("company_id", companyId);
    }
    toast({ title: `${r.name} ativado com acesso completo!`, description: isOwnerRole ? "" : "1 crédito debitado." });
    fetchResellers();
    fetchCompanyCredits();
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

  const getTimeLeft = (expiresAt: string | null) => {
    if (!expiresAt) return { label: "Sem prazo", expired: false };
    const hours = differenceInHours(parseISO(expiresAt), new Date());
    if (hours <= 0) return { label: "Expirado", expired: true };
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    if (days > 0) return { label: `${days}d ${remainingHours}h`, expired: false };
    return { label: `${hours}h`, expired: false };
  };

  // Filtered & paginated data
  const filtered = useMemo(() => {
    return resellers.filter((r) => {
      const matchesSearch = r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.email?.toLowerCase().includes(search.toLowerCase()) ||
        r.whatsapp?.includes(search);
      const matchesStatus = statusFilter === "all" || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [resellers, search, statusFilter]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => { setCurrentPage(1); }, [search, statusFilter]);

  // KPI calculations
  const totalCredits = resellers.reduce((s, r) => s + r.credit_balance, 0);
  const activeCount = resellers.filter((r) => r.status === "active").length;
  const blockedCount = resellers.filter((r) => r.status === "blocked").length;
  const trialResellersCount = resellers.filter((r) => r.status === "trial").length;
  const activeClients = Object.values(trialCounts).reduce((a, b) => a + b, 0);
  const conversionRate = resellers.length > 0 ? Math.round((activeCount / resellers.length) * 100) : 0;

  // Status badge helper
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[11px]">Ativo</Badge>;
      case "blocked":
        return <Badge variant="destructive" className="text-[11px]">Bloqueado</Badge>;
      case "trial":
        return <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[11px]">Teste</Badge>;
      default:
        return <Badge variant="outline" className="text-[11px]">{status}</Badge>;
    }
  };

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
    <div className="p-6 space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Revendedores</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie sua rede de revendedores, créditos e testes</p>
      </div>

      {/* 1. KPI Cards - 6 columns */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Total Revendedores", value: resellers.length, icon: Users, color: "text-primary" },
          { label: "Ativos", value: activeCount, icon: TrendingUp, color: "text-emerald-400" },
          { label: "Bloqueados", value: blockedCount, icon: Ban, color: "text-destructive" },
          { label: "Créditos Disponíveis", value: isOwner ? "∞" : companyCredits, icon: Coins, color: "text-primary" },
          { label: "Testes Ativos", value: trialResellersCount, icon: FlaskConical, color: "text-amber-400" },
          { label: "Conversão %", value: `${conversionRate}%`, icon: PercentCircle, color: "text-emerald-400" },
        ].map((kpi, i) => (
          <div key={i} className="h-[110px] rounded-lg border border-border bg-card flex flex-col justify-center items-center p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{kpi.label}</span>
            </div>
            <span className="text-[28px] font-bold text-foreground leading-none">{kpi.value}</span>
          </div>
        ))}
      </div>

      {/* 2. Action Bar */}
      <div className="flex items-center justify-end h-14 gap-3">
        <Button onClick={() => { setForm({ name: "", email: "", whatsapp: "", notes: "", status: "active" }); setShowCreate(true); }} className="gap-2" disabled={!hasCredits}>
          <Plus className="w-4 h-4" /> Novo Revendedor
        </Button>
        <Button variant="secondary" onClick={handleGenerateTrialInstant} disabled={trialGenerating} className="gap-2">
          <FlaskConical className="w-4 h-4" /> {trialGenerating ? "Gerando..." : "Gerar Teste"}
        </Button>
        <Button variant="outline" onClick={() => openCredits(resellers[0])} disabled={resellers.length === 0} className="gap-2">
          <Coins className="w-4 h-4" /> Comprar Créditos
        </Button>
      </div>

      {/* 3. Reseller Table */}
      <div className="rounded-lg border border-border bg-card">
        {/* Table header with search and filter */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar revendedor..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40 h-9">
              <SelectValue placeholder="Filtrar status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="blocked">Bloqueados</SelectItem>
              <SelectItem value="trial">Em Teste</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground py-12 text-sm">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-12 text-sm">Nenhum revendedor encontrado</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Créditos</TableHead>
                  <TableHead className="text-center">Testes</TableHead>
                  <TableHead className="text-center">Clientes Ativos</TableHead>
                  <TableHead>Data Cadastro</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((r) => (
                  <TableRow key={r.id} className="group">
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm text-foreground">{r.name}</p>
                        {r.email && <p className="text-[11px] text-muted-foreground">{r.email}</p>}
                      </div>
                    </TableCell>
                    <TableCell>{getStatusBadge(r.status)}</TableCell>
                    <TableCell className="text-center">
                      <span className={`font-mono text-sm font-bold ${r.credit_balance > 0 ? "text-primary" : "text-destructive"}`}>
                        {r.credit_balance}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-mono text-sm">{trialCounts[r.id] || 0}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="font-mono text-sm">—</span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(parseISO(r.created_at), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                        {r.status === "trial" ? (
                          <Button size="sm" className="gap-1 h-7 text-xs" onClick={() => handleActivateTrialReseller(r)}>
                            <UserCheck className="w-3.5 h-3.5" /> Ativar
                          </Button>
                        ) : (
                          <>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openCredits(r)} title="Créditos">
                              <Coins className="w-3.5 h-3.5 text-primary" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(r)} title="Editar">
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className={`h-7 w-7 ${r.status === "active" ? "hover:text-destructive" : "hover:text-primary"}`}
                              onClick={() => handleToggleStatus(r)}
                              title={r.status === "active" ? "Bloquear" : "Desbloquear"}
                            >
                              {r.status === "active" ? <Ban className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            </Button>
                          </>
                        )}
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openHistory(r)} title="Histórico">
                          <History className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-destructive" onClick={() => handleDelete(r.id)} title="Excluir">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                <span className="text-xs text-muted-foreground">
                  Mostrando {((currentPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} de {filtered.length}
                </span>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <Button
                      key={page}
                      size="icon"
                      variant={page === currentPage ? "default" : "ghost"}
                      className="h-8 w-8 text-xs"
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Button>
                  ))}
                  <Button size="icon" variant="ghost" className="h-8 w-8" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 4. Trial Links Table */}
      {pendingLinks.length > 0 && (
        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-amber-400" />
              Links de Teste Pendentes
              <Badge variant="outline" className="text-[10px] ml-1">{pendingLinks.length}</Badge>
            </h2>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Link</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead>Expira em</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingLinks.map((link) => {
                const time = getTimeLeft(link.expires_at);
                const fullUrl = `${window.location.origin}/trial/${link.token}`;
                return (
                  <TableRow key={link.id}>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded font-mono">/trial/{link.token.substring(0, 16)}...</code>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{format(parseISO(link.created_at), "dd/MM/yyyy HH:mm")}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{format(parseISO(link.expires_at), "dd/MM/yyyy HH:mm")}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={time.expired ? "bg-destructive/10 text-destructive text-[11px]" : "bg-amber-500/10 text-amber-400 text-[11px]"}>
                        <Clock className="w-3 h-3 mr-1" />
                        {time.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 h-7 text-xs"
                        onClick={() => { navigator.clipboard.writeText(fullUrl); toast({ title: "Link copiado!" }); }}
                      >
                        <Copy className="w-3 h-3" /> Copiar
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ===== DIALOGS ===== */}

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
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(tx.created_at).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>
                        <Badge variant={tx.amount > 0 ? "default" : "destructive"} className="text-xs">{tx.amount > 0 ? "Crédito" : "Débito"}</Badge>
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
          <DialogHeader><DialogTitle>Alterar Cargo — {selected?.name}</DialogTitle></DialogHeader>
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
            <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(generatedTrialLink); toast({ title: "Link copiado!" }); }}>
              Copiar
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowTrialLink(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
