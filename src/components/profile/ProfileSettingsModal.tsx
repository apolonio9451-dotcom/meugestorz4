import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Camera, Loader2, Save, User, LogOut, Phone, Palette, Check } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { themePresets, applyThemePreset } from "@/lib/themes";

interface ProfileSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProfileUpdated?: () => void;
  onSignOut?: () => void;
}

export default function ProfileSettingsModal({
  open,
  onOpenChange,
  onProfileUpdated,
  onSignOut,
}: ProfileSettingsModalProps) {
  const { user, userRole, effectiveCompanyId: companyId } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [supportWhatsapp, setSupportWhatsapp] = useState("");
  const [activeThemeId, setActiveThemeId] = useState("teal");

  const email = user?.email || "";
  const initials = fullName
    ? fullName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : email.slice(0, 2).toUpperCase();

  const roleColor = (() => {
    switch (userRole) {
      case "Proprietário":
        return "bg-blue-500/20 text-blue-400 border-blue-500/40";
      case "Admin":
        return "bg-cyan-500/20 text-cyan-400 border-cyan-500/40";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  })();

  useEffect(() => {
    if (!open || !user) return;
    const googleAvatar = user.user_metadata?.avatar_url || user.user_metadata?.picture || "";
    const metaName = user.user_metadata?.full_name || user.user_metadata?.name || "";
    setFullName(metaName);
    setAvatarUrl(googleAvatar);

    supabase
      .from("profiles")
      .select("avatar_url, full_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.full_name) setFullName(data.full_name);
        if (data?.avatar_url && data.avatar_url.trim() !== "") setAvatarUrl(data.avatar_url);
      });

    // Load company settings (whatsapp + theme)
    if (companyId) {
      supabase
        .from("company_settings")
        .select("support_whatsapp, primary_color, secondary_color, background_color")
        .eq("company_id", companyId)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setSupportWhatsapp(data.support_whatsapp || "");
            // Detect active theme
            const matched = themePresets.find(
              (p) =>
                p.colors.primary === data.primary_color &&
                p.colors.secondary === data.secondary_color &&
                p.colors.background === data.background_color
            );
            if (matched) setActiveThemeId(matched.id);
          }
        });
    }
  }, [open, user, companyId]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Erro", description: "Selecione uma imagem válida.", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Erro", description: "Imagem deve ter no máximo 2MB.", variant: "destructive" });
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const filePath = `${user.id}/avatar.${ext}`;
    await supabase.storage.from("avatars").remove([filePath]);
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true, contentType: file.type });
    if (uploadError) {
      toast({ title: "Erro no upload", description: uploadError.message, variant: "destructive" });
      setUploading(false);
      return;
    }
    const { data: publicData } = supabase.storage.from("avatars").getPublicUrl(filePath);
    const newUrl = `${publicData.publicUrl}?t=${Date.now()}`;
    await supabase.from("profiles").update({ avatar_url: newUrl }).eq("id", user.id);
    setAvatarUrl(newUrl);
    setUploading(false);
    onProfileUpdated?.();
    toast({ title: "Foto atualizada!" });
  };

  const handleSelectTheme = (preset: typeof themePresets[0]) => {
    if (preset.locked) return;
    setActiveThemeId(preset.id);
    applyThemePreset(preset);
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);

    // Save profile data
    await supabase.auth.updateUser({ data: { full_name: fullName } });
    await supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id);

    // Save company settings (whatsapp + theme)
    if (companyId) {
      const selectedTheme = themePresets.find((p) => p.id === activeThemeId) || themePresets[0];
      const payload = {
        company_id: companyId,
        support_whatsapp: supportWhatsapp,
        primary_color: selectedTheme.colors.primary,
        secondary_color: selectedTheme.colors.secondary,
        background_color: selectedTheme.colors.background,
      };

      const { data: existing } = await supabase
        .from("company_settings")
        .select("id")
        .eq("company_id", companyId)
        .maybeSingle();

      if (existing?.id) {
        await supabase.from("company_settings").update(payload).eq("id", existing.id);
      } else {
        await supabase.from("company_settings").insert(payload);
      }
    }

    setSaving(false);
    onProfileUpdated?.();
    toast({ title: "Perfil atualizado!", description: "Seus dados foram salvos com sucesso." });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto scrollbar-hide">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Meu Perfil
          </DialogTitle>
        </DialogHeader>

        {/* Avatar + Badge */}
        <div className="flex flex-col items-center gap-3 py-2">
          <div className="relative group">
            <Avatar className="h-24 w-24 border-2 border-primary/30 shadow-lg">
              <AvatarImage src={avatarUrl} alt={fullName} />
              <AvatarFallback className="bg-gradient-to-br from-primary/30 to-primary/10 text-primary text-2xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute inset-0 flex items-center justify-center rounded-full bg-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              {uploading ? (
                <Loader2 className="w-6 h-6 text-background animate-spin" />
              ) : (
                <Camera className="w-6 h-6 text-background" />
              )}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>
          <Badge variant="outline" className={cn("text-[10px] px-2 py-0.5 font-bold border rounded-full", roleColor)}>
            {userRole || "Usuário"}
          </Badge>
        </div>

        <Separator />

        {/* Profile Info */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="profile-name">Nome Completo</Label>
            <Input id="profile-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Seu nome" />
          </div>
          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input value={email} disabled className="opacity-60" />
          </div>
        </div>

        <Separator />

        {/* Network Settings */}
        <div className="space-y-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Configurações da Rede</p>

          {/* WhatsApp de Suporte */}
          <div className="space-y-1.5">
            <Label className="text-sm flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-primary" />
              WhatsApp de Suporte
            </Label>
            <Input
              value={supportWhatsapp}
              onChange={(e) => setSupportWhatsapp(e.target.value)}
              placeholder="5511999999999"
              className="bg-secondary/50 border-border"
            />
          </div>

          {/* Compact Theme Selector */}
          <div className="space-y-2">
            <Label className="text-sm flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-primary" />
              Tema do Sistema
            </Label>
            <div className="grid grid-cols-6 gap-2">
              {themePresets.map((preset) => {
                const isActive = activeThemeId === preset.id;
                return (
                  <button
                    key={preset.id}
                    disabled={preset.locked}
                    onClick={() => handleSelectTheme(preset)}
                    className={cn(
                      "relative w-9 h-9 rounded-full overflow-hidden border-2 transition-all duration-200 hover:scale-110 mx-auto",
                      preset.locked
                        ? "opacity-40 cursor-not-allowed border-border"
                        : isActive
                        ? "border-primary ring-2 ring-primary/30 scale-110"
                        : "border-border/50 hover:border-primary/40"
                    )}
                    title={preset.name}
                  >
                    <div className="absolute inset-0 flex flex-col">
                      <div className="w-full h-1/2" style={{ backgroundColor: preset.colors.primary }} />
                      <div className="w-full h-1/2" style={{ backgroundColor: preset.colors.background }} />
                    </div>
                    {isActive && (
                      <div className="absolute top-0 right-0 w-3.5 h-3.5 bg-primary rounded-full flex items-center justify-center translate-x-0.5 -translate-y-0.5 border border-background">
                        <Check className="w-2 h-2 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Save */}
        <Button onClick={handleSaveProfile} disabled={saving} className="w-full">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar Dados
        </Button>

        <Separator />

        {/* Sign Out + Google notice */}
        <div className="space-y-3">
          <Button
            variant="ghost"
            onClick={() => {
              onOpenChange(false);
              onSignOut?.();
            }}
            className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sair da Conta
          </Button>
          <p className="text-[10px] text-muted-foreground text-center">
            Sua conta é autenticada via Google. Para gerenciar sua segurança, acesse sua{" "}
            <a href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground transition-colors">
              Conta Google
            </a>.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
