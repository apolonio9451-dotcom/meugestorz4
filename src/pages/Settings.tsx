import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Settings as SettingsIcon, Upload, X, Loader2, Save, RotateCcw } from "lucide-react";

interface CompanySettings {
  id?: string;
  company_id: string;
  brand_name: string;
  login_slug: string | null;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  background_color: string;
}

export default function Settings() {
  const { companyId } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [settings, setSettings] = useState<CompanySettings>({
    company_id: "",
    brand_name: "",
    login_slug: "",
    logo_url: null,
    primary_color: "#00db49",
    secondary_color: "#00c0f5",
    background_color: "#0357a5",
  });

  useEffect(() => {
    if (companyId) {
      fetchSettings();
    }
  }, [companyId]);

  const fetchSettings = async () => {
    if (!companyId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("company_settings")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle();

    if (data) {
      setSettings(data as CompanySettings);
    } else {
      // Load company name as default
      const { data: company } = await supabase
        .from("companies")
        .select("name")
        .eq("id", companyId)
        .single();
      setSettings((prev) => ({
        ...prev,
        company_id: companyId,
        brand_name: company?.name || "",
      }));
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!companyId) return;
    setSaving(true);

    const payload = {
      company_id: companyId,
      brand_name: settings.brand_name,
      login_slug: settings.login_slug,
      logo_url: settings.logo_url,
      primary_color: settings.primary_color,
      secondary_color: settings.secondary_color,
      background_color: settings.background_color,
    };

    let error;
    if (settings.id) {
      ({ error } = await supabase
        .from("company_settings")
        .update(payload)
        .eq("id", settings.id));
    } else {
      const { data, error: insertError } = await supabase
        .from("company_settings")
        .insert(payload)
        .select()
        .single();
      error = insertError;
      if (data) setSettings(data as CompanySettings);
    }

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Configurações salvas com sucesso!" });
    }
    setSaving(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !companyId) return;

    setUploading(true);
    const fileExt = file.name.split(".").pop();
    const filePath = `${companyId}/logo.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("logos")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast({ title: "Erro ao enviar logo", description: uploadError.message, variant: "destructive" });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("logos").getPublicUrl(filePath);
    setSettings((prev) => ({ ...prev, logo_url: urlData.publicUrl }));
    setUploading(false);
    toast({ title: "Logo enviado com sucesso!" });
  };

  const handleRemoveLogo = async () => {
    if (!companyId) return;
    // Remove from storage
    await supabase.storage.from("logos").remove([`${companyId}/logo.png`, `${companyId}/logo.jpg`, `${companyId}/logo.jpeg`, `${companyId}/logo.webp`]);
    setSettings((prev) => ({ ...prev, logo_url: null }));
    toast({ title: "Logo removido" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
          <SettingsIcon className="h-6 w-6 text-primary" />
          Configurações
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Personalize sua marca e meios de pagamento
        </p>
      </div>

      <div className="glass-card rounded-xl p-6 space-y-8">
        <h2 className="text-lg font-display font-semibold text-foreground">Marca</h2>

        {/* Brand Name */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-foreground">Nome da Marca</Label>
          <Input
            value={settings.brand_name}
            onChange={(e) => setSettings((prev) => ({ ...prev, brand_name: e.target.value }))}
            placeholder="Nome da sua empresa"
            className="bg-secondary/50 border-border"
          />
        </div>

        {/* Login Slug */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-foreground">Slug do Login</Label>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm whitespace-nowrap">
              https://app.ongestor.top/login/
            </span>
            <Input
              value={settings.login_slug || ""}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  login_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                }))
              }
              placeholder="minha-empresa"
              className="bg-secondary/50 border-border"
            />
          </div>
          <p className="text-muted-foreground text-xs">URL personalizada para login dos seus clientes</p>
        </div>

        {/* Logo */}
        <div className="space-y-3">
          <Label className="text-sm font-semibold text-foreground">Logo</Label>
          <div className="flex items-center gap-4">
            {settings.logo_url ? (
              <div className="h-16 w-16 rounded-lg overflow-hidden bg-secondary/50 border border-border flex items-center justify-center">
                <img
                  src={settings.logo_url}
                  alt="Logo"
                  className="h-full w-full object-contain"
                />
              </div>
            ) : (
              <div className="h-16 w-16 rounded-lg bg-secondary/50 border border-border border-dashed flex items-center justify-center">
                <Upload className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
            <div className="flex gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                Trocar
              </Button>
              {settings.logo_url && (
                <Button variant="destructive" size="sm" onClick={handleRemoveLogo}>
                  <X className="h-4 w-4 mr-1" /> Remover
                </Button>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoUpload}
            />
          </div>
        </div>

        {/* Colors */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-foreground">Cor Primária</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settings.primary_color}
                onChange={(e) => setSettings((prev) => ({ ...prev, primary_color: e.target.value }))}
                className="h-10 w-10 rounded-md border border-border cursor-pointer bg-transparent"
              />
              <Input
                value={settings.primary_color}
                onChange={(e) => setSettings((prev) => ({ ...prev, primary_color: e.target.value }))}
                className="bg-secondary/50 border-border font-mono"
                maxLength={7}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold text-foreground">Cor Secundária</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settings.secondary_color}
                onChange={(e) => setSettings((prev) => ({ ...prev, secondary_color: e.target.value }))}
                className="h-10 w-10 rounded-md border border-border cursor-pointer bg-transparent"
              />
              <Input
                value={settings.secondary_color}
                onChange={(e) => setSettings((prev) => ({ ...prev, secondary_color: e.target.value }))}
                className="bg-secondary/50 border-border font-mono"
                maxLength={7}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold text-foreground">Cor de Fundo</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settings.background_color}
                onChange={(e) => setSettings((prev) => ({ ...prev, background_color: e.target.value }))}
                className="h-10 w-10 rounded-md border border-border cursor-pointer bg-transparent"
              />
              <Input
                value={settings.background_color}
                onChange={(e) => setSettings((prev) => ({ ...prev, background_color: e.target.value }))}
                className="bg-secondary/50 border-border font-mono"
                maxLength={7}
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <Button
            variant="outline"
            onClick={async () => {
              const defaults = {
                brand_name: "Meu gestor",
                login_slug: "",
                logo_url: null,
                primary_color: "#2ba6d4",
                secondary_color: "#242a33",
                background_color: "#0f1319",
              };
              setSettings((prev) => ({ ...prev, ...defaults }));
              // Auto-save defaults
              if (settings.id && companyId) {
                await supabase.from("company_settings").update({ ...defaults, company_id: companyId }).eq("id", settings.id);
                // Apply CSS immediately
                const root = document.documentElement;
                root.style.removeProperty("--primary");
                root.style.removeProperty("--ring");
                root.style.removeProperty("--accent");
                root.style.removeProperty("--sidebar-primary");
                root.style.removeProperty("--sidebar-ring");
                root.style.removeProperty("--glass-glow");
                root.style.removeProperty("--secondary");
                root.style.removeProperty("--muted");
                root.style.removeProperty("--sidebar-accent");
                root.style.removeProperty("--background");
                root.style.removeProperty("--sidebar-background");
              }
              toast({ title: "Padrões restaurados e salvos!" });
            }}
            className="text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Restaurar Padrão
          </Button>
          <Button onClick={handleSave} disabled={saving} className="min-w-[140px]">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar Alterações
          </Button>
        </div>
      </div>
    </div>
  );
}
