import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Clock3, PauseCircle, Radio, ShieldAlert } from "lucide-react";

interface Props {
  hiddenErrorCount: number;
  isActive: boolean;
  sentCount: number;
  errorCount: number;
  totalToday: number;
  alertMessage: string | null;
}

const metricClassName = "rounded-xl border border-border/60 bg-muted/30 px-3 py-2";

export default function MonitorSummary({
  hiddenErrorCount,
  isActive,
  sentCount,
  errorCount,
  totalToday,
  alertMessage,
}: Props) {
  return (
    <div className="space-y-3">
      {alertMessage ? (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-3">
          <ShieldAlert className="mt-0.5 h-4 w-4 text-destructive" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">{alertMessage}</p>
            <p className="text-xs text-muted-foreground">
              Verifique se a instância está conectada e se o token atual foi salvo no painel.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-2 md:grid-cols-4">
        <div className={metricClassName}>
          <div className="mb-1 flex items-center gap-2 text-muted-foreground">
            <Radio className={`h-4 w-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
            <span className="text-xs">Estado</span>
          </div>
          <p className="text-sm font-semibold text-foreground">{isActive ? "Fila ativa" : "Aguardando comando"}</p>
        </div>

        <div className={metricClassName}>
          <div className="mb-1 flex items-center gap-2 text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span className="text-xs">Enviados hoje</span>
          </div>
          <p className="text-sm font-semibold text-foreground">{sentCount}</p>
        </div>

        <div className={metricClassName}>
          <div className="mb-1 flex items-center gap-2 text-muted-foreground">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-xs">Erros visíveis</span>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{errorCount}</p>
            {hiddenErrorCount > 0 ? <Badge variant="outline">{hiddenErrorCount} ocultos</Badge> : null}
          </div>
        </div>

        <div className={metricClassName}>
          <div className="mb-1 flex items-center gap-2 text-muted-foreground">
            <Clock3 className="h-4 w-4" />
            <span className="text-xs">Total hoje</span>
          </div>
          <p className="text-sm font-semibold text-foreground">{totalToday}</p>
        </div>
      </div>

      {hiddenErrorCount > 0 ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <PauseCircle className="h-3.5 w-3.5" />
          <span>Os erros foram removidos apenas da visualização do monitor.</span>
        </div>
      ) : null}
    </div>
  );
}