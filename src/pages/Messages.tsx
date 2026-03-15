import { useState, useEffect } from "react";
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
import { Save, Info, Loader2 } from "lucide-react";
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
  const { user } = useAuth();
  const [templates, setTemplates] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("vence_hoje");
  const [pixKey, setPixKey] = useState("");
  const [savingPix, setSavingPix] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchCompanyAndTemplates = async () => {
      const { data: membership } = await supabase
        .from("company_memberships")
        .select("company_id")
        .eq("user_id", user.id)
        .single();
      if (!membership) return;
      setCompanyId(membership.company_id);

      // Fetch pix key
      const { data: settings } = await supabase
        .from("api_settings" as any)
        .select("pix_key")
        .eq("company_id", membership.company_id)
        .maybeSingle();
      if (settings) setPixKey((settings as any).pix_key || "");


      const { data } = await supabase
        .from("message_templates")
        .select("category, message")
        .eq("company_id", membership.company_id);

      const map: Record<string, string> = {};
      categories.forEach((c) => {
        const found = data?.find((t) => t.category === c.key);
        map[c.key] = found ? found.message : c.defaultMessage;
      });
      setTemplates(map);
    };
    fetchCompanyAndTemplates();
  }, [user]);

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
    <div className="space-y-6">
      {/* Compact Pix Key field */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 bg-muted/30 border border-border/50 rounded-lg px-4 py-3">
        <Label className="text-sm font-semibold text-foreground whitespace-nowrap">Sua Chave Pix</Label>
        <Input
          value={pixKey}
          onChange={(e) => setPixKey(e.target.value)}
          placeholder="email@exemplo.com ou CPF/CNPJ"
          className="bg-secondary/50 border-border max-w-[300px]"
        />
        <Button size="sm" onClick={handleSavePixKey} disabled={savingPix} className="shrink-0">
          {savingPix ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
          Salvar
        </Button>
        <p className="text-muted-foreground text-[11px] sm:ml-auto">
          Usada na variável <code className="bg-muted px-1 rounded text-[10px]">{'{sua_chave_pix}'}</code>
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Mensagens de Cobrança</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configure as mensagens enviadas ao clicar em "Cobrar".
          </p>
        </div>
        <div className="flex gap-2">
          <TestSendButton companyId={companyId} />
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Info className="w-4 h-4" />
                Variáveis
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
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          {categories.map((cat) => (
            <TabsTrigger key={cat.key} value={cat.key} className="text-xs data-[state=active]:bg-transparent data-[state=active]:shadow-none">
              <Badge variant="outline" className={`border text-xs transition-colors ${activeTab === cat.key ? cat.color : "bg-muted/50 text-muted-foreground border-border"}`}>
                {cat.label}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {categories.map((cat) => (
          <TabsContent key={cat.key} value={cat.key}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Badge variant="outline" className={`${cat.color} border`}>
                    {cat.label}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">{cat.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-1.5">
                  {variables.map((v) => (
                    <Button
                      key={v.tag}
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
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
                  rows={8}
                  className="font-mono text-sm"
                  placeholder="Digite a mensagem..."
                />
                <div className="flex justify-between items-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground"
                    onClick={() => handleRestoreDefault(cat.key)}
                  >
                    Restaurar padrão
                  </Button>
                  <Button
                    onClick={() => handleSave(cat.key)}
                    disabled={saving === cat.key}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saving === cat.key ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <AutoSendCategoryToggles companyId={companyId} />
      <AutoSendLogs companyId={companyId} />
    </div>
  );
}
