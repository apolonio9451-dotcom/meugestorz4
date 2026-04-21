import { useAuth } from "@/hooks/useAuth";
import { SlidersHorizontal } from "lucide-react";
import AnnouncementManager from "@/components/announcements/AnnouncementManager";
import DataBackupExport from "@/components/settings/DataBackupExport";
import OverdueRulesSection from "@/components/settings/OverdueRulesSection";

export default function GeneralSettings() {
  const { userRole, effectiveCompanyId } = useAuth();
  const isOwner = userRole === "Proprietário";

  if (!isOwner) {
    return (
      <div className="glass-card rounded-xl p-6 border border-border/60">
        <h2 className="text-lg font-display font-semibold text-foreground">Acesso restrito</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Apenas o Proprietário pode acessar as configurações gerais.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
          <SlidersHorizontal className="h-6 w-6 text-primary" />
          Configuração Geral
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Backup, régua de cobrança e avisos do sistema
        </p>
      </div>
      <OverdueRulesSection companyId={effectiveCompanyId} />
      <DataBackupExport />
      <AnnouncementManager />
    </div>
  );
}
