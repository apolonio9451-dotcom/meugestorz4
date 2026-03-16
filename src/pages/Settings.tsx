import { useAuth } from "@/hooks/useAuth";
import { Settings as SettingsIcon } from "lucide-react";
import AnnouncementManager from "@/components/announcements/AnnouncementManager";
import ApiSettingsSection from "@/components/settings/ApiSettingsSection";
import WhatsAppInstanceSection from "@/components/settings/WhatsAppInstanceSection";

export default function Settings() {
  const { effectiveCompanyId: companyId, parentCompanyId, userRole, planType } = useAuth();
  const isOwner = userRole === "Proprietário";
  const isReseller = !!parentCompanyId;
  const hasInstanceAccess = isOwner || planType === "pro";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
          <SettingsIcon className="h-6 w-6 text-primary" />
          Configurações
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gerencie suas integrações e instâncias
        </p>
      </div>

      {hasInstanceAccess ? (
        <>
          {/* WhatsApp Instance Management */}
          <WhatsAppInstanceSection companyId={companyId} isOwner={isOwner} />

          {/* API Settings */}
          <ApiSettingsSection companyId={isReseller && companyId === parentCompanyId ? null : companyId} isOwner={isOwner} />
        </>
      ) : (
        <div className="glass-card rounded-xl p-6 border border-border/60">
          <h2 className="text-lg font-display font-semibold text-foreground">Acesso bloqueado</h2>
          <p className="text-sm text-muted-foreground mt-2">
            O módulo de Instância e Configuração de Envio é exclusivo para Plano PRO.
          </p>
        </div>
      )}

      {isOwner && <AnnouncementManager />}
    </div>
  );
}
