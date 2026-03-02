import { useState, useEffect } from "react";
import { useReseller } from "@/hooks/useReseller";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Users, Coins, TrendingUp, FileText } from "lucide-react";

export default function ResellerDashboard() {
  const { reseller } = useReseller();
  const [clientCount, setClientCount] = useState(0);
  const [activeSubCount, setActiveSubCount] = useState(0);
  const [recentClients, setRecentClients] = useState<any[]>([]);

  useEffect(() => {
    if (!reseller) return;

    const fetchStats = async () => {
      const { count } = await supabase
        .from("clients")
        .select("*", { count: "exact", head: true })
        .eq("reseller_id", reseller.id);
      setClientCount(count || 0);

      const { data: clients } = await supabase
        .from("clients")
        .select("id, name, status, created_at")
        .eq("reseller_id", reseller.id)
        .order("created_at", { ascending: false })
        .limit(5);
      if (clients) setRecentClients(clients);

      const today = new Date().toISOString().split("T")[0];
      const { count: subCount } = await supabase
        .from("client_subscriptions")
        .select("*", { count: "exact", head: true })
        .gte("end_date", today);
      setActiveSubCount(subCount || 0);
    };

    fetchStats();
  }, [reseller]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Bem-vindo, {reseller?.name}!</h1>
        <p className="text-muted-foreground text-sm mt-1">Resumo do seu painel de revenda</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
            <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Clientes</p>
              <p className="text-xl font-bold text-foreground">{clientCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Assinaturas Ativas</p>
              <p className="text-xl font-bold text-foreground">{activeSubCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <Badge variant={reseller?.status === "active" ? "default" : "secondary"}>
                {reseller?.status === "active" ? "Ativo" : "Inativo"}
              </Badge>
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
                recentClients.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium text-foreground">{c.name}</TableCell>
                    <TableCell>
                      <Badge variant={c.status === "active" ? "default" : "secondary"}>
                        {c.status === "active" ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(c.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
