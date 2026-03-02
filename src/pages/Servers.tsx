import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Plus, Server, Trash2, MoreVertical, Pencil, AlertTriangle } from "lucide-react";

interface ServerItem {
  id: string;
  name: string;
  url: string;
  cost_per_credit: number;
  created_at: string;
}

export default function Servers() {
  const { companyId } = useAuth();
  const [servers, setServers] = useState<ServerItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ServerItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [blockDeleteModal, setBlockDeleteModal] = useState(false);
  const [blockDeleteName, setBlockDeleteName] = useState("");
  const [blockDeleteCount, setBlockDeleteCount] = useState(0);

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

  const openEdit = (s: ServerItem) => {
    setEditing(s);
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!companyId) return;
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const name = (form.get("name") as string).trim();
    const url = (form.get("url") as string).trim();
    const costPerCredit = form.get("cost_per_credit") as string;
    if (!name) { toast.error("Nome é obrigatório"); setLoading(false); return; }

    if (editing) {
      const { error } = await supabase.from("servers").update({ name, url, cost_per_credit: parseFloat(costPerCredit) || 0 }).eq("id", editing.id);
      if (error) { toast.error(error.message); } else { toast.success("Servidor atualizado!"); setDialogOpen(false); setEditing(null); fetchServers(); }
    } else {
      const { error } = await supabase.from("servers").insert({ name, url, company_id: companyId, cost_per_credit: parseFloat(costPerCredit) || 0 });
      if (error) { toast.error(error.message); } else { toast.success("Servidor adicionado!"); setDialogOpen(false); fetchServers(); }
    }
    setLoading(false);
  };

  const handleDelete = async (s: ServerItem) => {
    if (!companyId) return;
    // Check if any client is linked to this server
    const { count } = await supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("server", s.name);

    if (count && count > 0) {
      setBlockDeleteName(s.name);
      setBlockDeleteCount(count);
      setBlockDeleteModal(true);
      return;
    }

    if (!confirm("Tem certeza que deseja excluir este servidor?")) return;
    const { error } = await supabase.from("servers").delete().eq("id", s.id);
    if (error) toast.error(error.message); else { toast.success("Servidor excluído!"); fetchServers(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Servidores</h1>
          <p className="text-muted-foreground text-sm mt-1">{servers.length} servidores cadastrados</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" /> Adicionar Servidor</Button>
          </DialogTrigger>
          <DialogContent aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Servidor" : "Novo Servidor"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input name="name" required placeholder="Servidor Premium" defaultValue={editing?.name || ""} key={editing?.id || "new"} />
              </div>
              <div className="space-y-1.5">
                <Label>URL</Label>
                <Input name="url" placeholder="http://servidor.tv" defaultValue={editing?.url || ""} key={(editing?.id || "new") + "-url"} />
              </div>
              <div className="space-y-1.5">
                <Label>Valor do Crédito (R$) *</Label>
                <Input name="cost_per_credit" required placeholder="2.00" type="number" step="0.01" defaultValue={editing?.cost_per_credit ?? ""} key={(editing?.id || "new") + "-cost"} />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Salvando..." : editing ? "Salvar Alterações" : "Criar Servidor"}
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
            <div
              key={s.id}
              className="flex items-center justify-between rounded-xl border border-primary/20 bg-card p-4 shadow-[0_0_12px_-3px_hsl(var(--primary)/0.2)] hover:shadow-[0_0_20px_-3px_hsl(var(--primary)/0.35)] transition-all duration-300 cursor-pointer"
              onClick={() => { if (s.url) window.open(s.url.startsWith("http") ? s.url : `http://${s.url}`, "_blank"); }}
            >
              <div className="flex flex-col">
                <span className="font-semibold text-foreground">{s.name}</span>
                {s.url && <span className="text-[11px] text-primary/70 truncate max-w-[180px] underline underline-offset-2">{s.url}</span>}
                <span className="text-xs text-muted-foreground">R$ {Number(s.cost_per_credit).toFixed(2).replace(".", ",")} / crédito</span>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEdit(s); }}>
                    <Pencil className="w-3.5 h-3.5 mr-2" /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); handleDelete(s); }}>
                    <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      )}

      {/* Block delete modal */}
      <Dialog open={blockDeleteModal} onOpenChange={setBlockDeleteModal}>
        <DialogContent aria-describedby={undefined} className="border-warning/30 shadow-[0_0_30px_-5px_hsl(var(--warning)/0.2)]">
          <DialogHeader>
            <div className="mx-auto w-12 h-12 rounded-full bg-warning/15 border border-warning/30 flex items-center justify-center mb-3">
              <AlertTriangle className="w-6 h-6 text-warning" />
            </div>
            <DialogTitle className="text-center text-lg text-warning">
              Exclusão Bloqueada
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-center">
            <p className="text-sm text-muted-foreground">
              O servidor <strong className="text-foreground">{blockDeleteName}</strong> não pode ser excluído porque possui{" "}
              <strong className="text-warning">{blockDeleteCount} cliente{blockDeleteCount !== 1 ? "s" : ""}</strong> vinculado{blockDeleteCount !== 1 ? "s" : ""}.
            </p>
            <p className="text-xs text-muted-foreground/70">
              Remova ou migre os clientes para outro servidor antes de excluir.
            </p>
          </div>
          <Button
            variant="outline"
            className="w-full mt-2 border-warning/30 text-warning hover:bg-warning/10"
            onClick={() => setBlockDeleteModal(false)}
          >
            Entendi
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
