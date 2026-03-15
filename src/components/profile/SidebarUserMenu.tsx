import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Globe, LogOut, ChevronUp } from "lucide-react";
import ProfileSettingsModal from "./ProfileSettingsModal";
import { cn } from "@/lib/utils";

interface SidebarUserMenuProps {
  onSignOut: () => void;
  onCloseSidebar?: () => void;
}

export default function SidebarUserMenu({ onSignOut, onCloseSidebar }: SidebarUserMenuProps) {
  const { user, userRole, resellerCredits } = useAuth();
  const navigate = useNavigate();
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [resellerSlug, setResellerSlug] = useState<string | null>(null);

  const email = user?.email || "";

  const fetchProfile = async () => {
    if (!user) return;

    const googleAvatar = user.user_metadata?.avatar_url || user.user_metadata?.picture || "";
    const metaName = user.user_metadata?.full_name || user.user_metadata?.name || "";

    // Fetch from profiles table
    const { data } = await supabase
      .from("profiles")
      .select("avatar_url, full_name")
      .eq("id", user.id)
      .maybeSingle();

    const profileAvatar = data?.avatar_url?.trim() || "";
    const profileName = data?.full_name?.trim() || "";

    // Priority: 1) manual upload, 2) Google avatar, 3) initials fallback
    setAvatarUrl(profileAvatar || googleAvatar);
    setDisplayName(profileName || metaName);

    // Sync Google avatar to profiles if profile has no avatar yet
    if (!profileAvatar && googleAvatar) {
      await supabase.from("profiles").update({ avatar_url: googleAvatar }).eq("id", user.id);
    }
    if (!profileName && metaName) {
      await supabase.from("profiles").update({ full_name: metaName }).eq("id", user.id);
    }

    // Check for reseller custom domain/slug
    if (resellerCredits !== null) {
      const { data: reseller } = await supabase
        .from("resellers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (reseller) {
        const { data: settings } = await supabase
          .from("reseller_settings")
          .select("service_name")
          .eq("reseller_id", reseller.id)
          .maybeSingle();
        if (settings?.service_name) setResellerSlug(settings.service_name);
      }
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [user]);

  const initials = displayName
    ? displayName
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

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50 transition-all duration-200 group focus:outline-none">
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
              <Badge
                variant="outline"
                className={cn("mt-0.5 text-[9px] px-1.5 py-0 h-4 font-semibold border", roleColor)}
              >
                {userRole || "Usuário"}
              </Badge>
            </div>
            <ChevronUp className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent
          side="top"
          align="start"
          sideOffset={8}
          className="w-56"
        >
          <div className="px-3 py-2">
            <p className="text-sm font-medium truncate">{displayName || email}</p>
            <p className="text-xs text-muted-foreground truncate">{email}</p>
          </div>
          <DropdownMenuSeparator />
          {/* Clicking profile name/avatar area opens modal directly */}
          <DropdownMenuItem
            onClick={() => {
              setProfileModalOpen(true);
              onCloseSidebar?.();
            }}
            className="gap-2 cursor-pointer"
          >
            Meu Perfil
          </DropdownMenuItem>
          {resellerSlug && (
            <DropdownMenuItem
              onClick={() => {
                navigate("/dashboard/settings");
                onCloseSidebar?.();
              }}
              className="gap-2 cursor-pointer"
            >
              <Globe className="w-4 h-4" />
              Meu Site
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={onSignOut}
            className="gap-2 cursor-pointer text-destructive focus:text-destructive"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ProfileSettingsModal
        open={profileModalOpen}
        onOpenChange={setProfileModalOpen}
        onProfileUpdated={fetchProfile}
      />
    </>
  );
}
