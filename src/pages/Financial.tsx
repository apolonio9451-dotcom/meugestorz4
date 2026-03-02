import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, TrendingUp, Clock, Users, AlertCircle, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface Sub {
  amount: number;
  payment_status: string;
  start_date: string;
  end_date: string;
  clients: { name: string; server: string | null } | null;
  subscription_plans: { name: string } | null;
}

interface ServerData {
  name: string;
  url: string;
  cost_per_credit: number;
}

export default function Financial() {
  const { companyId } = useAuth();
  const [subs, setSubs] = useState<Sub[]>([]);
  const [servers, setServers] = useState<ServerData[]>([]);
  const [totalClients, setTotalClients] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    Promise.all([
      supabase
        .from("client_subscriptions")
        .select("amount, payment_status, start_date, end_date, clients(name, server), subscription_plans(name)")
        .eq("company_id", companyId),
      supabase.from("servers").select("name, url, cost_per_credit").eq("company_id", companyId),
      supabase.from("clients").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "active"),
    ]).then(([subsRes, serversRes, clientsRes]) => {
      setSubs(subsRes.data || []);
      setServers(serversRes.data || []);
      setTotalClients(clientsRes.count || 0);
      setLoading(false);
    });
  }, [companyId]);

  const today = new Date().toISOString().split("T")[0];
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const metrics = useMemo(() => {
    // Recebido Hoje: assinaturas pagas cuja start_date é hoje
    const receivedToday = subs
      .filter((s) => s.payment_status === "paid" && s.start_date === today)
      .reduce((sum, s) => sum + Number(s.amount), 0);

    // Previsão do Dia: assinaturas pendentes que vencem hoje (precisam renovar)
    const forecastToday = subs
      .filter((s) => s.payment_status === "pending" && s.end_date === today)
      .reduce((sum, s) => sum + Number(s.amount), 0);

    // Total Recebido no Mês: todas as assinaturas pagas do mês atual
    const totalReceived = subs
      .filter((s) => {
        const d = new Date(s.start_date);
        return s.payment_status === "paid" && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .reduce((sum, s) => sum + Number(s.amount), 0);

    // Faturas em Aberto: pendentes + vencidas
    const openInvoices = subs
      .filter((s) => s.payment_status === "pending" || s.payment_status === "overdue")
      .reduce((sum, s) => sum + Number(s.amount), 0);

    // Receita Mensal: apenas assinaturas criadas/renovadas no mês atual (start_date no mês)
    const monthlyRevenue = subs
      .filter((s) => {
        const d = new Date(s.start_date);
        return s.payment_status !== "cancelled" && d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .reduce((sum, s) => sum + Number(s.amount), 0);

    const totalCosts = servers.reduce((sum, srv) => sum + Number(srv.cost_per_credit), 0);
    const monthlyProfit = monthlyRevenue - totalCosts;

    return { receivedToday, forecastToday, totalReceived, openInvoices, monthlyRevenue, monthlyProfit };
  }, [subs, servers, today, currentMonth, currentYear]);

  const chartData = useMemo(() => {
    const months: { label: string; total: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      const total = subs
        .filter((s) => {
          const sd = new Date(s.start_date);
          return s.payment_status !== "cancelled" && sd.getMonth() === d.getMonth() && sd.getFullYear() === d.getFullYear();
        })
        .reduce((sum, s) => sum + Number(s.amount), 0);
      months.push({ label, total });
    }
    return months;
  }, [subs, currentMonth, currentYear]);

  const serverProfits = useMemo(() => {
    return servers.map((srv) => {
      // Apenas assinaturas criadas/renovadas no mês atual vinculadas ao servidor
      const serverSubs = subs.filter((s) => {
        const sd = new Date(s.start_date);
        return s.clients?.server === srv.name && s.payment_status !== "cancelled" && sd.getMonth() === currentMonth && sd.getFullYear() === currentYear;
      });
      const clientCount = new Set(serverSubs.map((s) => s.clients?.name)).size;
      const revenue = serverSubs.reduce((sum, s) => sum + Number(s.amount), 0);
      const cost = Number(srv.cost_per_credit);
      const profit = revenue - cost;
      const profitPerDay = profit / 30;
      return { name: srv.name, credit: cost, clients: clientCount, revenue, cost, profit, profitPerDay };
    });
  }, [subs, servers]);

  const serverTotals = useMemo(() => {
    const t = serverProfits.reduce(
      (acc, sp) => ({
        clients: acc.clients + sp.clients,
        revenue: acc.revenue + sp.revenue,
        cost: acc.cost + sp.cost,
        profit: acc.profit + sp.profit,
        profitPerDay: acc.profitPerDay + sp.profitPerDay,
      }),
      { clients: 0, revenue: 0, cost: 0, profit: 0, profitPerDay: 0 }
    );
    return t;
  }, [serverProfits]);

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const metricCards = [
    { title: "Recebido Hoje", value: metrics.receivedToday, icon: DollarSign, trend: "up" as const },
    { title: "Previsão do Dia", value: metrics.forecastToday, icon: Clock, trend: "neutral" as const },
    { title: "Receita Mensal", value: metrics.monthlyRevenue, icon: TrendingUp, trend: "up" as const },
    { title: "Faturas em Aberto", value: metrics.openInvoices, icon: AlertCircle, trend: "down" as const },
    { title: "Lucro Mensal", value: metrics.monthlyProfit, icon: TrendingUp, trend: metrics.monthlyProfit >= 0 ? "up" as const : "down" as const },
    { title: "Total de Clientes", value: totalClients, icon: Users, trend: "neutral" as const, isCurrency: false },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Financeiro</h1>
          <p className="text-muted-foreground text-sm mt-1">Carregando dados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Financeiro</h1>
        <p className="text-muted-foreground text-sm mt-1">Visão geral das suas finanças</p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {metricCards.map((m) => (
          <Card key={m.title} className="glass-card border-border/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <m.icon className="w-4 h-4 text-muted-foreground" />
                {m.trend === "up" && <ArrowUpRight className="w-3.5 h-3.5 text-success" />}
                {m.trend === "down" && <ArrowDownRight className="w-3.5 h-3.5 text-destructive" />}
              </div>
              <p className="text-xs text-muted-foreground">{m.title}</p>
              <p className="text-lg font-display font-bold text-foreground mt-0.5">
                {m.isCurrency === false ? m.value : fmt(m.value)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart */}
      <Card className="glass-card border-border/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-foreground">Faturamento - Últimos 6 meses</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis dataKey="label" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value: number) => [fmt(value), "Faturamento"]}
                />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Server Profit Table */}
      <Card className="glass-card border-border/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-foreground">Lucro por Servidor</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Servidor</TableHead>
                <TableHead className="text-right">Crédito</TableHead>
                <TableHead className="text-right">Clientes</TableHead>
                <TableHead className="text-right">Receita/Mês</TableHead>
                <TableHead className="text-right">Custo/Mês</TableHead>
                <TableHead className="text-right">Lucro/Mês</TableHead>
                <TableHead className="text-right">Lucro/Dia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {serverProfits.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhum servidor cadastrado
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {serverProfits.map((sp) => (
                    <TableRow key={sp.name}>
                      <TableCell className="font-medium">{sp.name}</TableCell>
                      <TableCell className="text-right">{fmt(sp.credit)}</TableCell>
                      <TableCell className="text-right font-semibold">{sp.clients}</TableCell>
                      <TableCell className="text-right font-semibold">{fmt(sp.revenue)}</TableCell>
                      <TableCell className="text-right text-destructive">{fmt(sp.cost)}</TableCell>
                      <TableCell className={`text-right font-semibold ${sp.profit >= 0 ? "text-success" : "text-destructive"}`}>
                        {fmt(sp.profit)}
                      </TableCell>
                      <TableCell className="text-right">{fmt(sp.profitPerDay)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 border-border/50 bg-muted/20">
                    <TableCell className="font-bold">Total</TableCell>
                    <TableCell className="text-right">—</TableCell>
                    <TableCell className="text-right font-bold">{serverTotals.clients}</TableCell>
                    <TableCell className="text-right font-bold">{fmt(serverTotals.revenue)}</TableCell>
                    <TableCell className="text-right font-bold text-destructive">{fmt(serverTotals.cost)}</TableCell>
                    <TableCell className={`text-right font-bold ${serverTotals.profit >= 0 ? "text-success" : "text-destructive"}`}>
                      {fmt(serverTotals.profit)}
                    </TableCell>
                    <TableCell className="text-right font-bold">{fmt(serverTotals.profitPerDay)}</TableCell>
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
