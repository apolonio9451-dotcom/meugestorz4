import { useAuth } from "@/hooks/useAuth";
import AnimatedPage from "@/components/AnimatedPage";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, TrendingUp, CalendarDays, Users, Target, MessageCircle, UserPlus, FileText, Server, UserCheck, UserX } from "lucide-react";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface ServerStat {
  name: string;
  total: number;
  active: number;
  expired: number;
}

async function fetchDashboardData(companyId: string) {
  const today = new Date().toISOString().split("T")[0];
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
  const next7 = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
  const next30 = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

  const [clientsRes, subsRes] = await Promise.all([
    supabase.from("clients").select("id, status, name, server").eq("company_id", companyId),
    supabase.from("client_subscriptions").select("id, payment_status, amount, start_date, end_date, client_id").eq("company_id", companyId),
  ]);

  const clients = clientsRes.data || [];
  const subs = subsRes.data || [];

  const paidSubs = subs.filter((s) => s.payment_status === "paid");
  const todayPaid = paidSubs.filter((s) => s.start_date === today);
  const monthPaid = paidSubs.filter((s) => s.start_date >= monthStart);

  const pendingSubs = subs.filter((s) => s.payment_status === "pending" || s.payment_status === "overdue");
  const upcoming7 = pendingSubs.filter((s) => s.end_date >= today && s.end_date <= next7);
  const upcoming30 = pendingSubs.filter((s) => s.end_date >= today && s.end_date <= next30);

  const clientMap = new Map(clients.map((c) => [c.id, c.name]));

  const latestSub: Record<string, string> = {};
  subs.forEach(s => {
    if (!latestSub[s.client_id] || s.end_date > latestSub[s.client_id]) {
      latestSub[s.client_id] = s.end_date;
    }
  });

  const srvMap: Record<string, ServerStat> = {};
  clients.filter(c => c.status !== "excluded" && c.server).forEach(c => {
    const srv = c.server!;
    if (!srvMap[srv]) srvMap[srv] = { name: srv, total: 0, active: 0, expired: 0 };
    srvMap[srv].total++;
    const endDate = latestSub[c.id];
    if (endDate) {
      const days = differenceInCalendarDays(parseISO(endDate), new Date());
      if (days >= 0) srvMap[srv].active++;
      else srvMap[srv].expired++;
    }
  });

  return {
    stats: {
      todayRevenue: todayPaid.reduce((sum, s) => sum + Number(s.amount), 0),
      todayPayments: todayPaid.length,
      monthRevenue: monthPaid.reduce((sum, s) => sum + Number(s.amount), 0),
      monthPayments: monthPaid.length,
      forecast30d: upcoming30.reduce((sum, s) => sum + Number(s.amount), 0),
      forecastInvoices: upcoming30.length,
      activeClients: clients.filter((c) => c.status === "active").length,
      totalClients: clients.length,
      leadsNew: 0,
      leadsContact: 0,
      leadsConverted: 0,
      openInvoices: pendingSubs.length,
      totalInvoices: subs.length,
    },
    recentPayments: monthPaid.slice(0, 5).map((s) => ({
      client: clientMap.get(s.client_id) || "—",
      amount: Number(s.amount),
      date: s.start_date,
      method: "—",
    })),
    upcomingInvoices: upcoming7.slice(0, 5).map((s) => ({
      client: clientMap.get(s.client_id) || "—",
      ref: s.id.slice(0, 8),
      amount: Number(s.amount),
      dueDate: s.end_date,
    })),
    serverStats: Object.values(srvMap).sort((a, b) => b.total - a.total),
  };
}

