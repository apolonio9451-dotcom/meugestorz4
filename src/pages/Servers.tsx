import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Plus, Trash2, MoreVertical, Pencil, AlertTriangle, Users, UserCheck, UserX } from "lucide-react";
import { differenceInCalendarDays, parseISO } from "date-fns";

interface ServerItem {
  id: string;
  name: string;
  url: string;
  cost_per_credit: number;
  created_at: string;
}

interface ServerStats {
  total: number;
  active: number;
  expired: number;
}

export default function Servers() {
  const { companyId } = useAuth();
  const [servers, setServers] = useState<ServerItem[]>([]);
  const [serverStats, setServerStats] = useState<Record<string, ServerStats>>({});
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

  const fetchServerStats = async () => {
    if (!companyId) return;
    // Get all non-excluded clients with their server
    const { data: clients } = await supabase
      .from("clients")
      .select("id, server, status")
      .eq("company_id", companyId)
      .neq("status", "excluded");

    // Get all subscriptions to determine active/expired
    const { data: subs } = await supabase
      .from("client_subscriptions")
      .select("client_id, end_date")
      .eq("company_id", companyId);

    // Build latest sub map
    const latestSub: Record<string, string> = {};
    (subs || []).forEach(s => {
      if (!latestSub[s.client_id] || s.end_date > latestSub[s.client_id]) {
        latestSub[s.client_id] = s.end_date;
      }
    });

    const stats: Record<string, ServerStats> = {};
    (clients || []).forEach(c => {
      const srv = c.server || "";
      if (!srv) return;
      if (!stats[srv]) stats[srv] = { total: 0, active: 0, expired: 0 };
      stats[srv].total++;
      const endDate = latestSub[c.id];
      if (endDate) {
        const days = differenceInCalendarDays(parseISO(endDate), new Date());
        if (days >= 0) stats[srv].active++;
        else stats[srv].expired++;
      }
    });
    setServerStats(stats);
  };

  useEffect(() => { fetchServers(); fetchServerStats(); }, [companyId]);

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
      if (error) { toast.error(error.message); } else { toast.success("Servidor atualizado!"); setDialogOpen(false); setEditing(null); fetchServers(); fetchServerStats(); }
    } else {
      const { error } = await supabase.from("servers").insert({ name, url, company_id: companyId, cost_per_credit: parseFloat(costPerCredit) || 0 });
      if (error) { toast.error(error.message); } else { toast.success("Servidor adicionado!"); setDialogOpen(false); fetchServers(); fetchServerStats(); }
    }
    setLoading(false);
  };

  const handleDelete = async (s: ServerItem) => {
    if (!companyId) return;
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
    if (error) toast.error(error.message); else { toast.success("Servidor excluído!"); fetchServers(); fetchServerStats(); }
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
          {servers.map((s) => {
            const stats = serverStats[s.name] || { total: 0, active: 0, expired: 0 };
            return (
              <div
                key={s.id}
                className="rounded-xl border border-primary/20 bg-card p-4 shadow-[0_0_12px_-3px_hsl(var(--primary)/0.2)] hover:shadow-[0_0_20px_-3px_hsl(var(--primary)/0.35)] transition-all duration-300 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div
                    className="flex flex-col cursor-pointer"
                    onClick={() => { if (s.url) window.open(s.url.startsWith("http") ? s.url : `http://${s.url}`, "_blank"); }}
                  >
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

                {/* Client stats */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/30">
                  <div className="flex flex-col items-center gap-0.5 rounded-lg bg-muted/40 py-2">
                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-sm font-bold text-foreground">{stats.total}</span>
                    <span className="text-[9px] text-muted-foreground uppercase font-medium">Total</span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5 rounded-lg bg-emerald-500/10 py-2">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-sm font-bold text-emerald-400">{stats.active}</span>
                    <span className="text-[9px] text-emerald-400/70 uppercase font-medium">Ativos</span>
                  </div>
                  <div className="flex flex-col items-center gap-0.5 rounded-lg bg-destructive/10 py-2">
                    <UserX className="w-3.5 h-3.5 text-destructive" />
                    <span className="text-sm font-bold text-destructive">{stats.expired}</span>
                    <span className="text-[9px] text-destructive/70 uppercase font-medium">Vencidos</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Block delete modal */}
      <Dialog open={blockDeleteModal} onOpenChange={setBlockDeleteModal}>
        <DialogContent aria-describedby={undefined} className="border-warning/30 shadow-[0_0_30px_-5px_hsl(var(--warning)/0.2)] rounded-2xl">
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
            className="w-full mt-2 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25"
            onClick={() => setBlockDeleteModal(false)}
          >
            Entendi
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
