import { useState, useEffect } from "react";
import { useReseller } from "@/hooks/useReseller";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Users, Coins, TrendingUp, FileText, AlertTriangle, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function ResellerDashboard() {
  const { reseller } = useReseller();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ active: 0, expired: 0, blocked: 0, test: 0, revenue: 0 });
  const [recentClients, setRecentClients] = useState<any[]>([]);

  useEffect(() => {
    if (!reseller) return;

    const fetchStats = async () => {
      const { data: clients } = await supabase
        .from("clients")
        .select("id, name, status, created_at, client_subscriptions(end_date, amount)")
        .eq("reseller_id", reseller.id)
        .order("created_at", { ascending: false });

      if (!clients) return;

      const today = new Date().toISOString().split("T")[0];
      let active = 0, expired = 0, blocked = 0, test = 0, revenue = 0;

      clients.forEach((c: any) => {
        if (c.status === "blocked") { blocked++; return; }
        if (c.status === "test") { test++; return; }
        const subs = c.client_subscriptions || [];
        const hasActive = subs.some((s: any) => s.end_date >= today);
        if (hasActive) {
          active++;
          subs.forEach((s: any) => { if (s.end_date >= today) revenue += Number(s.amount || 0); });
        } else if (subs.length > 0) {
          expired++;
        }
      });

      setStats({ active, expired, blocked, test, revenue });
      setRecentClients(clients.slice(0, 5));
    };

    fetchStats();
  }, [reseller]);

  const getClientStatus = (c: any) => {
    if (c.status === "blocked") return "bloqueado";
    if (c.status === "test") return "teste";
    const today = new Date().toISOString().split("T")[0];
    const subs = c.client_subscriptions || [];
    return subs.some((s: any) => s.end_date >= today) ? "ativo" : "vencido";
  };

  const statusVariant = (s: string) => {
    switch (s) {
      case "ativo": return "default";
      case "vencido": return "destructive";
      case "bloqueado": return "secondary";
      case "teste": return "outline";
      default: return "secondary";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Bem-vindo, {reseller?.name}!</h1>
          <p className="text-muted-foreground text-sm mt-1">Resumo do seu painel de revenda</p>
        </div>
        <Button onClick={() => navigate("/reseller/clients")} className="gap-2">
          <UserPlus className="w-4 h-4" /> Criar Cliente
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
              <Coins className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Créditos</p>
              <p className="text-xl font-bold font-mono text-primary">{reseller?.credit_balance ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-10 h-10 rounded-lg bg-chart-2/15 flex items-center justify-center">
              <Users className="w-5 h-5 text-chart-2" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ativos</p>
              <p className="text-xl font-bold text-foreground">{stats.active}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-10 h-10 rounded-lg bg-destructive/15 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Vencidos</p>
              <p className="text-xl font-bold text-foreground">{stats.expired}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Teste / Bloq.</p>
              <p className="text-xl font-bold text-foreground">{stats.test + stats.blocked}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-10 h-10 rounded-lg bg-chart-4/15 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-chart-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Receita Est.</p>
              <p className="text-xl font-bold text-foreground">R${stats.revenue.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b border-border">
            <h3 className="font-medium text-foreground">Clientes Recentes</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentClients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                    Nenhum cliente ainda
                  </TableCell>
                </TableRow>
              ) : (
                recentClients.map((c) => {
                  const st = getClientStatus(c);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium text-foreground">{c.name}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(st)}>{st}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(c.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
