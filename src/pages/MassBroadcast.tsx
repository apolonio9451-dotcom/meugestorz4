import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, Play, Radio, RefreshCw, ShieldAlert } from "lucide-react";
import AnimatedPage from "@/components/AnimatedPage";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

type Campaign = {
  id: string;
  name: string;
  status: string;
  total_recipients: number;
  processed_recipients: number;
  success_count: number;
  failure_count: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

type LogRow = {
  id: string;
  campaign_id: string;
  phone: string;
  step: string;
  status: string;
  message: string;
  error_message: string | null;
  created_at: string;
};

const normalizePhone = (value: string) => value.replace(/\D/g, "");
const splitOfferTemplates = (value: string) =>
  value
    .split(/\n\s*\n+/)
    .map((block) => block.trim())
    .filter(Boolean);

const statusLabel: Record<string, string> = {
  queued: "Na fila",
  running: "Rodando",
  completed: "Concluída",
  paused: "Pausada",
};

export default function MassBroadcast() {
  const { effectiveCompanyId: companyId, user } = useAuth();
  const [globalEnabled, setGlobalEnabled] = useState(false);
  const [savingToggle, setSavingToggle] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [offerTemplatesInput, setOfferTemplatesInput] = useState("");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);

  const cleanedPhones = useMemo(
    () => Array.from(new Set(phoneInput.split("\n").map(normalizePhone).filter((phone) => phone.length >= 10))),
    [phoneInput],
  );

  const offerTemplates = useMemo(() => splitOfferTemplates(offerTemplatesInput), [offerTemplatesInput]);
  const activeCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.status === "running" || campaign.status === "queued") ?? campaigns[0] ?? null,
    [campaigns],
  );
  const progressValue = activeCampaign
    ? Math.min(100, Math.round((activeCampaign.processed_recipients / Math.max(activeCampaign.total_recipients, 1)) * 100))
    : 0;
  const activeLogs = useMemo(
    () => (activeCampaign ? logs.filter((log) => log.campaign_id === activeCampaign.id) : logs).slice(0, 20),
    [activeCampaign, logs],
  );

  const loadData = async (showSpinner = false) => {
    if (!companyId) return;
    if (showSpinner) setRefreshing(true);
    try {
      const [settingsRes, campaignsRes, logsRes] = await Promise.all([
        supabase
          .from("api_settings" as any)
          .select("id, bulk_send_enabled")
          .eq("company_id", companyId)
          .maybeSingle(),
        supabase
          .from("mass_broadcast_campaigns" as any)
          .select("id, name, status, total_recipients, processed_recipients, success_count, failure_count, created_at, started_at, completed_at")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("mass_broadcast_logs" as any)
          .select("id, campaign_id, phone, step, status, message, error_message, created_at")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false })
          .limit(60),
      ]);

      setGlobalEnabled(Boolean((settingsRes.data as any)?.bulk_send_enabled ?? false));
      setCampaigns(((campaignsRes.data as unknown) as Campaign[]) || []);
      setLogs(((logsRes.data as unknown) as LogRow[]) || []);
    } finally {
      if (showSpinner) setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel(`mass-broadcast-${companyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "api_settings", filter: `company_id=eq.${companyId}` },
        () => void loadData(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mass_broadcast_campaigns", filter: `company_id=eq.${companyId}` },
        () => void loadData(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mass_broadcast_logs", filter: `company_id=eq.${companyId}` },
        () => void loadData(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId]);

  const handleToggleGlobal = async (checked: boolean) => {
    if (!companyId || savingToggle) return;
    setSavingToggle(true);
    try {
      const { data: existing } = await supabase
        .from("api_settings" as any)
        .select("id")
        .eq("company_id", companyId)
        .maybeSingle();

      if ((existing as any)?.id) {
        const { error } = await supabase
          .from("api_settings" as any)
          .update({ bulk_send_enabled: checked })
          .eq("id", (existing as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("api_settings" as any)
          .insert({ company_id: companyId, bulk_send_enabled: checked });
        if (error) throw error;
      }

      setGlobalEnabled(checked);
      toast({
        title: checked ? "Fila global ativada" : "Fila global desativada",
        description: checked
          ? "Os disparos em massa voltarão a ser processados em segundo plano."
          : "Os disparos em massa foram pausados globalmente.",
      });
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error?.message || "Não foi possível atualizar a fila global.", variant: "destructive" });
    } finally {
      setSavingToggle(false);
    }
  };

  const handleCreateCampaign = async () => {
    if (!companyId || !user?.id) return;
    if (cleanedPhones.length === 0) {
      toast({ title: "Adicione números válidos", description: "Cole ao menos um telefone por linha.", variant: "destructive" });
      return;
    }
    if (offerTemplates.length === 0) {
      toast({ title: "Cadastre o textão", description: "Separe os modelos em blocos para alternância automática.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const name = campaignName.trim() || `Campanha ${new Date().toLocaleString("pt-BR")}`;
      const { data: campaign, error: campaignError } = await supabase
        .from("mass_broadcast_campaigns" as any)
        .insert({
          company_id: companyId,
          created_by: user.id,
          name,
          status: "queued",
          total_recipients: cleanedPhones.length,
          offer_templates: offerTemplates,
          greeting_templates: ["Olá!", "Tudo bem?", "Bom dia, como vai?"],
          message_delay_min_seconds: 30,
          message_delay_max_seconds: 90,
        })
        .select("id")
        .single();

      if (campaignError) throw campaignError;

      const recipients = cleanedPhones.map((phone, index) => ({
        campaign_id: (campaign as any).id,
        company_id: companyId,
        phone,
        normalized_phone: phone,
        offer_template: offerTemplates[index % offerTemplates.length],
        status: "pending",
        current_step: "greeting",
        next_action_at: new Date().toISOString(),
      }));

      const { error: recipientsError } = await supabase.from("mass_broadcast_recipients" as any).insert(recipients);
      if (recipientsError) throw recipientsError;

      toast({
        title: "Fila criada",
        description: `${cleanedPhones.length} contatos foram adicionados ao disparo em massa em segundo plano.`,
      });

      setCampaignName("");
      setPhoneInput("");
      await loadData();
    } catch (error: any) {
      toast({ title: "Erro ao criar fila", description: error?.message || "Não foi possível preparar a campanha.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatedPage>
      <div className="space-y-6">
        <Card className="border-destructive/40 bg-destructive/10 shadow-[0_0_24px_-16px_hsl(var(--destructive)/0.8)]">
          <CardContent className="flex items-start gap-3 p-4 sm:p-5">
            <ShieldAlert className="mt-0.5 h-5 w-5 text-destructive" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-destructive">⚠️ ALTO RISCO DE BANIMENTO: Use com moderação e intervalos longos.</p>
              <p className="text-xs text-foreground/80">
                Painel crítico com simulação humana em duas etapas: saudação aleatória, espera de 30 a 90 segundos e envio do textão alternado.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-border/60 bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Painel Crítico · Disparo em Massa
              </CardTitle>
              <CardDescription>
                Cole os números, cadastre variações do textão e deixe a fila rodar em segundo plano enquanto você navega.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4 shadow-[0_0_24px_-14px_hsl(var(--primary)/0.7)]">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="bulk-send-enabled" className="text-sm font-semibold text-foreground">Ativar/Desativar fila global</Label>
                    <p className="text-xs text-muted-foreground">Se desligar, nenhuma campanha da empresa continua processando até religar.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={globalEnabled ? "border-primary/40 bg-primary/10 text-primary" : "border-border/60 bg-muted/40 text-muted-foreground"}>
                      {globalEnabled ? "Fila ativa" : "Fila pausada"}
                    </Badge>
                    <Switch id="bulk-send-enabled" checked={globalEnabled} onCheckedChange={handleToggleGlobal} disabled={savingToggle} />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="campaign-name">Nome da campanha</Label>
                <Input id="campaign-name" value={campaignName} onChange={(event) => setCampaignName(event.target.value)} placeholder="Ex: Oferta IPTV Março" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phones">Números de telefone</Label>
                <Textarea
                  id="phones"
                  value={phoneInput}
                  onChange={(event) => setPhoneInput(event.target.value)}
                  placeholder={"5511999999999\n(11) 98888-7777\n+55 21 97777-6666"}
                  className="min-h-[200px] font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Limpamos automaticamente espaços, parênteses e caracteres especiais. Válidos na fila: <span className="font-semibold text-foreground">{cleanedPhones.length}</span>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="offer-templates">Modelos do textão</Label>
                <Textarea
                  id="offer-templates"
                  value={offerTemplatesInput}
                  onChange={(event) => setOfferTemplatesInput(event.target.value)}
                  placeholder={"Modelo 1 da oferta...\n\nModelo 2 da oferta com outra abordagem...\n\nModelo 3 da oferta com CTA diferente..."}
                  className="min-h-[220px]"
                />
                <p className="text-xs text-muted-foreground">
                  Separe cada modelo com uma linha em branco. O sistema alterna automaticamente entre eles para reduzir padrão repetitivo.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="outline" className="border-border/60 bg-muted/40">Saudações randômicas: 3</Badge>
                <Badge variant="outline" className="border-border/60 bg-muted/40">Delay humano: 30–90s</Badge>
                <Badge variant="outline" className="border-border/60 bg-muted/40">Textões ativos: {offerTemplates.length}</Badge>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={handleCreateCampaign} disabled={submitting || cleanedPhones.length === 0 || offerTemplates.length === 0} className="min-w-[220px]">
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                  Criar fila de disparo
                </Button>
                <Button variant="outline" onClick={() => void loadData(true)} disabled={refreshing}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                  Atualizar monitor
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-border/60 bg-card/80 backdrop-blur">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <Radio className="h-5 w-5 text-primary" />
                  Monitor de Progresso
                </CardTitle>
                <CardDescription>
                  {activeCampaign
                    ? activeCampaign.status === "completed"
                      ? `Campanha concluída: ${activeCampaign.name}`
                      : `Enviando para ${Math.min(activeCampaign.processed_recipients + 1, activeCampaign.total_recipients)} de ${activeCampaign.total_recipients}...`
                    : "Nenhuma campanha em execução no momento."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Progress value={progressValue} className="h-3" />
                {activeCampaign ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">Status</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">{statusLabel[activeCampaign.status] || activeCampaign.status}</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">Processados</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">{activeCampaign.processed_recipients} / {activeCampaign.total_recipients}</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">Entregues</p>
                      <p className="mt-1 text-sm font-semibold text-primary">{activeCampaign.success_count}</p>
                    </div>
                    <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">Falhas</p>
                      <p className="mt-1 text-sm font-semibold text-destructive">{activeCampaign.failure_count}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Crie uma fila para começar a monitorar os disparos.</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/80 backdrop-blur">
              <CardHeader>
                <CardTitle>Log rápido</CardTitle>
                <CardDescription>Quem recebeu e quem falhou nas últimas tentativas.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {activeLogs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sem eventos ainda.</p>
                  ) : (
                    activeLogs.map((log) => (
                      <div key={log.id} className="rounded-xl border border-border/60 bg-muted/25 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">{log.phone}</p>
                            <p className="text-xs text-muted-foreground">
                              {log.step === "greeting" ? "Quebra-gelo" : "Oferta"} · {new Date(log.created_at).toLocaleString("pt-BR")}
                            </p>
                          </div>
                          <Badge variant="outline" className={log.status === "success" ? "border-primary/40 bg-primary/10 text-primary" : "border-destructive/40 bg-destructive/10 text-destructive"}>
                            {log.status === "success" ? "Enviado" : "Falhou"}
                          </Badge>
                        </div>
                        <p className="mt-2 line-clamp-3 text-xs text-foreground/85">{log.message}</p>
                        {log.error_message ? <p className="mt-2 text-xs text-destructive">{log.error_message}</p> : null}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AnimatedPage>
  );
}
