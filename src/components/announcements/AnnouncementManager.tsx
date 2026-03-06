import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Megaphone, Plus, Trash2, Loader2, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface Announcement {
  id: string;
  title: string;
  message: string;
  is_active: boolean;
  created_at: string;
}

export default function AnnouncementManager() {
  const { companyId, user } = useAuth();
  const { toast } = useToast();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", message: "" });

  useEffect(() => {
    if (companyId) fetchAnnouncements();
  }, [companyId]);

  const fetchAnnouncements = async () => {
    if (!companyId) return;
    setLoading(true);
    const { data } = await supabase
      .from("system_announcements")
      .select("id, title, message, is_active, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    setAnnouncements((data as Announcement[]) || []);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!companyId || !user || !form.title.trim() || !form.message.trim()) return;
    setSaving(true);

    if (editId) {
      const { error } = await supabase
        .from("system_announcements")
        .update({ title: form.title, message: form.message, updated_at: new Date().toISOString() })
        .eq("id", editId);
      if (error) {
        toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Aviso atualizado!" });
      }
    } else {
      const { error } = await supabase
        .from("system_announcements")
        .insert({ company_id: companyId, title: form.title, message: form.message, created_by: user.id });
      if (error) {
        toast({ title: "Erro ao criar", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Aviso criado!" });
      }
    }

    setSaving(false);
    setDialogOpen(false);
    setEditId(null);
    setForm({ title: "", message: "" });
    fetchAnnouncements();
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase
      .from("system_announcements")
      .update({ is_active: !current, updated_at: new Date().toISOString() })
      .eq("id", id);
    fetchAnnouncements();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("system_announcements").delete().eq("id", id);
    toast({ title: "Aviso removido" });
    fetchAnnouncements();
  };

  const openEdit = (a: Announcement) => {
    setEditId(a.id);
    setForm({ title: a.title, message: a.message });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditId(null);
    setForm({ title: "", message: "" });
    setDialogOpen(true);
  };

  return (
    <div className="glass-card rounded-xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-display font-semibold text-foreground flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" />
          Avisos do Sistema
        </h2>
        <Button size="sm" onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" /> Novo Aviso
        </Button>
      </div>

      <p className="text-muted-foreground text-xs">
        Avisos ativos serão exibidos para todos os usuários na primeira vez que acessarem o sistema no dia.
      </p>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : announcements.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-6">Nenhum aviso cadastrado.</p>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <div
              key={a.id}
              className={`rounded-lg border p-4 flex items-start justify-between gap-4 transition-all ${
                a.is_active
                  ? "border-primary/30 bg-primary/5"
                  : "border-border bg-secondary/30 opacity-60"
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground text-sm truncate">{a.title}</p>
                <p className="text-muted-foreground text-xs mt-1 line-clamp-2">{a.message}</p>
                <p className="text-muted-foreground text-[10px] mt-2">
                  {new Date(a.created_at).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch
                  checked={a.is_active}
                  onCheckedChange={() => toggleActive(a.id, a.is_active)}
                />
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(a)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(a.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "Editar Aviso" : "Novo Aviso"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Ex: Manutenção programada"
              />
            </div>
            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Textarea
                value={form.message}
                onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
                placeholder="Descreva o aviso que será exibido aos usuários..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.title.trim() || !form.message.trim()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              {editId ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
