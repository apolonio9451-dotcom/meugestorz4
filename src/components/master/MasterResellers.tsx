import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Plus, Coins, Search, Pencil, Trash2, History, KeyRound, Copy, Eye, EyeOff, GitBranch,
} from "lucide-react";

interface Reseller {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  credit_balance: number;
  status: string;
  notes: string;
  user_id: string | null;
  parent_reseller_id: string | null;
  level: number;
  created_at: string;
}

interface CreditTransaction {
  id: string;
  reseller_id: string;
  amount: number;
  type: string;
  description: string;
  created_at: string;
}

interface MasterResellersProps {
  onDataChange: () => void;
}

export default function MasterResellers({ onDataChange }: MasterResellersProps) {
  const { companyId } = useAuth();
  const { toast } = useToast();
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAccess, setShowAccess] = useState(false);
  const [selected, setSelected] = useState<Reseller | null>(null);
  const [accessLoading, setAccessLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({ name: "", email: "", whatsapp: "", notes: "", status: "active", parent_reseller_id: "" });
  const [creditForm, setCreditForm] = useState({ amount: "", type: "purchase", description: "" });
  const [accessForm, setAccessForm] = useState({ email: "", password: "" });

  const fetchResellers = async () => {
    if (!companyId) { setLoading(false); return; }
    const { data, error } = await supabase
      .from("resellers")
      .select("*")
      .eq("company_id", companyId)
      .order("level", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Erro ao carregar revendedores", description: error.message, variant: "destructive" });
    if (data) setResellers(data as Reseller[]);
    setLoading(false);
  };

  useEffect(() => { fetchResellers(); }, [companyId]);

  const handleCreate = async () => {
    if (!form.name.trim()) { toast({ title: "Preencha o nome", variant: "destructive" }); return; }
    if (!companyId) { toast({ title: "Empresa não carregada", variant: "destructive" }); return; }
    const parentId = form.parent_reseller_id || null;
    const parentLevel = parentId ? (resellers.find(r => r.id === parentId)?.level || 1) : 0;
    const { error } = await supabase.from("resellers").insert({
      company_id: companyId, name: form.name, email: form.email, whatsapp: form.whatsapp,
      notes: form.notes, parent_reseller_id: parentId, level: parentLevel + 1,
    });
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Revendedor criado!" }); setShowCreate(false); resetForm(); fetchResellers(); onDataChange(); }
  };

  const handleUpdate = async () => {
    if (!selected) return;
    const { error } = await supabase.from("resellers").update({
      name: form.name, email: form.email, whatsapp: form.whatsapp, notes: form.notes, status: form.status,
    }).eq("id", selected.id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Atualizado!" }); setShowEdit(false); fetchResellers(); onDataChange(); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este revendedor e todos seus sub-revendedores?")) return;
    const { error } = await supabase.from("resellers").delete().eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else { toast({ title: "Excluído!" }); fetchResellers(); onDataChange(); }
  };

  const handleAddCredits = async () => {
    if (!selected || !companyId || !creditForm.amount) return;
    const amount = parseInt(creditForm.amount);
    if (isNaN(amount) || amount === 0) return;
    const finalAmount = creditForm.type === "debit" ? -Math.abs(amount) : Math.abs(amount);
    const { error: txError } = await supabase.from("reseller_credit_transactions").insert({
      reseller_id: selected.id, company_id: companyId, amount: finalAmount, type: creditForm.type,
      description: creditForm.description || (creditForm.type === "purchase" ? "Compra de créditos" : "Débito"),
    });
    if (txError) { toast({ title: "Erro", description: txError.message, variant: "destructive" }); return; }
    const { error: upError } = await supabase.from("resellers").update({ credit_balance: selected.credit_balance + finalAmount }).eq("id", selected.id);
    if (upError) toast({ title: "Erro", description: upError.message, variant: "destructive" });
    else { toast({ title: finalAmount > 0 ? "Créditos adicionados" : "Créditos debitados" }); setShowCredits(false); fetchResellers(); onDataChange(); }
  };

  const handleCreateAccess = async () => {
    if (!selected || !accessForm.email || !accessForm.password) return;
    setAccessLoading(true);
    const { data, error } = await supabase.functions.invoke("create-reseller-user", {
      body: { reseller_id: selected.id, email: accessForm.email, password: accessForm.password, full_name: selected.name },
    });
    if (error || data?.error) toast({ title: "Erro", description: data?.error || error?.message, variant: "destructive" });
    else { toast({ title: "Acesso criado!", description: `Login: ${accessForm.email}` }); setShowAccess(false); fetchResellers(); }
    setAccessLoading(false);
  };

  const openHistory = async (r: Reseller) => {
    setSelected(r);
    const { data } = await supabase.from("reseller_credit_transactions").select("*").eq("reseller_id", r.id).order("created_at", { ascending: false });
    if (data) setTransactions(data);
    setShowHistory(true);
  };

  const resetForm = () => setForm({ name: "", email: "", whatsapp: "", notes: "", status: "active", parent_reseller_id: "" });
  const openEdit = (r: Reseller) => { setSelected(r); setForm({ name: r.name, email: r.email || "", whatsapp: r.whatsapp || "", notes: r.notes || "", status: r.status, parent_reseller_id: r.parent_reseller_id || "" }); setShowEdit(true); };
  const openCredits = (r: Reseller) => { setSelected(r); setCreditForm({ amount: "", type: "purchase", description: "" }); setShowCredits(true); };
  const openAccess = (r: Reseller) => { setSelected(r); setAccessForm({ email: r.email || "", password: "" }); setShowPassword(false); setShowAccess(true); };

  const resellerLoginUrl = `${window.location.origin}/reseller/auth`;
  const filtered = resellers.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()) || r.email?.toLowerCase().includes(search.toLowerCase()));
  const topLevel = resellers.filter(r => !r.parent_reseller_id);

  const getSubCount = (id: string): number => resellers.filter(r => r.parent_reseller_id === id).length;
  const getParentName = (id: string | null) => id ? resellers.find(r => r.id === id)?.name || "—" : "—";

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => { navigator.clipboard.writeText(resellerLoginUrl); toast({ title: "Link copiado!" }); }}>
            <Copy className="w-3.5 h-3.5" /> Link do Painel Revenda
          </Button>
          <Button onClick={() => { resetForm(); setShowCreate(true); }} className="gap-2">
            <Plus className="w-4 h-4" /> Novo Revendedor
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar revendedor..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Nível</TableHead>
                <TableHead>Pai</TableHead>
                <TableHead>Subs</TableHead>
                <TableHead>Créditos</TableHead>
                <TableHead>Acesso</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum revendedor</TableCell></TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {r.level > 1 && <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />}
                        <div>
                          <p className="font-medium text-foreground">{r.name}</p>
                          {r.email && <p className="text-xs text-muted-foreground">{r.email}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="font-mono text-xs">Nv {r.level}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{getParentName(r.parent_reseller_id)}</TableCell>
                    <TableCell><Badge variant="secondary" className="font-mono">{getSubCount(r.id)}</Badge></TableCell>
                    <TableCell><Badge variant={r.credit_balance > 0 ? "default" : "secondary"} className="font-mono">{r.credit_balance}</Badge></TableCell>
                    <TableCell>
                      {r.user_id ? (
                        <Badge variant="default" className="text-xs">Ativo</Badge>
                      ) : (
                        <Button size="sm" variant="outline" className="h-6 text-xs gap-1" onClick={() => openAccess(r)}>
                          <KeyRound className="w-3 h-3" /> Criar
                        </Button>
                      )}
                    </TableCell>
                    <TableCell><Badge variant={r.status === "active" ? "default" : "secondary"}>{r.status === "active" ? "Ativo" : "Inativo"}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openCredits(r)} title="Créditos"><Coins className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => openHistory(r)} title="Histórico"><History className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => openEdit(r)} title="Editar"><Pencil className="w-4 h-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(r.id)} title="Excluir" className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Revendedor</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></div>
            <div>
              <Label>Revendedor Pai (opcional)</Label>
              <Select value={form.parent_reseller_id} onValueChange={(v) => setForm({ ...form, parent_reseller_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Nenhum (nível 1)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum (nível 1)</SelectItem>
                  {resellers.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{"  ".repeat(r.level - 1)}{r.name} (Nv {r.level})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button><Button onClick={handleCreate}>Criar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Revendedor</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>WhatsApp</Label><Input value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></div>
            <div><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <div><Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="active">Ativo</SelectItem><SelectItem value="inactive">Inativo</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowEdit(false)}>Cancelar</Button><Button onClick={handleUpdate}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credits Dialog */}
      <Dialog open={showCredits} onOpenChange={setShowCredits}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Coins className="w-5 h-5 text-primary" />Créditos — {selected?.name}</DialogTitle></DialogHeader>
          <div className="text-center py-2"><p className="text-xs text-muted-foreground">Saldo Atual</p><p className="text-3xl font-bold font-mono text-primary">{selected?.credit_balance ?? 0}</p></div>
          <div className="space-y-4">
            <div><Label>Tipo</Label><Select value={creditForm.type} onValueChange={(v) => setCreditForm({ ...creditForm, type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="purchase">Adicionar</SelectItem><SelectItem value="debit">Debitar</SelectItem></SelectContent></Select></div>
            <div><Label>Quantidade</Label><Input type="number" min="1" value={creditForm.amount} onChange={(e) => setCreditForm({ ...creditForm, amount: e.target.value })} /></div>
            <div><Label>Descrição</Label><Input value={creditForm.description} onChange={(e) => setCreditForm({ ...creditForm, description: e.target.value })} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setShowCredits(false)}>Cancelar</Button><Button onClick={handleAddCredits}>{creditForm.type === "purchase" ? "Adicionar" : "Debitar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><History className="w-5 h-5 text-primary" />Histórico — {selected?.name}</DialogTitle></DialogHeader>
          <div className="max-h-80 overflow-auto">
            {transactions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">Nenhuma transação</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Tipo</TableHead><TableHead>Qtd</TableHead><TableHead>Descrição</TableHead></TableRow></TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(tx.created_at).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell><Badge variant={tx.amount > 0 ? "default" : "destructive"} className="text-xs">{tx.amount > 0 ? "Crédito" : "Débito"}</Badge></TableCell>
                      <TableCell className="font-mono font-medium">{tx.amount > 0 ? `+${tx.amount}` : tx.amount}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{tx.description || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Access Dialog */}
      <Dialog open={showAccess} onOpenChange={setShowAccess}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><KeyRound className="w-5 h-5 text-primary" />Criar Acesso — {selected?.name}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Crie as credenciais para o revendedor acessar o painel:</p>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border">
            <code className="text-xs text-primary flex-1 break-all">{resellerLoginUrl}</code>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { navigator.clipboard.writeText(resellerLoginUrl); toast({ title: "Copiado!" }); }}><Copy className="w-3.5 h-3.5" /></Button>
          </div>
          <div className="space-y-4">
            <div><Label>Email *</Label><Input type="email" value={accessForm.email} onChange={(e) => setAccessForm({ ...accessForm, email: e.target.value })} /></div>
            <div>
              <Label>Senha *</Label>
              <div className="relative">
                <Input type={showPassword ? "text" : "password"} value={accessForm.password} onChange={(e) => setAccessForm({ ...accessForm, password: e.target.value })} />
                <Button size="icon" variant="ghost" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAccess(false)}>Cancelar</Button>
            <Button onClick={handleCreateAccess} disabled={accessLoading || !accessForm.email || !accessForm.password}>
              {accessLoading ? "Criando..." : "Criar Acesso"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
