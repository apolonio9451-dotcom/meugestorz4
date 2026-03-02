import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Package } from "lucide-react";

interface SaasPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  max_clients: number;
  max_resellers: number;
  allow_sub_resellers: boolean;
  duration_days: number;
  is_active: boolean;
}

export default function MasterSaasPlans() {
  const { companyId } = useAuth();
  const { toast } = useToast();
  const [plans, setPlans] = useState<SaasPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SaasPlan | null>(null);
  const [form, setForm] = useState({
    name: "", description: "", price: "", max_clients: "50", max_resellers: "0",
    allow_sub_resellers: false, duration_days: "30", is_active: true,
  });

  const fetchPlans = async () => {
    const { data, error } = await supabase.from("saas_plans").select("*").order("price", { ascending: true });
    if (error) toast({ title: "Erro ao carregar planos", description: error.message, variant: "destructive" });
    if (data) setPlans(data as SaasPlan[]);
    setLoading(false);
  };

  useEffect(() => { fetchPlans(); }, []);

  const resetForm = () => {
    setForm({ name: "", description: "", price: "", max_clients: "50", max_resellers: "0", allow_sub_resellers: false, duration_days: "30", is_active: true });
    setEditing(null);
  };

  const openCreate = () => { resetForm(); setShowForm(true); };
  const openEdit = (p: SaasPlan) => {
    setEditing(p);
    setForm({
      name: p.name, description: p.description || "", price: String(p.price), max_clients: String(p.max_clients),
      max_resellers: String(p.max_resellers), allow_sub_resellers: p.allow_sub_resellers, duration_days: String(p.duration_days), is_active: p.is_active,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast({ title: "Preencha o nome do plano", variant: "destructive" }); return; }
    const payload = {
      name: form.name, description: form.description, price: parseFloat(form.price) || 0,
      max_clients: parseInt(form.max_clients) || 50, max_resellers: parseInt(form.max_resellers) || 0,
      allow_sub_resellers: form.allow_sub_resellers, duration_days: parseInt(form.duration_days) || 30, is_active: form.is_active,
    };
    if (editing) {
      const { error } = await supabase.from("saas_plans").update(payload).eq("id", editing.id);
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else toast({ title: "Plano atualizado!" });
    } else {
      const { error } = await supabase.from("saas_plans").insert(payload);
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else toast({ title: "Plano criado!" });
    }
    setShowForm(false);
    resetForm();
    fetchPlans();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este plano?")) return;
    const { error } = await supabase.from("saas_plans").delete().eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Plano excluído" }); fetchPlans(); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Planos SaaS</h2>
        <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> Novo Plano</Button>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-center py-8">Carregando...</p>
      ) : plans.length === 0 ? (
        <Card><CardContent className="text-center py-12 text-muted-foreground">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Nenhum plano SaaS criado ainda</p>
          <p className="text-xs mt-1">Crie planos para vender acesso ao sistema</p>
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((p) => (
            <Card key={p.id} className={!p.is_active ? "opacity-50" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{p.name}</CardTitle>
                    {p.description && <p className="text-xs text-muted-foreground mt-1">{p.description}</p>}
                  </div>
                  <Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? "Ativo" : "Inativo"}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-2xl font-bold text-primary">
                  R$ {p.price.toFixed(2)}<span className="text-xs font-normal text-muted-foreground">/{p.duration_days} dias</span>
                </p>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>• Até <span className="text-foreground font-medium">{p.max_clients}</span> clientes</p>
                  <p>• Até <span className="text-foreground font-medium">{p.max_resellers}</span> revendedores</p>
                  {p.allow_sub_resellers && <p>• <span className="text-primary">Sub-revendedores permitidos</span></p>}
                </div>
                <div className="flex gap-1 pt-2">
                  <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => openEdit(p)}><Pencil className="w-3 h-3" /> Editar</Button>
                  <Button size="sm" variant="outline" className="text-destructive hover:text-destructive gap-1" onClick={() => handleDelete(p.id)}><Trash2 className="w-3 h-3" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editar Plano" : "Novo Plano SaaS"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Plano Pro" /></div>
            <div><Label>Descrição</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Preço (R$)</Label><Input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
              <div><Label>Duração (dias)</Label><Input type="number" value={form.duration_days} onChange={(e) => setForm({ ...form, duration_days: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Máx. Clientes</Label><Input type="number" value={form.max_clients} onChange={(e) => setForm({ ...form, max_clients: e.target.value })} /></div>
              <div><Label>Máx. Revendedores</Label><Input type="number" value={form.max_resellers} onChange={(e) => setForm({ ...form, max_resellers: e.target.value })} /></div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Permitir sub-revendedores</Label>
              <Switch checked={form.allow_sub_resellers} onCheckedChange={(v) => setForm({ ...form, allow_sub_resellers: v })} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Plano ativo</Label>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editing ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
