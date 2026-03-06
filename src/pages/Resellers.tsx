import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  CirclePlus,
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
  Key,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CalendarClock,
  CreditCard,
  MoreVertical,
  Phone,
  Mail,
} from "lucide-react";
import { differenceInDays, differenceInHours, parseISO, format, addDays } from "date-fns";

// === TYPES ===

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
  subscription_expires_at?: string | null;
  user_id?: string | null;
}

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

// === STATUS HELPERS ===

type ResellerStatus = "trial" | "expired" | "active" | "overdue";

const STATUS_CONFIG: Record<ResellerStatus, { label: string; color: string; dot: string }> = {
  trial: { label: "Em Teste", color: "bg-amber-500/15 text-amber-400 border-amber-500/30", dot: "bg-amber-400" },
  expired: { label: "Expirado", color: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30", dot: "bg-zinc-500" },
  active: { label: "Ativo", color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", dot: "bg-emerald-400" },
  overdue: { label: "Vencido", color: "bg-orange-500/15 text-orange-400 border-orange-500/30", dot: "bg-orange-400" },
};

function getStatusBadge(status: string) {
  const config = STATUS_CONFIG[status as ResellerStatus] || STATUS_CONFIG.expired;
  return (
    <Badge variant="outline" className={`${config.color} text-[11px] gap-1.5`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </Badge>
  );
}

function getDaysRemaining(r: Reseller): { days: number; label: string; expiryDate: string | null } {
  if (r.status === "trial") {
    if (!r.trial_expires_at) return { days: 0, label: "0 dias", expiryDate: null };
    const days = Math.max(0, differenceInDays(parseISO(r.trial_expires_at), new Date()));
    return { days, label: `${days} dia${days !== 1 ? "s" : ""}`, expiryDate: format(parseISO(r.trial_expires_at), "dd/MM/yyyy") };
  }
  if (r.status === "active") {
    if (!r.subscription_expires_at) return { days: 0, label: "—", expiryDate: null };
    const days = Math.max(0, differenceInDays(parseISO(r.subscription_expires_at), new Date()));
    return { days, label: `${days} dia${days !== 1 ? "s" : ""}`, expiryDate: format(parseISO(r.subscription_expires_at), "dd/MM/yyyy") };
  }
  return { days: 0, label: "0 dias", expiryDate: null };
}

const ITEMS_PER_PAGE = 10;

// === COMPONENT ===

export default function Resellers() {
  const { companyId, userRole, user, isTrial, resellerCredits } = useAuth();
  const { toast } = useToast();
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyCredits, setCompanyCredits] = useState<number>(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Dialogs
  const [showCredits, setShowCredits] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showTrialLink, setShowTrialLink] = useState(false);
  const [showActivate, setShowActivate] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [generatedTrialLink, setGeneratedTrialLink] = useState("");
  const [selected, setSelected] = useState<Reseller | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Trial links
  const [pendingLinks, setPendingLinks] = useState<PendingLink[]>([]);

  // Forms
  const [creditForm, setCreditForm] = useState({ amount: "", type: "purchase", description: "" });
  const [activateDays, setActivateDays] = useState("30");
  const [trialGenerating, setTrialGenerating] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", email: "", whatsapp: "" });

  const isOwner = userRole === "Proprietário";
  const isAdmin = userRole === "Proprietário" || userRole === "Administrador" || userRole === "Admin";

  // === DATA FETCHING ===

  const fetchResellers = async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from("resellers")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (!data) { setLoading(false); return; }

    // Use subscription_expires_at directly as trial expiry source
    data.forEach(r => {
      if (r.status === "trial") {
        (r as any).trial_expires_at = r.subscription_expires_at || null;
      }
    });

    const now = new Date();
    for (const r of data) {
      if (r.status === "trial" && (r as any).trial_expires_at) {
        const expires = parseISO((r as any).trial_expires_at);
        if (now > expires) {
          await supabase.from("resellers").update({ status: "expired" }).eq("id", r.id);
          r.status = "expired";
        }
      }
      if (r.status === "active" && r.subscription_expires_at) {
        const subExpires = parseISO(r.subscription_expires_at);
        if (now > subExpires) {
          await supabase.from("resellers").update({ status: "overdue" }).eq("id", r.id);
          r.status = "overdue";
        }
      }
    }

    setResellers(data as Reseller[]);
    setLoading(false);
  };

  const fetchPendingLinks = async () => {
    if (!companyId || !user) return;
    const { data } = await supabase
      .from("trial_links")
      .select("id, token, expires_at, created_at, status")
      .eq("company_id", companyId)
      .eq("created_by", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (data) setPendingLinks(data);
  };

  const fetchCompanyCredits = async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from("companies")
      .select("credit_balance")
      .eq("id", companyId)
      .single();
    if (data) setCompanyCredits(data.credit_balance);
  };

  useEffect(() => {
    fetchResellers();
    fetchPendingLinks();
    fetchCompanyCredits();
  }, [companyId]);

  // === HANDLERS ===

  const handleGenerateTrial = async () => {
    if (!companyId || !user) return;

    if (isTrial) {
      toast({ title: "Bloqueado", description: "Contas em teste não podem gerar acessos de revendedores.", variant: "destructive" });
      return;
    }

    const effectiveCredits = resellerCredits !== null ? resellerCredits : companyCredits;
    if (effectiveCredits <= 0 && !isOwner) {
      toast({ title: "Sem créditos", description: "É necessário ter pelo menos 1 crédito para gerar acesso de revendedor.", variant: "destructive" });
      return;
    }

    setTrialGenerating(true);
    const { data, error } = await supabase
      .from("trial_links")
      .insert({ company_id: companyId, created_by: user.id, client_name: "Pendente" })
      .select("token")
      .single();
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

  const handleActivateSubscription = async () => {
    if (!selected || !companyId) return;
    const days = parseInt(activateDays);
    if (isNaN(days) || days <= 0) return;

    // If still in trial, add remaining trial days to the activation period
    let totalDays = days;
    if (selected.status === "trial" && (selected as any).trial_expires_at) {
      const trialEnd = parseISO((selected as any).trial_expires_at);
      const now = new Date();
      if (trialEnd > now) {
        const remainingDays = differenceInDays(trialEnd, now);
        totalDays += remainingDays;
      }
    }

    const expiresAt = addDays(new Date(), totalDays).toISOString();
    const { error } = await supabase
      .from("resellers")
      .update({
        status: "active",
        subscription_expires_at: expiresAt,
        can_resell: true,
        can_create_trial: true,
      })
      .eq("id", selected.id);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }

    if (selected.user_id) {
      await supabase
        .from("company_memberships")
        .update({ is_trial: false, trial_expires_at: null })
        .eq("user_id", selected.user_id);
    }

    const extraMsg = totalDays > days ? ` (${days} + ${totalDays - days} dias restantes do teste)` : "";
    toast({ title: `Assinatura ativada para ${selected.name}`, description: `${totalDays} dias de acesso${extraMsg}.` });
    setShowActivate(false);
    setActivateDays("30");
    fetchResellers();
  };

  const handleRenewSubscription = async (r: Reseller) => {
    setSelected(r);
    setActivateDays("30");
    setShowActivate(true);
  };

  const handleAddCredits = async () => {
    if (!selected || !companyId || !creditForm.amount) return;

    if (selected.status !== "active") {
      toast({
        title: "Ação bloqueada",
        description: "Só é possível adicionar créditos para revendedores com Assinatura Ativa.",
        variant: "destructive",
      });
      return;
    }

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
    if (txError) { toast({ title: "Erro", description: txError.message, variant: "destructive" }); return; }

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

  const handleGenerateAccess = async (r: Reseller) => {
    if (r.status !== "active") {
      toast({ title: "Bloqueado", description: "Assinatura deve estar ativa para gerar acesso.", variant: "destructive" });
      return;
    }
    if (r.credit_balance <= 0 && !isOwner) {
      toast({ title: "Sem créditos", description: "Saldo insuficiente. Compre créditos para gerar acesso.", variant: "destructive" });
      return;
    }

    if (!isOwner) {
      await supabase.from("resellers").update({ credit_balance: r.credit_balance - 1 }).eq("id", r.id);
      await supabase.from("reseller_credit_transactions").insert({
        reseller_id: r.id,
        company_id: companyId!,
        amount: -1,
        type: "activation",
        description: "Geração de acesso",
      });
    }

    toast({ title: "Acesso gerado com sucesso!", description: isOwner ? "" : "1 crédito debitado." });
    fetchResellers();
  };

  const openCredits = (r: Reseller) => {
    if (r.status !== "active") {
      toast({ title: "Ação bloqueada", description: "Só é possível gerenciar créditos para revendedores com Assinatura Ativa.", variant: "destructive" });
      return;
    }
    setSelected(r);
    setCreditForm({ amount: "", type: "purchase", description: "" });
    setShowCredits(true);
  };

  const openHistory = async (r: Reseller) => {
    setSelected(r);
    const { data } = await supabase
      .from("reseller_credit_transactions")
      .select("*")
      .eq("reseller_id", r.id)
      .order("created_at", { ascending: false });
    if (data) setTransactions(data);
    setShowHistory(true);
  };

  const openDelete = (r: Reseller) => {
    setSelected(r);
    setDeleteConfirmText("");
    setShowDelete(true);
  };

  const handleDelete = async () => {
    if (!selected || deleteConfirmText !== "EXCLUIR") return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-reseller`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ reseller_id: selected.id }),
        }
      );
      const result = await res.json();
      if (!res.ok) {
        toast({ title: "Erro", description: result.error || "Falha ao excluir", variant: "destructive" });
      } else {
        toast({ title: "Revendedor excluído completamente" });
        setShowDelete(false);
        fetchResellers();
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const openEdit = (r: Reseller) => {
    setSelected(r);
    setEditForm({ name: r.name, email: r.email || "", whatsapp: r.whatsapp || "" });
    setShowEdit(true);
  };

  const handleEdit = async () => {
    if (!selected) return;
    const { error } = await supabase.from("resellers").update({
      name: editForm.name,
      email: editForm.email,
      whatsapp: editForm.whatsapp,
    }).eq("id", selected.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Dados atualizados" });
      setShowEdit(false);
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

  // === FILTERING & PAGINATION ===

  const manageableResellers = useMemo(() => {
    if (!user?.id) return resellers;
    const currentEmail = user.email?.toLowerCase();
    // Never show yourself in the resellers list
    return resellers.filter((r) => {
      if (r.user_id === user.id) return false;
      if (currentEmail && r.email?.toLowerCase() === currentEmail) return false;
      return true;
    });
  }, [resellers, user?.id, user?.email]);

  const filtered = useMemo(() => {
    return manageableResellers.filter((r) => {
      const matchesSearch =
        r.name.toLowerCase().includes(search.toLowerCase()) ||
        r.email?.toLowerCase().includes(search.toLowerCase()) ||
        r.whatsapp?.includes(search);
      const matchesStatus = statusFilter === "all" || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [manageableResellers, search, statusFilter]);

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => { setCurrentPage(1); }, [search, statusFilter]);

  // === KPIs ===
  const activeCount = manageableResellers.filter(r => r.status === "active").length;
  const trialCount = manageableResellers.filter(r => r.status === "trial").length;
  const overdueCount = manageableResellers.filter(r => r.status === "overdue").length;

  // === RENDER ===

  if (!isAdmin || isTrial) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-2">
          <ShieldCheck className="w-12 h-12 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-bold text-foreground">Acesso Restrito</h2>
          <p className="text-muted-foreground text-sm">
            {isTrial
              ? "Contas em teste não têm acesso à gestão de revendedores."
              : "Apenas administradores e proprietários podem acessar esta página."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Revendedores</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Centro de gerenciamento de revenda, créditos e acessos
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">
            <Coins className="w-4 h-4" />
            {isOwner ? (
              <>
                <span className="font-mono">∞</span>
                <span className="text-xs font-normal text-primary/70">ilimitado</span>
              </>
            ) : resellerCredits !== null ? (
              <>
                <span className="font-mono">{resellerCredits}</span>
                <span className="text-xs font-normal text-primary/70">créditos</span>
              </>
            ) : (
              <>
                <span className="font-mono">{companyCredits}</span>
                <span className="text-xs font-normal text-primary/70">créditos</span>
              </>
            )}
          </div>
          <Button variant="secondary" onClick={handleGenerateTrial} disabled={trialGenerating} className="gap-2 flex-1 sm:flex-none">
            <FlaskConical className="w-4 h-4" /> {trialGenerating ? "Gerando..." : "Gerar Teste"}
          </Button>
        </div>
      </div>

      {/* KPI Cards - compact on mobile */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {[
          { label: "Total", value: manageableResellers.length, icon: Users, color: "text-primary" },
          { label: "Ativos", value: activeCount, icon: CheckCircle2, color: "text-emerald-400" },
          { label: "Teste", value: trialCount, icon: FlaskConical, color: "text-amber-400" },
          { label: "Vencidos", value: overdueCount, icon: AlertTriangle, color: "text-orange-400" },
        ].map((kpi, i) => (
          <div key={i} className="rounded-lg border border-border bg-card flex flex-col justify-center items-center p-2 sm:p-4">
            <div className="flex items-center gap-1 mb-1 sm:mb-2">
              <kpi.icon className={`w-3 h-3 sm:w-4 sm:h-4 ${kpi.color}`} />
              <span className="text-[9px] sm:text-[11px] text-muted-foreground font-medium uppercase tracking-wider hidden sm:inline">{kpi.label}</span>
            </div>
            <span className="text-lg sm:text-[28px] font-bold text-foreground leading-none">{kpi.value}</span>
            <span className="text-[9px] text-muted-foreground font-medium mt-0.5 sm:hidden">{kpi.label}</span>
          </div>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between p-3 sm:p-4 border-b border-border gap-2 sm:gap-3">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-44 h-9">
              <SelectValue placeholder="Filtrar status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="trial">Em Teste</SelectItem>
              <SelectItem value="active">Assinatura Ativa</SelectItem>
              <SelectItem value="expired">Expirado</SelectItem>
              <SelectItem value="overdue">Vencido</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <p className="text-center text-muted-foreground py-12 text-sm">Carregando...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-12 text-sm">Nenhum revendedor encontrado</p>
        ) : (
          <>
            {/* Desktop Table - hidden on mobile */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-center">Dias Restantes</TableHead>
                    <TableHead className="text-center">Créditos</TableHead>
                    <TableHead>Data Cadastro</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((r) => {
                    const remaining = getDaysRemaining(r);
                    const canGenerateAccess = r.status === "active" && (r.credit_balance > 0 || isOwner);

                    return (
                      <TableRow key={r.id} className="group">
                        <TableCell>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm text-foreground">{r.name}</p>
                              <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${
                                r.credit_balance > 0
                                  ? "bg-primary/10 text-primary border-primary/30"
                                  : "bg-muted text-muted-foreground border-border"
                              }`}>
                                {r.credit_balance > 0 ? "Admin" : "Usuário"}
                              </Badge>
                            </div>
                            {r.email && <p className="text-[11px] text-muted-foreground">{r.email}</p>}
                            {r.whatsapp && <p className="text-[11px] text-muted-foreground">{r.whatsapp}</p>}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(r.status)}</TableCell>
                        <TableCell className="text-center">
                          <div>
                            <span className={`font-mono text-sm font-semibold ${
                              remaining.days <= 3 && remaining.days > 0 ? "text-orange-400" :
                              remaining.days === 0 ? "text-destructive" :
                              "text-foreground"
                            }`}>
                              {remaining.label}
                            </span>
                            {remaining.expiryDate && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">{remaining.expiryDate}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`font-mono text-sm font-bold ${r.credit_balance > 0 ? "text-primary" : "text-muted-foreground"}`}>
                            {r.credit_balance}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(parseISO(r.created_at), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                            {(r.status === "trial" || r.status === "expired") && (
                              <Button size="sm" className="gap-1 h-7 text-xs" onClick={() => handleRenewSubscription(r)}>
                                <CreditCard className="w-3.5 h-3.5" /> Ativar
                              </Button>
                            )}
                            {r.status === "overdue" && (
                              <Button size="sm" variant="outline" className="gap-1 h-7 text-xs border-orange-500/30 text-orange-400 hover:bg-orange-500/10" onClick={() => handleRenewSubscription(r)}>
                                <CalendarClock className="w-3.5 h-3.5" /> Renovar
                              </Button>
                            )}
                            {r.status === "active" && (
                              <Button size="sm" variant="ghost" className="gap-1 h-7 text-xs" onClick={() => openCredits(r)} title="Adicionar créditos">
                                <CirclePlus className="w-3.5 h-3.5 text-primary" />
                                <span className="hidden lg:inline">Créditos</span>
                              </Button>
                            )}
                            {r.status === "active" && (
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleRenewSubscription(r)} title="Renovar assinatura">
                                <CalendarClock className="w-3.5 h-3.5 text-emerald-400" />
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(r)} title="Editar">
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openHistory(r)} title="Histórico">
                              <History className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-destructive" onClick={() => openDelete(r)} title="Excluir">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards - shown only on mobile */}
            <div className="md:hidden divide-y divide-border">
              {paginated.map((r) => {
                const remaining = getDaysRemaining(r);
                const canGenerateAccess = r.status === "active" && (r.credit_balance > 0 || isOwner);

                return (
                  <div key={r.id} className="p-3 space-y-3">
                    {/* Top: Name + Status */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-sm text-foreground truncate">{r.name}</p>
                          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 shrink-0 ${
                            r.credit_balance > 0
                              ? "bg-primary/10 text-primary border-primary/30"
                              : "bg-muted text-muted-foreground border-border"
                          }`}>
                            {r.credit_balance > 0 ? "Admin" : "Usuário"}
                          </Badge>
                        </div>
                        {r.email && (
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Mail className="w-3 h-3 shrink-0" />
                            <span className="truncate">{r.email}</span>
                          </p>
                        )}
                        {r.whatsapp && (
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Phone className="w-3 h-3 shrink-0" />
                            {r.whatsapp}
                          </p>
                        )}
                      </div>
                      {getStatusBadge(r.status)}
                    </div>

                    {/* Info row: days, credits, date */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-md bg-muted/50 p-2 text-center">
                        <p className="text-[9px] text-muted-foreground uppercase font-medium">Dias</p>
                        <p className={`text-sm font-bold font-mono ${
                          remaining.days <= 3 && remaining.days > 0 ? "text-orange-400" :
                          remaining.days === 0 ? "text-destructive" :
                          "text-foreground"
                        }`}>
                          {remaining.label}
                        </p>
                        {remaining.expiryDate && (
                          <p className="text-[8px] text-muted-foreground mt-0.5">{remaining.expiryDate}</p>
                        )}
                      </div>
                      <div className="rounded-md bg-muted/50 p-2 text-center">
                        <p className="text-[9px] text-muted-foreground uppercase font-medium">Créditos</p>
                        <p className={`text-sm font-bold font-mono ${r.credit_balance > 0 ? "text-primary" : "text-muted-foreground"}`}>
                          {r.credit_balance}
                        </p>
                      </div>
                      <div className="rounded-md bg-muted/50 p-2 text-center">
                        <p className="text-[9px] text-muted-foreground uppercase font-medium">Cadastro</p>
                        <p className="text-[11px] font-medium text-foreground">
                          {format(parseISO(r.created_at), "dd/MM/yy")}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(r.status === "trial" || r.status === "expired") && (
                        <Button size="sm" className="gap-1 h-8 text-xs flex-1" onClick={() => handleRenewSubscription(r)}>
                          <CreditCard className="w-3.5 h-3.5" /> Ativar
                        </Button>
                      )}
                      {r.status === "overdue" && (
                        <Button size="sm" variant="outline" className="gap-1 h-8 text-xs flex-1 border-orange-500/30 text-orange-400 hover:bg-orange-500/10" onClick={() => handleRenewSubscription(r)}>
                          <CalendarClock className="w-3.5 h-3.5" /> Renovar
                        </Button>
                      )}
                      {r.status === "active" && (
                        <Button size="sm" variant="ghost" className="gap-1 h-8 text-xs px-2" onClick={() => openCredits(r)} title="Adicionar créditos">
                          <CirclePlus className="w-4 h-4 text-primary" />
                          <span className="text-[10px]">Créditos</span>
                        </Button>
                      )}
                      {r.status === "active" && (
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleRenewSubscription(r)}>
                          <CalendarClock className="w-3.5 h-3.5 text-emerald-400" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openEdit(r)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => openHistory(r)}>
                        <History className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:text-destructive" onClick={() => openDelete(r)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-3 sm:px-4 py-3 border-t border-border">
                <span className="text-[10px] sm:text-xs text-muted-foreground">
                  {((currentPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} de {filtered.length}
                </span>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7 sm:h-8 sm:w-8" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).slice(
                    Math.max(0, currentPage - 3),
                    currentPage + 2
                  ).map(page => (
                    <Button key={page} size="icon" variant={page === currentPage ? "default" : "ghost"} className="h-7 w-7 sm:h-8 sm:w-8 text-xs" onClick={() => setCurrentPage(page)}>
                      {page}
                    </Button>
                  ))}
                  <Button size="icon" variant="ghost" className="h-7 w-7 sm:h-8 sm:w-8" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Trial Links - Mobile-friendly */}
      {pendingLinks.length > 0 && (
        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center justify-between p-3 sm:p-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-amber-400" />
              Links de Teste
              <Badge variant="outline" className="text-[10px] ml-1">{pendingLinks.length}</Badge>
            </h2>
          </div>

          {/* Desktop trial table */}
          <div className="hidden sm:block">
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
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" className="gap-1.5 h-7 text-xs" onClick={() => { navigator.clipboard.writeText(fullUrl); toast({ title: "Link copiado!" }); }}>
                            <Copy className="w-3 h-3" /> Copiar
                          </Button>
                          <Button variant="ghost" size="sm" className="gap-1.5 h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10" onClick={async () => {
                            const { error } = await supabase.from("trial_links").delete().eq("id", link.id);
                            if (error) {
                              toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
                            } else {
                              toast({ title: "Link excluído!" });
                              fetchPendingLinks();
                            }
                          }}>
                            <Trash2 className="w-3 h-3" /> Excluir
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile trial cards */}
          <div className="sm:hidden divide-y divide-border">
            {pendingLinks.map((link) => {
              const time = getTimeLeft(link.expires_at);
              const fullUrl = `${window.location.origin}/trial/${link.token}`;
              return (
                <div key={link.id} className="p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-[10px] bg-muted px-2 py-1 rounded font-mono truncate flex-1">
                      /trial/{link.token.substring(0, 12)}...
                    </code>
                    <Badge variant="outline" className={`shrink-0 text-[10px] ${time.expired ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-400"}`}>
                      <Clock className="w-2.5 h-2.5 mr-1" />
                      {time.label}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Criado: {format(parseISO(link.created_at), "dd/MM/yy HH:mm")}</span>
                    <span>Expira: {format(parseISO(link.expires_at), "dd/MM/yy HH:mm")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="gap-1 h-7 text-xs flex-1" onClick={() => { navigator.clipboard.writeText(fullUrl); toast({ title: "Link copiado!" }); }}>
                      <Copy className="w-3 h-3" /> Copiar
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1 h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10" onClick={async () => {
                      const { error } = await supabase.from("trial_links").delete().eq("id", link.id);
                      if (error) {
                        toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
                      } else {
                        toast({ title: "Link excluído!" });
                        fetchPendingLinks();
                      }
                    }}>
                      <Trash2 className="w-3 h-3" /> Excluir
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===== DIALOGS ===== */}

      {/* Activate/Renew Subscription Dialog */}
      <Dialog open={showActivate} onOpenChange={setShowActivate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              {selected?.status === "overdue" ? "Renovar Assinatura" : "Ativar Assinatura"} — {selected?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 p-4 space-y-1">
              <p className="text-xs text-muted-foreground">Status atual</p>
              {selected && getStatusBadge(selected.status)}
            </div>
            <div>
              <Label>Duração da assinatura (dias)</Label>
              <Input type="number" min="1" value={activateDays} onChange={(e) => setActivateDays(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowActivate(false)}>Cancelar</Button>
            <Button onClick={handleActivateSubscription}>
              {selected?.status === "overdue" ? "Renovar" : "Ativar Assinatura"}
            </Button>
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
          {selected?.status !== "active" && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Créditos só podem ser gerenciados com Assinatura Ativa.
            </div>
          )}
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
            <Button onClick={handleAddCredits} disabled={selected?.status !== "active"}>
              {creditForm.type === "purchase" ? "Adicionar" : "Debitar"}
            </Button>
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

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar — {selected?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome</Label><Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></div>
            <div><Label>Email</Label><Input value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} /></div>
            <div><Label>WhatsApp</Label><Input value={editForm.whatsapp} onChange={(e) => setEditForm({ ...editForm, whatsapp: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEdit(false)}>Cancelar</Button>
            <Button onClick={handleEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Secure Delete Dialog */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Excluir Cadastro
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-destructive/10 border border-destructive/30 p-4 space-y-2">
              <p className="text-sm font-semibold text-destructive">⚠️ Essa ação é irreversível</p>
              <div className="text-sm text-foreground space-y-1">
                <p><strong>Nome:</strong> {selected?.name}</p>
                <p><strong>Email:</strong> {selected?.email || "—"}</p>
                <p><strong>WhatsApp:</strong> {selected?.whatsapp || "—"}</p>
              </div>
            </div>
            <div>
              <Label>Digite <strong>EXCLUIR</strong> para confirmar</Label>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
                placeholder="EXCLUIR"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteConfirmText !== "EXCLUIR"}>
              Confirmar Exclusão
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
          <p className="text-sm text-muted-foreground">O link abaixo é válido por <strong>7 dias</strong>. Compartilhe com o revendedor para acesso temporário.</p>
          <div className="relative">
            <Input readOnly value={generatedTrialLink} className="pr-20 font-mono text-xs" />
            <Button size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 gap-1 h-7" onClick={() => { navigator.clipboard.writeText(generatedTrialLink); toast({ title: "Link copiado!" }); }}>
              <Copy className="w-3 h-3" /> Copiar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
