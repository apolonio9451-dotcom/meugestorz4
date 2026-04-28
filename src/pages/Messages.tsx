import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Save, Info, Loader2, Play, Pause, RefreshCw } from "lucide-react";
import { defaultMessageTemplates } from "@/lib/defaultMessageTemplates";
import AutoSendLogs from "@/components/messages/AutoSendLogs";
import AutoSendCategoryToggles from "@/components/messages/AutoSendCategoryToggles";
import TestSendButton from "@/components/messages/TestSendButton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";

const categories = [
  {
    key: "vence_hoje",
    label: "Vence Hoje",
    color: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    description: "Mensagem enviada para clientes cujo plano vence hoje.",
    defaultMessage: defaultMessageTemplates.vence_hoje,
  },
  {
    key: "vence_amanha",
    label: "Vence Amanhã",
    color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    description: "Mensagem enviada para clientes cujo plano vence amanhã.",
    defaultMessage: defaultMessageTemplates.vence_amanha,
  },
  {
    key: "a_vencer",
    label: "A Vencer",
    color: "bg-yellow-600/20 text-yellow-500 border-yellow-600/30",
    description: "Mensagem enviada para clientes cujo plano vence em 3 dias.",
    defaultMessage: defaultMessageTemplates.a_vencer,
  },
  {
    key: "vencidos",
    label: "Vencidos",
    color: "bg-destructive/20 text-destructive border-destructive/30",
    description: "Mensagem enviada para clientes com plano já vencido.",
    defaultMessage: defaultMessageTemplates.vencidos,
  },
  {
    key: "followup",
    label: "Follow-up",
    color: "bg-cyan-400/20 text-cyan-400 border-cyan-400/50",
    description: "Mensagem de follow-up para clientes em acompanhamento.",
    defaultMessage: defaultMessageTemplates.followup,
  },
  {
    key: "suporte",
    label: "Suporte",
    color: "bg-violet-400/20 text-violet-400 border-violet-400/50",
    description: "Mensagem de check-up de satisfação enviada após suporte técnico.",
    defaultMessage: defaultMessageTemplates.suporte,
  },
  {
    key: "renovacao",
    label: "Renovação",
    color: "bg-emerald-400/20 text-emerald-400 border-emerald-400/50",
    description: "Mensagem de agradecimento enviada após a renovação do plano do cliente.",
    defaultMessage: defaultMessageTemplates.renovacao,
  },
];

const variables = [
  { tag: "{saudacao}", desc: "Bom dia / Boa tarde / Boa noite (automático)" },
  { tag: "{dia_semana}", desc: "Dia da semana (ex: Segunda-feira)" },
  { tag: "{dia}", desc: "Dia do mês (ex: 10)" },
  { tag: "{nome}", desc: "Nome do cliente" },
  { tag: "{primeiro_nome}", desc: "Primeiro nome do cliente" },
  { tag: "{plano}", desc: "Nome do plano" },
  { tag: "{valor}", desc: "Valor do plano (R$)" },
  { tag: "{vencimento}", desc: "Data de vencimento" },
  { tag: "{dias}", desc: "Dias até vencer / vencido" },
  { tag: "{mac}", desc: "Endereço MAC (se houver)" },
  { tag: "{usuario}", desc: "Usuário IPTV" },
  { tag: "{senha}", desc: "Senha IPTV" },
  { tag: "{servidor}", desc: "Nome do servidor" },
  { tag: "{sua_chave_pix}", desc: "Chave Pix (configurada em Configurações)" },
];

