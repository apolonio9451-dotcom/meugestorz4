import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Mail, KeyRound, Loader2, ShieldCheck, MessageCircle, UserCog, Check, Palette, Pipette } from "lucide-react";
import { cn } from "@/lib/utils";
import { themePresets, applyThemePreset, type ThemePreset } from "@/lib/themes";

function getGravatarUrl(email: string, size = 200): string {
  const trimmed = email.trim().toLowerCase();
  return `https://www.gravatar.com/avatar/${encodeURIComponent(trimmed)}?s=${size}&d=identicon`;
}

// Custom color option — build a theme preset from a hex color
function buildCustomThemeFromHex(hex: string): ThemePreset {
  // Convert hex to HSL
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  const hDeg = Math.round(h * 360);
  const sPct = Math.round(s * 100);
  const lPct = Math.round(l * 100);

  const primary = `${hDeg} ${sPct}% ${lPct}%`;
  const bgH = hDeg;

  return {
    id: `hex_${hex.slice(1)}`,
    name: "Personalizado",
    description: "Tema personalizado",
    colors: { primary: hex, secondary: "#1a1a2e", background: "#0a0a14" },
    cssVars: {
      "--background": `${bgH} 40% 6%`,
      "--foreground": `${bgH} 15% 93%`,
      "--card": `${bgH} 32% 11%`,
      "--card-foreground": `${bgH} 15% 93%`,
      "--popover": `${bgH} 32% 11%`,
      "--popover-foreground": `${bgH} 15% 93%`,
      "--primary": primary,
      "--primary-foreground": "0 0% 100%",
      "--secondary": `${bgH} 30% 11%`,
      "--secondary-foreground": `${bgH} 15% 90%`,
      "--muted": `${bgH} 22% 13%`,
      "--muted-foreground": `${bgH} 10% 48%`,
      "--accent": `${hDeg} ${Math.max(sPct - 7, 30)}% ${Math.max(lPct - 2, 30)}%`,
      "--accent-foreground": "0 0% 100%",
      "--border": `${hDeg} 40% 20%`,
      "--input": `${bgH} 22% 12%`,
      "--ring": primary,
      "--sidebar-background": `${bgH} 45% 4%`,
      "--sidebar-foreground": `${bgH} 12% 60%`,
      "--sidebar-primary": primary,
      "--sidebar-primary-foreground": "0 0% 100%",
      "--sidebar-accent": `${bgH} 25% 12%`,
      "--sidebar-accent-foreground": `${bgH} 15% 85%`,
      "--sidebar-border": `${bgH} 20% 13%`,
      "--sidebar-ring": primary,
      "--glass-bg": `${bgH} 35% 10%`,
      "--glass-border": `${hDeg} 60% 35%`,
      "--glass-glow": primary,
    },
  };
}

