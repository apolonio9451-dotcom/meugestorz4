import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";

interface Subscription {
  id: string;
  client_id: string;
  plan_id: string;
  start_date: string;
  end_date: string;
  payment_status: string;
  amount: number;
  clients: { name: string } | null;
  subscription_plans: { name: string } | null;
}

interface Client { id: string; name: string; }
interface Plan { id: string; name: string; price: number; duration_days: number; }

export default function Subscriptions() {
  const { effectiveCompanyId: companyId } = useAuth();
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>("");

  const fetchAll = async () => {
    if (!companyId) return;
    const [subsRes, clientsRes, plansRes] = await Promise.all([
      supabase.from("client_subscriptions").select("*, clients(name), subscription_plans(name)").eq("company_id", companyId).order("created_at", { ascending: false }),
      supabase.from("clients").select("id, name").eq("company_id", companyId).eq("status", "active"),
      supabase.from("subscription_plans").select("id, name, price, duration_days").eq("company_id", companyId).eq("is_active", true),
    ]);
    setSubs(subsRes.data || []);
    setClients(clientsRes.data || []);
    setPlans(plansRes.data || []);
  };

  useEffect(() => { fetchAll(); }, [companyId]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!companyId) return;
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const planId = form.get("plan_id") as string;
    const plan = plans.find((p) => p.id === planId);
    const startDate = form.get("start_date") as string;
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + (plan?.duration_days || 30));

    const payload = {
      client_id: form.get("client_id") as string,
      plan_id: planId,
      start_date: startDate,
      end_date: endDate.toISOString().split("T")[0],
      payment_status: form.get("payment_status") as string,
      amount: plan?.price || 0,
      company_id: companyId,
    };

    if (editing) {
      const { error } = await supabase.from("client_subscriptions").update(payload).eq("id", editing.id);
      if (error) toast.error(error.message); else toast.success("Assinatura atualizada!");
    } else {
      const { error } = await supabase.from("client_subscriptions").insert(payload);
      if (error) toast.error(error.message); else toast.success("Assinatura criada!");
    }
    setLoading(false);
    setDialogOpen(false);
    setEditing(null);
    fetchAll();
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      paid: "bg-success/10 text-success",
      pending: "bg-warning/10 text-warning",
      overdue: "bg-destructive/10 text-destructive",
      cancelled: "bg-muted text-muted-foreground",
    };
    const labels: Record<string, string> = { paid: "Pago", pending: "Pendente", overdue: "Vencido", cancelled: "Cancelado" };
    return <Badge variant="outline" className={map[status] || ""}>{labels[status] || status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Assinaturas</h1>
          <p className="text-muted-foreground text-sm">{subs.length} assinaturas</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Nova Assinatura</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Assinatura" : "Nova Assinatura"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Select name="client_id" defaultValue={editing?.client_id || ""}>
                  <SelectTrigger><SelectValue placeholder="Selecione um cliente" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Plano</Label>
                <Select name="plan_id" defaultValue={editing?.plan_id || ""} onValueChange={setSelectedPlan}>
                  <SelectTrigger><SelectValue placeholder="Selecione um plano" /></SelectTrigger>
                  <SelectContent>
                    {plans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} - R$ {Number(p.price).toFixed(2)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data de Início</Label>
                <Input name="start_date" type="date" required defaultValue={editing?.start_date || new Date().toISOString().split("T")[0]} />
              </div>
              <div className="space-y-2">
                <Label>Status do Pagamento</Label>
                <Select name="payment_status" defaultValue={editing?.payment_status || "pending"}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="paid">Pago</SelectItem>
                    <SelectItem value="overdue">Vencido</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Salvando..." : "Salvar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead className="hidden md:table-cell">Início</TableHead>
                <TableHead className="hidden md:table-cell">Fim</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[60px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subs.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma assinatura</TableCell></TableRow>
              ) : (
                subs.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium">{sub.clients?.name || "-"}</TableCell>
                    <TableCell>{sub.subscription_plans?.name || "-"}</TableCell>
                    <TableCell className="hidden md:table-cell">{new Date(sub.start_date).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="hidden md:table-cell">{new Date(sub.end_date).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>R$ {Number(sub.amount).toFixed(2)}</TableCell>
                    <TableCell>{statusBadge(sub.payment_status)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(sub); setDialogOpen(true); }}>
                        <Pencil className="w-4 h-4" />
                      </Button>
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