export default function Dashboard() {
  const { effectiveCompanyId: companyId } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-stats", companyId],
    queryFn: () => fetchDashboardData(companyId!),
    enabled: !!companyId,
    staleTime: 1000 * 60 * 5,
  });

  const stats = data?.stats ?? {
    todayRevenue: 0, todayPayments: 0, monthRevenue: 0, monthPayments: 0,
    forecast30d: 0, forecastInvoices: 0, activeClients: 0, totalClients: 0,
    leadsNew: 0, leadsContact: 0, leadsConverted: 0, openInvoices: 0, totalInvoices: 0,
  };
  const recentPayments = data?.recentPayments ?? [];
  const upcomingInvoices = data?.upcomingInvoices ?? [];
  const serverStats = data?.serverStats ?? [];

  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  const topCards = [
    { title: "Ganhos hoje", value: fmt(stats.todayRevenue), sub: `${stats.todayPayments} pagamento(s)`, icon: DollarSign, iconColor: "text-green-400" },
    { title: "Ganhos do mês", value: fmt(stats.monthRevenue), sub: `${stats.monthPayments} pagamento(s)`, icon: TrendingUp, iconColor: "text-blue-400" },
    { title: "Previsão 30d", value: fmt(stats.forecast30d), sub: `${stats.forecastInvoices} fatura(s)`, icon: CalendarDays, iconColor: "text-orange-400" },
    { title: "Clientes ativos", value: String(stats.activeClients), sub: `de ${stats.totalClients} total`, icon: Users, iconColor: "text-muted-foreground" },
  ];

  const bottomCards = [
    { title: "Leads novos", value: String(stats.leadsNew), sub: "Este mês", icon: Target, iconColor: "text-green-400" },
    { title: "Em contato", value: String(stats.leadsContact), sub: "Este mês", icon: MessageCircle, iconColor: "text-yellow-400" },
    { title: "Convertidos", value: String(stats.leadsConverted), sub: "Este mês", icon: UserPlus, iconColor: "text-muted-foreground" },
    { title: "Faturas abertas", value: String(stats.openInvoices), sub: `${stats.totalInvoices} total`, icon: FileText, iconColor: "text-muted-foreground" },
  ];

  const renderCards = (cards: typeof topCards) => (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((card) => (
        <Card key={card.title} className="bg-card border-border">
          <CardContent className="p-3 sm:p-5">
            <div className="flex items-start justify-between mb-2">
              <div className="p-1.5 sm:p-2 rounded-lg bg-muted/50">
                <card.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${card.iconColor}`} />
              </div>
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground mb-0.5">{card.title}</p>
            <p className="text-lg sm:text-2xl font-bold font-display text-foreground">{card.value}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">{card.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload as ServerStat;
    return (
      <div className="rounded-lg bg-popover border border-border p-2.5 shadow-lg text-xs space-y-1">
        <p className="font-semibold text-foreground">{d.name}</p>
        <p className="text-muted-foreground">Total: <span className="text-foreground font-medium">{d.total}</span></p>
        <p className="text-emerald-400">Ativos: <span className="font-medium">{d.active}</span></p>
        <p className="text-destructive">Vencidos: <span className="font-medium">{d.expired}</span></p>
      </div>
    );
  };

  if (isLoading) {
    return (
      <AnimatedPage><div className="space-y-6">
        <div><Skeleton className="h-8 w-48" /><Skeleton className="h-4 w-32 mt-2" /></div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-page-enter">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Visão geral do seu negócio</p>
      </div>

      {renderCards(topCards)}
      {renderCards(bottomCards)}

      {serverStats.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader className="flex flex-row items-center gap-2 pb-1">
            <Server className="w-4 h-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Clientes por Servidor</CardTitle>
          </CardHeader>
          <CardContent className="px-2 pb-3">
            <div className="flex items-center gap-2 mb-3 px-2">
              <div className="flex items-center gap-1.5 rounded-full bg-muted/60 px-2.5 py-1 text-[10px]">
                <Users className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">Total</span>
                <span className="font-bold text-foreground">{serverStats.reduce((s, x) => s + x.total, 0)}</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px]">
                <UserCheck className="w-3 h-3 text-emerald-500" />
                <span className="text-emerald-500">{serverStats.reduce((s, x) => s + x.active, 0)}</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-[10px]">
                <UserX className="w-3 h-3 text-destructive" />
                <span className="text-destructive">{serverStats.reduce((s, x) => s + x.expired, 0)}</span>
              </div>
            </div>
            <div className="h-[200px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={serverStats} margin={{ top: 4, right: 12, left: -20, bottom: 0 }} barCategoryGap="30%">
                  <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted)/0.15)" }} />
                  <Bar dataKey="active" stackId="a" radius={[0, 0, 4, 4]} name="Ativos" fill="hsl(160, 65%, 45%)" />
                  <Bar dataKey="expired" stackId="a" radius={[4, 4, 0, 0]} name="Vencidos" fill="hsl(var(--destructive))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-center gap-4 mt-1 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> Ativos</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-destructive inline-block" /> Vencidos</span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <FileText className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-base">Últimos Pagamentos</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Método</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                      Nenhum pagamento registrado
                    </TableCell>
                  </TableRow>
                ) : (
                  recentPayments.map((p, i) => (
                    <TableRow key={i}>
                      <TableCell>{p.client}</TableCell>
                      <TableCell>{fmt(p.amount)}</TableCell>
                      <TableCell>{new Date(p.date).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>{p.method}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <CalendarDays className="w-4 h-4 text-muted-foreground" />
            <CardTitle className="text-base">Faturas a vencer (7 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Ref.</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Venc.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {upcomingInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                      Nenhuma fatura nos próximos 7 dias
                    </TableCell>
                  </TableRow>
                ) : (
                  upcomingInvoices.map((inv, i) => (
                    <TableRow key={i}>
                      <TableCell>{inv.client}</TableCell>
                      <TableCell>{inv.ref}</TableCell>
                      <TableCell>{fmt(inv.amount)}</TableCell>
                      <TableCell>{new Date(inv.dueDate).toLocaleDateString("pt-BR")}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
