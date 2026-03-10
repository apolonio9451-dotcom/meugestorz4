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
import AutoSendLogs from "@/components/messages/AutoSendLogs";
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
    defaultMessage:
      "Olá, {primeiro_nome}, {saudacao}! ⏳\n\nSeu acesso vence hoje, {dia_semana} dia {dia}. Seu sinal pode cair a qualquer momento, confira os dados para renovação:\n\n📋 *Plano*: {plano}\n💰 *Valor*: R$ {valor}\n📅 *Vencimento*: {vencimento}\n\n💳 Pagamento Pix\nClique na chave para copiar:\n\n📌 Chave: {sua_chave_pix}\n👤 Nome: [Seu Nome]\n\n_Após o pagamento, envie o comprovante por aqui para liberação imediata._",
  },
  {
    key: "vence_amanha",
    label: "Vence Amanhã",
    color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    description: "Mensagem enviada para clientes cujo plano vence amanhã.",
    defaultMessage:
      "Olá, {nome}! 👋\n\nPassando para lembrar que o seu acesso vence amanhã! 🗓️\n\nGaranta sua renovação antecipada para continuar aproveitando sem interrupções.\n\n📋 Plano: {plano}\n\n💰 Valor: R$ {valor}\n\n📅 Vencimento: {vencimento} ({dias} dias)\n\n🔑 Dados de Acesso:\n\n👤 Usuário: {usuario}\n\n🔑 Senha: {senha}\n\n🖥️ MAC: {mac}\n\n🌐 Servidor: {servidor}\n\nDeseja garantir sua vaga? Basta efetuar o Pix e enviar o comprovante:\n\n📌 Dados para Pagamento:\n\nBanco: [Seu Banco]\n\nNome: [Seu Nome]\n\nChave Pix: [Sua Chave]\n\nQualquer dúvida, estou aqui para ajudar! 🚀",
  },
  {
    key: "a_vencer",
    label: "A Vencer",
    color: "bg-yellow-600/20 text-yellow-500 border-yellow-600/30",
    description: "Mensagem enviada para clientes cujo plano vence em 2 a 7 dias.",
    defaultMessage:
      "Olá, {nome}! 👋\n\nTudo bem por aí? Passando apenas para te manter informado sobre o status do seu acesso. Seu plano vence em {dias} dias! ⏳\n\nPreparamos tudo para que você continue aproveitando sua programação sem interrupções. Confira os detalhes:\n\n📋 Resumo da Assinatura:\n\nPlano: {plano}\n\nValor: R$ {valor}\n\nVencimento: {vencimento}\n\n🔑 Dados do Seu Acesso:\n\n👤 Usuário: {usuario}\n\n🔑 Senha: {senha}\n\n🖥️ MAC: {mac}\n\n🌐 Servidor: {servidor}\n\nQuer se antecipar e garantir sua renovação? 🚀\n\nBasta realizar o Pix e nos enviar o comprovante por aqui:\n\n📌 Dados para Pagamento:\n\nBanco: [Seu Banco]\n\nNome: [Seu Nome]\n\nChave Pix: [Sua Chave]\n\nQualquer dúvida ou se precisar de suporte, conte comigo! 😊",
  },
  {
    key: "vencidos",
    label: "Vencidos",
    color: "bg-destructive/20 text-destructive border-destructive/30",
    description: "Mensagem enviada para clientes com plano já vencido.",
    defaultMessage:
      "Olá, {nome}! 👋\n\nNotamos que o seu plano venceu e o seu acesso pode estar interrompido. 🚫\nNão queremos que você perca seus conteúdos! Vamos regularizar isso agora?\n\n📋 Dados da Assinatura Vencida:\n\nPlano: {plano}\n\nValor: R$ {valor}\n\nVencimento: {vencimento}\n\n🔑 Suas Credenciais:\n\n👤 Usuário: {usuario} | 🖥️ MAC: {mac}\n\n🌐 Servidor: {servidor}",
  },
  {
    key: "followup",
    label: "Follow-up",
    color: "bg-cyan-400/20 text-cyan-400 border-cyan-400/50",
    description: "Mensagem de follow-up para clientes em acompanhamento.",
    defaultMessage:
      "Olá, {nome}! 👋\n\nPassando hoje com um sentimento de gratidão por ter você conosco! Já se passaram {dias} dias desde o seu cadastro e é um privilégio fazer parte do seu entretenimento diário. 🌟\n\nNossa maior prioridade é garantir que você tenha a melhor experiencia possível com nosso serviços. Por isso, gostaria de saber: como está sendo sua experiência até agora? Seu feedback é valioso para continuarmos evoluindo nosso serviço! 🚀\n\n📋 Resumo da Sua Assinatura:\n\nPlano: {plano} | Valor: R$ {valor}\n\nVencimento: {vencimento}\n\n🔑 Seus Dados:\n\n👤 Usuário: {usuario} |\n\n🖥️ MAC: {mac} | 🌐 Servidor: {servidor}",
  },
  {
    key: "suporte",
    label: "Suporte",
    color: "bg-violet-400/20 text-violet-400 border-violet-400/50",
    description: "Mensagem de check-up de satisfação enviada após suporte técnico.",
    defaultMessage:
      "Olá, {nome}! 👋\n\nFaço questão de entrar em contato para saber como ficou o seu sinal após o nosso último suporte. Como está a sua experiência hoje? 🌟\n\nPassando apenas para confirmar se ficou tudo 100% resolvido, pois sua satisfação é nossa prioridade e queremos garantir que você esteja em boas mãos. 🤝",
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

      <AutoSendLogs companyId={companyId} />
    </div>
  );
}
