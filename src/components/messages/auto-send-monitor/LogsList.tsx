import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2, ChevronRight, Loader2, TriangleAlert } from "lucide-react";
import { LogEntry, formatLogTimestamp, getCategoryLabel, getLogStatusMeta, summarizeErrorMessage } from "./types";

interface Props {
  loading: boolean;
  logs: LogEntry[];
  onSelectLog: (log: LogEntry) => void;
}

export default function LogsList({ loading, logs, onSelectLog }: Props) {
  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border/60 py-8 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Carregando monitor…
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 py-8 text-center text-sm text-muted-foreground">
        Nenhum envio visível no momento.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {logs.map((log) => {
        const statusMeta = getLogStatusMeta(log.status);
        const hasError = statusMeta.variant === "destructive";

        return (
          <Card key={log.id} className="border-border/60 bg-background/70">
            <Button
              variant="ghost"
              className="h-auto w-full justify-between rounded-xl px-3 py-3 text-left"
              onClick={() => onSelectLog(log)}
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  {hasError ? (
                    <TriangleAlert className="h-4 w-4 shrink-0 text-destructive" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                  )}
                  <span className="truncate text-sm font-medium text-foreground">{log.client_name}</span>
                  <Badge variant="outline">{getCategoryLabel(log.category)}</Badge>
                  <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                </div>

                {log.error_message ? (
                  <p className="truncate text-xs text-muted-foreground">{summarizeErrorMessage(log.error_message)}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">Mensagem registrada com sucesso.</p>
                )}
              </div>

              <div className="ml-4 flex items-center gap-2 text-xs text-muted-foreground">
                <span>{formatLogTimestamp(log.created_at)}</span>
                <ChevronRight className="h-4 w-4" />
              </div>
            </Button>
          </Card>
        );
      })}
    </div>
  );
}