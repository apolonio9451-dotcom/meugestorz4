import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { FlaskConical, CheckCircle2, Clock, Trash2, UserCheck } from "lucide-react";
import { differenceInHours, parseISO, format } from "date-fns";

interface TrialMember {
  id: string;
  user_id: string;
  is_trial: boolean;
  trial_expires_at: string | null;
  trial_link_id: string | null;
  created_at: string;
  role: string;
  profile_name: string;
  profile_email: string;
}

export default function TrialManagement() {
  const { companyId } = useAuth();
  const [trials, setTrials] = useState<TrialMember[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTrials = async () => {
    if (!companyId) return;
    setLoading(true);

    const { data, error } = await supabase
      .from("company_memberships")
      .select("id, user_id, is_trial, trial_expires_at, trial_link_id, created_at, role")
      .eq("company_id", companyId)
      .eq("is_trial", true)
      .order("created_at", { ascending: false });

    if (error || !data) {
      setLoading(false);
      return;
    }

    // Fetch profiles for these users
    const userIds = data.map((d) => d.user_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds);

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

    const merged = data.map((d) => ({
      ...d,
      profile_name: profileMap.get(d.user_id)?.full_name || "Sem nome",
      profile_email: profileMap.get(d.user_id)?.email || "—",
    }));

    setTrials(merged);
    setLoading(false);
  };

  useEffect(() => {
    fetchTrials();
  }, [companyId]);

  const handleActivate = async (membership: TrialMember) => {
    const { error } = await supabase
      .from("company_memberships")
      .update({ is_trial: false, trial_expires_at: null })
      .eq("id", membership.id);

    if (error) {
      toast.error("Erro ao ativar usuário");
    } else {
      toast.success(`${membership.profile_name} ativado com acesso completo!`);
      fetchTrials();
    }
  };

  const handleRemove = async (membership: TrialMember) => {
    if (!confirm(`Remover acesso de teste de ${membership.profile_name}?`)) return;

    const { error } = await supabase
      .from("company_memberships")
      .delete()
      .eq("id", membership.id);

    if (error) {
      toast.error("Erro ao remover");
    } else {
      toast.success("Acesso removido");
      fetchTrials();
    }
  };

  const getTimeLeft = (expiresAt: string | null) => {
    if (!expiresAt) return { label: "Sem prazo", expired: false };
    const hours = differenceInHours(parseISO(expiresAt), new Date());
    if (hours <= 0) return { label: "Expirado", expired: true };
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    if (days > 0) return { label: `${days}d ${remainingHours}h`, expired: false };
    return { label: `${hours}h`, expired: false };
  };

  // Also fetch pending (unused) trial links
  const [pendingLinks, setPendingLinks] = useState<Array<{ id: string; token: string; expires_at: string; created_at: string }>>([]);

  useEffect(() => {
    if (!companyId) return;
    supabase
      .from("trial_links")
      .select("id, token, expires_at, created_at")
      .eq("company_id", companyId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setPendingLinks(data);
      });
  }, [companyId]);

  return (
    <div className="space-y-6">
      {/* Active Trial Users */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FlaskConical className="w-5 h-5 text-primary" />
            Usuários em Teste ({trials.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-6 text-sm">Carregando...</p>
          ) : trials.length === 0 ? (
            <p className="text-center text-muted-foreground py-6 text-sm">Nenhum usuário em teste</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-center">Tempo Restante</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trials.map((t) => {
                  const time = getTimeLeft(t.trial_expires_at);
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.profile_name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{t.profile_email}</TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className={
                            time.expired
                              ? "bg-destructive/10 text-destructive border-destructive/30"
                              : "bg-primary/10 text-primary border-primary/30"
                          }
                        >
                          <Clock className="w-3 h-3 mr-1" />
                          {time.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(parseISO(t.created_at), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            className="gap-1.5 h-7 text-xs"
                            onClick={() => handleActivate(t)}
                          >
                            <UserCheck className="w-3.5 h-3.5" /> Ativar
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleRemove(t)}
                          >
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pending Trial Links */}
      {pendingLinks.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="w-5 h-5 text-muted-foreground" />
              Links Pendentes ({pendingLinks.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Link</TableHead>
                  <TableHead className="text-center">Expira em</TableHead>
                  <TableHead>Criado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingLinks.map((link) => {
                  const time = getTimeLeft(link.expires_at);
                  return (
                    <TableRow key={link.id}>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          /trial/{link.token.substring(0, 8)}...
                        </code>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className={
                            time.expired
                              ? "bg-destructive/10 text-destructive"
                              : "bg-muted text-muted-foreground"
                          }
                        >
                          {time.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(parseISO(link.created_at), "dd/MM/yyyy HH:mm")}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
