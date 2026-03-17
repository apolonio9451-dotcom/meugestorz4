import { ReactNode, useState, useEffect } from "react";
import SidebarUserMenu from "@/components/profile/SidebarUserMenu";
import { Link, useLocation, useNavigate } from "react-router-dom";
import TrialBanner from "@/components/trials/TrialBanner";
import AnnouncementModal from "@/components/announcements/AnnouncementModal";
import { supabase } from "@/integrations/supabase/client";
import { themePresets, applyThemePreset } from "@/lib/themes";
import { useAuth } from "@/hooks/useAuth";
import { useGhostMode } from "@/hooks/useGhostMode";
import { cn } from "@/lib/utils";
import defaultBrandLogo from "@/assets/brand-logo.svg";
import { differenceInDays, parseISO } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  FileText,
  LogOut,
  Menu,
  X,
  Eye,
  
  Server,
  DollarSign,
  RotateCcw,
  Megaphone,
  UserCog,
  ChevronDown,
  Settings,
  KeyRound,
  ShieldCheck,
  
  Clock,
  MessageCircle,
  FlaskConical,
  Bot,
  
  Zap,
  Lock,
} from "lucide-react";

type NavItem = {
  href?: string;
  label: string;
  icon: any;
  children?: { href: string; label: string; icon: any; proOnly?: boolean }[];
  adminOnly?: boolean;
  resellerOnly?: boolean;
  proOnly?: boolean;
};

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/clients", label: "Clientes", icon: Users },
  {
    label: "Financeiro",
    icon: DollarSign,
    children: [
      { href: "/dashboard/financial", label: "Financeiro", icon: DollarSign },
    ],
  },
  {
    label: "Marketing",
    icon: Megaphone,
    children: [
      { href: "/dashboard/marketing", label: "Marketing", icon: Megaphone },
      { href: "/dashboard/winback", label: "Repescagem", icon: RotateCcw, proOnly: true },
    ],
  },
  { href: "/dashboard/chatbot", label: "Chatbot IA", icon: Bot, proOnly: true },
  { href: "/dashboard/resellers", label: "Gestão de Acesso", icon: UserCog, adminOnly: true, proOnly: true },
  
  {
    label: "Configurações",
    icon: Settings,
    children: [
      { href: "/dashboard/servers", label: "Servidores", icon: Server },
      { href: "/dashboard/plans", label: "Planos", icon: CreditCard },
      { href: "/dashboard/messages", label: "Mensagens", icon: Megaphone },
      { href: "/dashboard/settings", label: "Instância", icon: Zap, proOnly: true },
    ],
  },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { signOut, user, companyId, effectiveCompanyId, userRole, resellerCredits, planType, effectivePlanType, isTrial, session } = useAuth();
  const { isGhostMode, ghostName, ghostCompanyId, exitGhostMode } = useGhostMode();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [brandName, setBrandName] = useState("Meu Gestor");
  const [subscriptionDaysLeft, setSubscriptionDaysLeft] = useState<number | null>(null);
  const [supportWhatsapp, setSupportWhatsapp] = useState<string | null>(null);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState("");

  const handleExitGhostMode = async () => {
    // Call edge function to remove temporary membership
    try {
      const stored = localStorage.getItem("ghost_mode");
      if (stored) {
        const parsed = JSON.parse(stored);
        await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ghost-login`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session?.access_token}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({ reseller_id: parsed.resellerId || "", action: "exit" }),
          }
        );
      }
    } catch (e) {
      console.error("Error exiting ghost mode:", e);
    }
    exitGhostMode();
    navigate("/dashboard/resellers");
  };

  const applyThemeColors = (primary?: string, secondary?: string, bg?: string) => {
    // Check if colors match a preset — if so, apply full preset for complete coverage
    const matchedPreset = themePresets.find(
      (p) =>
        !p.locked &&
        p.colors.primary === primary &&
        p.colors.secondary === secondary &&
        p.colors.background === bg
    );
    if (matchedPreset) {
      applyThemePreset(matchedPreset); // also caches to localStorage
      return;
    }

    // Fallback: apply individual hex colors
    const hexToHsl = (hex: string): string => {
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
      return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
    };
    const root = document.documentElement;
    if (primary) {
      const hsl = hexToHsl(primary);
      root.style.setProperty("--primary", hsl);
      root.style.setProperty("--ring", hsl);
      root.style.setProperty("--accent", hsl);
      root.style.setProperty("--sidebar-primary", hsl);
      root.style.setProperty("--sidebar-ring", hsl);
      root.style.setProperty("--glass-glow", hsl);
    }
    if (secondary) {
      const hsl = hexToHsl(secondary);
      root.style.setProperty("--secondary", hsl);
      root.style.setProperty("--muted", hsl);
      root.style.setProperty("--sidebar-accent", hsl);
    }
    if (bg) {
      const hsl = hexToHsl(bg);
      root.style.setProperty("--background", hsl);
      root.style.setProperty("--sidebar-background", hsl);
    }
  };

  useEffect(() => {
    if (!companyId || !user) return;
    const fetchBrand = async () => {
      try {
        // Check if user is a reseller first
        const { data: resellerData } = await supabase
          .from("resellers")
          .select("id, credit_balance")
          .eq("user_id", user.id)
          .maybeSingle();

        if (resellerData) {
          // Reseller theme: fetch from company_settings (same as owner)
          const { data: compSettings } = await supabase
            .from("company_settings")
            .select("primary_color, secondary_color, background_color")
            .eq("company_id", companyId)
            .maybeSingle();
          if (compSettings) applyThemeColors(compSettings.primary_color, compSettings.secondary_color, compSettings.background_color);
        } else {
          // Regular user: fetch from company_settings
          const { data } = await supabase
            .from("company_settings")
            .select("primary_color, secondary_color, background_color")
            .eq("company_id", companyId)
            .maybeSingle();
          if (data) applyThemeColors(data.primary_color, data.secondary_color, data.background_color);
        }
      } catch (e) {
        console.error("Error fetching brand:", e);
      }
    };

    const fetchSubscription = async () => {
      const { data } = await supabase
        .from("saas_subscriptions")
        .select("end_date, status")
        .eq("company_id", companyId)
        .eq("status", "active")
        .order("end_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.end_date) {
        const days = differenceInDays(parseISO(data.end_date), new Date());
        setSubscriptionDaysLeft(days);
      }
    };

    const fetchAdminInfo = async () => {
      if (!user) return;

      // Helper: get support_whatsapp via SECURITY DEFINER RPC (bypasses RLS)
      const getCompanySupportById = async (cId: string): Promise<string | null> => {
        const { data } = await supabase.rpc("get_support_whatsapp", { _company_id: cId });
        return data || null;
      };

      const getCompanySupportByUser = async (userId: string): Promise<string | null> => {
        const { data: cid } = await supabase.rpc("get_user_company_id", { _user_id: userId });
        if (!cid) return null;
        return getCompanySupportById(cid as string);
      };

      // 1. Check if user was created via a trial link → use creator info
      const { data: membership } = await supabase
        .from("company_memberships")
        .select("trial_link_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (membership?.trial_link_id) {
        const { data: trialLink } = await supabase
          .from("trial_links")
          .select("created_by, company_id")
          .eq("id", membership.trial_link_id)
          .maybeSingle();

        if (trialLink?.created_by) {
          // Get support_whatsapp from creator's company_settings (primary source)
          const creatorSupport = await getCompanySupportByUser(trialLink.created_by);

          // Fallback: try reseller_settings if creator is a reseller
          let fallbackWhatsapp: string | null = null;
          if (!creatorSupport) {
            const { data: creatorReseller } = await supabase
              .from("resellers")
              .select("id")
              .eq("user_id", trialLink.created_by)
              .maybeSingle();
            if (creatorReseller) {
              const { data: rs } = await supabase
                .from("reseller_settings")
                .select("support_whatsapp")
                .eq("reseller_id", creatorReseller.id)
                .maybeSingle();
              fallbackWhatsapp = rs?.support_whatsapp || null;
            }
          }

          // Ultimate fallback: parent company (trialLink.company_id)
          let masterWhatsapp: string | null = null;
          if (!creatorSupport && !fallbackWhatsapp && trialLink.company_id) {
            masterWhatsapp = await getCompanySupportById(trialLink.company_id);
          }

          const finalWhatsapp = creatorSupport || fallbackWhatsapp || masterWhatsapp;

          if (finalWhatsapp) setSupportWhatsapp(finalWhatsapp);
          return;
        }
      }

      // 2. Reseller: get parent company owner's support via RPC
      const { data: resellerData } = await supabase
        .from("resellers")
        .select("company_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (resellerData?.company_id) {
        const parentSupport = await getCompanySupportById(resellerData.company_id);
        if (parentSupport) setSupportWhatsapp(parentSupport);
        return;
      }

      // 3. Fallback: own company settings via RPC
      if (companyId) {
        const ownSupport = await getCompanySupportById(companyId);
        if (ownSupport) {
          setSupportWhatsapp(ownSupport);
        }
      }
    };
    fetchAdminInfo();

    return () => {};
  }, [companyId, user]);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>(() => {
    const open: Record<string, boolean> = {};
    navItems.forEach((item) => {
      if ("children" in item && item.children) {
        // Configurações sempre aberto por padrão
        if (item.label === "Configurações" || item.children.some((c) => location.pathname.startsWith(c.href))) {
          open[item.label] = true;
        }
      }
    });
    return open;
  });

  const toggleMenu = (label: string) =>
    setOpenMenus((prev) => ({ ...prev, [label]: !prev[label] }));

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const isActive = (href: string) => location.pathname === href;

  return (
    <div className="min-h-screen flex bg-background">
      <AnnouncementModal />
      {/* Mobile overlay */}
      <div
        className={cn(
          "fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300",
          sidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 w-64 flex flex-col glass-sidebar text-sidebar-foreground transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center px-4 h-20 border-b border-sidebar-border/50">
          <div className="relative flex items-center justify-center flex-1 min-w-0 py-2">
            {/* Glow effect behind logo */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-14 rounded-full bg-primary/20 blur-2xl" />
            </div>
            <img
              src={defaultBrandLogo}
              alt="Meu Gestor"
              className="relative h-9 max-w-[160px] object-contain drop-shadow-[0_0_10px_hsl(var(--primary)/0.5)]"
            />
          </div>
          <button className="lg:hidden ml-2 text-sidebar-foreground hover:text-foreground transition-colors duration-200" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems
            .filter((item) => {
              const isOwnerOrAdmin = userRole === "Proprietário" || userRole === "Admin";
              const isResellerUser = resellerCredits !== null;

              if (item.adminOnly && !(isOwnerOrAdmin || isResellerUser)) return false;
              if (item.resellerOnly && !isResellerUser) return false;
              // Completely hide items that are both adminOnly and proOnly for Starter users
              if (item.proOnly && item.adminOnly && planType !== "pro") return false;
              return true;
            })
            .map((item) => {
            const isStarterLocked = item.proOnly && planType !== "pro";
            // Show all children, but mark proOnly ones
            const allChildren = item.children;
            if (allChildren && allChildren.length > 0) {
              const childActive = allChildren.some((c) => isActive(c.href) && (!c.proOnly || planType === "pro"));
              const isOpen = openMenus[item.label];
              return (
                <div key={item.label}>
                  <button
                    onClick={() => toggleMenu(item.label)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium transition-all duration-200",
                      childActive
                        ? "text-primary"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <item.icon className={cn("w-5 h-5 transition-colors duration-200", childActive && "text-primary")} />
                    {item.label}
                    <ChevronDown
                      className={cn(
                        "w-4 h-4 ml-auto transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
                        isOpen && "rotate-180"
                      )}
                    />
                  </button>

                  <div
                    className={cn(
                      "overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
                      isOpen ? "max-h-[300px] opacity-100" : "max-h-0 opacity-0"
                    )}
                  >
                    <div className="relative ml-[1.65rem] mt-1 space-y-0.5 pb-1">
                      {/* Vertical connecting line */}
                      <div
                        className={cn(
                          "absolute left-0 top-0 bottom-2 w-px transition-all duration-500",
                          "bg-gradient-to-b from-primary/40 via-primary/20 to-transparent"
                        )}
                      />
                      {allChildren.map((child, idx) => {
                        const childLocked = child.proOnly && planType !== "pro";

                        return (
                        <div key={child.href} className="relative animate-fade-in" style={{ animationDelay: `${idx * 50}ms` }}>
                          {/* Horizontal branch line */}
                          <div className="absolute left-0 top-1/2 w-3.5 h-px bg-primary/25 transition-all duration-200" />
                          {childLocked ? (
                             <button
                              onClick={() => {
                                setUpgradeFeature(child.label);
                                setUpgradeModalOpen(true);
                                setSidebarOpen(false);
                              }}
                              className="flex items-center gap-2.5 pl-6 pr-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 w-full text-left text-sidebar-foreground/60 hover:bg-sidebar-accent/30"
                            >
                              <child.icon className="w-3.5 h-3.5 transition-transform duration-200" />
                              <span className="flex-1">{child.label}</span>
                              <Lock className="w-3 h-3 text-[hsl(48,96%,53%)]" />
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase leading-none bg-[hsl(48,96%,53%)] text-black tracking-wider">PRO</span>
                            </button>
                          ) : (
                          <Link
                            to={child.href}
                            onClick={() => setSidebarOpen(false)}
                            className={cn(
                              "flex items-center gap-2.5 pl-6 pr-3 py-2 rounded-lg text-xs font-medium transition-all duration-200",
                              isActive(child.href)
                                ? "bg-primary/15 text-primary border border-primary/20 shadow-[0_0_12px_hsl(var(--primary)/0.1)]"
                                : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground hover:pl-7"
                            )}
                          >
                            <child.icon className="w-3.5 h-3.5 transition-transform duration-200" />
                            {child.label}
                          </Link>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            }

            // Top-level items
            if (isStarterLocked) {
              return (
                <button
                  key={item.href || item.label}
                  onClick={() => {
                    setUpgradeFeature(item.label);
                    setUpgradeModalOpen(true);
                    setSidebarOpen(false);
                  }}
                  className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium transition-all duration-200 text-sidebar-foreground/60 hover:bg-sidebar-accent/30"
                >
                  <item.icon className="w-5 h-5" />
                  <span className="flex-1 text-left">{item.label}</span>
                  <Lock className="w-3.5 h-3.5 text-[hsl(48,96%,53%)]" />
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase leading-none bg-[hsl(48,96%,53%)] text-black tracking-wider">PRO</span>
                </button>
              );
            }

            return (
              <Link
                key={item.href}
                to={item.href!}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group",
                  isActive(item.href!)
                    ? "bg-primary/15 text-primary border border-primary/20 shadow-[0_0_12px_hsl(var(--primary)/0.1)]"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className={cn(
                  "w-5 h-5 transition-all duration-200",
                  isActive(item.href!) ? "text-primary" : "group-hover:scale-110"
                )} />
                <span className="flex-1">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-sidebar-border/50 space-y-1">
          {supportWhatsapp && (
            <a
              href={`https://wa.me/${supportWhatsapp.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-green-400 hover:bg-green-500/10 transition-all duration-200"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Suporte
            </a>
          )}
          <SidebarUserMenu
            onSignOut={handleSignOut}
            onCloseSidebar={() => setSidebarOpen(false)}
          />
        </div>
      </aside>

      {/* Upgrade Pro Modal */}
      <Dialog open={upgradeModalOpen} onOpenChange={setUpgradeModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-center">
              Desbloqueie o Poder Total da Automação 🚀
            </DialogTitle>
            <DialogDescription className="text-center text-sm">
              O recurso <strong>"{upgradeFeature}"</strong> é exclusivo do <span className="text-[hsl(48,96%,53%)] font-bold">Plano PRO</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="rounded-xl border border-[hsl(48,96%,53%)]/20 bg-[hsl(48,96%,53%)]/5 p-4 space-y-2.5">
              {[
                "Conexão direta via API (Instância)",
                "Disparos automáticos diários (Vence hoje/amanhã/vencidos)",
                "Follow-up e Suporte automatizados",
                "Gestão de rede completa",
              ].map((benefit) => (
                <div key={benefit} className="flex items-start gap-2.5 text-sm">
                  <span className="text-green-400 mt-0.5 shrink-0">✅</span>
                  <span className="text-foreground">{benefit}</span>
                </div>
              ))}
            </div>
            {supportWhatsapp ? (
              <a
                href={`https://wa.me/${supportWhatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`Olá! Gostaria de fazer upgrade para o Plano Pro. Recurso: ${upgradeFeature}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full rounded-xl py-3.5 font-bold text-sm transition-all bg-[hsl(48,96%,53%)] text-black hover:bg-[hsl(48,96%,45%)] hover:scale-[1.02] shadow-[0_0_20px_hsl(48,96%,53%,0.3)]"
                onClick={() => setUpgradeModalOpen(false)}
              >
                <Zap className="w-4 h-4" />
                Quero ser PRO agora
              </a>
            ) : (
              <Button
                className="w-full gap-2 font-bold rounded-xl py-3.5 h-auto bg-[hsl(48,96%,53%)] text-black hover:bg-[hsl(48,96%,45%)] hover:scale-[1.02] shadow-[0_0_20px_hsl(48,96%,53%,0.3)]"
                onClick={() => setUpgradeModalOpen(false)}
              >
                <Zap className="w-4 h-4" />
                Quero ser PRO agora
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Ghost Mode Banner */}
        {isGhostMode && (
          <div className="bg-orange-500 text-white px-4 py-2.5 flex items-center justify-between z-50 shadow-lg">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Eye className="w-4 h-4" />
              <span>Você está visualizando o painel de: <strong>{ghostName}</strong></span>
            </div>
            <button
              onClick={handleExitGhostMode}
              className="flex items-center gap-1.5 rounded-lg bg-white/20 hover:bg-white/30 px-3 py-1.5 text-xs font-bold transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sair e Voltar para o Master
            </button>
          </div>
        )}
        <TrialBanner />
        <header className="h-24 glass-header flex items-center justify-between px-4 lg:px-6">
          <button className="lg:hidden mr-3 hover:scale-110 transition-transform duration-200" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-6 h-6 text-foreground" />
          </button>

          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="relative flex items-center justify-center">
              {/* Glow effect */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-72 h-20 rounded-full bg-primary/25 blur-3xl" />
              </div>
              <img
                src={defaultBrandLogo}
                alt="Meu Gestor"
                className="relative h-16 sm:h-20 object-contain drop-shadow-[0_0_16px_hsl(var(--primary)/0.6)]"
              />
            </div>
          </div>

          {/* Spacer to balance hamburger on mobile */}
          <div className="w-6 lg:hidden" />
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {subscriptionDaysLeft !== null && subscriptionDaysLeft <= 15 && (
            <div className={cn(
              "mb-4 flex items-center justify-between gap-3 rounded-xl px-4 py-3 border",
              subscriptionDaysLeft <= 3
                ? "bg-destructive/10 border-destructive/30 text-destructive"
                : subscriptionDaysLeft <= 7
                  ? "bg-warning/10 border-warning/30 text-warning"
                  : "bg-primary/10 border-primary/30 text-primary"
            )}>
              <div className="flex items-center gap-3 min-w-0">
                <Clock className="w-5 h-5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {subscriptionDaysLeft <= 0
                      ? "Sua plataforma expirou!"
                      : `Sua plataforma vence em ${subscriptionDaysLeft} dia${subscriptionDaysLeft !== 1 ? "s" : ""}`}
                  </p>
                  <div className="w-full max-w-xs mt-1.5">
                    <div className="h-1.5 rounded-full bg-foreground/10 overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          subscriptionDaysLeft <= 3 ? "bg-destructive" : subscriptionDaysLeft <= 7 ? "bg-warning" : "bg-primary"
                        )}
                        style={{ width: `${Math.max(0, Math.min(100, (subscriptionDaysLeft / 30) * 100))}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <button className="flex items-center gap-2 shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
                <MessageCircle className="w-4 h-4" />
                Renovar assinatura
              </button>
            </div>
          )}
          <div className="animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
