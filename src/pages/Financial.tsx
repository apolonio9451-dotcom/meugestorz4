import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DollarSign, TrendingUp, Clock, Users, AlertCircle, ArrowUpRight, ArrowDownRight, CalendarIcon } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

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

  // Date range filter - default: current month
  const [dateFrom, setDateFrom] = useState<Date>(startOfMonth(new Date()));
  const [dateTo, setDateTo] = useState<Date>(endOfMonth(new Date()));

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
  const fromStr = format(dateFrom, "yyyy-MM-dd");
  const toStr = format(dateTo, "yyyy-MM-dd");

  // Filtered subs within the selected date range (by start_date)
  const filteredSubs = useMemo(() => {
    return subs.filter((s) => s.start_date >= fromStr && s.start_date <= toStr);
  }, [subs, fromStr, toStr]);

  const metrics = useMemo(() => {
    const receivedToday = subs
      .filter((s) => s.payment_status === "paid" && s.start_date === today)
      .reduce((sum, s) => sum + Number(s.amount), 0);

    const forecastToday = subs
      .filter((s) => s.payment_status === "pending" && s.end_date === today)
      .reduce((sum, s) => sum + Number(s.amount), 0);

    const totalReceived = filteredSubs
      .filter((s) => s.payment_status === "paid")
      .reduce((sum, s) => sum + Number(s.amount), 0);

    const openInvoices = subs
      .filter((s) => s.payment_status === "pending" || s.payment_status === "overdue")
      .reduce((sum, s) => sum + Number(s.amount), 0);

    const monthlyRevenue = filteredSubs
      .filter((s) => s.payment_status !== "cancelled")
      .reduce((sum, s) => sum + Number(s.amount), 0);

    // Calculate costs: for each server, count unique clients in filtered subs × cost_per_credit
    const serverCostMap = new Map<string, number>();
    servers.forEach((srv) => serverCostMap.set(srv.name, Number(srv.cost_per_credit)));

    const clientsByServer = new Map<string, Set<string>>();
    filteredSubs
      .filter((s) => s.payment_status !== "cancelled")
      .forEach((s) => {
        const serverName = s.clients?.server || "";
        if (!clientsByServer.has(serverName)) clientsByServer.set(serverName, new Set());
        if (s.clients?.name) clientsByServer.get(serverName)!.add(s.clients.name);
      });

    let totalCosts = 0;
    clientsByServer.forEach((clients, serverName) => {
      const cost = serverCostMap.get(serverName) || 0;
      totalCosts += cost * clients.size;
    });

    const monthlyProfit = monthlyRevenue - totalCosts;

    return { receivedToday, forecastToday, totalReceived, openInvoices, monthlyRevenue, monthlyProfit };
  }, [subs, filteredSubs, servers, today]);

  // Chart: generate bars for each month in the range
  const chartData = useMemo(() => {
    const months = eachMonthOfInterval({ start: dateFrom, end: dateTo });
    return months.map((m) => {
      const label = format(m, "MMM yy", { locale: ptBR });
      const mMonth = m.getMonth();
      const mYear = m.getFullYear();
      const total = subs
        .filter((s) => {
          const sd = new Date(s.start_date);
          return s.payment_status !== "cancelled" && sd.getMonth() === mMonth && sd.getFullYear() === mYear;
        })
        .reduce((sum, s) => sum + Number(s.amount), 0);
      return { label, total };
    });
  }, [subs, dateFrom, dateTo]);

  // Entradas e Saídas chart - last 3 months
  const entradasSaidasData = useMemo(() => {
    const now = new Date();
    const last3 = Array.from({ length: 3 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (2 - i), 1);
      return d;
    });

    // Build a map of server name -> cost_per_credit
    const serverCostMap = new Map<string, number>();
    servers.forEach((srv) => serverCostMap.set(srv.name, Number(srv.cost_per_credit)));

    return last3.map((m) => {
      const mMonth = m.getMonth();
      const mYear = m.getFullYear();
      const isCurrentMonth = mMonth === now.getMonth() && mYear === now.getFullYear();
      const label = format(m, "MMM", { locale: ptBR });
      const capitalLabel = label.charAt(0).toUpperCase() + label.slice(1);

      const monthSubs = subs.filter((s) => {
        const sd = new Date(s.start_date);
        return s.payment_status !== "cancelled" && sd.getMonth() === mMonth && sd.getFullYear() === mYear;
      });

      const entradas = monthSubs.reduce((sum, s) => sum + Number(s.amount), 0);

      // Saídas: para cada servidor, conta clientes únicos no mês × custo por crédito daquele servidor
      const clientsByServer = new Map<string, Set<string>>();
      monthSubs.forEach((s) => {
        const serverName = s.clients?.server || "";
        if (!clientsByServer.has(serverName)) clientsByServer.set(serverName, new Set());
        if (s.clients?.name) clientsByServer.get(serverName)!.add(s.clients.name);
      });

      let saidas = 0;
      clientsByServer.forEach((clients, serverName) => {
        const cost = serverCostMap.get(serverName) || 0;
        saidas += cost * clients.size;
      });

      return { label: capitalLabel, entradas, saidas, isCurrent: isCurrentMonth };
    });
  }, [subs, servers]);

  const totalEntradas = entradasSaidasData.reduce((sum, d) => sum + d.entradas, 0);
  const totalSaidas = entradasSaidasData.reduce((sum, d) => sum + d.saidas, 0);

  const serverProfits = useMemo(() => {
    return servers.map((srv) => {
      const serverSubs = filteredSubs.filter(
        (s) => s.clients?.server === srv.name && s.payment_status !== "cancelled"
      );
      const clientCount = new Set(serverSubs.map((s) => s.clients?.name)).size;
      const revenue = serverSubs.reduce((sum, s) => sum + Number(s.amount), 0);
      const creditUnit = Number(srv.cost_per_credit);
      const cost = creditUnit * clientCount;
      const profit = revenue - cost;
      return { name: srv.name, credit: creditUnit, clients: clientCount, revenue, cost, profit };
    });
  }, [filteredSubs, servers]);

  const serverTotals = useMemo(() => {
    return serverProfits.reduce(
      (acc, sp) => ({
        clients: acc.clients + sp.clients,
        revenue: acc.revenue + sp.revenue,
        cost: acc.cost + sp.cost,
        profit: acc.profit + sp.profit,
      }),
      { clients: 0, revenue: 0, cost: 0, profit: 0 }
    );
  }, [serverProfits]);

  const fmt = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const metricCards = [
    { title: "Recebido Hoje", value: metrics.receivedToday, icon: DollarSign, trend: "up" as const },
    { title: "Previsão do Dia", value: metrics.forecastToday, icon: Clock, trend: "neutral" as const },
    { title: "Receita no Período", value: metrics.monthlyRevenue, icon: TrendingUp, trend: "up" as const },
    { title: "Faturas em Aberto", value: metrics.openInvoices, icon: AlertCircle, trend: "down" as const },
    { title: "Lucro no Período", value: metrics.monthlyProfit, icon: TrendingUp, trend: metrics.monthlyProfit >= 0 ? "up" as const : "down" as const },
    { title: "Total de Clientes", value: totalClients, icon: Users, trend: "neutral" as const, isCurrency: false },
  ];

  // Quick filters
  const setQuickFilter = (months: number) => {
    const now = new Date();
    setDateTo(endOfMonth(now));
    setDateFrom(startOfMonth(new Date(now.getFullYear(), now.getMonth() - (months - 1), 1)));
  };

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
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Financeiro</h1>
          <p className="text-muted-foreground text-sm mt-1">Visão geral das suas finanças</p>
        </div>

        {/* Date range filter */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick buttons */}
          <div className="flex gap-1">
            {[
              { label: "1M", months: 1 },
              { label: "3M", months: 3 },
              { label: "6M", months: 6 },
              { label: "12M", months: 12 },
            ].map((q) => (
              <Button
                key={q.label}
                variant="outline"
                size="sm"
                className="h-8 px-2.5 text-xs"
                onClick={() => setQuickFilter(q.months)}
              >
                {q.label}
              </Button>
            ))}
          </div>

          {/* From date */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <CalendarIcon className="w-3.5 h-3.5" />
                {format(dateFrom, "dd/MM/yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={dateFrom}
                onSelect={(d) => d && setDateFrom(startOfDay(d))}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>

          <span className="text-xs text-muted-foreground">até</span>

          {/* To date */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <CalendarIcon className="w-3.5 h-3.5" />
                {format(dateTo, "dd/MM/yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={dateTo}
                onSelect={(d) => d && setDateTo(endOfDay(d))}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
                locale={ptBR}
              />
            </PopoverContent>
          </Popover>
        </div>
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
          <CardTitle className="text-sm font-medium text-foreground">
            Faturamento — {format(dateFrom, "MMM yyyy", { locale: ptBR })} a {format(dateTo, "MMM yyyy", { locale: ptBR })}
          </CardTitle>
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

      {/* Entradas e Saídas */}
      <Card className="glass-card border-border/30">
        <CardHeader className="pb-1">
          <CardTitle className="text-sm font-medium text-foreground">
            Entradas e Saídas
          </CardTitle>
          <p className="text-xs text-muted-foreground">Últimos 3 meses</p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {/* Mini bar chart */}
            <div className="flex items-end gap-3 h-[140px] pt-4">
              {entradasSaidasData.map((d, i) => {
                const maxVal = Math.max(
                  ...entradasSaidasData.map((x) => Math.max(x.entradas, x.saidas)),
                  1
                );
                const entH = Math.max((d.entradas / maxVal) * 100, 6);
                const saiH = Math.max((d.saidas / maxVal) * 100, 6);
                return (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div className="flex items-end gap-1">
                      <div
                        className="w-6 rounded-t-md transition-all"
                        style={{
                          height: `${entH}px`,
                          backgroundColor: d.isCurrent
                            ? "hsl(var(--primary))"
                            : "hsl(var(--primary) / 0.35)",
                        }}
                      />
                      <div
                        className="w-6 rounded-t-md transition-all"
                        style={{
                          height: `${saiH}px`,
                          backgroundColor: d.isCurrent
                            ? "hsl(var(--muted-foreground))"
                            : "hsl(var(--muted-foreground) / 0.3)",
                        }}
                      />
                    </div>
                    <span className={cn("text-xs", d.isCurrent ? "font-bold text-foreground" : "text-muted-foreground")}>
                      {d.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Summary */}
            <div className="flex flex-col gap-4 flex-1">
              <div>
                <p className="text-xs text-muted-foreground">Entradas</p>
                <p className="text-xl font-display font-bold text-success">
                  + {fmt(totalEntradas)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Saídas</p>
                <p className="text-xl font-display font-bold text-destructive">
                  - {fmt(totalSaidas)}
                </p>
              </div>
            </div>
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
