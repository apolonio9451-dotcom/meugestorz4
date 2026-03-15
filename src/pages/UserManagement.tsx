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
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Shield, Trash2, Users, Search } from "lucide-react";

interface Member {
  id: string;
  user_id: string;
  role: "owner" | "admin" | "operator";
  created_at: string;
  profile?: { full_name: string; email: string };
}

const roleLabels: Record<string, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  operator: "Operador",
};

const roleBadgeColors: Record<string, string> = {
  owner: "bg-primary/15 text-primary border-primary/30",
  admin: "bg-amber-500/15 text-amber-600 border-amber-500/30",
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

  const fetchMembers = async () => {
    if (!companyId) return;
    setLoading(true);
    const { data } = await supabase
      .from("company_memberships")
      .select("id, user_id, role, created_at")
      .eq("company_id", companyId);

    if (data) {
      const enriched: Member[] = [];
      for (const m of data) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", m.user_id)
          .maybeSingle();
        enriched.push({ ...m, profile: profile ?? undefined });
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
          <p className="text-sm text-muted-foreground">Adicione, remova e gerencie cargos dos membros da sua equipe.</p>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden sm:table-cell">E-mail</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead className="w-[80px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">
                      <div>
                        {m.profile?.full_name || "—"}
                        <div className="text-xs text-muted-foreground sm:hidden">{m.profile?.email}</div>
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
                      {m.role !== "owner" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:bg-destructive/10"
                          onClick={() => handleDelete(m)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
    </div>
  );
}
