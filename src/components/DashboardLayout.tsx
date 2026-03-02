import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
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
} from "lucide-react";

const navItems = [
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
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { signOut, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
          <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center transition-transform duration-200 hover:scale-110">
            <Building2 className="w-4 h-4 text-primary" />
          </div>
          <span className="font-display font-bold text-lg text-foreground">ClientHub</span>
          <button className="lg:hidden ml-auto text-sidebar-foreground hover:text-foreground transition-colors duration-200" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
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
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-sidebar-border/50">
          <div className="px-3 py-2 text-xs text-sidebar-foreground/50 truncate mb-2">
            {user?.email}
          </div>
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
        <header className="h-16 glass-header flex items-center px-4 lg:px-6">
          <button className="lg:hidden mr-3 hover:scale-110 transition-transform duration-200" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-6 h-6 text-foreground" />
          </button>
          <h2 className="font-display font-semibold text-lg text-foreground">
            {(() => {
              for (const item of navItems) {
                if ("children" in item && item.children) {
                  const child = item.children.find((c) => c.href === location.pathname);
                  if (child) return child.label;
                } else if (item.href === location.pathname) {
                  return item.label;
                }
              }
              return "Dashboard";
            })()}
          </h2>
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <div className="animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
