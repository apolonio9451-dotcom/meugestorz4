import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Save, Info } from "lucide-react";

const categories = [
  {
    key: "vence_hoje",
    label: "Vence Hoje",
    color: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    description: "Mensagem enviada para clientes cujo plano vence hoje.",
    defaultMessage:
      "Olá {nome}! 👋\n\nSeu plano vence *hoje*.\n\n📋 Plano: {plano}\n💰 Valor: R$ {valor}\n📅 Vencimento: {vencimento}\n\nPara renovar, entre em contato conosco! 🙏",
  },
  {
    key: "vence_amanha",
    label: "Vence Amanhã",
    color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    description: "Mensagem enviada para clientes cujo plano vence amanhã.",
    defaultMessage:
      "Olá {nome}! 👋\n\nSeu plano vence *amanhã*.\n\n📋 Plano: {plano}\n💰 Valor: R$ {valor}\n📅 Vencimento: {vencimento}\n\nRenove agora para não perder o acesso! 🙏",
  },
  {
    key: "a_vencer",
    label: "A Vencer",
    color: "bg-yellow-600/20 text-yellow-500 border-yellow-600/30",
    description: "Mensagem enviada para clientes cujo plano vence em 2 a 7 dias.",
    defaultMessage:
      "Olá {nome}! 👋\n\nSeu plano vence em *{dias} dias*.\n\n📋 Plano: {plano}\n💰 Valor: R$ {valor}\n📅 Vencimento: {vencimento}\n\nAproveite para renovar com antecedência! 🙏",
  },
  {
    key: "vencidos",
    label: "Vencidos",
    color: "bg-destructive/20 text-destructive border-destructive/30",
    description: "Mensagem enviada para clientes com plano já vencido.",
    defaultMessage:
      "Olá {nome}! 👋\n\nSeu plano está *vencido há {dias} dias*.\n\n📋 Plano: {plano}\n💰 Valor: R$ {valor}\n📅 Venceu em: {vencimento}\n\nRenove agora para voltar a ter acesso! 🙏",
  },
  {
    key: "followup",
    label: "Follow-up",
    color: "bg-cyan-400/20 text-cyan-400 border-cyan-400/50",
    description: "Mensagem de follow-up para clientes em acompanhamento.",
    defaultMessage:
      "Olá {nome}! 👋\n\nEstamos entrando em contato para saber se tem interesse em renovar.\n\n📋 Plano: {plano}\n💰 Valor: R$ {valor}\n\nEstamos à disposição! 🙏",
  },
];

const variables = [
  { tag: "{nome}", desc: "Nome do cliente" },
  { tag: "{plano}", desc: "Nome do plano" },
  { tag: "{valor}", desc: "Valor do plano (R$)" },
  { tag: "{vencimento}", desc: "Data de vencimento" },
  { tag: "{dias}", desc: "Dias até vencer / vencido" },
  { tag: "{mac}", desc: "Endereço MAC (se houver)" },
  { tag: "{usuario}", desc: "Usuário IPTV" },
  { tag: "{senha}", desc: "Senha IPTV" },
  { tag: "{servidor}", desc: "Nome do servidor" },
];

export default function Messages() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);

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
      toast({ title: "Salvo!", description: "Mensagem atualizada com sucesso." });
    } catch {
      toast({ title: "Erro", description: "Não foi possível salvar.", variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const insertVariable = (categoryKey: string, tag: string) => {
    setTemplates((prev) => ({ ...prev, [categoryKey]: (prev[categoryKey] || "") + tag }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Mensagens de Cobrança</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configure as mensagens que serão enviadas ao clicar em "Cobrar" no card do cliente.
        </p>
      </div>

      {/* Variables reference */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="w-4 h-4" /> Variáveis disponíveis
          </CardTitle>
          <CardDescription className="text-xs">
            Clique em uma variável para inserir no texto. Elas serão substituídas pelos dados reais do cliente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {variables.map((v) => (
              <div key={v.tag} className="text-xs">
                <code className="bg-muted px-1.5 py-0.5 rounded font-mono">{v.tag}</code>
                <span className="text-muted-foreground ml-1">{v.desc}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="vence_hoje" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1">
          {categories.map((cat) => (
            <TabsTrigger key={cat.key} value={cat.key} className="text-xs">
              <Badge variant="outline" className={`${cat.color} border text-xs`}>
                {cat.label}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {categories.map((cat) => (
          <TabsContent key={cat.key} value={cat.key}>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Badge variant="outline" className={`${cat.color} border`}>
                    {cat.label}
                  </Badge>
                </CardTitle>
                <CardDescription>{cat.description}</CardDescription>
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
                    onClick={() =>
                      setTemplates((prev) => ({ ...prev, [cat.key]: cat.defaultMessage }))
                    }
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
    </div>
  );
}
