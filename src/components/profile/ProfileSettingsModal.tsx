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
import { Camera, KeyRound, Loader2, Save, User } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface ProfileSettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProfileUpdated?: () => void;
}

export default function ProfileSettingsModal({
  open,
  onOpenChange,
  onProfileUpdated,
}: ProfileSettingsModalProps) {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const email = user?.email || "";
  const initials = fullName
    ? fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
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

    // Get Google avatar from user metadata if available
    const googleAvatar = user.user_metadata?.avatar_url || user.user_metadata?.picture || "";
    const metaName = user.user_metadata?.full_name || user.user_metadata?.name || "";

    setFullName(metaName);
    setAvatarUrl(googleAvatar);

    // Fetch from profiles table (overrides Google defaults if set)
    supabase
      .from("profiles")
      .select("avatar_url, full_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.full_name) setFullName(data.full_name);
        // Use profile avatar if it exists and is not empty, otherwise keep Google avatar
        if (data?.avatar_url && data.avatar_url.trim() !== "") {
          setAvatarUrl(data.avatar_url);
        }
      });
  }, [open, user]);

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

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);

    await supabase.auth.updateUser({
      data: { full_name: fullName },
    });

    await supabase
      .from("profiles")
      .update({ full_name: fullName })
      .eq("id", user.id);

    setSaving(false);
    onProfileUpdated?.();
    toast({ title: "Perfil atualizado!", description: "Seus dados foram salvos com sucesso." });
  };

  const handlePasswordReset = async () => {
    if (!newPassword) {
      toast({ title: "Erro", description: "Digite a nova senha.", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Erro", description: "Mínimo 6 caracteres.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Erro", description: "As senhas não coincidem.", variant: "destructive" });
      return;
    }

    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Senha atualizada!", description: "Sua senha foi alterada com sucesso." });
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto scrollbar-hide">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Meu Perfil
          </DialogTitle>
        </DialogHeader>

        {/* Avatar + Badge Section */}
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
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>
          <p className="text-xs text-muted-foreground">Clique na foto para alterar</p>
          <Badge
            variant="outline"
            className={cn("text-[10px] px-2 py-0.5 font-bold border rounded-full", roleColor)}
          >
            {userRole || "Usuário"}
          </Badge>
        </div>

        <Separator />

        {/* Profile Info */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="profile-name">Nome Completo</Label>
            <Input
              id="profile-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Seu nome"
            />
          </div>

          <div className="space-y-2">
            <Label>E-mail</Label>
            <Input value={email} disabled className="opacity-60" />
            <p className="text-[10px] text-muted-foreground">
              O e-mail não pode ser alterado por segurança.
            </p>
          </div>

          <Button onClick={handleSaveProfile} disabled={saving} className="w-full">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar Dados
          </Button>
        </div>

        <Separator />

        {/* Password */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-primary" />
            Alterar Senha
          </h3>
          <div className="space-y-2">
            <Label htmlFor="modal-new-password">Nova Senha</Label>
            <Input
              id="modal-new-password"
              type="password"
              placeholder="Mínimo 6 caracteres"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="modal-confirm-password">Confirmar Senha</Label>
            <Input
              id="modal-confirm-password"
              type="password"
              placeholder="Repita a senha"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
          <Button onClick={handlePasswordReset} disabled={savingPassword} variant="outline" className="w-full">
            {savingPassword ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <KeyRound className="w-4 h-4 mr-2" />}
            Alterar Senha
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
