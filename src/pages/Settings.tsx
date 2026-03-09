import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Settings as SettingsIcon, Upload, X, Loader2, Save, RotateCcw, Phone, Palette, Lock, Check } from "lucide-react";
import AnnouncementManager from "@/components/announcements/AnnouncementManager";
import ApiSettingsSection from "@/components/settings/ApiSettingsSection";
import { themePresets, applyThemePreset, clearThemeOverrides, type ThemePreset } from "@/lib/themes";
interface CompanySettings {
  id?: string;
  company_id: string;
  brand_name: string;
  login_slug: string | null;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  background_color: string;
  support_whatsapp: string;
}

export default function Settings() {
  const { companyId, userRole } = useAuth();
  const isOwner = userRole === "Proprietário";
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
    support_whatsapp: "",
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
      support_whatsapp: settings.support_whatsapp,
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

        {/* WhatsApp de Suporte */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Phone className="w-4 h-4 text-primary" />
            WhatsApp de Suporte
          </Label>
          <Input
            value={settings.support_whatsapp}
            onChange={(e) => setSettings((prev) => ({ ...prev, support_whatsapp: e.target.value }))}
            placeholder="5511999999999"
            className="bg-secondary/50 border-border"
          />
          <p className="text-muted-foreground text-xs">
            Número usado para contato dos revendedores quando precisarem de suporte ou créditos. Formato: código do país + DDD + número (ex: 5511999999999)
          </p>
        </div>

        {/* Theme Presets */}
        <div className="space-y-4">
          <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Palette className="w-4 h-4 text-primary" />
            Temas Predefinidos
          </Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {themePresets.map((preset) => {
              const isActive =
                settings.primary_color === preset.colors.primary &&
                settings.secondary_color === preset.colors.secondary &&
                settings.background_color === preset.colors.background;
              return (
                <button
                  key={preset.id}
                  disabled={preset.locked}
                  onClick={() => {
                    if (preset.locked) return;
                    setSettings((prev) => ({
                      ...prev,
                      primary_color: preset.colors.primary,
                      secondary_color: preset.colors.secondary,
                      background_color: preset.colors.background,
                    }));
                    applyThemePreset(preset);
                  }}
                  className={`relative rounded-xl p-4 text-left transition-all border-2 ${
                    preset.locked
                      ? "opacity-50 cursor-not-allowed border-border"
                      : isActive
                      ? "border-primary shadow-[0_0_16px_hsl(var(--primary)/0.3)]"
                      : "border-border hover:border-primary/50"
                  }`}
                  style={{
                    background: `linear-gradient(135deg, ${preset.colors.background}, ${preset.colors.secondary})`,
                  }}
                >
                  {isActive && (
                    <div className="absolute top-2 right-2 bg-primary rounded-full p-0.5">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </div>
                  )}
                  {preset.locked && (
                    <div className="absolute top-2 right-2">
                      <Lock className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="w-5 h-5 rounded-full border border-white/20"
                      style={{ backgroundColor: preset.colors.primary }}
                    />
                    <div
                      className="w-5 h-5 rounded-full border border-white/20"
                      style={{ backgroundColor: preset.colors.secondary }}
                    />
                    <div
                      className="w-5 h-5 rounded-full border border-white/20"
                      style={{ backgroundColor: preset.colors.background }}
                    />
                  </div>
                  <p className="text-sm font-semibold text-white">{preset.name}</p>
                  <p className="text-xs text-white/60 mt-0.5">{preset.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Colors */}
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
              const defaultTheme = themePresets[0];
              const defaults = {
                brand_name: "Meu gestor",
                login_slug: "",
                logo_url: null,
                primary_color: defaultTheme.colors.primary,
                secondary_color: defaultTheme.colors.secondary,
                background_color: defaultTheme.colors.background,
              };
              setSettings((prev) => ({ ...prev, ...defaults }));
              clearThemeOverrides();
              applyThemePreset(defaultTheme);
              if (settings.id && companyId) {
                await supabase.from("company_settings").update({ ...defaults, company_id: companyId }).eq("id", settings.id);
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

      <ApiSettingsSection companyId={companyId} />
      {isOwner && <AnnouncementManager />}
    </div>
  );
}