export default function Messages() {
  const { user, effectivePlanType: planType, companyId: authCompanyId, loading } = useAuth();
  const [templates, setTemplates] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("vence_hoje");
  const [pixKey, setPixKey] = useState("");
  const [savingPix, setSavingPix] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [whatsappConnected, setWhatsappConnected] = useState<boolean | null>(null);
  const [checkingWhatsapp, setCheckingWhatsapp] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const shouldShowUpgradeUI = !loading && planType !== "pro";

  const checkWhatsappStatus = useCallback(async () => {
    if (!user) return;
    setCheckingWhatsapp(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-manage", {
        body: { action: "status" }
      });
      if (!error && data) {
        setWhatsappConnected(data.connected);
      }
    } catch (err) {
      console.error("Error checking whatsapp:", err);
    } finally {
      setCheckingWhatsapp(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user || !authCompanyId) return;
    const fetchCompanyAndTemplates = async () => {
      setCompanyId(authCompanyId);

      // Fetch pix key
      const { data: settings } = await supabase
        .from("api_settings" as any)
        .select("pix_key")
        .eq("company_id", authCompanyId)
        .maybeSingle();
      if (settings) setPixKey((settings as any).pix_key || "");

      const { data } = await supabase
        .from("message_templates")
        .select("category, message")
        .eq("company_id", authCompanyId);

      const map: Record<string, string> = {};
      categories.forEach((c) => {
        const found = data?.find((t) => t.category === c.key);
        map[c.key] = found ? found.message : c.defaultMessage;
      });
      setTemplates(map);
    };
    fetchCompanyAndTemplates();
    checkWhatsappStatus();
  }, [user, authCompanyId, checkWhatsappStatus]);

  const handlePauseRestart = async (action: "pause" | "restart") => {
    if (!user) return;
    setActionLoading(action);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-manage", {
        body: { action: action === "pause" ? "pause" : "restart" }
      });
      
      if (error || data?.error) throw new Error(data?.error || error?.message);
      
      toast({ 
        title: action === "pause" ? "Instância Pausada" : "Instância Reiniciada",
        description: action === "pause" ? "As automações foram pausadas." : "As automações foram retomadas."
      });
      checkWhatsappStatus();
    } catch (err: any) {
      toast({ 
        title: "Erro", 
        description: err.message || "Erro ao processar comando", 
        variant: "destructive" 
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSave = async (categoryKey: string) => {
    if (!companyId) return;
    setSaving(categoryKey);
    try {
      const { error } = await supabase
        .from("message_templates")
        .upsert(
          { company_id: companyId, category: categoryKey, message: templates[categoryKey] },
          { onConflict: "company_id,category" }
        );
      if (error) throw error;
      // Dispatch event so other pages (Clients) can refresh templates
      window.dispatchEvent(new CustomEvent("templates-updated"));
      toast({ title: "Salvo!", description: "Mensagem atualizada com sucesso." });
    } catch (err: any) {
      console.error("Erro ao salvar template:", err);
      toast({ title: "Erro", description: err?.message || "Não foi possível salvar.", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const handleRestoreDefault = async (categoryKey: string) => {
    if (!companyId) return;
    const cat = categories.find(c => c.key === categoryKey);
    if (!cat) return;
    // Delete custom template from DB so system uses default
    await supabase
      .from("message_templates")
      .delete()
      .eq("company_id", companyId)
      .eq("category", categoryKey);
    setTemplates((prev) => ({ ...prev, [categoryKey]: cat.defaultMessage }));
    window.dispatchEvent(new CustomEvent("templates-updated"));
    toast({ title: "Restaurado!", description: "Mensagem restaurada ao padrão." });
  };

  const insertVariable = (categoryKey: string, tag: string) => {
    setTemplates((prev) => ({ ...prev, [categoryKey]: (prev[categoryKey] || "") + tag }));
  };

  const handleSavePixKey = async () => {
    if (!companyId) return;
    setSavingPix(true);
    try {
      const { data: existing } = await supabase
        .from("api_settings" as any)
        .select("id")
        .eq("company_id", companyId)
        .maybeSingle();
      if (existing) {
        await supabase.from("api_settings" as any).update({ pix_key: pixKey.trim() }).eq("id", (existing as any).id);
      } else {
        await supabase.from("api_settings" as any).insert({ company_id: companyId, pix_key: pixKey.trim() });
      }
      toast({ title: "Chave Pix salva!" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err?.message, variant: "destructive" });
    } finally {
      setSavingPix(false);
    }
  };

  return (
    <div className="space-y-3 px-3 sm:px-0">
      {/* Compact Pix Key field */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 bg-muted/30 border border-border/50 rounded-lg px-3 py-2">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Input
            value={pixKey}
            onChange={(e) => setPixKey(e.target.value)}
            placeholder="Chave Pix (email, CPF...)"
            className="bg-secondary/50 border-border h-8 text-sm max-w-[260px]"
          />
          <Button size="sm" onClick={handleSavePixKey} disabled={savingPix} className="shrink-0 h-8 px-2.5">
            {savingPix ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          </Button>
        </div>
        <p className="text-muted-foreground text-[10px] sm:ml-auto">
          Variável <code className="bg-muted px-1 rounded text-[10px]">{'{sua_chave_pix}'}</code>
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-display font-bold text-foreground">Mensagens de Cobrança</h1>
          <p className="text-muted-foreground text-xs">
            Templates enviados ao clicar em "Cobrar".
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="hidden sm:flex items-center gap-1.5 mr-2 px-3 py-1.5 bg-muted/40 rounded-lg border border-border/50">
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${whatsappConnected ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.5)]"}`} />
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                {checkingWhatsapp ? "Verificando..." : whatsappConnected ? "API Online" : "API Offline"}
              </span>
            </div>
            <div className="h-4 w-[1px] bg-border mx-1" />
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-500/10"
                onClick={() => handlePauseRestart("restart")}
                disabled={!!actionLoading}
              >
                {actionLoading === "restart" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7 text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                onClick={() => handlePauseRestart("pause")}
                disabled={!!actionLoading}
              >
                {actionLoading === "pause" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pause className="h-3.5 w-3.5 fill-current" />}
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7 text-muted-foreground"
                onClick={checkWhatsappStatus}
                disabled={checkingWhatsapp}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${checkingWhatsapp ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          <TestSendButton companyId={companyId} />
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8">
                <Info className="w-3.5 h-3.5" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle>Variáveis disponíveis</DialogTitle>
                <DialogDescription>
                  Use estas variáveis nos templates. Elas serão substituídas pelos dados reais do cliente.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-2 mt-2">
                {variables.map((v) => (
                  <div key={v.tag} className="flex items-center gap-3 text-sm">
                    <code className="bg-muted px-2 py-1 rounded font-mono text-xs min-w-[110px]">{v.tag}</code>
                    <span className="text-muted-foreground">{v.desc}</span>
                  </div>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="vence_hoje" className="w-full" onValueChange={(v) => setActiveTab(v)}>
        <TabsList className="flex flex-wrap h-auto gap-0.5 bg-muted/50 p-0.5">
          {categories.map((cat) => (
            <TabsTrigger key={cat.key} value={cat.key} className="text-[11px] px-1.5 py-1 data-[state=active]:bg-transparent data-[state=active]:shadow-none">
              <Badge variant="outline" className={`border text-[11px] transition-colors ${activeTab === cat.key ? cat.color : "bg-muted/50 text-muted-foreground border-border"}`}>
                {cat.label}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {categories.map((cat) => (
          <TabsContent key={cat.key} value={cat.key} className="mt-2">
            <Card>
              <CardHeader className="px-3 py-2 pb-1.5">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className={`${cat.color} border text-xs`}>
                    {cat.label}
                  </Badge>
                </div>
                <CardDescription className="text-[11px] mt-0.5">{cat.description}</CardDescription>
              </CardHeader>
              <CardContent className="px-3 pb-3 pt-1 space-y-2">
                <div className="flex flex-wrap gap-1">
                  {variables.map((v) => (
                    <Button
                      key={v.tag}
                      variant="outline"
                      size="sm"
                      className="text-[10px] h-6 px-1.5"
                      onClick={() => insertVariable(cat.key, v.tag)}
                    >
                      {v.tag}
                    </Button>
                  ))}
                </div>
                <Textarea
                  value={templates[cat.key] || ""}
                  onChange={(e) =>
                    setTemplates((prev) => ({ ...prev, [cat.key]: e.target.value }))
                  }
                  rows={4}
                  className="font-mono text-xs min-h-[80px]"
                  placeholder="Digite a mensagem..."
                />
                <div className="flex justify-between items-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[11px] h-7 text-muted-foreground"
                    onClick={() => handleRestoreDefault(cat.key)}
                  >
                    Restaurar padrão
                  </Button>
                  <Button
                    size="sm"
                    className="h-8"
                    onClick={() => handleSave(cat.key)}
                    disabled={saving === cat.key}
                  >
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                    {saving === cat.key ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <AutoSendCategoryToggles
        companyId={companyId}
        planType={loading ? "pro" : planType}
        onUpgradeClick={() => shouldShowUpgradeUI && setUpgradeModalOpen(true)}
      />
      <AutoSendLogs companyId={companyId} />

      {/* Upgrade Modal for Messages page */}
      {shouldShowUpgradeUI && (
        <Dialog open={upgradeModalOpen} onOpenChange={setUpgradeModalOpen}>
          <DialogContent data-upgrade-ui className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-center">
                Desbloqueie o Poder Total da Automação 🚀
              </DialogTitle>
              <DialogDescription className="text-center text-sm">
                Os controles de automação são exclusivos do <span data-upgrade-ui className="text-[hsl(48,96%,53%)] font-bold">Plano PRO</span>.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <div data-upgrade-ui className="rounded-xl border border-[hsl(48,96%,53%)]/20 bg-[hsl(48,96%,53%)]/5 p-4 space-y-2.5">
                {[
                  "Conexão direta via API (Instância)",
                  "Disparos automáticos diários (Vence hoje/amanhã/vencidos)",
                  "Follow-up e Suporte automatizados",
                  "Gestão de rede completa",
                ].map((benefit) => (
                  <div key={benefit} className="flex items-start gap-2.5 text-sm">
                    <span className="text-green-400 mt-0.5 shrink-0">✅</span>
                    <span className="text-foreground">{benefit}</span>
                  </div>
                ))}
              </div>
              <Button
                data-upgrade-ui
                className="w-full gap-2 font-bold rounded-xl py-3.5 h-auto bg-[hsl(48,96%,53%)] text-black hover:bg-[hsl(48,96%,45%)] hover:scale-[1.02] shadow-[0_0_20px_hsl(48,96%,53%,0.3)]"
                onClick={() => setUpgradeModalOpen(false)}
              >
                <Save className="w-4 h-4" />
                Quero ser PRO agora
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
