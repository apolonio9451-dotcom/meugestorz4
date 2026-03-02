import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldCheck,
  ShieldOff,
  RefreshCw,
  Search,
  KeyRound,
  Calendar,
  Lock,
  Unlock,
} from "lucide-react";
import { format, addDays, isPast, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ClientAccess {
  id: string;
  name: string;
  status: string;
  whatsapp: string | null;
  subscription?: {
    id: string;
    end_date: string;
    payment_status: string;
    plan_name: string;
  };
}

export default function AccessControl() {
  const { companyId } = useAuth();
  const { toast } = useToast();
  const [clients, setClients] = useState<ClientAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "blocked" | "expiring">("all");
  const [renewOpen, setRenewOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientAccess | null>(null);
  const [renewDays, setRenewDays] = useState("30");
  const [saving, setSaving] = useState(false);

  const fetchClients = async () => {
    if (!companyId) return;
    setLoading(true);

    const { data: clientsData } = await supabase
      .from("clients")
      .select("id, name, status, whatsapp")
      .eq("company_id", companyId)
      .order("name");

    if (!clientsData) {
      setLoading(false);
      return;
    }

    const enriched: ClientAccess[] = [];
    for (const c of clientsData) {
      const { data: sub } = await supabase
        .from("client_subscriptions")
        .select("id, end_date, payment_status, plan_id")
        .eq("client_id", c.id)
        .eq("company_id", companyId)
        .order("end_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      let planName = "—";
      if (sub?.plan_id) {
        const { data: plan } = await supabase
          .from("subscription_plans")
          .select("name")
          .eq("id", sub.plan_id)
          .maybeSingle();
        if (plan) planName = plan.name;
      }

      enriched.push({
        ...c,
        subscription: sub ? { ...sub, plan_name: planName } : undefined,
      });
    }

    setClients(enriched);
    setLoading(false);
  };

  useEffect(() => {
    fetchClients();
  }, [companyId]);

  const toggleStatus = async (client: ClientAccess) => {
    const newStatus = client.status === "active" ? "blocked" : "active";
    const { error } = await supabase
      .from("clients")
      .update({ status: newStatus })
      .eq("id", client.id);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: newStatus === "active" ? "Acesso liberado!" : "Acesso bloqueado!" });
      fetchClients();
    }
  };

  const handleRenew = async () => {
    if (!selectedClient?.subscription || !companyId) return;
    setSaving(true);

    const currentEnd = new Date(selectedClient.subscription.end_date);
    const baseDate = isPast(currentEnd) ? new Date() : currentEnd;
    const newEnd = addDays(baseDate, parseInt(renewDays));

    const { error } = await supabase
      .from("client_subscriptions")
      .update({
        end_date: format(newEnd, "yyyy-MM-dd"),
        payment_status: "paid",
      })
      .eq("id", selectedClient.subscription.id);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      // Also reactivate client
      await supabase.from("clients").update({ status: "active" }).eq("id", selectedClient.id);
      toast({ title: "Acesso renovado com sucesso!" });
      setRenewOpen(false);
      fetchClients();
    }
    setSaving(false);
  };

  const getStatusInfo = (client: ClientAccess) => {
    if (client.status === "blocked") return { label: "Bloqueado", color: "bg-destructive/15 text-destructive border-destructive/30", icon: ShieldOff };
    if (!client.subscription) return { label: "Sem plano", color: "bg-muted text-muted-foreground border-border", icon: KeyRound };
    const daysLeft = differenceInDays(new Date(client.subscription.end_date), new Date());
    if (daysLeft < 0) return { label: "Expirado", color: "bg-destructive/15 text-destructive border-destructive/30", icon: ShieldOff };
    if (daysLeft <= 5) return { label: `${daysLeft}d restantes`, color: "bg-amber-500/15 text-amber-600 border-amber-500/30", icon: ShieldCheck };
    return { label: "Ativo", color: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30", icon: ShieldCheck };
  };

  const filtered = clients.filter((c) => {
    const q = search.toLowerCase();
    if (q && !c.name.toLowerCase().includes(q)) return false;
    if (filter === "active") return c.status === "active";
    if (filter === "blocked") return c.status === "blocked";
    if (filter === "expiring") {
      if (!c.subscription) return false;
      const days = differenceInDays(new Date(c.subscription.end_date), new Date());
      return days >= 0 && days <= 5;
    }
    return true;
  });

  const stats = {
    total: clients.length,
    active: clients.filter((c) => c.status === "active").length,
    blocked: clients.filter((c) => c.status === "blocked").length,
    expiring: clients.filter((c) => {
      if (!c.subscription) return false;
      const days = differenceInDays(new Date(c.subscription.end_date), new Date());
      return days >= 0 && days <= 5;
    }).length,
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-primary" />
          Controle de Acessos
        </h1>
        <p className="text-sm text-muted-foreground">Renove, bloqueie ou libere acessos dos seus clientes.</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, icon: KeyRound, color: "text-primary" },
          { label: "Ativos", value: stats.active, icon: Unlock, color: "text-emerald-500" },
          { label: "Bloqueados", value: stats.blocked, icon: Lock, color: "text-destructive" },
          { label: "Expirando", value: stats.expiring, icon: Calendar, color: "text-amber-500" },
        ].map((s) => (
          <Card key={s.label} className="p-3">
            <div className="flex items-center gap-2">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </div>
            <div className="text-2xl font-bold mt-1">{s.value}</div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "active", "blocked", "expiring"] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(f)}
            className="text-xs"
          >
            {{ all: "Todos", active: "Ativos", blocked: "Bloqueados", expiring: "Expirando" }[f]}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-center text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">Nenhum cliente encontrado.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="hidden sm:table-cell">Plano</TableHead>
                  <TableHead className="hidden sm:table-cell">Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => {
                  const status = getStatusInfo(c);
                  const StatusIcon = status.icon;
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">
                        <div>
                          {c.name}
                          <div className="text-xs text-muted-foreground sm:hidden">
                            {c.subscription?.plan_name ?? "Sem plano"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {c.subscription?.plan_name ?? "—"}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {c.subscription
                          ? format(new Date(c.subscription.end_date), "dd/MM/yyyy", { locale: ptBR })
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={status.color}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {c.subscription && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Renovar"
                              onClick={() => { setSelectedClient(c); setRenewOpen(true); }}
                            >
                              <RefreshCw className="w-4 h-4 text-primary" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            title={c.status === "active" ? "Bloquear" : "Liberar"}
                            onClick={() => toggleStatus(c)}
                          >
                            {c.status === "active" ? (
                              <Lock className="w-4 h-4 text-destructive" />
                            ) : (
                              <Unlock className="w-4 h-4 text-emerald-500" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Renew Dialog */}
      <Dialog open={renewOpen} onOpenChange={setRenewOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-primary" />
              Renovar Acesso
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Renovando acesso de <strong>{selectedClient?.name}</strong>
            </p>
            <div className="space-y-2">
              <Label>Período de renovação</Label>
              <Select value={renewDays} onValueChange={setRenewDays}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 dias</SelectItem>
                  <SelectItem value="15">15 dias</SelectItem>
                  <SelectItem value="30">30 dias</SelectItem>
                  <SelectItem value="60">60 dias</SelectItem>
                  <SelectItem value="90">90 dias</SelectItem>
                  <SelectItem value="180">180 dias</SelectItem>
                  <SelectItem value="365">365 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenewOpen(false)}>Cancelar</Button>
            <Button onClick={handleRenew} disabled={saving}>
              {saving ? "Renovando..." : "Renovar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
