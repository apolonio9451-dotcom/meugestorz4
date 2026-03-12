import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Trash2, Pencil, Search, BookOpen, Loader2, ToggleLeft,
  MessageSquare, Layers, FileAudio, ChevronDown, ChevronUp
} from "lucide-react";

interface TrainingRule {
  id: string;
  trigger_question: string;
  instruction: string;
  action_type: string;
  action_config: any;
  media_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Props {
  companyId: string;
  refreshKey?: number;
}

export default function TrainingRulesList({ companyId, refreshKey }: Props) {
  const [rules, setRules] = useState<TrainingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchRules();
  }, [companyId, refreshKey]);

  const fetchRules = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("bot_training_rules")
      .select("*")
      .eq("company_id", companyId)
      .order("updated_at", { ascending: false });
    if (data) setRules(data as TrainingRule[]);
    setLoading(false);
  };

  const handleToggle = async (rule: TrainingRule) => {
    const { error } = await supabase
      .from("bot_training_rules")
      .update({ is_active: !rule.is_active })
      .eq("id", rule.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setRules(prev => prev.map(r => r.id === rule.id ? { ...r, is_active: !r.is_active } : r));
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("bot_training_rules")
      .delete()
      .eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setRules(prev => prev.filter(r => r.id !== id));
      toast({ title: "Regra removida!" });
    }
  };

  const actionLabels: Record<string, { label: string; icon: typeof MessageSquare }> = {
    text: { label: "Texto", icon: MessageSquare },
    buttons: { label: "Botões", icon: Layers },
    list: { label: "Lista", icon: Layers },
    media: { label: "Mídia", icon: FileAudio },
  };

  const filtered = rules.filter(r => {
    if (!search) return true;
    const s = search.toLowerCase();
    return r.trigger_question.toLowerCase().includes(s) || r.instruction.toLowerCase().includes(s);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  if (rules.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Nenhuma regra de treinamento criada.</p>
        <p className="text-xs mt-1">Use o simulador acima para instruir o bot.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" />
          Linhas de Raciocínio ({rules.length})
        </h3>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar regra..."
            className="pl-8 h-8 w-44 text-xs bg-secondary/30"
          />
        </div>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {filtered.map((rule) => {
          const action = actionLabels[rule.action_type] || actionLabels.text;
          const ActionIcon = action.icon;
          const isExpanded = expandedId === rule.id;

          return (
            <div
              key={rule.id}
              className={`rounded-lg border transition-all ${
                rule.is_active
                  ? "bg-secondary/30 border-border/50"
                  : "bg-secondary/10 border-border/20 opacity-60"
              }`}
            >
              <div
                className="flex items-center justify-between px-4 py-2.5 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : rule.id)}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Badge variant="outline" className="text-[10px] shrink-0 gap-1">
                    <ActionIcon className="w-2.5 h-2.5" />
                    {action.label}
                  </Badge>
                  <span className="text-sm text-foreground truncate">
                    "{rule.trigger_question.slice(0, 60)}{rule.trigger_question.length > 60 ? "..." : ""}"
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => { e.stopPropagation(); handleToggle(rule); }}
                  >
                    <ToggleLeft className={`w-3.5 h-3.5 ${rule.is_active ? "text-primary" : "text-muted-foreground"}`} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={(e) => { e.stopPropagation(); handleDelete(rule.id); }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                </div>
              </div>

              {isExpanded && (
                <div className="px-4 pb-3 space-y-2 border-t border-border/30 pt-2">
                  <div className="bg-background/50 rounded p-2.5 text-xs">
                    <span className="text-muted-foreground font-semibold block mb-1">📝 Instrução:</span>
                    <span className="text-foreground whitespace-pre-wrap">{rule.instruction}</span>
                  </div>
                  {rule.action_type === "buttons" && rule.action_config?.buttons && (
                    <div className="flex gap-1.5 flex-wrap">
                      {rule.action_config.buttons.split("|").map((btn: string, i: number) => (
                        <Badge key={i} variant="secondary" className="text-[10px]">{btn.trim()}</Badge>
                      ))}
                    </div>
                  )}
                  {rule.action_type === "list" && rule.action_config?.items && (
                    <div className="flex gap-1.5 flex-wrap">
                      {rule.action_config.items.split("|").map((item: string, i: number) => (
                        <Badge key={i} variant="secondary" className="text-[10px]">{item.trim()}</Badge>
                      ))}
                    </div>
                  )}
                  {rule.media_id && (
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <FileAudio className="w-2.5 h-2.5" /> Mídia anexada
                    </Badge>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
