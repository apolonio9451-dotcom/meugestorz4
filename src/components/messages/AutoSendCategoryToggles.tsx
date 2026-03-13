import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const autoSendCategories = [
  { key: "vence_hoje", label: "Vence Hoje", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  { key: "vence_amanha", label: "Vence Amanhã", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  { key: "a_vencer", label: "A Vencer", color: "bg-yellow-600/20 text-yellow-500 border-yellow-600/30" },
  { key: "vencidos", label: "Vencidos", color: "bg-destructive/20 text-destructive border-destructive/30" },
];

interface Props {
  companyId: string | null;
}

export default function AutoSendCategoryToggles({ companyId }: Props) {
  const [activeCategories, setActiveCategories] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("auto_send_category_settings")
        .select("category, is_active")
        .eq("company_id", companyId);

      const map: Record<string, boolean> = {};
      autoSendCategories.forEach((c) => {
        const found = data?.find((d: any) => d.category === c.key);
        map[c.key] = found ? found.is_active : true; // default active
      });
      setActiveCategories(map);
      setLoading(false);
    };
    fetch();
  }, [companyId]);

  const handleToggle = async (category: string, checked: boolean) => {
    if (!companyId) return;
    setActiveCategories((prev) => ({ ...prev, [category]: checked }));

    const { error } = await supabase
      .from("auto_send_category_settings")
      .upsert(
        { company_id: companyId, category, is_active: checked, updated_at: new Date().toISOString() },
        { onConflict: "company_id,category" }
      );

    if (error) {
      setActiveCategories((prev) => ({ ...prev, [category]: !checked }));
      toast({ title: "Erro", description: "Não foi possível atualizar.", variant: "destructive" });
    } else {
      toast({
        title: checked ? "Ativado" : "Desativado",
        description: `Envio automático "${autoSendCategories.find((c) => c.key === category)?.label}" ${checked ? "ativado" : "desativado"}.`,
      });
    }
  };

  if (loading || !companyId) return null;

  const activeCount = Object.values(activeCategories).filter(Boolean).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-muted-foreground" />
            Disparos Automáticos Ativos
          </span>
          <Badge variant="outline" className="text-xs">
            {activeCount}/{autoSendCategories.length} ativos
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Escolha quais lembretes automáticos o sistema deve enviar.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {autoSendCategories.map((cat) => (
            <div
              key={cat.key}
              className="flex items-center justify-between rounded-lg border border-border/50 px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`${cat.color} border text-xs`}>
                  {cat.label}
                </Badge>
              </div>
              <Switch
                checked={activeCategories[cat.key] ?? true}
                onCheckedChange={(checked) => handleToggle(cat.key, checked)}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
