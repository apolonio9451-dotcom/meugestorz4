import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trophy, Save, Key } from "lucide-react";

interface SportsSettingsSectionProps {
  companyId: string | null;
}

const SportsSettingsSection = ({ companyId }: SportsSettingsSectionProps) => {
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (companyId) {
      fetchSettings();
    }
  }, [companyId]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("api_settings")
        .select("football_api_key")
        .eq("company_id", companyId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setApiKey((data as any).football_api_key || "");
      }
    } catch (error: any) {
      console.error("Error fetching sports settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!companyId) return;
    try {
      setSaving(true);
      const { error } = await supabase
        .from("api_settings")
        .update({ 
          football_api_key: apiKey,
          updated_at: new Date().toISOString()
        } as any)
        .eq("company_id", companyId);

      if (error) throw error;
      toast.success("Configurações de esportes salvas!");
    } catch (error: any) {
      toast.error("Erro ao salvar: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="glass-card border-border/60">
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Trophy className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle>Integração de Esportes</CardTitle>
            <CardDescription>
              Configure a API para o Gerador de Banners
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="football-api-key" className="flex items-center gap-2">
              <Key className="h-4 w-4 text-muted-foreground" />
              API-Football Key (RapidAPI)
            </Label>
            <a 
              href="https://dashboard.api-football.com/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[10px] text-primary hover:underline"
            >
              Obter chave aqui
            </a>
          </div>
          <Input
            id="football-api-key"
            type="password"
            placeholder="Insira sua chave da API-Football"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="bg-background/50"
          />
          <p className="text-[10px] text-muted-foreground italic">
            Esta chave é necessária para buscar os jogos de hoje automaticamente.
          </p>
        </div>

        <Button 
          onClick={handleSave} 
          disabled={saving || loading}
          className="w-full md:w-auto"
        >
          {saving ? "Salvando..." : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Salvar Configurações
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default SportsSettingsSection;
