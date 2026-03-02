import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, History, Coins, TrendingDown, TrendingUp } from "lucide-react";

interface Transaction {
  id: string;
  reseller_id: string;
  amount: number;
  type: string;
  description: string;
  created_at: string;
}

interface Reseller {
  id: string;
  name: string;
}

export default function CreditHistory() {
  const { companyId } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterReseller, setFilterReseller] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!companyId) return;

    const fetchData = async () => {
      const [txRes, rRes] = await Promise.all([
        supabase.from("reseller_credit_transactions").select("*").eq("company_id", companyId).order("created_at", { ascending: false }),
        supabase.from("resellers").select("id, name").eq("company_id", companyId),
      ]);
      if (txRes.data) setTransactions(txRes.data);
      if (rRes.data) setResellers(rRes.data);
      setLoading(false);
    };
    fetchData();
  }, [companyId]);

  const resellerMap = Object.fromEntries(resellers.map((r) => [r.id, r.name]));

  const filtered = transactions.filter((tx) => {
    if (filterReseller !== "all" && tx.reseller_id !== filterReseller) return false;
    if (filterType === "credit" && tx.amount <= 0) return false;
    if (filterType === "debit" && tx.amount >= 0) return false;
    if (search && !(tx.description || "").toLowerCase().includes(search.toLowerCase()) && !resellerMap[tx.reseller_id]?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalAdded = transactions.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalDebited = transactions.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Histórico de Créditos</h1>
        <p className="text-muted-foreground text-sm mt-1">Auditoria completa de todas as transações de créditos</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
              <Coins className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Transações</p>
              <p className="text-xl font-bold text-foreground">{transactions.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Créditos Adicionados</p>
              <p className="text-xl font-bold text-foreground">+{totalAdded}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-10 h-10 rounded-lg bg-destructive/15 flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Créditos Debitados</p>
              <p className="text-xl font-bold text-foreground">-{totalDebited}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="w-48">
          <Select value={filterReseller} onValueChange={setFilterReseller}>
            <SelectTrigger><SelectValue placeholder="Revendedor" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {resellers.map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-40">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="credit">Créditos</SelectItem>
              <SelectItem value="debit">Débitos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Revendedor</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Quantidade</TableHead>
                <TableHead>Descrição</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma transação encontrada</TableCell></TableRow>
              ) : (
                filtered.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(tx.created_at).toLocaleDateString("pt-BR")} {new Date(tx.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">{resellerMap[tx.reseller_id] || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={tx.amount > 0 ? "default" : "destructive"} className="text-xs">
                        {tx.amount > 0 ? "Crédito" : "Débito"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono font-medium">{tx.amount > 0 ? `+${tx.amount}` : tx.amount}</TableCell>
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
