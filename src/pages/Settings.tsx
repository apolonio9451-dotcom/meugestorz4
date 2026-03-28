import { useAuth } from "@/hooks/useAuth";
import { Settings as SettingsIcon } from "lucide-react";
import AnnouncementManager from "@/components/announcements/AnnouncementManager";
import WhatsAppView from "@/components/whatsapp/WhatsAppView";
...
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

      {isOwner && <AnnouncementManager />}
    </div>
  );
}
