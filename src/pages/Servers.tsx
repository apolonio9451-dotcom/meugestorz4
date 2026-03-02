import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Server, Trash2 } from "lucide-react";

interface ServerItem {
  id: string;
  name: string;
  cost_per_credit: number;
  created_at: string;
}

export default function Servers() {
  const { companyId } = useAuth();
  const [servers, setServers] = useState<ServerItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchServers = async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from("servers")
      .select("*")
      .eq("company_id", companyId)
      .order("name");
    setServers(data || []);
  };

  useEffect(() => { fetchServers(); }, [companyId]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!companyId) return;
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const name = (form.get("name") as string).trim();
    const costPerCredit = form.get("cost_per_credit") as string;
    if (!name) { toast.error("Nome é obrigatório"); setLoading(false); return; }

    const { error } = await supabase.from("servers").insert({ name, company_id: companyId, cost_per_credit: parseFloat(costPerCredit) || 0 });
    if (error) { toast.error(error.message); } else { toast.success("Servidor adicionado!"); setDialogOpen(false); fetchServers(); }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este servidor?")) return;
    const { error } = await supabase.from("servers").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Servidor excluído!"); fetchServers(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Servidores</h1>
          <p className="text-muted-foreground text-sm mt-1">{servers.length} servidores cadastrados</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Adicionar Servidor</Button>
          </DialogTrigger>
          <DialogContent aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>Novo Servidor</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nome do Servidor *</Label>
                <Input name="name" required placeholder="Ex: Servidor 1" />
              </div>
              <div className="space-y-1.5">
                <Label>Custo por Crédito (R$) *</Label>
                <Input name="cost_per_credit" required placeholder="0.00" type="number" step="0.01" />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Salvando..." : "Salvar"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {servers.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">Nenhum servidor cadastrado</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {servers.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-4">
              <div className="flex flex-col">
                <span className="font-semibold text-foreground">{s.name}</span>
                <span className="text-xs text-muted-foreground">R$ {Number(s.cost_per_credit).toFixed(2).replace(".", ",")} / crédito</span>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(s.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
