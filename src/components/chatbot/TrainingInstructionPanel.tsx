import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Save, Loader2, X, Pencil, FileAudio, FileVideo, Image, FileText,
  Layers, MessageSquare
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
    }
  };

  const handleSave = async () => {
    if (!instruction.trim()) {
      toast({ title: "Escreva a instrução", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        company_id: companyId,
        trigger_question: triggerQuestion,
        instruction: instruction.trim(),
        action_type: actionType,
        action_config: actionConfig || {},
        is_active: true,
      };

      // Only include media_id if it's a valid selection, otherwise set null
      if (actionType === "media" && mediaId) {
        payload.media_id = mediaId;
      } else {
        payload.media_id = null;
      }

      console.log("Saving training rule payload:", JSON.stringify(payload, null, 2));

      if (existingRuleId) {
        const { error } = await supabase
          .from("bot_training_rules")
          .update(payload)
          .eq("id", existingRuleId);
        if (error) {
          console.error("Update error:", error);
          throw error;
        }
      } else {
        const { error } = await supabase
          .from("bot_training_rules")
          .insert(payload);
        if (error) {
          console.error("Insert error:", error);
          throw error;
        }
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

        {/* Instruction */}
        <div className="space-y-2 border-t border-border pt-4">
          <Label className="text-sm font-semibold">Instrução para a IA</Label>
          <p className="text-[10px] text-muted-foreground">
            Diga à IA como ela deve se comportar quando receber essa pergunta ou similar.
          </p>
          <Textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Ex: Quando o cliente perguntar sobre preço, apresente nossos 3 planos: Básico R$29.90, Premium R$49.90 e Ultra R$79.90. Destaque o Premium como melhor custo-benefício."
            className="min-h-[120px] text-sm bg-secondary/30"
          />
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
        <Button onClick={handleSave} disabled={saving || !instruction.trim()} className="w-full">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          {existingRuleId ? "Atualizar Regra" : "Salvar Regra de Treinamento"}
        </Button>
      </div>
    </div>
  );
}
