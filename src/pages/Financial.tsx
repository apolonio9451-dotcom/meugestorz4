import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, FileText, TrendingUp, Clock, Users, CalendarDays } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, parseISO, startOfMonth, subMonths, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ServerProfit {
  name: string;
  costPerCredit: number;
  clients: number;
  revenueMonth: number;
  costMonth: number;
  profitMonth: number;
  profitDay: number;
}

export default function Financial() {
  const { companyId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    receivedToday: 0,
    todayPayments: 0,
    forecastToday: 0,
    forecastInvoices: 0,
    totalReceived: 0,
    openAmount: 0,
    openInvoices: 0,
    monthlyProfit: 0,
    monthlyCost: 0,
    totalClients: 0,
  });
  const [serverProfits, setServerProfits] = useState<ServerProfit[]>([]);
  const [chartData, setChartData] = useState<{ month: string; revenue: number }[]>([]);

  useEffect(() => {
    if (!companyId) return;

    const fetchAll = async () => {
      setLoading(true);
      const today = new Date().toISOString().split("T")[0];
      const monthStart = format(startOfMonth(new Date()), "yyyy-MM-dd");

      const [clientsRes, subsRes, serversRes] = await Promise.all([
        supabase.from("clients").select("id, status, server").eq("company_id", companyId),
        supabase.from("client_subscriptions").select("id, client_id, amount, payment_status, start_date, end_date, plan_id").eq("company_id", companyId),
        supabase.from("servers").select("id, name, cost_per_credit").eq("company_id", companyId),
      ]);

      const clients = clientsRes.data || [];
      const subs = subsRes.data || [];
      const servers = serversRes.data || [];

      // Today's received
      const paidToday = subs.filter(s => s.payment_status === "paid" && s.start_date === today);
      const receivedToday = paidToday.reduce((sum, s) => sum + Number(s.amount), 0);

      // Forecast today (pending ending today)
      const pendingToday = subs.filter(s => (s.payment_status === "pending" || s.payment_status === "overdue") && s.end_date === today);
      const forecastToday = pendingToday.reduce((sum, s) => sum + Number(s.amount), 0);

      // Total received this month
      const paidMonth = subs.filter(s => s.payment_status === "paid" && s.start_date >= monthStart);
      const totalReceived = paidMonth.reduce((sum, s) => sum + Number(s.amount), 0);

      // Open invoices
      const openSubs = subs.filter(s => s.payment_status === "pending" || s.payment_status === "overdue");
      const openAmount = openSubs.reduce((sum, s) => sum + Number(s.amount), 0);

      // Monthly revenue (all active subs)
      const monthRevenue = subs.filter(s => s.end_date >= today).reduce((sum, s) => sum + Number(s.amount), 0);

      // Server cost calculation
      const serverMap = new Map(servers.map(s => [s.name, s]));
      const serverStats: Record<string, { clients: number; revenue: number }> = {};

      for (const client of clients) {
        const serverName = client.server || "";
        if (!serverStats[serverName]) serverStats[serverName] = { clients: 0, revenue: 0 };
        serverStats[serverName].clients++;

        const clientSub = subs.find(s => s.client_id === client.id && s.end_date >= today);
        if (clientSub) {
          serverStats[serverName].revenue += Number(clientSub.amount);
        }
      }

      let totalCost = 0;
      const profits: ServerProfit[] = [];
      for (const [name, stat] of Object.entries(serverStats)) {
        if (!name) continue;
        const srv = serverMap.get(name);
        const costPerCredit = srv ? Number(srv.cost_per_credit) : 0;
        const costMonth = stat.clients * costPerCredit;
        totalCost += costMonth;
        const profitMonth = stat.revenue - costMonth;
        profits.push({
          name,
          costPerCredit,
          clients: stat.clients,
          revenueMonth: stat.revenue,
          costMonth,
          profitMonth,
          profitDay: profitMonth / 30,
        });
      }

      // Totals row
      const totalRevenue = profits.reduce((s, p) => s + p.revenueMonth, 0);
      const totalCostAll = profits.reduce((s, p) => s + p.costMonth, 0);
      const totalProfitMonth = totalRevenue - totalCostAll;

      setStats({
        receivedToday,
        todayPayments: paidToday.length,
        forecastToday,
        forecastInvoices: pendingToday.length,
        totalReceived,
        openAmount,
        openInvoices: openSubs.length,
        monthlyProfit: totalProfitMonth,
        monthlyCost: totalCostAll,
        totalClients: clients.length,
      });

      setServerProfits(profits);

      // Chart data - last 6 months
      const chartMonths: { month: string; revenue: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = subMonths(new Date(), i);
        const mStart = format(startOfMonth(d), "yyyy-MM-dd");
        const mEnd = format(endOfMonth(d), "yyyy-MM-dd");
        const monthLabel = format(d, "MMM/yy", { locale: ptBR });
        const rev = subs
          .filter(s => s.payment_status === "paid" && s.start_date >= mStart && s.start_date <= mEnd)
          .reduce((sum, s) => sum + Number(s.amount), 0);
        chartMonths.push({ month: monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1), revenue: rev });
      }
      setChartData(chartMonths);
      setLoading(false);
    };

    fetchAll();
  }, [companyId]);

  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  const topCards = [
    { title: "Recebido Hoje", value: fmt(stats.receivedToday), sub: `${stats.todayPayments} pagamento(s)`, icon: FileText, iconColor: "text-primary" },
    { title: "Previsão do Dia", value: fmt(stats.forecastToday), sub: `${stats.forecastInvoices} fatura(s) vencendo`, icon: CalendarDays, iconColor: "text-primary" },
    { title: "Total Recebido", value: fmt(stats.totalReceived), sub: "Este mês", icon: TrendingUp, iconColor: "text-primary" },
    { title: "Em Aberto", value: fmt(stats.openAmount), sub: `${stats.openInvoices} fatura(s)`, icon: DollarSign, iconColor: "text-warning" },
  ];

  const bottomCards = [
    { title: "Lucro Mensal", value: fmt(stats.monthlyProfit), sub: `Custo: ${fmt(stats.monthlyCost)}`, icon: DollarSign, iconColor: "text-primary" },
    { title: "Total Clientes", value: String(stats.totalClients), sub: "", icon: Clock, iconColor: "text-primary" },
  ];

  const totalRow = useMemo(() => {
    const t = serverProfits.reduce(
      (acc, p) => ({
        clients: acc.clients + p.clients,
        revenueMonth: acc.revenueMonth + p.revenueMonth,
        costMonth: acc.costMonth + p.costMonth,
        profitMonth: acc.profitMonth + p.profitMonth,
        profitDay: acc.profitDay + p.profitDay,
      }),
      { clients: 0, revenueMonth: 0, costMonth: 0, profitMonth: 0, profitDay: 0 }
    );
    return t;
  }, [serverProfits]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <DollarSign className="w-5 h-5 text-primary" />
        <div>
          <h1 className="text-xl font-display font-bold text-foreground">Financeiro</h1>
          <p className="text-muted-foreground text-xs">Visão completa das finanças</p>
        </div>
      </div>

      {/* Top metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {topCards.map((card) => (
          <Card key={card.title}>
            <CardContent className="p-4">
              <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center mb-3">
                <card.icon className={`w-4 h-4 ${card.iconColor}`} />
              </div>
              <p className="text-xs text-muted-foreground">{card.title}</p>
              <p className="text-xl font-bold font-display text-foreground">{card.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{card.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bottom metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {bottomCards.map((card) => (
          <Card key={card.title}>
            <CardContent className="p-4">
              <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center mb-3">
                <card.icon className={`w-4 h-4 ${card.iconColor}`} />
              </div>
              <p className="text-xs text-muted-foreground">{card.title}</p>
              <p className="text-xl font-bold font-display text-foreground">{card.value}</p>
              {card.sub && <p className="text-xs text-muted-foreground mt-0.5">{card.sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue chart */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          <CardTitle className="text-sm font-bold">Faturamento Mensal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={{ stroke: "hsl(var(--border))" }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} axisLine={{ stroke: "hsl(var(--border))" }} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: "hsl(var(--foreground))" }}
                  formatter={(value: number) => [fmt(value), "Receita"]}
                />
                <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorRevenue)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Server profit table */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <FileText className="w-4 h-4 text-primary" />
          <CardTitle className="text-sm font-bold">Lucro por Servidor</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Servidor</TableHead>
                <TableHead>Crédito</TableHead>
                <TableHead>Clientes</TableHead>
                <TableHead>Receita/Mês</TableHead>
                <TableHead>Custo/Mês</TableHead>
                <TableHead>Lucro/Mês</TableHead>
                <TableHead>Lucro/Dia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {serverProfits.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nenhum dado disponível</TableCell>
                </TableRow>
              ) : (
                <>
                  {serverProfits.map((sp) => (
                    <TableRow key={sp.name}>
                      <TableCell className="font-medium">{sp.name}</TableCell>
                      <TableCell>{fmt(sp.costPerCredit)}</TableCell>
                      <TableCell className="text-primary font-medium">{sp.clients}</TableCell>
                      <TableCell className="font-bold">{fmt(sp.revenueMonth)}</TableCell>
                      <TableCell className="text-destructive">{fmt(sp.costMonth)}</TableCell>
                      <TableCell className="text-success font-medium">{fmt(sp.profitMonth)}</TableCell>
                      <TableCell className="text-success">{fmt(sp.profitDay)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 border-border">
                    <TableCell className="font-bold">Total</TableCell>
                    <TableCell>—</TableCell>
                    <TableCell className="text-primary font-bold">{totalRow.clients}</TableCell>
                    <TableCell className="font-bold">{fmt(totalRow.revenueMonth)}</TableCell>
                    <TableCell className="text-destructive font-bold">{fmt(totalRow.costMonth)}</TableCell>
                    <TableCell className="text-success font-bold">{fmt(totalRow.profitMonth)}</TableCell>
                    <TableCell className="text-success font-bold">{fmt(totalRow.profitDay)}</TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
