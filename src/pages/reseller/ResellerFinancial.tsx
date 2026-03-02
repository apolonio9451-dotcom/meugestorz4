import { useState, useEffect } from "react";
import { useReseller } from "@/hooks/useReseller";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Download, DollarSign, TrendingUp } from "lucide-react";

export default function ResellerFinancial() {
  const { reseller } = useReseller();
  const [subs, setSubs] = useState<any[]>([]);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);

  useEffect(() => {
    if (!reseller) return;
    const fetchSubs = async () => {
      const { data: clientIds } = await supabase
        .from("clients")
        .select("id, name")
        .eq("reseller_id", reseller.id);
      if (!clientIds || clientIds.length === 0) return;

      const ids = clientIds.map((c) => c.id);
      const { data } = await supabase
        .from("client_subscriptions")
        .select("*")
        .in("client_id", ids)
        .gte("start_date", startDate)
        .lte("start_date", endDate)
        .order("start_date", { ascending: false });

      if (data) {
        const mapped = data.map((s) => ({
          ...s,
          client_name: clientIds.find((c) => c.id === s.client_id)?.name || "—",
        }));
        setSubs(mapped);
      }
    };
    fetchSubs();
  }, [reseller, startDate, endDate]);

  const totalRevenue = subs.reduce((acc, s) => acc + Number(s.amount || 0), 0);
  const paidCount = subs.filter((s) => s.payment_status === "paid").length;

  const exportCSV = () => {
    const header = "Cliente,Plano,Valor,Status,Início,Fim\n";
    const rows = subs.map((s) =>
      `"${s.client_name}","${s.plan_id}",${s.amount},"${s.payment_status}","${s.start_date}","${s.end_date}"`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `faturamento_${startDate}_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Financeiro</h1>
          <p className="text-muted-foreground text-sm mt-1">Relatório de faturamento por período</p>
        </div>
        <Button onClick={exportCSV} variant="outline" className="gap-2">
          <Download className="w-4 h-4" /> Exportar CSV
        </Button>
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <Label>De</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-auto" />
        </div>
        <div>
          <Label>Até</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-auto" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Faturamento Total</p>
              <p className="text-xl font-bold font-mono text-primary">R${totalRevenue.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-10 h-10 rounded-lg bg-chart-2/15 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-chart-2" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Assinaturas</p>
              <p className="text-xl font-bold text-foreground">{subs.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-10 h-10 rounded-lg bg-chart-4/15 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-chart-4" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pagos</p>
              <p className="text-xl font-bold text-foreground">{paidCount} / {subs.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Fim</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subs.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum registro</TableCell></TableRow>
              ) : (
                subs.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium text-foreground">{s.client_name}</TableCell>
                    <TableCell className="font-mono">R${Number(s.amount).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant={s.payment_status === "paid" ? "default" : "secondary"}>
                        {s.payment_status === "paid" ? "Pago" : "Pendente"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(s.start_date).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{new Date(s.end_date).toLocaleDateString("pt-BR")}</TableCell>
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
