import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Coins } from "lucide-react";

export default function ResellerCredits() {
  const { reseller } = useAuth();
  const [transactions, setTransactions] = useState<any[]>([]);

  useEffect(() => {
    if (!reseller) return;
    supabase
      .from("reseller_credit_transactions")
      .select("*")
      .eq("reseller_id", reseller.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setTransactions(data); });
  }, [reseller]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Meus Créditos</h1>
        <p className="text-muted-foreground text-sm mt-1">Histórico de transações de créditos</p>
      </div>

      <Card>
        <CardContent className="flex items-center gap-4 p-6">
          <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
            <Coins className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Saldo Atual</p>
            <p className="text-3xl font-bold font-mono text-primary">{reseller?.credit_balance ?? 0}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Quantidade</TableHead>
                <TableHead>Descrição</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhuma transação</TableCell></TableRow>
              ) : (
                transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(tx.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <Badge variant={tx.amount > 0 ? "default" : "destructive"}>
                        {tx.amount > 0 ? "Crédito" : "Uso"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono font-medium">
                      {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{tx.description || "—"}</TableCell>
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
