import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ShieldCheck,
  Search,
  KeyRound,
  Users,
  UserCog,
  Crown,
  Link2,
  Send,
  Copy,
  Clock,
  FlaskConical,
  CheckCircle2,
  Ban,
  Loader2,
} from "lucide-react";
import { differenceInHours, parseISO, format } from "date-fns";

interface Reseller {
  id: string;
  name: string;
  email: string | null;
  whatsapp: string | null;
  status: string;
  credit_balance: number;
  created_at: string;
  parent_reseller_id: string | null;
  user_id: string | null;
  company_id: string;
  can_resell: boolean;
  can_create_subreseller: boolean;
}

interface TrialLink {
  id: string;
  token: string;
  client_name: string;
  client_whatsapp: string | null;
  status: string;
  expires_at: string;
  created_at: string;
  activated_at: string | null;
  reseller_id: string | null;
  user_id: string | null;
}

const statusLabels: Record<string, { label: string; className: string }> = {
  active: { label: "Ativo", className: "bg-primary/15 text-primary border-primary/30" },
  trial: { label: "Teste", className: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  blocked: { label: "Bloqueado", className: "bg-destructive/15 text-destructive border-destructive/30" },
};

export default function AccessControl() {
  const { effectiveCompanyId: companyId, user, userRole } = useAuth();
  const { toast } = useToast();
  const [resellers, setResellers] = useState<Reseller[]>([]);
  const [trialLinks, setTrialLinks] = useState<TrialLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [newTrialName, setNewTrialName] = useState("");
  const [newTrialWhatsapp, setNewTrialWhatsapp] = useState("");
  const [trialDays, setTrialDays] = useState(7);

  const isOwner = userRole === "Proprietário";

  const fetchData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);

    const [resellersRes, trialsRes] = await Promise.all([
      supabase
        .from("resellers")
        .select("id, name, email, whatsapp, status, credit_balance, created_at, parent_reseller_id, user_id, company_id, can_resell, can_create_subreseller")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false }),
      supabase
        .from("trial_links")
        .select("id, token, client_name, client_whatsapp, status, expires_at, created_at, activated_at, reseller_id, user_id")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false }),
    ]);

    if (resellersRes.data) setResellers(resellersRes.data);
    if (trialsRes.data) setTrialLinks(trialsRes.data);
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime: new resellers and trial links appear instantly
  useEffect(() => {
    if (!companyId || !user) return;

    const channel = supabase
      .channel(`${user.id}:access-control-rt`)
      .on("postgres_changes", { event: "*", schema: "public", table: "resellers", filter: `company_id=eq.${companyId}` }, () => {
        fetchData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "trial_links", filter: `company_id=eq.${companyId}` }, () => {
        fetchData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [companyId, user, fetchData]);

  // Filter: owners see all, resellers see only their children
  const myResellerId = resellers.find((r) => r.user_id === user?.id)?.id;
  const filteredResellers = resellers.filter((r) => {
    if (isOwner) return true;
    // Reseller sees only those they created
    return r.parent_reseller_id === myResellerId;
  });

  const searchFiltered = filteredResellers.filter((r) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      r.name.toLowerCase().includes(q) ||
      (r.email || "").toLowerCase().includes(q) ||
      (r.whatsapp || "").toLowerCase().includes(q)
    );
  });

  const pendingTrials = trialLinks.filter((t) => t.status === "pending");
  const activatedTrials = trialLinks.filter((t) => t.status === "activated");

  const stats = {
    total: filteredResellers.length,
    active: filteredResellers.filter((r) => r.status === "active").length,
    trial: filteredResellers.filter((r) => r.status === "trial").length,
    blocked: filteredResellers.filter((r) => r.status === "blocked").length,
    pendingLinks: pendingTrials.length,
  };

  const handleGenerateTrialLink = async () => {
    if (!companyId || !user || !newTrialName.trim()) {
      toast({ title: "Erro", description: "Preencha o nome do revendedor.", variant: "destructive" });
      return;
    }
    setGenerating(true);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + trialDays);

    const { data, error } = await supabase.from("trial_links").insert({
      company_id: companyId,
      created_by: user.id,
      client_name: newTrialName.trim(),
      client_whatsapp: newTrialWhatsapp.trim() || null,
      expires_at: expiresAt.toISOString(),
      reseller_id: myResellerId || null,
    }).select("token").single();

    if (error) {
      toast({ title: "Erro ao gerar link", description: error.message, variant: "destructive" });
    } else if (data) {
      const link = `${window.location.origin}/auth?trial=${data.token}`;
      setGeneratedLink(link);
      toast({ title: "Link gerado com sucesso!" });
    }
    setGenerating(false);
  };

  const handleCopyLink = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      toast({ title: "Link copiado!" });
    }
  };

  const handleShareWhatsApp = () => {
    if (!generatedLink) return;
    const msg = encodeURIComponent(`Olá! Aqui está seu acesso de teste para o sistema Meu Gestor: ${generatedLink}`);
    const phone = newTrialWhatsapp.replace(/\D/g, "");
    const url = phone
      ? `https://wa.me/${phone}?text=${msg}`
      : `https://wa.me/?text=${msg}`;
    window.open(url, "_blank");
  };

  const resetModal = () => {
    setGenerateModalOpen(false);
    setGeneratedLink(null);
    setNewTrialName("");
    setNewTrialWhatsapp("");
    setTrialDays(7);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-primary" />
            Gestão de Acesso
          </h1>
          <p className="text-sm text-muted-foreground">
            Gerencie revendedores, convites e acessos da sua equipe.
          </p>
        </div>
        <Button onClick={() => setGenerateModalOpen(true)} className="gap-2">
          <FlaskConical className="w-4 h-4" />
          Gerar Teste
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total", value: stats.total, icon: Users, color: "text-primary" },
          { label: "Ativos", value: stats.active, icon: CheckCircle2, color: "text-primary" },
          { label: "Em Teste", value: stats.trial, icon: FlaskConical, color: "text-amber-500" },
          { label: "Bloqueados", value: stats.blocked, icon: Ban, color: "text-destructive" },
          { label: "Links Pendentes", value: stats.pendingLinks, icon: Link2, color: "text-cyan-500" },
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

      {/* Search */}
      <Card>
        <CardHeader className="pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, e-mail ou WhatsApp..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-center text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
            </div>
          ) : searchFiltered.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              Nenhum revendedor encontrado. Gere um link de teste para convidar alguém.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {searchFiltered.map((r) => (
                <ResellerRow key={r.id} reseller={r} trialLinks={trialLinks} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending Trial Links */}
      {pendingTrials.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Link2 className="w-4 h-4 text-cyan-500" />
              Links de Teste Pendentes
            </h2>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {pendingTrials.map((t) => {
                const hoursLeft = Math.max(0, differenceInHours(parseISO(t.expires_at), new Date()));
                const daysLeft = Math.floor(hoursLeft / 24);
                const expired = new Date() > parseISO(t.expires_at);
                const link = `${window.location.origin}/auth?trial=${t.token}`;

                return (
                  <div key={t.id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{t.client_name}</p>
                      {t.client_whatsapp && (
                        <p className="text-xs text-muted-foreground">{t.client_whatsapp}</p>
                      )}
                      <p className={`text-xs flex items-center gap-1 mt-0.5 ${expired ? "text-destructive" : "text-amber-500"}`}>
                        <Clock className="w-3 h-3" />
                        {expired ? "Expirado" : daysLeft > 0 ? `${daysLeft}d ${hoursLeft % 24}h restantes` : `${hoursLeft}h restantes`}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => {
                          navigator.clipboard.writeText(link);
                          toast({ title: "Link copiado!" });
                        }}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-green-600"
                        onClick={() => {
                          const msg = encodeURIComponent(`Olá! Aqui está seu acesso de teste para o sistema Meu Gestor: ${link}`);
                          const phone = (t.client_whatsapp || "").replace(/\D/g, "");
                          window.open(phone ? `https://wa.me/${phone}?text=${msg}` : `https://wa.me/?text=${msg}`, "_blank");
                        }}
                      >
                        <Send className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generate Trial Link Modal */}
      <Dialog open={generateModalOpen} onOpenChange={(open) => { if (!open) resetModal(); else setGenerateModalOpen(true); }}>
        <DialogContent className="max-w-md bg-background rounded-2xl shadow-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-primary" />
              Gerar Link de Teste
            </DialogTitle>
            <DialogDescription>
              Gere um link de convite para um novo revendedor. Ele receberá acesso de teste automaticamente.
            </DialogDescription>
          </DialogHeader>

          {!generatedLink ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Nome do Revendedor *</label>
                <Input
                  value={newTrialName}
                  onChange={(e) => setNewTrialName(e.target.value)}
                  placeholder="Ex: João Silva"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">WhatsApp (opcional)</label>
                <Input
                  value={newTrialWhatsapp}
                  onChange={(e) => setNewTrialWhatsapp(e.target.value)}
                  placeholder="5511999999999"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">Dias de teste</label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={trialDays}
                  onChange={(e) => setTrialDays(Number(e.target.value) || 7)}
                />
              </div>
              <Button onClick={handleGenerateTrialLink} disabled={generating || !newTrialName.trim()} className="w-full gap-2">
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                {generating ? "Gerando..." : "Gerar Link"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 border border-border p-3">
                <p className="text-xs text-muted-foreground mb-1">Link gerado:</p>
                <p className="text-sm font-mono text-foreground break-all">{generatedLink}</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCopyLink} variant="outline" className="flex-1 gap-2">
                  <Copy className="w-4 h-4" /> Copiar
                </Button>
                <Button onClick={handleShareWhatsApp} className="flex-1 gap-2 bg-green-600 hover:bg-green-700 text-white">
                  <Send className="w-4 h-4" /> Enviar via WhatsApp
                </Button>
              </div>
              <Button variant="ghost" onClick={resetModal} className="w-full">Fechar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Reseller Row Component ─── */
function ResellerRow({ reseller: r, trialLinks }: { reseller: Reseller; trialLinks: TrialLink[] }) {
  const initials = r.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const status = statusLabels[r.status] || statusLabels.active;

  // Trial countdown
  const linkedTrial = trialLinks.find((t) => t.user_id === r.user_id && t.status === "activated");
  const isTrial = r.status === "trial";

  let trialHoursLeft = 0;
  let trialDaysLeft = 0;
  let trialExpired = false;

  if (isTrial && linkedTrial?.expires_at) {
    trialHoursLeft = Math.max(0, differenceInHours(parseISO(linkedTrial.expires_at), new Date()));
    trialDaysLeft = Math.floor(trialHoursLeft / 24);
    trialExpired = new Date() > parseISO(linkedTrial.expires_at);
  }

  const avatarClass = isTrial
    ? "bg-amber-500/15 text-amber-500"
    : r.status === "active"
      ? "bg-primary/15 text-primary"
      : "bg-destructive/15 text-destructive";

  return (
    <div className="px-4 py-3 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${avatarClass}`}>
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate">{r.name}</span>
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 shrink-0 ${status.className}`}>
            {status.label}
          </Badge>
        </div>
        {r.email && <p className="text-[11px] text-muted-foreground truncate">{r.email}</p>}
        {r.whatsapp && <p className="text-[11px] text-muted-foreground">{r.whatsapp}</p>}

        {/* Trial countdown */}
        {isTrial && (
          <p className={`text-[11px] flex items-center gap-1 mt-0.5 ${trialExpired ? "text-destructive" : "text-amber-500"}`}>
            <Clock className="w-3 h-3" />
            {trialExpired
              ? "Teste expirado"
              : trialDaysLeft > 0
                ? `${trialDaysLeft}d ${trialHoursLeft % 24}h restantes`
                : `${trialHoursLeft}h restantes`}
          </p>
        )}
      </div>
      <div className="text-right shrink-0">
        <p className="text-xs text-muted-foreground">Créditos</p>
        <p className={`font-mono text-sm font-bold ${r.credit_balance > 0 ? "text-primary" : "text-destructive"}`}>
          {r.credit_balance}
        </p>
      </div>
    </div>
  );
}
