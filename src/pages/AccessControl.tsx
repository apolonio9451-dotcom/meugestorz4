import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
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
import {
  ShieldCheck,
  Search,
  KeyRound,
  Users,
  UserCog,
  Crown,
  FlaskConical,
  CheckCircle2,
  AlertTriangle,
  Network,
} from "lucide-react";

interface TeamMember {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  email: string;
  full_name: string;
  source: "membership" | "reseller";
  status?: string;
  parent_reseller_id?: string | null;
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

const statusConfig: Record<string, { label: string; icon: typeof CheckCircle2; color: string }> = {
  trial: { label: "Em Teste", icon: FlaskConical, color: "text-amber-400" },
  active: { label: "Ativo", icon: CheckCircle2, color: "text-emerald-400" },
  expired: { label: "Expirado", icon: AlertTriangle, color: "text-zinc-400" },
  overdue: { label: "Vencido", icon: AlertTriangle, color: "text-orange-400" },
};

export default function AccessControl() {
  const { effectiveCompanyId: companyId, userRole, user } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [myResellerId, setMyResellerId] = useState<string | null>(null);

  const isOwner = userRole === "Proprietário";

  // Get current user's reseller ID
  useEffect(() => {
    if (!user || isOwner) return;
    (async () => {
      const { data } = await supabase
        .from("resellers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) setMyResellerId(data.id);
    })();
  }, [user, isOwner]);

  const fetchMembers = async () => {
    if (!companyId) return;
    setLoading(true);

    const enriched: TeamMember[] = [];

    if (isOwner) {
      // Owner sees all: memberships + resellers
      const [{ data: memberships }, { data: resellers }] = await Promise.all([
        supabase
          .from("company_memberships")
          .select("id, user_id, role, created_at")
          .eq("company_id", companyId)
          .order("created_at"),
        supabase
          .from("resellers")
          .select("id, user_id, name, email, status, parent_reseller_id, created_at")
          .eq("company_id", companyId)
          .order("created_at"),
      ]);

      // Add membership-only users (owners, admins without reseller record)
      const resellerUserIds = new Set((resellers || []).map(r => r.user_id).filter(Boolean));

      for (const m of memberships || []) {
        if (resellerUserIds.has(m.user_id)) continue; // Will be added from resellers
        const { data: profile } = await supabase
          .from("profiles")
          .select("email, full_name")
          .eq("id", m.user_id)
          .maybeSingle();
        enriched.push({
          id: m.id,
          user_id: m.user_id,
          role: m.role,
          created_at: m.created_at,
          email: profile?.email || "—",
          full_name: profile?.full_name || "—",
          source: "membership",
        });
      }

      // Add resellers
      for (const r of resellers || []) {
        enriched.push({
          id: r.id,
          user_id: r.user_id || "",
          role: "operator",
          created_at: r.created_at,
          email: r.email || "—",
          full_name: r.name || "—",
          source: "reseller",
          status: r.status,
          parent_reseller_id: r.parent_reseller_id,
        });
      }
    } else {
      // Reseller: only see sub-resellers linked via parent_reseller_id
      const resellerId = myResellerId;
      if (!resellerId) { setLoading(false); return; }

      const { data: resellers } = await supabase
        .from("resellers")
        .select("id, user_id, name, email, status, parent_reseller_id, created_at")
        .eq("parent_reseller_id", resellerId)
        .order("created_at");

      for (const r of resellers || []) {
        enriched.push({
          id: r.id,
          user_id: r.user_id || "",
          role: "operator",
          created_at: r.created_at,
          email: r.email || "—",
          full_name: r.name || "—",
          source: "reseller",
          status: r.status,
          parent_reseller_id: r.parent_reseller_id,
        });
      }
    }

    setMembers(enriched);
    setLoading(false);
  };

  useEffect(() => {
    if (isOwner) {
      fetchMembers();
    } else if (myResellerId) {
      fetchMembers();
    }
  }, [companyId, myResellerId]);

  // Realtime: refresh when resellers table changes
  useEffect(() => {
    if (!user || !companyId) return;

    const channel = supabase
      .channel(`${user.id}:access-control-sync`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "resellers",
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          fetchMembers();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "company_memberships",
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          fetchMembers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, companyId, myResellerId]);

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
    resellers: members.filter((m) => m.source === "reseller").length,
    trials: members.filter((m) => m.status === "trial").length,
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-primary" />
          Controle de Acessos
        </h1>
        <p className="text-sm text-muted-foreground">
          {isOwner
            ? "Gerencie permissões e acessos de toda a sua equipe."
            : "Veja os revendedores vinculados a você."}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", value: stats.total, icon: Users, color: "text-primary" },
          { label: "Proprietários", value: stats.owners, icon: Crown, color: "text-primary" },
          { label: "Revendedores", value: stats.resellers, icon: Network, color: "text-amber-500" },
          { label: "Em Teste", value: stats.trials, icon: FlaskConical, color: "text-emerald-500" },
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
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((m) => {
                  const RoleIcon = roleIcons[m.role] || UserCog;
                  const st = m.status ? statusConfig[m.status] : null;
                  const StatusIcon = st?.icon || CheckCircle2;
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
                      <TableCell>
                        {st ? (
                          <span className={`flex items-center gap-1 text-xs ${st.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {st.label}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
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
