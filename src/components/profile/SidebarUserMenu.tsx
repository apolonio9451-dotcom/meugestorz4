import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import ProfileSettingsModal from "./ProfileSettingsModal";
import { cn } from "@/lib/utils";

interface SidebarUserMenuProps {
  onSignOut: () => void;
  onCloseSidebar?: () => void;
}

export default function SidebarUserMenu({ onSignOut, onCloseSidebar }: SidebarUserMenuProps) {
  const { user, userRole } = useAuth();
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [displayName, setDisplayName] = useState("");

  const email = user?.email || "";

  const fetchProfile = async () => {
    if (!user) return;
    const googleAvatar = user.user_metadata?.avatar_url || user.user_metadata?.picture || "";
    const metaName = user.user_metadata?.full_name || user.user_metadata?.name || "";

    const { data } = await supabase
      .from("profiles")
      .select("avatar_url, full_name")
      .eq("id", user.id)
      .maybeSingle();

    const profileAvatar = data?.avatar_url?.trim() || "";
    const profileName = data?.full_name?.trim() || "";

    setAvatarUrl(profileAvatar || googleAvatar);
    setDisplayName(profileName || metaName);

    if (!profileAvatar && googleAvatar) {
      await supabase.from("profiles").update({ avatar_url: googleAvatar }).eq("id", user.id);
    }
    if (!profileName && metaName) {
      await supabase.from("profiles").update({ full_name: metaName }).eq("id", user.id);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [user]);

  const initials = displayName
    ? displayName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
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

  return (
    <>
      <button
        onClick={() => {
          setProfileModalOpen(true);
          onCloseSidebar?.();
        }}
        className="flex items-center gap-3 px-3 py-3.5 lg:py-2.5 w-full rounded-xl lg:rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50 transition-all duration-200 group focus:outline-none bg-sidebar-accent/15 lg:bg-transparent border border-sidebar-border/30 lg:border-0 min-h-[52px] lg:min-h-0"
      >
        <Avatar className="h-9 w-9 border border-primary/20 shadow-md">
          <AvatarImage src={avatarUrl} alt={displayName} />
          <AvatarFallback className="bg-gradient-to-br from-primary/25 to-primary/5 text-primary text-xs font-bold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 text-left">
          <span className="block truncate text-sm font-medium">
            {displayName || "Meu Perfil"}
          </span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Badge
              variant="outline"
              className={cn("text-[9px] px-1.5 py-0 h-4 font-semibold border", roleColor)}
            >
              {userRole || "Usuário"}
            </Badge>
          </div>
        </div>
      </button>

      <ProfileSettingsModal
        open={profileModalOpen}
        onOpenChange={setProfileModalOpen}
        onProfileUpdated={fetchProfile}
        onSignOut={onSignOut}
      />
    </>
  );
}
