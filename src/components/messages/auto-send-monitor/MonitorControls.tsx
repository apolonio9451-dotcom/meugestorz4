import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Pause, Play, RefreshCw, Square, Trash2 } from "lucide-react";

type ActionKey = "start" | "pause" | "stop" | "refresh" | null;

interface Props {
  activeAction: ActionKey;
  busy: boolean;
  canClearErrors: boolean;
  lastAction: string | null;
  statusLabel: string;
  statusVariant: "default" | "secondary" | "destructive" | "outline";
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
  onClearErrors: () => void;
  onRefresh: () => void;
}

function SpinnerLabel({ icon, label }: { icon?: React.ReactNode; label: string }) {
  return (
    <>
      {icon}
      {label}
    </>
  );
}

export default function MonitorControls({
  activeAction,
  busy,
  canClearErrors,
  lastAction,
  statusLabel,
  statusVariant,
  onStart,
  onPause,
  onStop,
  onClearErrors,
  onRefresh,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <Badge variant={statusVariant}>{statusLabel}</Badge>
          {lastAction ? <span className="text-xs text-muted-foreground">{lastAction}</span> : null}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={onStart} disabled={busy} className="min-w-[110px]">
            {activeAction === "start" ? (
              <SpinnerLabel icon={<Loader2 className="mr-2 h-4 w-4 animate-spin" />} label="Iniciando" />
            ) : (
              <SpinnerLabel icon={<Play className="mr-2 h-4 w-4" />} label="Iniciar" />
            )}
          </Button>

          <Button size="sm" variant="secondary" onClick={onPause} disabled={busy} className="min-w-[110px]">
            {activeAction === "pause" ? (
              <SpinnerLabel icon={<Loader2 className="mr-2 h-4 w-4 animate-spin" />} label="Pausando" />
            ) : (
              <SpinnerLabel icon={<Pause className="mr-2 h-4 w-4" />} label="Pausar" />
            )}
          </Button>

          <Button size="sm" variant="destructive" onClick={onStop} disabled={busy} className="min-w-[140px]">
            {activeAction === "stop" ? (
              <SpinnerLabel icon={<Loader2 className="mr-2 h-4 w-4 animate-spin" />} label="Parando" />
            ) : (
              <SpinnerLabel icon={<Square className="mr-2 h-4 w-4" />} label="Parar Fila" />
            )}
          </Button>

          <Button size="sm" variant="outline" onClick={onClearErrors} disabled={busy || !canClearErrors}>
            <Trash2 className="mr-2 h-4 w-4" />
            Limpar Erros
          </Button>

          <Button size="sm" variant="ghost" onClick={onRefresh} disabled={busy}>
            {activeAction === "refresh" ? (
              <SpinnerLabel icon={<Loader2 className="mr-2 h-4 w-4 animate-spin" />} label="Atualizando" />
            ) : (
              <SpinnerLabel icon={<RefreshCw className="mr-2 h-4 w-4" />} label="Atualizar" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}