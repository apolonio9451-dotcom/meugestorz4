import { useAuth } from "@/hooks/useAuth";
import { Settings as SettingsIcon } from "lucide-react";
import AnnouncementManager from "@/components/announcements/AnnouncementManager";
import ApiSettingsSection from "@/components/settings/ApiSettingsSection";
import WhatsAppInstanceSection from "@/components/settings/WhatsAppInstanceSection";

export default function Settings() {
  const { effectiveCompanyId: companyId, parentCompanyId, userRole } = useAuth();
  const isOwner = userRole === "Proprietário";
  const isReseller = !!parentCompanyId;

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

      {/* WhatsApp Instance Management */}
      <WhatsAppInstanceSection companyId={isReseller && companyId === parentCompanyId ? null : companyId} />

      {/* API Settings */}
      <ApiSettingsSection companyId={isReseller && companyId === parentCompanyId ? null : companyId} />

      {isOwner && <AnnouncementManager />}
    </div>
  );
}
