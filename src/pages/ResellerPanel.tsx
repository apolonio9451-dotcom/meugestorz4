import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Coins,
  FlaskConical,
  Clock,
  UserCheck,
  Copy,
  History,
  Users,
  TrendingUp,
  AlertTriangle,
  ShieldCheck,
  MessageCircle,
  Phone,
  Save,
  Loader2,
} from "lucide-react";
import { differenceInHours, parseISO, format } from "date-fns";

interface ResellerClient {
  id: string;
  name: string;
  email: string | null;
  whatsapp: string | null;
  status: string;
  created_at: string;
  end_date?: string | null;
}

interface CreditTransaction {
  id: string;
  amount: number;
  type: string;
  description: string;
  created_at: string;
}

interface TrialLink {
  id: string;
  token: string;
  status: string;
  client_name: string;
  expires_at: string;
  created_at: string;
}

export default function ResellerPanel() {
  const { user, companyId } = useAuth();
  const { toast } = useToast();
  const [reseller, setReseller] = useState<any>(null);
  const [clients, setClients] = useState<ResellerClient[]>([]);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [trialLinks, setTrialLinks] = useState<TrialLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showTrialLink, setShowTrialLink] = useState(false);
  const [generatedLink, setGeneratedLink] = useState("");
  const [showNoCreditModal, setShowNoCreditModal] = useState(false);
  const [adminWhatsapp, setAdminWhatsapp] = useState<string | null>(null);
  const [adminName, setAdminName] = useState<string>("Administrador");
  const [supportWhatsapp, setSupportWhatsapp] = useState("");
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);
  const [resellerSettingsId, setResellerSettingsId] = useState<string | null>(null);

  const fetchReseller = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("resellers")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) setReseller(data);
    setLoading(false);
  };

  const fetchClients = async () => {
    if (!reseller) return;
    const { data } = await supabase
      .from("clients")
      .select("id, name, email, whatsapp, status, created_at")
      .eq("reseller_id", reseller.id)
      .order("created_at", { ascending: false });

    if (!data) return;

    // Fetch latest subscription end_date for each client
    const clientIds = data.map((c) => c.id);
    const { data: subs } = await supabase
      .from("client_subscriptions")
      .select("client_id, end_date")
      .in("client_id", clientIds)
      .order("end_date", { ascending: false });

    const endDateMap = new Map<string, string>();
    (subs || []).forEach((s) => {
      if (!endDateMap.has(s.client_id)) endDateMap.set(s.client_id, s.end_date);
    });

    setClients(
      data.map((c) => ({ ...c, end_date: endDateMap.get(c.id) || null }))
    );
  };

  const fetchTransactions = async () => {
    if (!reseller) return;
    const { data } = await supabase
      .from("reseller_credit_transactions")
      .select("id, amount, type, description, created_at")
      .eq("reseller_id", reseller.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setTransactions(data);
  };

  const fetchTrialLinks = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("trial_links")
      .select("id, token, status, client_name, expires_at, created_at")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    if (data) setTrialLinks(data);
  };

  useEffect(() => {
    fetchReseller();
  }, [user]);

  useEffect(() => {
    if (reseller) {
      fetchClients();
      fetchTransactions();
      fetchTrialLinks();
      // Fetch admin contact info
      if (reseller.company_id) {
        supabase
          .from("company_settings")
          .select("support_whatsapp, brand_name")
          .eq("company_id", reseller.company_id)
          .maybeSingle()
          .then(({ data }) => {
            if (data?.support_whatsapp) setAdminWhatsapp(data.support_whatsapp);
            if (data?.brand_name) setAdminName(data.brand_name);
          });
      }
      // Fetch reseller's own support whatsapp
      supabase
        .from("reseller_settings")
        .select("id, support_whatsapp")
        .eq("reseller_id", reseller.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setResellerSettingsId(data.id);
            setSupportWhatsapp((data as any).support_whatsapp || "");
          }
        });
    }
  }, [reseller]);

  const handleSaveWhatsapp = async () => {
    if (!reseller) return;
    setSavingWhatsapp(true);
    if (resellerSettingsId) {
      await supabase
        .from("reseller_settings")
        .update({ support_whatsapp: supportWhatsapp } as any)
        .eq("id", resellerSettingsId);
    } else {
      const { data } = await supabase
        .from("reseller_settings")
        .insert({ reseller_id: reseller.id, support_whatsapp: supportWhatsapp } as any)
        .select("id")
        .single();
      if (data) setResellerSettingsId(data.id);
    }
    setSavingWhatsapp(false);
    toast({ title: "WhatsApp de suporte salvo!" });
  };

  const handleGenerateTrial = async () => {
    if (!companyId || !user) return;

    // Block if no credits
    if (reseller && reseller.credit_balance <= 0) {
      setShowNoCreditModal(true);
      return;
    }

    setGenerating(true);

    const { data, error } = await supabase
      .from("trial_links")
      .insert({
        company_id: companyId,
        created_by: user.id,
        reseller_id: reseller?.id || null,
        client_name: "Pendente",
      })
      .select("token")
      .single();

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      const link = `${window.location.origin}/trial/${data.token}`;
      setGeneratedLink(link);
      setShowTrialLink(true);
      fetchTrialLinks();
    }
    setGenerating(false);
  };

  const handleActivateClient = async (client: ResellerClient) => {
    if (!reseller || !companyId) return;

    if (reseller.credit_balance <= 0) {
      toast({
        title: "Saldo insuficiente",
        description: "Compre créditos para ativar este cliente.",
        variant: "destructive",
      });
      return;
    }

    // Debit 1 credit
    const newBalance = reseller.credit_balance - 1;
    const { error: upErr } = await supabase
      .from("resellers")
      .update({ credit_balance: newBalance })
      .eq("id", reseller.id);

    if (upErr) {
      toast({ title: "Erro", description: upErr.message, variant: "destructive" });
      return;
    }

    // Log transaction
    await supabase.from("reseller_credit_transactions").insert({
      reseller_id: reseller.id,
      company_id: companyId,
      amount: -1,
      type: "activation",
      description: `Ativação do cliente ${client.name}`,
    });

    // Update client status
    await supabase.from("clients").update({ status: "active" }).eq("id", client.id);

    // Log activity
    await supabase.from("reseller_activity_logs").insert({
      reseller_id: reseller.id,
      company_id: companyId,
      action: "client_activation",
      entity_type: "client",
      entity_id: client.id,
      details: { client_name: client.name },
    });

    setReseller({ ...reseller, credit_balance: newBalance });
    toast({ title: "Cliente ativado!", description: "1 crédito debitado." });
    fetchClients();
    fetchTransactions();
  };

  const getTimeLeft = (expiresAt: string) => {
    const hours = differenceInHours(parseISO(expiresAt), new Date());
    if (hours <= 0) return { label: "Expirado", expired: true };
    const days = Math.floor(hours / 24);
    if (days > 0) return { label: `${days}d ${hours % 24}h`, expired: false };
    return { label: `${hours}h`, expired: false };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!reseller) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-2">
          <ShieldCheck className="w-12 h-12 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-bold text-foreground">Sem Acesso de Revendedor</h2>
          <p className="text-muted-foreground text-sm">Você não possui um perfil de revendedor vinculado.</p>
        </div>
      </div>
    );
  }

  const activeClients = clients.filter((c) => c.status === "active").length;
  const trialClients = clients.filter((c) => c.status === "trial").length;
  const expiredClients = clients.filter((c) => c.status === "expired").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Minha Revenda</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerencie seus clientes e créditos</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-sm font-mono">
            <Coins className="w-4 h-4 text-primary" />
            {reseller.credit_balance} crédito{reseller.credit_balance !== 1 ? "s" : ""}
          </Badge>
          <Button variant="outline" onClick={() => { fetchTransactions(); setShowHistory(true); }} className="gap-2">
            <History className="w-4 h-4" /> Histórico
          </Button>
          <Button onClick={handleGenerateTrial} disabled={generating} className="gap-2">
            <FlaskConical className="w-4 h-4" /> {generating ? "Gerando..." : "Gerar Teste (7 dias)"}
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Clientes</p>
              <p className="text-xl font-bold text-foreground">{clients.length}</p>
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
              <p className="text-xl font-bold text-foreground">{activeClients}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-10 h-10 rounded-lg bg-amber-500/15 flex items-center justify-center">
              <FlaskConical className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Em Teste</p>
              <p className="text-xl font-bold text-foreground">{trialClients}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
              <Coins className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Créditos</p>
              <p className="text-xl font-bold text-foreground">{reseller.credit_balance}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trial Links */}
      {trialLinks.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FlaskConical className="w-5 h-5 text-primary" />
              Links de Teste
              <Badge variant="outline" className="ml-auto text-xs">
                {trialLinks.filter((l) => l.status === "pending").length} pendente{trialLinks.filter((l) => l.status === "pending").length !== 1 ? "s" : ""}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {trialLinks.slice(0, 10).map((link) => {
                const time = getTimeLeft(link.expires_at);
                const fullUrl = `${window.location.origin}/trial/${link.token}`;
                return (
                  <div key={link.id} className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 px-3 py-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge
                        variant="outline"
                        className={
                          link.status === "used"
                            ? "bg-primary/10 text-primary border-primary/30 text-xs"
                            : link.status === "pending"
                              ? "bg-amber-500/10 text-amber-500 border-amber-500/30 text-xs"
                              : "bg-muted text-muted-foreground text-xs"
                        }
                      >
                        {link.status === "used" ? "Usado" : link.status === "pending" ? "Pendente" : link.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground truncate">
                        {link.client_name !== "Pendente" ? link.client_name : "Aguardando cadastro"}
                      </span>
                      <Badge
                        variant="outline"
                        className={time.expired ? "bg-destructive/10 text-destructive text-xs" : "bg-muted text-muted-foreground text-xs"}
                      >
                        <Clock className="w-3 h-3 mr-1" />
                        {time.label}
                      </Badge>
                    </div>
                    {link.status === "pending" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 h-7 text-xs shrink-0"
                        onClick={() => {
                          navigator.clipboard.writeText(fullUrl);
                          toast({ title: "Link copiado!" });
                        }}
                      >
                        <Copy className="w-3 h-3" /> Copiar
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* WhatsApp de Suporte Config */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Phone className="w-5 h-5 text-primary" />
            WhatsApp de Suporte
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
            <div className="space-y-1.5 flex-1 w-full">
              <Label className="text-xs text-muted-foreground">
                Número que seus clientes/sub-revendas usarão para contato
              </Label>
              <Input
                value={supportWhatsapp}
                onChange={(e) => setSupportWhatsapp(e.target.value)}
                placeholder="5511999999999"
                className="bg-secondary/50 border-border"
              />
            </div>
            <Button onClick={handleSaveWhatsapp} disabled={savingWhatsapp} size="sm" className="gap-2 shrink-0">
              {savingWhatsapp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar
            </Button>
          </div>
          <p className="text-muted-foreground text-xs mt-2">
            Formato: código do país + DDD + número (ex: 5511999999999)
          </p>
        </CardContent>
      </Card>

      {/* Client List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="w-5 h-5 text-primary" />
            Meus Clientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">
              Nenhum cliente ainda. Gere um link de teste para começar.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((c) => {
                  const statusConfig =
                    c.status === "active"
                      ? { label: "Ativo", class: "bg-primary/10 text-primary border-primary/30" }
                      : c.status === "trial"
                        ? { label: "Teste", class: "bg-amber-500/10 text-amber-500 border-amber-500/30" }
                        : c.status === "expired"
                          ? { label: "Expirado", class: "bg-destructive/10 text-destructive border-destructive/30" }
                          : { label: c.status, class: "bg-muted text-muted-foreground" };

                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium text-sm">{c.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {c.whatsapp || c.email || "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={`${statusConfig.class} text-xs`}>
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(parseISO(c.created_at), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {c.end_date ? format(parseISO(c.end_date), "dd/MM/yyyy") : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {(c.status === "trial" || c.status === "expired") && (
                          <Button
                            size="sm"
                            className="gap-1.5 h-7 text-xs"
                            onClick={() => handleActivateClient(c)}
                            disabled={reseller.credit_balance <= 0}
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            {reseller.credit_balance <= 0 ? "Sem créditos" : "Ativar (1 crédito)"}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {/* Insufficient credits warning */}
          {reseller.credit_balance <= 0 && clients.some((c) => c.status === "trial" || c.status === "expired") && (
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
              <p className="text-sm text-destructive">
                Saldo insuficiente. Compre créditos para ativar seus clientes.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              Histórico de Créditos
            </DialogTitle>
          </DialogHeader>
          <div className="text-center py-2">
            <p className="text-xs text-muted-foreground">Saldo Atual</p>
            <p className="text-3xl font-bold font-mono text-primary">{reseller.credit_balance}</p>
          </div>
          {transactions.length === 0 ? (
            <p className="text-center text-muted-foreground py-4 text-sm">Sem transações</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(parseISO(t.created_at), "dd/MM/yyyy HH:mm")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={t.amount > 0 ? "bg-primary/10 text-primary text-xs" : "bg-destructive/10 text-destructive text-xs"}>
                        {t.amount > 0 ? "Compra" : "Débito"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{t.description}</TableCell>
                    <TableCell className={`text-right font-mono font-bold text-sm ${t.amount > 0 ? "text-primary" : "text-destructive"}`}>
                      {t.amount > 0 ? `+${t.amount}` : t.amount}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      {/* Generated Trial Link Dialog */}
      <Dialog open={showTrialLink} onOpenChange={setShowTrialLink}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-primary" />
              Link de Teste Gerado
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg bg-muted/50 border border-border p-3">
              <code className="text-xs break-all select-all">{generatedLink}</code>
            </div>
            <p className="text-xs text-muted-foreground">
              Envie este link para o cliente. Ele terá 7 dias de acesso gratuito. A ativação definitiva consumirá 1 crédito.
            </p>
            <Button
              className="w-full gap-2"
              onClick={() => {
                navigator.clipboard.writeText(generatedLink);
                toast({ title: "Link copiado!" });
              }}
            >
              <Copy className="w-4 h-4" /> Copiar Link
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* No Credits Modal */}
      <Dialog open={showNoCreditModal} onOpenChange={setShowNoCreditModal}>
        <DialogContent className="rounded-2xl border-amber-500/30">
          <DialogHeader className="text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-amber-500/15 flex items-center justify-center mb-2">
              <AlertTriangle className="w-7 h-7 text-amber-500" />
            </div>
            <DialogTitle className="text-lg">Créditos Insuficientes</DialogTitle>
          </DialogHeader>
          <div className="text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Você precisa ter pelo menos <strong className="text-foreground">1 crédito</strong> disponível para gerar um link de teste.
            </p>
            <p className="text-sm text-muted-foreground">
              Entre em contato com seu administrador para adquirir créditos.
            </p>
            {adminWhatsapp ? (
              <Button
                className="w-full gap-2"
                onClick={() => {
                  const phone = adminWhatsapp.replace(/\D/g, "");
                  const msg = encodeURIComponent("Olá! Preciso comprar créditos para minha revenda.");
                  window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
                }}
              >
                <MessageCircle className="w-4 h-4" /> Chamar no WhatsApp
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                WhatsApp de suporte não configurado. Contate seu administrador.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNoCreditModal(false)} className="w-full">
              Entendi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
