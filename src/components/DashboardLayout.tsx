import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import TrialBanner from "@/components/trials/TrialBanner";
import AnnouncementModal from "@/components/announcements/AnnouncementModal";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { differenceInDays, parseISO } from "date-fns";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  FileText,
  LogOut,
  Menu,
  X,
  Building2,
  Server,
  DollarSign,
  RotateCcw,
  Megaphone,
  UserCog,
  ChevronDown,
  Settings,
  KeyRound,
  ShieldCheck,
  Store,
  Clock,
  MessageCircle,
  FlaskConical,
} from "lucide-react";

type NavItem = {
  href?: string;
  label: string;
  icon: any;
  children?: { href: string; label: string; icon: any }[];
  adminOnly?: boolean;
  resellerOnly?: boolean;
};

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/clients", label: "Clientes", icon: Users },
  {
    label: "Financeiro",
    icon: DollarSign,
    children: [
      { href: "/dashboard/financial", label: "Financeiro", icon: DollarSign },
      { href: "/dashboard/subscriptions", label: "Assinaturas", icon: FileText },
    ],
  },
  { href: "/dashboard/winback", label: "Repescagem", icon: RotateCcw },
  { href: "/dashboard/marketing", label: "Marketing", icon: Megaphone },
  {
    label: "Configurações",
    icon: Settings,
    children: [
      { href: "/dashboard/servers", label: "Servidores", icon: Server },
      { href: "/dashboard/plans", label: "Planos", icon: CreditCard },
      { href: "/dashboard/messages", label: "Mensagens", icon: Megaphone },
      { href: "/dashboard/settings", label: "Geral", icon: Settings },
    ],
  },
  { href: "/dashboard/resellers", label: "Revendedores", icon: Store, adminOnly: true },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { signOut, user, companyId, userRole, resellerCredits, isTrial } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [brandName, setBrandName] = useState("ClientHub");
  const [brandLogo, setBrandLogo] = useState<string | null>(null);
  const [subscriptionDaysLeft, setSubscriptionDaysLeft] = useState<number | null>(null);
  const [adminInfo, setAdminInfo] = useState<{ name: string; whatsapp: string | null } | null>(null);
  const [supportWhatsapp, setSupportWhatsapp] = useState<string | null>(null);

  const applyThemeColors = (primary?: string, secondary?: string, bg?: string) => {
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
      // Check if user is a reseller first
      const { data: resellerData } = await supabase
        .from("resellers")
        .select("id, credit_balance")
        .eq("user_id", user.id)
        .maybeSingle();

      if (resellerData) {
        // Reseller: fetch from reseller_settings
        const { data: resellerSettings } = await supabase
          .from("reseller_settings")
          .select("service_name, logo_url, primary_color")
          .eq("reseller_id", resellerData.id)
          .maybeSingle();

        if (resellerSettings?.service_name) {
          setBrandName(resellerSettings.service_name);
        } else {
          setBrandName("Meu gestor");
        }
        if (resellerSettings?.logo_url) setBrandLogo(resellerSettings.logo_url);
        if (resellerSettings?.primary_color) applyThemeColors(resellerSettings.primary_color);
      } else {
        // Regular user: fetch from company_settings
        const { data } = await supabase
          .from("company_settings")
          .select("brand_name, logo_url, primary_color, secondary_color, background_color")
          .eq("company_id", companyId)
          .maybeSingle();
        if (data?.brand_name) setBrandName(data.brand_name);
        if (data?.logo_url) setBrandLogo(data.logo_url);
        if (data) applyThemeColors(data.primary_color, data.secondary_color, data.background_color);
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
      // Check if this user was created via a trial link
      const { data: membership } = await supabase
        .from("company_memberships")
        .select("trial_link_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (membership?.trial_link_id) {
        // Get who created the trial link
        const { data: trialLink } = await supabase
          .from("trial_links")
          .select("created_by, company_id")
          .eq("id", membership.trial_link_id)
          .maybeSingle();

        if (trialLink?.created_by) {
          const { data: adminProfile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", trialLink.created_by)
            .maybeSingle();

          // Try to get whatsapp from resellers table
          const { data: reseller } = await supabase
            .from("resellers")
            .select("whatsapp")
            .eq("user_id", trialLink.created_by)
            .maybeSingle();

          if (adminProfile) {
            setAdminInfo({
              name: adminProfile.full_name || "Admin",
              whatsapp: reseller?.whatsapp || null,
            });
          }
        }
      } else {
        // Check if user is a reseller - get parent company owner
        const { data: resellerData } = await supabase
          .from("resellers")
          .select("company_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (resellerData?.company_id) {
          const { data: ownerMembership } = await supabase
            .from("company_memberships")
            .select("user_id")
            .eq("company_id", resellerData.company_id)
            .eq("role", "owner")
            .maybeSingle();

          if (ownerMembership?.user_id) {
            const { data: ownerProfile } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", ownerMembership.user_id)
              .maybeSingle();

            if (ownerProfile) {
              setAdminInfo({
                name: ownerProfile.full_name || "Admin",
                whatsapp: null,
              });
            }
          }
        }
      }
    };

    fetchBrand();
    fetchSubscription();
    fetchAdminInfo();

    // Fetch support whatsapp
    const fetchSupportWhatsapp = async () => {
      if (!user) return;
      // Check if user is a reseller
      const { data: resellerData } = await supabase
        .from("resellers")
        .select("id, company_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (resellerData) {
        // First check if the reseller's parent has a support_whatsapp in reseller_settings
        const { data: parentReseller } = await supabase
          .from("resellers")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (parentReseller) {
          // Get the company_settings support_whatsapp for the parent company
          const { data: compSettings } = await supabase
            .from("company_settings")
            .select("support_whatsapp")
            .eq("company_id", resellerData.company_id)
            .maybeSingle();
          if (compSettings?.support_whatsapp) {
            setSupportWhatsapp(compSettings.support_whatsapp);
            return;
          }
        }
      }

      // For non-resellers or fallback: get from own company settings
      if (companyId) {
        const { data: compSettings } = await supabase
          .from("company_settings")
          .select("support_whatsapp")
          .eq("company_id", companyId)
          .maybeSingle();
        if (compSettings?.support_whatsapp) {
          setSupportWhatsapp(compSettings.support_whatsapp);
        }
      }
    };
    fetchSupportWhatsapp();
  }, [companyId, user]);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>(() => {
    const open: Record<string, boolean> = {};
    navItems.forEach((item) => {
      if ("children" in item && item.children) {
        if (item.children.some((c) => location.pathname.startsWith(c.href))) {
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
        <div className="flex items-center gap-3 px-6 h-16 border-b border-sidebar-border/50">
          {brandLogo ? (
            <div className="w-8 h-8 rounded-lg overflow-hidden border border-primary/30 flex items-center justify-center transition-transform duration-200 hover:scale-110">
              <img src={brandLogo} alt="Logo" className="w-full h-full object-contain" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center transition-transform duration-200 hover:scale-110">
              <Building2 className="w-4 h-4 text-primary" />
            </div>
          )}
        <div className="flex flex-col min-w-0">
          <span className="font-display font-bold text-lg text-foreground truncate leading-tight">{brandName}</span>
          {userRole && (
            <span className="text-[10px] font-medium text-muted-foreground truncate">{userRole}</span>
          )}
        </div>
          <button className="lg:hidden ml-auto text-sidebar-foreground hover:text-foreground transition-colors duration-200" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems
            .filter((item) => {
              const isOwnerOrAdmin = userRole === "Proprietário" || userRole === "Administrador" || userRole === "Admin";
              const isResellerUser = resellerCredits !== null;

              // "Revendedores" deve continuar visível para revendedores mesmo com 0 créditos;
              // o bloqueio acontece dentro da própria página com aviso de recarga.
              if (item.adminOnly && !(isOwnerOrAdmin || isResellerUser)) return false;
              if (item.resellerOnly && !isResellerUser) return false;
              return true;
            })
            .map((item) => {
            if ("children" in item && item.children) {
              const childActive = item.children.some((c) => isActive(c.href));
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
                      {item.children.map((child, idx) => (
                        <div key={child.href} className="relative animate-fade-in" style={{ animationDelay: `${idx * 50}ms` }}>
                          {/* Horizontal branch line */}
                          <div className="absolute left-0 top-1/2 w-3.5 h-px bg-primary/25 transition-all duration-200" />
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
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
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
          <Link
            to="/dashboard/profile"
            onClick={() => setSidebarOpen(false)}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium transition-all duration-200 group",
              isActive("/dashboard/profile")
                ? "bg-primary/15 text-primary border border-primary/20"
                : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
            )}
          >
            <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
              {user?.email?.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <span className="block truncate">{user?.user_metadata?.full_name || "Meu Perfil"}</span>
              <span className="block text-[10px] text-muted-foreground truncate">{user?.email}</span>
            </div>
          </Link>
          {adminInfo && (
            <div className="rounded-lg bg-sidebar-accent/30 border border-sidebar-border/50 px-3 py-2.5 space-y-1.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Seu Admin</p>
              <p className="text-xs font-semibold text-sidebar-foreground truncate">{adminInfo.name}</p>
              {adminInfo.whatsapp && (
                <a
                  href={`https://wa.me/${adminInfo.whatsapp.replace(/\D/g, "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[11px] text-primary hover:text-primary/80 transition-colors font-medium"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Chamar no WhatsApp
                </a>
              )}
            </div>
          )}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-200 group"
          >
            <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <TrialBanner />
        <header className="h-16 glass-header flex items-center justify-between px-4 lg:px-6">
          <button className="lg:hidden mr-3 hover:scale-110 transition-transform duration-200" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-6 h-6 text-foreground" />
          </button>

          {/* Centered brand name + logo */}
          <div className="flex-1 flex items-center justify-center gap-2.5">
            {brandLogo ? (
              <div className="w-10 h-10 rounded-lg overflow-hidden border border-primary/30 flex items-center justify-center shrink-0">
                <img src={brandLogo} alt="Logo" className="w-full h-full object-contain" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
            )}
            <span className="font-display font-bold text-base text-foreground truncate">{brandName}</span>
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
