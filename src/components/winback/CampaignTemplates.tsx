import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Save, ChevronDown, ChevronUp, Zap } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const campaignDays = [
  {
    key: "winback_day1",
    day: 1,
    label: "Dia 1",
    trigger: "Saudade & Reconexão",
    color: "bg-primary/20 text-primary border-primary/30",
    description: "Primeiro contato — mensagem leve de saudade para reabrir o diálogo.",
    defaultMessage:
      "Olá {nome}! 👋\n\nSentimos sua falta por aqui! Faz um tempinho que você não está com a gente.\n\nSeu último plano era o *{plano}* e queremos te ajudar a voltar.\n\nTem interesse? Responda essa mensagem! 😊",
  },
  {
    key: "winback_day3",
    day: 3,
    label: "Dia 3",
    trigger: "Benefício & Valor",
    color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
    description: "Destaque os benefícios e o valor do serviço que o cliente está perdendo.",
    defaultMessage:
      "Oi {nome}! 😊\n\nVocê sabia que nossos clientes estão aproveitando novidades incríveis?\n\nSeu plano *{plano}* por apenas *R$ {valor}* te dá acesso completo.\n\nQue tal voltar e conferir? 🚀",
  },
  {
    key: "winback_day6",
    day: 6,
    label: "Dia 6",
    trigger: "Prova Social",
    color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    description: "Use prova social — mostre que outros clientes já voltaram e estão satisfeitos.",
    defaultMessage:
      "Oi {nome}! 👋\n\nMuitos clientes que estavam na mesma situação já voltaram e estão curtindo nosso serviço!\n\nPlano *{plano}* • R$ {valor}\n\nVem fazer parte desse grupo também! 💪",
  },
  {
    key: "winback_day10",
    day: 10,
    label: "Dia 10",
    trigger: "Oferta Especial",
    color: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    description: "Apresente uma oferta especial ou condição exclusiva para reconquistar o cliente.",
    defaultMessage:
      "Fala {nome}! 🔥\n\nPreparei uma *condição especial* pra você voltar:\n\nPlano *{plano}* com um valor diferenciado!\n\nEssa oferta é por tempo limitado. Quer saber mais? Me chama! ⏳",
  },
  {
    key: "winback_day15",
    day: 15,
    label: "Dia 15",
    trigger: "Última Chance & Urgência",
    color: "bg-destructive/20 text-destructive border-destructive/30",
    description: "Último contato da campanha — crie urgência e encerre o ciclo com elegância.",
    defaultMessage:
      "Olá {nome}! 👋\n\nEssa é minha última tentativa de contato.\n\nSei que imprevistos acontecem, mas quero que saiba que a porta está aberta.\n\nPlano *{plano}* • R$ {valor}\n\nSe mudar de ideia, é só me chamar! 🙏",
  },
];

const variables = [
  { tag: "{nome}", desc: "Nome do cliente" },
  { tag: "{plano}", desc: "Último plano" },
  { tag: "{valor}", desc: "Valor do plano" },
  { tag: "{dias}", desc: "Dias vencido" },
  { tag: "{servidor}", desc: "Servidor" },
];

interface Props {
  companyId: string | null;
}

export default function CampaignTemplates({ companyId }: Props) {
  const [templates, setTemplates] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [openDays, setOpenDays] = useState<Record<string, boolean>>({ winback_day1: true });

  useEffect(() => {
    if (!companyId) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("message_templates")
        .select("category, message")
        .eq("company_id", companyId)
        .like("category", "winback_%");

      const map: Record<string, string> = {};
      campaignDays.forEach((c) => {
        const found = data?.find((t) => t.category === c.key);
        map[c.key] = found ? found.message : c.defaultMessage;
      });
      setTemplates(map);
    };
    fetch();
  }, [companyId]);

  const handleSave = async (key: string) => {
    if (!companyId) return;
    setSaving(key);
    try {
      const { error } = await supabase
        .from("message_templates")
        .upsert(
          { company_id: companyId, category: key, message: templates[key] },
          { onConflict: "company_id,category" }
        );
      if (error) throw error;
      toast.success("Mensagem salva com sucesso!");
    } catch {
      toast.error("Erro ao salvar mensagem.");
    } finally {
      setSaving(null);
    }
  };

  const insertVariable = (key: string, tag: string) => {
    setTemplates((prev) => ({ ...prev, [key]: (prev[key] || "") + tag }));
  };

  const toggle = (key: string) => {
    setOpenDays((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-5 h-5 text-primary" />
        <div>
          <h2 className="text-lg font-display font-bold text-foreground">Campanha Guiada — 15 dias</h2>
          <p className="text-xs text-muted-foreground">
            5 mensagens estratégicas com gatilhos diferentes para reconquistar o cliente.
          </p>
        </div>
      </div>

      {campaignDays.map((day) => (
        <Collapsible key={day.key} open={openDays[day.key] ?? false} onOpenChange={() => toggle(day.key)}>
          <Card className="glass-card border-border/30">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer pb-2 hover:bg-muted/30 transition-colors rounded-t-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={`${day.color} border text-xs font-mono`}>
                      {day.label}
                    </Badge>
                    <div>
                      <CardTitle className="text-sm">{day.trigger}</CardTitle>
                      <CardDescription className="text-xs">{day.description}</CardDescription>
                    </div>
                  </div>
                  {openDays[day.key] ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-3 pt-0">
                <div className="flex flex-wrap gap-1.5">
                  {variables.map((v) => (
                    <Button
                      key={v.tag}
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => insertVariable(day.key, v.tag)}
                    >
                      {v.tag}
                    </Button>
                  ))}
                </div>
                <Textarea
                  value={templates[day.key] || ""}
                  onChange={(e) => setTemplates((prev) => ({ ...prev, [day.key]: e.target.value }))}
                  rows={6}
                  className="font-mono text-sm"
                  placeholder="Digite a mensagem..."
                />
                <div className="flex justify-between items-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground"
                    onClick={() => setTemplates((prev) => ({ ...prev, [day.key]: day.defaultMessage }))}
                  >
                    Restaurar padrão
                  </Button>
                  <Button onClick={() => handleSave(day.key)} disabled={saving === day.key} size="sm">
                    <Save className="w-4 h-4 mr-2" />
                    {saving === day.key ? "Salvando..." : "Salvar"}
                  </Button>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      ))}
    </div>
  );
}
