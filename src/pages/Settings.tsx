import { useAuth } from "@/hooks/useAuth";
import { Settings as SettingsIcon, Wifi } from "lucide-react";
import WhatsAppView from "@/components/whatsapp/WhatsAppView";

export default function Settings() {
  const { effectiveCompanyId: companyId, parentCompanyId, userRole, effectivePlanType, loading } = useAuth();
  const isOwner = userRole === "Proprietário";
  const isMaster = userRole === "master";
  const canManageApiSettings = isOwner || isMaster;
  const hasInstanceAccess = loading ? true : (canManageApiSettings || effectivePlanType === "pro");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
          <Wifi className="h-6 w-6 text-primary" />
          Gerenciamento WhatsApp
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gerencie sua conexão WhatsApp
        </p>
      </div>

      {hasInstanceAccess ? (
        <WhatsAppView />
      ) : (
        <div className="glass-card rounded-xl p-6 border border-border/60">
          <h2 className="text-lg font-display font-semibold text-foreground">Acesso bloqueado</h2>
          <p className="text-sm text-muted-foreground mt-2">
            O módulo de Instância é exclusivo para Plano PRO.
          </p>
        </div>
      )}
    </div>
  );
}
