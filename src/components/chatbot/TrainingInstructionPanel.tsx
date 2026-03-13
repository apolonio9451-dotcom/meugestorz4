import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Save, Loader2, X, Pencil, FileAudio, FileVideo,
  Layers, MessageSquare, SplitSquareHorizontal, Plus, Trash2
} from "lucide-react";

interface Props {
  companyId: string;
  triggerQuestion: string;
  currentBotReply: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function TrainingInstructionPanel({
  companyId,
  triggerQuestion,
  currentBotReply,
  onClose,
  onSaved,
}: Props) {
  const [instruction, setInstruction] = useState("");
  const [actionType, setActionType] = useState("text");
  const [actionConfig, setActionConfig] = useState<any>({});
  const [mediaId, setMediaId] = useState<string | null>(null);
  const [mediaFiles, setMediaFiles] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [existingRuleId, setExistingRuleId] = useState<string | null>(null);
  const [splitMessages, setSplitMessages] = useState(false);
  const [messageParts, setMessageParts] = useState<string[]>([""]);

  useEffect(() => {
    fetchMedia();
    checkExistingRule();
  }, []);

  const fetchMedia = async () => {
    const { data } = await supabase
      .from("chatbot_media")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (data) setMediaFiles(data as any[]);
  };

  const checkExistingRule = async () => {
    const { data } = await supabase
      .from("bot_training_rules")
      .select("*")
      .eq("company_id", companyId)
      .ilike("trigger_question", `%${triggerQuestion.slice(0, 50)}%`)
      .limit(1);
    if (data && data.length > 0) {
      const rule = data[0];
      setExistingRuleId(rule.id);
      setInstruction(rule.instruction || "");
      setActionType(rule.action_type || "text");
      setActionConfig(rule.action_config || {});
      setMediaId(rule.media_id || null);
      // Restore split messages state
      const config = rule.action_config as any || {};
      if (config.split_messages && Array.isArray(config.message_parts)) {
        setSplitMessages(true);
        setMessageParts(config.message_parts);
      }
    }
  };

  const addMessagePart = () => {
    setMessageParts([...messageParts, ""]);
  };

  const removeMessagePart = (index: number) => {
    if (messageParts.length <= 1) return;
    setMessageParts(messageParts.filter((_, i) => i !== index));
  };

  const updateMessagePart = (index: number, value: string) => {
    const updated = [...messageParts];
    updated[index] = value;
    setMessageParts(updated);
  };

  const handleSave = async () => {
    const trimmedInstruction = instruction.trim();
    const isMediaAction = actionType === "media";

    // For split messages, build instruction from parts
    const finalInstruction = splitMessages
      ? messageParts.filter(p => p.trim()).join("\n---SEPARADOR---\n")
      : trimmedInstruction;

    if (!finalInstruction && !isMediaAction) {
      toast({ title: "Escreva a instrução", variant: "destructive" });
      return;
    }

    if (isMediaAction && !mediaId) {
      toast({ title: "Selecione um áudio/mídia para anexar", variant: "destructive" });
      return;
    }

    if (splitMessages && messageParts.filter(p => p.trim()).length < 2) {
      toast({ title: "Adicione pelo menos 2 mensagens para usar o modo dividido", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const finalConfig = {
        ...actionConfig,
        split_messages: splitMessages,
        message_parts: splitMessages ? messageParts.filter(p => p.trim()) : undefined,
      };

      const payload: any = {
        company_id: companyId,
        trigger_question: triggerQuestion,
        instruction: splitMessages
          ? `Responda em ${messageParts.filter(p => p.trim()).length} mensagens SEPARADAS. Use o separador ---SEPARADOR--- entre cada mensagem. As mensagens devem ser:\n${finalInstruction}`
          : (finalInstruction || "Quando essa pergunta ocorrer, envie automaticamente a mídia selecionada e responda de forma natural."),
        action_type: actionType,
        action_config: finalConfig,
        is_active: true,
        media_id: isMediaAction ? mediaId : null,
      };

      if (existingRuleId) {
        const { error } = await supabase
          .from("bot_training_rules")
          .update(payload)
          .eq("id", existingRuleId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("bot_training_rules")
          .insert(payload);
        if (error) throw error;
      }

      toast({ title: "✅ Regra salva! O bot usará esta instrução nas conversas reais." });
      onSaved();
      onClose();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const hasContent = splitMessages
    ? messageParts.filter(p => p.trim()).length >= 2
    : instruction.trim().length > 0;

  return (
    <div className="bg-background border-l border-border h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-primary/10 border-b border-border/30 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Pencil className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Instruir Resposta (Treinamento Real)</span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Context */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Pergunta do Cliente</Label>
          <div className="bg-secondary/50 rounded-lg px-3 py-2 text-sm text-foreground">
            "{triggerQuestion}"
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Resposta Atual do Bot</Label>
          <div className="bg-secondary/30 rounded-lg px-3 py-2 text-xs text-muted-foreground max-h-24 overflow-y-auto">
            {currentBotReply}
          </div>
        </div>

        {/* Split messages toggle */}
        <div className="flex items-center justify-between border-t border-border pt-4">
          <div className="flex items-center gap-2">
            <SplitSquareHorizontal className="w-4 h-4 text-primary" />
            <div>
              <Label className="text-sm font-semibold">Dividir em várias mensagens</Label>
              <p className="text-[10px] text-muted-foreground">
                O bot enviará cada parte como uma mensagem separada
              </p>
            </div>
          </div>
          <Switch checked={splitMessages} onCheckedChange={setSplitMessages} />
        </div>

        {/* Instruction */}
        <div className="space-y-2">
          {splitMessages ? (
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Mensagens (em ordem de envio)</Label>
              <p className="text-[10px] text-muted-foreground">
                Cada campo será enviado como uma mensagem separada no WhatsApp, com um pequeno intervalo entre elas.
              </p>
              {messageParts.map((part, index) => (
                <div key={index} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] text-muted-foreground font-mono">
                      Mensagem {index + 1}
                    </Label>
                    {messageParts.length > 1 && (
                      <button
                        onClick={() => removeMessagePart(index)}
                        className="text-destructive hover:text-destructive/80 p-0.5"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <Textarea
                    value={part}
                    onChange={(e) => updateMessagePart(index, e.target.value)}
                    placeholder={`Ex: ${index === 0 ? "Olá! Que bom te ver por aqui 😊" : index === 1 ? "Temos ótimos planos pra você..." : "Qual desses te interessa mais?"}`}
                    className="min-h-[70px] text-sm bg-secondary/30"
                  />
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={addMessagePart}
                className="w-full border-dashed"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Adicionar mais uma mensagem
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Instrução para a IA</Label>
              <p className="text-[10px] text-muted-foreground">
                Diga à IA como ela deve se comportar quando receber essa pergunta ou similar.
                {actionType === "media" && " Para regra de áudio/mídia, você pode deixar esse campo vazio e apenas selecionar a mídia abaixo."}
              </p>
              <Textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="Ex: Quando o cliente perguntar sobre preço, apresente nossos 3 planos: Básico R$29.90, Premium R$49.90 e Ultra R$79.90. Destaque o Premium como melhor custo-benefício."
                className="min-h-[120px] text-sm bg-secondary/30"
              />
            </div>
          )}
        </div>

        {/* Action type */}
        <div className="space-y-2 border-t border-border pt-4">
          <Label className="text-sm font-semibold">Ação Anexada (opcional)</Label>
          <Select value={actionType} onValueChange={setActionType}>
            <SelectTrigger className="bg-secondary/30">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">
                <span className="flex items-center gap-2">
                  <MessageSquare className="w-3 h-3" /> Apenas Texto
                </span>
              </SelectItem>
              <SelectItem value="buttons">
                <span className="flex items-center gap-2">
                  <Layers className="w-3 h-3" /> Botões Rápidos
                </span>
              </SelectItem>
              <SelectItem value="list">
                <span className="flex items-center gap-2">
                  <Layers className="w-3 h-3" /> Menu de Lista
                </span>
              </SelectItem>
              <SelectItem value="media">
                <span className="flex items-center gap-2">
                  <FileAudio className="w-3 h-3" /> Enviar Mídia
                </span>
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Buttons config */}
          {actionType === "buttons" && (
            <div className="space-y-2 bg-secondary/20 rounded-lg p-3">
              <Label className="text-xs">Botões (até 3, separados por |)</Label>
              <input
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={actionConfig.buttons || ""}
                onChange={(e) => setActionConfig({ ...actionConfig, buttons: e.target.value })}
                placeholder="Plano Básico|Plano Premium|Plano Ultra"
              />
            </div>
          )}

          {/* List config */}
          {actionType === "list" && (
            <div className="space-y-2 bg-secondary/20 rounded-lg p-3">
              <Label className="text-xs">Itens da lista (separados por |)</Label>
              <input
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                value={actionConfig.items || ""}
                onChange={(e) => setActionConfig({ ...actionConfig, items: e.target.value })}
                placeholder="Item 1|Item 2|Item 3"
              />
            </div>
          )}

          {/* Media selector */}
          {actionType === "media" && (
            <div className="space-y-2 bg-secondary/20 rounded-lg p-3">
              <Label className="text-xs">Selecionar Mídia</Label>
              {mediaFiles.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma mídia disponível. Envie na aba Mídia.</p>
              ) : (
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {mediaFiles.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setMediaId(m.id === mediaId ? null : m.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-left transition-all ${
                        mediaId === m.id
                          ? "bg-primary/10 border border-primary/30"
                          : "bg-background/50 border border-border/30 hover:border-border"
                      }`}
                    >
                      {m.file_type === "audio" ? (
                        <FileAudio className="w-3 h-3 text-primary shrink-0" />
                      ) : (
                        <FileVideo className="w-3 h-3 text-foreground shrink-0" />
                      )}
                      <span className="truncate">{m.file_name}</span>
                      {mediaId === m.id && <Badge className="text-[9px] ml-auto shrink-0">Selecionado</Badge>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {existingRuleId && (
          <div className="bg-accent/20 rounded-lg px-3 py-2 text-[11px] text-muted-foreground flex items-center gap-1">
            <Pencil className="w-3 h-3" />
            Regra existente será atualizada
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border/30 p-3 shrink-0">
        <Button
          onClick={handleSave}
          disabled={saving || (actionType === "media" ? !mediaId : !hasContent)}
          className="w-full"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          {existingRuleId ? "Atualizar Regra" : "Salvar Regra de Treinamento"}
        </Button>
      </div>
    </div>
  );
}
