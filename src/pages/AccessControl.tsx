import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import {
  ShieldCheck,
  Search,
  KeyRound,
  Users,
  UserCog,
  Crown,
} from "lucide-react";

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  email: string;
  full_name: string;
}

const roleLabels: Record<string, string> = {
  owner: "Proprietário",
  admin: "Admin",
  operator: "Usuário",
};

const roleIcons: Record<string, typeof Crown> = {
  owner: Crown,
  admin: ShieldCheck,
  operator: UserCog,
};

const roleColors: Record<string, string> = {
  owner: "bg-blue-500/20 text-blue-400 border-blue-500/40",
  admin: "bg-cyan-500/20 text-cyan-400 border-cyan-500/40",
  operator: "bg-muted text-muted-foreground border-border",
};

export default function AccessControl() {
  const { effectiveCompanyId: companyId } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchMembers = async () => {
    if (!companyId) return;
    setLoading(true);

    const { data: memberships } = await supabase
      .from("company_memberships")
      .select("id, user_id, role, created_at")
      .eq("company_id", companyId)
      .order("created_at");

    if (!memberships) {
      setLoading(false);
      return;
    }

    const enriched: TeamMember[] = [];
    for (const m of memberships) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", m.user_id)
        .maybeSingle();

      enriched.push({
        ...m,
        email: profile?.email || "—",
        full_name: profile?.full_name || "—",
      });
    }

    setMembers(enriched);
    setLoading(false);
  };

  useEffect(() => {
    fetchMembers();
  }, [companyId]);

  const filtered = members.filter((m) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      m.full_name.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      (roleLabels[m.role] || m.role).toLowerCase().includes(q)
    );
  });

  const stats = {
    total: members.length,
    owners: members.filter((m) => m.role === "owner").length,
    admins: members.filter((m) => m.role === "admin").length,
    operators: members.filter((m) => m.role === "operator").length,
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-primary" />
          Controle de Acessos
        </h1>
        <p className="text-sm text-muted-foreground">
          Gerencie permissões e acessos dos membros da sua equipe.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, icon: Users, color: "text-primary" },
          { label: "Proprietários", value: stats.owners, icon: Crown, color: "text-primary" },
          { label: "Administradores", value: stats.admins, icon: ShieldCheck, color: "text-amber-500" },
          { label: "Operadores", value: stats.operators, icon: UserCog, color: "text-emerald-500" },
        ].map((s) => (
          <Card key={s.label} className="p-3">
            <div className="flex items-center gap-2">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </div>
            <div className="text-2xl font-bold mt-1">{s.value}</div>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, e-mail ou cargo..."
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
            <div className="p-6 text-center text-muted-foreground">Nenhum membro encontrado.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Membro</TableHead>
                  <TableHead className="hidden sm:table-cell">E-mail</TableHead>
                  <TableHead>Cargo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((m) => {
                  const RoleIcon = roleIcons[m.role] || UserCog;
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">
                        <div>
                          {m.full_name}
                          <div className="text-xs text-muted-foreground sm:hidden">{m.email}</div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                        {m.email}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={roleColors[m.role] || "bg-muted text-muted-foreground"}>
                          <RoleIcon className="w-3 h-3 mr-1" />
                          {roleLabels[m.role] || m.role}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
