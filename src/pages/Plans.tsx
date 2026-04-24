import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Coins } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  price: number;
  duration_days: number;
  description: string;
  is_active: boolean;
  credit_cost: number;
}

export default function Plans() {
  const { effectiveCompanyId: companyId } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchPlans = async () => {
    if (!companyId) return;
    const { data } = await supabase.from("subscription_plans").select("*").eq("company_id", companyId).order("created_at", { ascending: false });
    setPlans((data || []).map(p => ({ ...p, credit_cost: p.credit_cost || 0 })) as Plan[]);
  };

  useEffect(() => { fetchPlans(); }, [companyId]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!companyId) return;
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const payload = {
      name: form.get("name") as string,
      price: parseFloat(form.get("price") as string),
      duration_days: parseInt(form.get("duration_days") as string),
      credit_cost: parseInt(form.get("credit_cost") as string) || 0,
      description: form.get("description") as string,
      is_active: true,
      company_id: companyId,
    };

    if (editing) {
      const { error } = await supabase.from("subscription_plans").update(payload).eq("id", editing.id);
      if (error) toast.error(error.message); else toast.success("Plano atualizado!");
    } else {
      const { error } = await supabase.from("subscription_plans").insert(payload);
      if (error) toast.error(error.message); else toast.success("Plano criado!");
    }
    setLoading(false);
    setDialogOpen(false);
    setEditing(null);
    fetchPlans();
  };

  const toggleActive = async (plan: Plan) => {
    const { error } = await supabase.from("subscription_plans").update({ is_active: !plan.is_active }).eq("id", plan.id);
    if (error) toast.error(error.message); else fetchPlans();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza?")) return;
    const { error } = await supabase.from("subscription_plans").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Plano excluído!"); fetchPlans(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Planos</h1>
          <p className="text-muted-foreground text-sm">{plans.length} planos cadastrados</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Novo Plano</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Plano" : "Novo Plano"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome do Plano</Label>
                <Input name="name" required defaultValue={editing?.name || ""} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Preço (R$)</Label>
                  <Input name="price" type="number" step="0.01" min="0" required defaultValue={editing?.price || ""} />
                </div>
                <div className="space-y-2">
                  <Label>Duração (dias)</Label>
                  <Input name="duration_days" type="number" min="1" required defaultValue={editing?.duration_days || 30} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Custo em Créditos (Consumo)</Label>
                <div className="relative">
                  <Coins className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input name="credit_cost" type="number" min="0" placeholder="Ex: 1" className="pl-9" defaultValue={editing?.credit_cost || 1} />
                </div>
                <p className="text-[10px] text-muted-foreground">Quantos créditos este plano consome do seu custo total.</p>
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input name="description" defaultValue={editing?.description || ""} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Salvando..." : "Salvar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="py-8 text-center text-muted-foreground">Nenhum plano cadastrado</CardContent>
          </Card>
        ) : (
          plans.map((plan) => (
            <Card key={plan.id} className={!plan.is_active ? "opacity-60" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                  </div>
                  <Badge variant={plan.is_active ? "default" : "secondary"}>
                    {plan.is_active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold font-display text-foreground">
                  R$ {Number(plan.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </div>
                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                  <span>{plan.duration_days} dias</span>
                  <span className="flex items-center gap-1"><Coins className="w-3 h-3" /> {plan.credit_cost} créd.</span>
                </div>
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
                  <Switch checked={plan.is_active} onCheckedChange={() => toggleActive(plan)} />
                  <span className="text-sm text-muted-foreground">Ativo</span>
                  <div className="ml-auto flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(plan); setDialogOpen(true); }}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(plan.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
