import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, UserX, DollarSign } from "lucide-react";

interface Stats {
  totalClients: number;
  activeClients: number;
  inactiveClients: number;
  totalRevenue: number;
  paidSubscriptions: number;
  overdueSubscriptions: number;
}

export default function Dashboard() {
  const { companyId } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalClients: 0,
    activeClients: 0,
    inactiveClients: 0,
    totalRevenue: 0,
    paidSubscriptions: 0,
    overdueSubscriptions: 0,
  });

  useEffect(() => {
    if (!companyId) return;

    const fetchStats = async () => {
      const [clientsRes, subsRes] = await Promise.all([
        supabase.from("clients").select("id, status").eq("company_id", companyId),
        supabase.from("client_subscriptions").select("id, payment_status, amount").eq("company_id", companyId),
      ]);

      const clients = clientsRes.data || [];
      const subs = subsRes.data || [];

      setStats({
        totalClients: clients.length,
        activeClients: clients.filter((c) => c.status === "active").length,
        inactiveClients: clients.filter((c) => c.status !== "active").length,
        totalRevenue: subs.filter((s) => s.payment_status === "paid").reduce((sum, s) => sum + Number(s.amount), 0),
        paidSubscriptions: subs.filter((s) => s.payment_status === "paid").length,
        overdueSubscriptions: subs.filter((s) => s.payment_status === "overdue").length,
      });
    };

    fetchStats();
  }, [companyId]);

  const cards = [
    { title: "Total de Clientes", value: stats.totalClients, icon: Users, color: "text-primary" },
    { title: "Clientes Ativos", value: stats.activeClients, icon: UserCheck, color: "text-success" },
    { title: "Clientes Inativos", value: stats.inactiveClients, icon: UserX, color: "text-destructive" },
    {
      title: "Receita Total",
      value: `R$ ${stats.totalRevenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: "text-accent",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Visão Geral</h1>
        <p className="text-muted-foreground text-sm mt-1">Acompanhe as métricas da sua empresa</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold font-display text-foreground">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assinaturas Pagas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-display text-success">{stats.paidSubscriptions}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assinaturas Vencidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold font-display text-destructive">{stats.overdueSubscriptions}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