export default function Profile() {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [adminInfo, setAdminInfo] = useState<{ name: string; whatsapp: string | null } | null>(null);
  const [selectedTheme, setSelectedTheme] = useState("teal");
  const [customHex, setCustomHex] = useState("#e91e63");

  // Load saved theme on mount
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("theme_preset")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.theme_preset) {
          const saved = data.theme_preset as string;
          setSelectedTheme(saved);
          // Apply it
          if (saved.startsWith("hex_")) {
            const hex = `#${saved.slice(4)}`;
            setCustomHex(hex);
            applyThemePreset(buildCustomThemeFromHex(hex));
          } else {
            const preset = themePresets.find((t) => t.id === saved);
            if (preset) applyThemePreset(preset);
          }
        }
      });
  }, [user]);

  useEffect(() => {
    const fetchAdmin = async () => {
      if (!user) return;
      const { data: membership } = await supabase
        .from("company_memberships")
        .select("trial_link_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (membership?.trial_link_id) {
        const { data: trialLink } = await supabase
          .from("trial_links")
          .select("created_by")
          .eq("id", membership.trial_link_id)
          .maybeSingle();

        if (trialLink?.created_by) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", trialLink.created_by)
            .maybeSingle();

          const { data: reseller } = await supabase
            .from("resellers")
            .select("whatsapp")
            .eq("user_id", trialLink.created_by)
            .maybeSingle();

          if (profile) {
            setAdminInfo({ name: profile.full_name || "Admin", whatsapp: reseller?.whatsapp || null });
          }
        }
      }
    };
    fetchAdmin();
  }, [user]);

  const email = user?.email || "";
  const fullName = user?.user_metadata?.full_name || "";
  const initials = fullName
    ? fullName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : email.slice(0, 2).toUpperCase();

  const handleThemeSelect = async (themeId: string) => {
    setSelectedTheme(themeId);

    // Apply instantly
    if (themeId.startsWith("hex_")) {
      const hex = `#${themeId.slice(4)}`;
      applyThemePreset(buildCustomThemeFromHex(hex));
    } else {
      const preset = themePresets.find((t) => t.id === themeId);
      if (preset) applyThemePreset(preset);
    }

    // Persist
    if (user) {
      await supabase
        .from("profiles")
        .update({ theme_preset: themeId } as any)
        .eq("id", user.id);
    }
  };

  const handleCustomColor = (hex: string) => {
    setCustomHex(hex);
    const themeId = `hex_${hex.slice(1)}`;
    handleThemeSelect(themeId);
  };

  const handlePasswordReset = async () => {
    if (!newPassword) {
      toast({ title: "Erro", description: "Digite a nova senha.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Erro", description: "A senha deve ter no mínimo 6 caracteres.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Erro", description: "As senhas não coincidem.", variant: "destructive" });
      return;
    }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Senha atualizada!", description: "Sua senha foi alterada com sucesso." });
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  // Quick color swatches (hex colors for the custom picker row)
  const quickColors = ["#e91e63", "#f44336", "#ff9800", "#4caf50", "#00bcd4", "#2196f3", "#9c27b0", "#607d8b"];

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Meu Perfil</h1>
        <p className="text-sm text-muted-foreground mt-1">Gerencie suas informações pessoais e segurança</p>
      </div>

      {/* Profile Card */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <Avatar className="h-20 w-20 border-2 border-primary/30 shadow-lg">
              <AvatarImage src={getGravatarUrl(email)} alt={fullName || email} />
              <AvatarFallback className="bg-primary/15 text-primary text-xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="text-center sm:text-left space-y-1 min-w-0">
              {fullName && (
                <h2 className="text-lg font-semibold text-foreground truncate">{fullName}</h2>
              )}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="w-4 h-4 shrink-0" />
                <span className="truncate">{email}</span>
              </div>
              {userRole && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>{userRole}</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Admin Info Card */}
      {adminInfo && (
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserCog className="w-5 h-5 text-primary" />
              Seu Administrador
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-foreground">{adminInfo.name}</p>
                <p className="text-xs text-muted-foreground">Entre em contato para suporte ou renovação</p>
              </div>
              {adminInfo.whatsapp && (
                <a
                  href={`https://wa.me/${adminInfo.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Theme Selector Card */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Palette className="w-5 h-5 text-primary" />
            Personalização
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Escolha a cor do tema do sistema</p>
          <div className="flex flex-wrap items-center gap-3">
            {themePresets.map((preset) => {
              const isActive = selectedTheme === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => handleThemeSelect(preset.id)}
                  className={cn(
                    "relative w-12 h-12 rounded-full overflow-hidden border-2 transition-all duration-200 hover:scale-110",
                    isActive ? "border-foreground ring-2 ring-foreground/30 scale-110" : "border-border/50 hover:border-foreground/40"
                  )}
                  title={preset.name}
                >
                  {/* Split circle: left = primary, right = background */}
                  <div className="absolute inset-0 flex">
                    <div className="w-1/2 h-full" style={{ backgroundColor: preset.colors.primary }} />
                    <div className="w-1/2 h-full" style={{ backgroundColor: preset.colors.background }} />
                  </div>
                  {isActive && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Check className="w-5 h-5 text-white drop-shadow-lg" />
                    </div>
                  )}
                </button>
              );
            })}

            {/* Quick hex colors */}
            {quickColors.map((hex) => {
              const themeId = `hex_${hex.slice(1)}`;
              const isActive = selectedTheme === themeId;
              return (
                <button
                  key={hex}
                  onClick={() => handleCustomColor(hex)}
                  className={cn(
                    "relative w-12 h-12 rounded-full overflow-hidden border-2 transition-all duration-200 hover:scale-110",
                    isActive ? "border-foreground ring-2 ring-foreground/30 scale-110" : "border-border/50 hover:border-foreground/40"
                  )}
                  title={hex}
                >
                  <div className="absolute inset-0 flex">
                    <div className="w-1/2 h-full" style={{ backgroundColor: hex }} />
                    <div className="w-1/2 h-full" style={{ backgroundColor: "#0a0a14" }} />
                  </div>
                  {isActive && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Check className="w-5 h-5 text-white drop-shadow-lg" />
                    </div>
                  )}
                </button>
              );
            })}

            {/* Native color picker */}
            <label
              className={cn(
                "relative w-12 h-12 rounded-full border-2 border-dashed border-border/60 flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-110 hover:border-foreground/40 bg-muted/30"
              )}
              title="Escolher cor personalizada"
            >
              <Pipette className="w-5 h-5 text-muted-foreground" />
              <input
                type="color"
                value={customHex}
                onChange={(e) => handleCustomColor(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Password Reset Card */}
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRound className="w-5 h-5 text-primary" />
            Redefinir Senha
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">Nova Senha</Label>
            <Input
              id="new-password"
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
            <Input
              id="confirm-password"
              type="password"
              placeholder="Repita a nova senha"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <Button onClick={handlePasswordReset} disabled={saving} className="w-full sm:w-auto">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <KeyRound className="h-4 w-4 mr-2" />}
            Alterar Senha
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
