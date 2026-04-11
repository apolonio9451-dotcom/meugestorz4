import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Mail, KeyRound, Loader2, ShieldCheck, MessageCircle, UserCog, Check, Palette } from "lucide-react";
import { cn } from "@/lib/utils";
import { themePresets, applyThemePreset } from "@/lib/themes";

function getGravatarUrl(email: string, size = 200): string {
  const trimmed = email.trim().toLowerCase();
  return `https://www.gravatar.com/avatar/${encodeURIComponent(trimmed)}?s=${size}&d=identicon`;
}

export default function Profile() {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [adminInfo, setAdminInfo] = useState<{ name: string; whatsapp: string | null } | null>(null);
  const [selectedTheme, setSelectedTheme] = useState("teal");

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
          const preset = themePresets.find((t) => t.id === saved);
          if (preset) applyThemePreset(preset);
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
    const preset = themePresets.find((t) => t.id === themeId);
    if (preset) applyThemePreset(preset);

    if (user) {
      await supabase
        .from("profiles")
        .update({ theme_preset: themeId } as any)
        .eq("id", user.id);
    }
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
          <p className="text-sm text-muted-foreground">Escolha a cor do tema</p>
          <div className="grid grid-cols-6 gap-3">
            {themePresets.map((preset) => {
              const isActive = selectedTheme === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => handleThemeSelect(preset.id)}
                  className={cn(
                    "relative w-12 h-12 rounded-full overflow-hidden border-2 transition-all duration-200 hover:scale-110 mx-auto",
                    isActive ? "border-foreground ring-2 ring-foreground/30 scale-110" : "border-border/50 hover:border-foreground/40"
                  )}
                  title={preset.name}
                >
                  {/* Split circle: top = primary, bottom = background */}
                  <div className="absolute inset-0 flex flex-col">
                    <div className="w-full h-1/2" style={{ backgroundColor: preset.colors.primary }} />
                    <div className="w-full h-1/2" style={{ backgroundColor: preset.colors.background }} />
                  </div>
                  {isActive && (
                    <div className="absolute top-0 right-0 w-4 h-4 bg-primary rounded-full flex items-center justify-center translate-x-0.5 -translate-y-0.5 border border-background">
                      <Check className="w-2.5 h-2.5 text-primary-foreground" />
                    </div>
                  )}
                </button>
              );
            })}
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
