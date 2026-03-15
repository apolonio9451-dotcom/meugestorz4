import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Shield, Trash2, Users, Search, Coins, Zap, Star } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Member {
  id: string;
  user_id: string;
  company_id: string;
  role: "owner" | "admin" | "operator";
  created_at: string;
  profile?: { full_name: string; email: string };
  company?: { name: string; plan_type: string; credit_balance: number };
}

const roleLabels: Record<string, string> = {
  owner: "Proprietário",
  admin: "Admin",
  operator: "Usuário",
};

const roleBadgeColors: Record<string, string> = {
  owner: "bg-blue-500/20 text-blue-400 border-blue-500/40",
  admin: "bg-cyan-500/20 text-cyan-400 border-cyan-500/40",
  operator: "bg-muted text-muted-foreground border-border",
};

export default function UserManagement() {
  const { effectiveCompanyId: companyId } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);

  // Credit dialog
  const [creditOpen, setCreditOpen] = useState(false);
  const [creditTarget, setCreditTarget] = useState<Member | null>(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditType, setCreditType] = useState<"add" | "remove">("add");

  // Downgrade confirmation
  const [downgradeStep, setDowngradeStep] = useState<0 | 1 | 2>(0);
  const [downgradeTarget, setDowngradeTarget] = useState<Member | null>(null);
  const [downgrading, setDowngrading] = useState(false);

  const fetchMembers = async () => {
    if (!companyId) return;
    setLoading(true);
    const { data } = await supabase
      .from("company_memberships")
      .select("id, user_id, company_id, role, created_at")
      .eq("company_id", companyId);

    if (data) {
      const enriched: Member[] = [];
      for (const m of data) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", m.user_id)
          .maybeSingle();

        // Fetch the user's OWN company (via their membership)
        const { data: userMembership } = await supabase
          .from("company_memberships")
          .select("company_id")
          .eq("user_id", m.user_id)
          .eq("role", "owner")
          .maybeSingle();

        let company: Member["company"] = undefined;
        const targetCompanyId = userMembership?.company_id || m.company_id;
        const { data: companyData } = await supabase
          .from("companies")
          .select("name, plan_type, credit_balance")
          .eq("id", targetCompanyId)
          .maybeSingle();
        if (companyData) {
          company = {
            name: companyData.name,
            plan_type: companyData.plan_type || "pro",
            credit_balance: companyData.credit_balance || 0,
          };
        }

        enriched.push({
          ...m,
          profile: profile ?? undefined,
          company,
        });
      }
      setMembers(enriched);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMembers();
  }, [companyId]);

  const handleAddUser = async () => {
    if (!newEmail || !newName || !newPassword) return;
    setSaving(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: newEmail,
      password: newPassword,
      options: {
        data: { full_name: newName },
        emailRedirectTo: window.location.origin,
      },
    });

    const isRepeatedSignup = !signUpError && (!data?.user || (Array.isArray(data.user.identities) && data.user.identities.length === 0));

    if (signUpError || isRepeatedSignup) {
      toast({
        title: "Erro",
        description: signUpError?.message || "Este email já está cadastrado e não pode ser criado novamente.",
        variant: "destructive",
      });
      setSaving(false);
      return;
    }

    toast({
      title: "Acesso criado com sucesso!",
      description: "Este usuário terá uma empresa própria e isolada, sem compartilhar dados.",
    });
    setAddOpen(false);
    setNewEmail("");
    setNewName("");
    setNewPassword("");
    setSaving(false);
  };

  const handleDelete = async (member: Member) => {
    if (member.role === "owner") {
      toast({ title: "Não é possível remover o proprietário", variant: "destructive" });
      return;
    }
    const { error } = await supabase
      .from("company_memberships")
      .delete()
      .eq("id", member.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Usuário removido!" });
      fetchMembers();
    }
  };

  const handleTogglePlan = async (member: Member) => {
    if (!member.company) return;
    const currentPlan = member.company.plan_type;

    if (currentPlan === "pro") {
      // Downgrade: open two-step confirmation
      setDowngradeTarget(member);
      setDowngradeStep(1);
      return;
    }

    // Upgrade to Pro: direct
    const { data: userMembership } = await supabase
      .from("company_memberships")
      .select("company_id")
      .eq("user_id", member.user_id)
      .eq("role", "owner")
      .maybeSingle();

    const cid = userMembership?.company_id || member.company_id;

    const { error } = await supabase
      .from("companies")
      .update({ plan_type: "pro" })
      .eq("id", cid);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Plano alterado para Pro" });
      fetchMembers();
    }
  };

  const handleConfirmDowngrade = async () => {
    if (!downgradeTarget?.company) return;
    setDowngrading(true);

    const { data: userMembership } = await supabase
      .from("company_memberships")
      .select("company_id")
      .eq("user_id", downgradeTarget.user_id)
      .eq("role", "owner")
      .maybeSingle();

    const cid = userMembership?.company_id || downgradeTarget.company_id;

    const { error } = await supabase
      .from("companies")
      .update({ plan_type: "starter", credit_balance: 0 })
      .eq("id", cid);

    setDowngrading(false);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "Plano alterado para Starter",
        description: "Créditos removidos e acesso a automações revogado com sucesso.",
      });
      setDowngradeStep(0);
      setDowngradeTarget(null);
      fetchMembers();
    }
  };

  const handleCreditSubmit = async () => {
    if (!creditTarget || !creditAmount) return;
    const amount = parseInt(creditAmount);
    if (isNaN(amount) || amount <= 0) return;

    const { data: userMembership } = await supabase
      .from("company_memberships")
      .select("company_id")
      .eq("user_id", creditTarget.user_id)
      .eq("role", "owner")
      .maybeSingle();

    const cid = userMembership?.company_id || creditTarget.company_id;
    const currentBalance = creditTarget.company?.credit_balance || 0;
    const newBalance = creditType === "add"
      ? currentBalance + amount
      : Math.max(0, currentBalance - amount);

    const { error } = await supabase
      .from("companies")
      .update({ credit_balance: newBalance })
      .eq("id", cid);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: creditType === "add" ? "Créditos adicionados" : "Créditos removidos",
        description: `Novo saldo: ${newBalance} créditos`,
      });
      setCreditOpen(false);
      setCreditAmount("");
      fetchMembers();
    }
  };

  const openCreditDialog = (member: Member, type: "add" | "remove") => {
    setCreditTarget(member);
    setCreditType(type);
    setCreditAmount("");
    setCreditOpen(true);
  };

  const filtered = members.filter((m) => {
    const name = m.profile?.full_name?.toLowerCase() ?? "";
    const email = m.profile?.email?.toLowerCase() ?? "";
    const q = search.toLowerCase();
    return name.includes(q) || email.includes(q);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Gestão de Revendedores
          </h1>
          <p className="text-sm text-muted-foreground">Gerencie planos, créditos e acessos dos membros.</p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="gap-2">
          <UserPlus className="w-4 h-4" />
          Novo Revendedor
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou e-mail..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-center text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">Nenhum usuário encontrado.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead className="hidden sm:table-cell">E-mail</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead className="hidden md:table-cell" title="Créditos controlam quantos sub-painéis o usuário pode criar">Créditos (Sub-painéis)</TableHead>
                    <TableHead className="w-[120px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div>
                            {m.profile?.full_name || "—"}
                            <div className="text-xs text-muted-foreground sm:hidden">{m.profile?.email}</div>
                          </div>
                          {m.company && (
                            m.company.plan_type === "pro" ? (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase leading-none bg-[hsl(48,96%,53%)] text-black tracking-wider shrink-0">PRO</span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase leading-none bg-muted text-muted-foreground border border-border tracking-wider shrink-0">STARTER</span>
                            )
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                        {m.profile?.email || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={roleBadgeColors[m.role]}>
                          <Shield className="w-3 h-3 mr-1" />
                          {roleLabels[m.role]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {m.company ? (
                          <button
                            onClick={() => handleTogglePlan(m)}
                            className="group flex items-center gap-1"
                            title="Clique para alternar plano"
                          >
                            {m.company.plan_type === "pro" ? (
                              <Badge className="bg-[hsl(48,96%,53%)]/15 text-[hsl(48,96%,53%)] border-[hsl(48,96%,53%)]/30 hover:bg-[hsl(48,96%,53%)]/25 cursor-pointer gap-1">
                                <Zap className="w-3 h-3" />
                                Pro
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground hover:bg-muted/50 cursor-pointer gap-1">
                                <Star className="w-3 h-3" />
                                Starter
                              </Badge>
                            )}
                            <ArrowUpDown className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {m.company ? (
                          <div className="flex items-center gap-1.5">
                            <Coins className="w-3.5 h-3.5 text-primary" />
                            <span className="font-mono text-sm font-semibold">{m.company.credit_balance}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {m.company && m.company.plan_type === "pro" && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-emerald-500 hover:bg-emerald-500/10"
                                onClick={() => openCreditDialog(m, "add")}
                                title="Adicionar créditos"
                              >
                                <Coins className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                          {m.role !== "owner" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:bg-destructive/10"
                              onClick={() => handleDelete(m)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add User Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              Adicionar Usuário
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome Completo</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="João Silva" />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="joao@email.com" />
            </div>
            <div className="space-y-2">
              <Label>Senha</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddUser} disabled={saving || !newEmail || !newName || !newPassword}>
              {saving ? "Salvando..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credit Dialog */}
      <Dialog open={creditOpen} onOpenChange={setCreditOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-primary" />
              {creditType === "add" ? "Adicionar" : "Remover"} Créditos
            </DialogTitle>
            <DialogDescription>
              {creditTarget?.profile?.full_name} — Saldo atual: <strong>{creditTarget?.company?.credit_balance || 0}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant={creditType === "add" ? "default" : "outline"}
                size="sm"
                onClick={() => setCreditType("add")}
                className="flex-1"
              >
                Adicionar
              </Button>
              <Button
                variant={creditType === "remove" ? "destructive" : "outline"}
                size="sm"
                onClick={() => setCreditType("remove")}
                className="flex-1"
              >
                Remover
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Quantidade</Label>
              <Input
                type="number"
                min="1"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                placeholder="Ex: 10"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleCreditSubmit}
              disabled={!creditAmount || parseInt(creditAmount) <= 0}
              variant={creditType === "remove" ? "destructive" : "default"}
            >
              {creditType === "add" ? "Adicionar" : "Remover"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Downgrade Confirmation Dialog - Two Steps */}
      <Dialog open={downgradeStep > 0} onOpenChange={(open) => { if (!open) { setDowngradeStep(0); setDowngradeTarget(null); } }}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Shield className="w-5 h-5" />
              {downgradeStep === 1 ? "Confirmar Downgrade" : "Atenção Final"}
            </DialogTitle>
            <DialogDescription>
              {downgradeStep === 1
                ? `Você tem certeza? Mudar "${downgradeTarget?.profile?.full_name || "este usuário"}" para Starter removerá todos os privilégios de automação e revenda.`
                : `Todos os créditos de revenda atuais (${downgradeTarget?.company?.credit_balance || 0}) deste usuário serão zerados permanentemente. Confirmar alteração?`
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setDowngradeStep(0); setDowngradeTarget(null); }}>
              Cancelar
            </Button>
            {downgradeStep === 1 ? (
              <Button variant="destructive" onClick={() => setDowngradeStep(2)}>
                Continuar
              </Button>
            ) : (
              <Button variant="destructive" onClick={handleConfirmDowngrade} disabled={downgrading}>
                {downgrading ? "Processando..." : "Confirmar e Zerar Créditos"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
