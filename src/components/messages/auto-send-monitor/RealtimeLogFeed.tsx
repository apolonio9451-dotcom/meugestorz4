import { Card } from "@/components/ui/card";
import { Activity, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { RuntimeEvent, formatLogTimestamp } from "./types";

interface Props {
  events: RuntimeEvent[];
}

function EventIcon({ level }: { level: RuntimeEvent["level"] }) {
  if (level === "error") return <AlertTriangle className="h-4 w-4 text-destructive" />;
  if (level === "success") return <CheckCircle2 className="h-4 w-4 text-primary" />;
  if (level === "warn") return <AlertTriangle className="h-4 w-4 text-foreground" />;
  return <Info className="h-4 w-4 text-muted-foreground" />;
}

export default function RealtimeLogFeed({ events }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Activity className="h-4 w-4 text-primary" />
        Log em Tempo Real
      </div>

      <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-2">
        {events.length === 0 ? (
          <p className="px-2 py-4 text-xs text-muted-foreground">
            O painel mostrará aqui as ações mais recentes da fila de envios.
          </p>
        ) : (
          events.map((event) => (
            <Card key={event.id} className="border-border/60 bg-background/70 px-3 py-2">
              <div className="flex items-start gap-2">
                <EventIcon level={event.level} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">{event.message}</p>
                  <p className="text-[11px] text-muted-foreground">{formatLogTimestamp(event.created_at)}</p>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}