import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Settings as SettingsIcon, Wifi, SlidersHorizontal } from "lucide-react";
import AnnouncementManager from "@/components/announcements/AnnouncementManager";
import WhatsAppView from "@/components/whatsapp/WhatsAppView";
import DataBackupExport from "@/components/settings/DataBackupExport";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
          <SettingsIcon className="h-6 w-6 text-primary" />
          Configurações
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gerencie suas integrações e configurações gerais
        </p>
      </div>

      <Tabs defaultValue="instancia" className="w-full">
        <TabsList className="w-full flex-col items-stretch h-auto gap-1 sm:flex-row sm:items-center sm:h-10 sm:gap-0">
          <TabsTrigger value="instancia" className="gap-2 justify-start">
            <Wifi className="h-4 w-4" />
            Instância
          </TabsTrigger>
          {isOwner && (
            <TabsTrigger value="geral" className="gap-2 justify-start">
              <SlidersHorizontal className="h-4 w-4" />
              Geral
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="instancia" className="mt-4">
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
        </TabsContent>

        {isOwner && (
          <TabsContent value="geral" className="mt-4 space-y-6">
            <DataBackupExport />
            <AnnouncementManager />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
