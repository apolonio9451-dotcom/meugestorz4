import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Activity } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import LogsList from "./auto-send-monitor/LogsList";
import MonitorControls from "./auto-send-monitor/MonitorControls";
import MonitorSummary from "./auto-send-monitor/MonitorSummary";
import RealtimeLogFeed from "./auto-send-monitor/RealtimeLogFeed";
import {
  ControlState,
  LogEntry,
  RuntimeEvent,
  formatDetailTimestamp,
  getCategoryLabel,
  getControlStatusMeta,
  getLogStatusMeta,
  isErrorStatus,
  isToday,
} from "./auto-send-monitor/types";

interface Props {
  companyId: string | null;
}

const HIDDEN_ERRORS_STORAGE_KEY = "auto-send-hidden-errors";
const MAX_LOG_ROWS = 100;
const MAX_RUNTIME_ROWS = 8;

async function getFunctionErrorMessage(error: any) {
  let message = error?.message || "Não foi possível concluir a ação.";

  try {
    if (error?.context && typeof error.context.json === "function") {
      const errorBody = await error.context.json();
      message = errorBody?.error || errorBody?.message || message;
    }
  } catch {
    // noop
  }

  return message;
}

export default function AutoSendLogs({ companyId }: Props) {
  const { user } = useAuth();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [controlState, setControlState] = useState<ControlState | null>(null);
  const [runtimeEvents, setRuntimeEvents] = useState<RuntimeEvent[]>([]);
  const [activeAction, setActiveAction] = useState<"start" | "pause" | "stop" | "refresh" | null>(null);
  const [dismissedErrorIds, setDismissedErrorIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  const persistDismissedErrors = useCallback((ids: string[]) => {
    if (!companyId) return;
    localStorage.setItem(`${HIDDEN_ERRORS_STORAGE_KEY}:${companyId}`, JSON.stringify(ids));
  }, [companyId]);

  const fetchLogs = useCallback(async () => {
    if (!companyId) {
      setLogs([]);
      return;
    }

    const { data, error } = await supabase
      .from("auto_send_logs")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(MAX_LOG_ROWS);

    if (error) throw error;
    setLogs((data as LogEntry[]) || []);
  }, [companyId]);

  const fetchControlState = useCallback(async () => {
    if (!companyId) {
      setControlState(null);
      return;
    }

    const { data, error } = await (supabase as any)
      .from("auto_send_control_states")
      .select("*")
      .eq("company_id", companyId)
      .maybeSingle();

    if (error) throw error;
    setControlState((data as ControlState | null) || null);
  }, [companyId]);

  const fetchRuntimeEvents = useCallback(async () => {
    if (!companyId) {
      setRuntimeEvents([]);
      return;
    }

    const { data, error } = await (supabase as any)
      .from("auto_send_runtime_events")
      .select("id, level, event_type, message, metadata, created_at")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(MAX_RUNTIME_ROWS);

    if (error) throw error;
    setRuntimeEvents((data as RuntimeEvent[]) || []);
  }, [companyId]);

  const refreshMonitor = useCallback(async (showFeedback = false) => {
    if (!companyId) return;

    setLoading(true);
    try {
      await Promise.all([fetchLogs(), fetchControlState(), fetchRuntimeEvents()]);
      if (showFeedback) {
        toast({ title: "Monitor atualizado" });
      }
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar",
        description: error?.message || "Não foi possível atualizar o monitor.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [companyId, fetchControlState, fetchLogs, fetchRuntimeEvents]);

  const runMonitorCommand = useCallback(async (
    action: "start" | "pause" | "stop",
    feedbackTitle: string,
    feedbackDescription: (data: any) => string,
  ) => {
    if (!companyId || !user?.id) return;

    setActiveAction(action);

    if (action === "start") {
      setControlState((prev) => prev ? {
        ...prev,
        status: "running",
        pause_requested: false,
        stop_requested: false,
        last_action: "Comando recebido. Preparando fila manual…",
        last_error: null,
      } : {
        company_id: companyId,
        status: "running",
        pause_requested: false,
        stop_requested: false,
        last_action: "Comando recebido. Preparando fila manual…",
        last_error: null,
        last_error_body: null,
        last_activity_at: new Date().toISOString(),
      });
    }

    try {
      const { data, error } = await supabase.functions.invoke("auto-send-messages", {
        body: { action, companyId },
      });

      if (error) {
        throw new Error(await getFunctionErrorMessage(error));
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast({
        title: feedbackTitle,
        description: feedbackDescription(data),
      });

      await refreshMonitor(false);
    } catch (error: any) {
      toast({
        title: "Comando não executado",
        description: error?.message || "Não foi possível concluir a ação no monitor.",
        variant: "destructive",
      });
    } finally {
      setActiveAction(null);
    }
  }, [companyId, refreshMonitor, user?.id]);

  const handleRefresh = useCallback(async () => {
    setActiveAction("refresh");
    await refreshMonitor(true);
    setActiveAction(null);
  }, [refreshMonitor]);

  const handleClearErrors = useCallback(() => {
    const idsToDismiss = logs.filter((log) => isErrorStatus(log.status)).map((log) => log.id);

    if (idsToDismiss.length === 0) {
      toast({ title: "Nenhum erro para limpar" });
      return;
    }

    const mergedIds = Array.from(new Set([...dismissedErrorIds, ...idsToDismiss]));
    setDismissedErrorIds(mergedIds);
    persistDismissedErrors(mergedIds);

    toast({
      title: "Monitor limpo",
      description: `${idsToDismiss.length} erro(s) foram ocultados desta visualização.`,
    });
  }, [dismissedErrorIds, logs, persistDismissedErrors]);

  useEffect(() => {
    if (!companyId) {
      setDismissedErrorIds([]);
      return;
    }

    try {
      const raw = localStorage.getItem(`${HIDDEN_ERRORS_STORAGE_KEY}:${companyId}`);
      setDismissedErrorIds(raw ? JSON.parse(raw) : []);
    } catch {
      setDismissedErrorIds([]);
    }
  }, [companyId]);

  useEffect(() => {
    void refreshMonitor(false);
  }, [refreshMonitor]);

  useEffect(() => {
    if (!companyId || !user?.id) return;

    const logsChannel = supabase
      .channel(`${user.id}:auto-send-logs-realtime`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "auto_send_logs",
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setLogs((prev) => [payload.new as LogEntry, ...prev].slice(0, MAX_LOG_ROWS));
            return;
          }

          if (payload.eventType === "UPDATE") {
            setLogs((prev) => prev.map((entry) => entry.id === payload.new.id ? payload.new as LogEntry : entry));
            return;
          }

          if (payload.eventType === "DELETE") {
            setLogs((prev) => prev.filter((entry) => entry.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    const stateChannel = supabase
      .channel(`${user.id}:auto-send-control-state`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "auto_send_control_states",
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            setControlState(null);
            return;
          }

          setControlState(payload.new as ControlState);
        }
      )
      .subscribe();

    const runtimeChannel = supabase
      .channel(`${user.id}:auto-send-runtime-events`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "auto_send_runtime_events",
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          setRuntimeEvents((prev) => [payload.new as RuntimeEvent, ...prev].slice(0, MAX_RUNTIME_ROWS));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(logsChannel);
      supabase.removeChannel(stateChannel);
      supabase.removeChannel(runtimeChannel);
    };
  }, [companyId, user?.id]);

  const dismissedErrorSet = useMemo(() => new Set(dismissedErrorIds), [dismissedErrorIds]);

  const visibleLogs = useMemo(
    () => logs.filter((log) => !(isErrorStatus(log.status) && dismissedErrorSet.has(log.id))),
    [dismissedErrorSet, logs]
  );

  const todayLogs = useMemo(() => logs.filter((log) => isToday(log.created_at)), [logs]);
  const todayVisibleLogs = useMemo(() => visibleLogs.filter((log) => isToday(log.created_at)), [visibleLogs]);

  const todaySuccess = todayVisibleLogs.filter((log) => log.status === "success").length;
  const todayErrors = todayVisibleLogs.filter((log) => isErrorStatus(log.status)).length;
  const hiddenErrorCount = todayLogs.filter((log) => isErrorStatus(log.status)).length - todayErrors;
  const isActive = controlState?.status === "running";
  const controlStatus = getControlStatusMeta(controlState?.status);

  return (
    <>
      <Card className="mt-6">
        <CardHeader className="space-y-4 pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="w-4 h-4 text-primary" />
              Monitor de Envios
            </CardTitle>
          </div>

          <MonitorControls
            activeAction={activeAction}
            busy={activeAction !== null}
            canClearErrors={logs.some((log) => isErrorStatus(log.status) && !dismissedErrorSet.has(log.id))}
            lastAction={controlState?.last_action || null}
            statusLabel={controlStatus.label}
            statusVariant={controlStatus.variant}
            onStart={() => void runMonitorCommand("start", "Fila processada", (data) => `${data?.sent ?? 0} enviados e ${data?.errors ?? 0} erros nesta execução.`)}
            onPause={() => void runMonitorCommand("pause", "Fila pausada", () => "Os próximos disparos ficarão aguardando até você iniciar novamente.")}
            onStop={() => void runMonitorCommand("stop", "Fila cancelada", () => "Os envios em andamento foram sinalizados para interrupção.")}
            onClearErrors={handleClearErrors}
            onRefresh={() => void handleRefresh()}
          />

          <MonitorSummary
            alertMessage={controlState?.last_error || null}
            errorCount={todayErrors}
            hiddenErrorCount={Math.max(0, hiddenErrorCount)}
            isActive={isActive}
            sentCount={todaySuccess}
            totalToday={todayLogs.length}
          />
        </CardHeader>
        <CardContent className="space-y-4">
          <LogsList loading={loading} logs={visibleLogs} onSelectLog={setSelectedLog} />
          <RealtimeLogFeed events={runtimeEvents} />
        </CardContent>
      </Card>

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes do Envio</DialogTitle>
            <DialogDescription>
              Informações completas sobre este envio automático.
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Cliente</p>
                  <p className="font-medium">{selectedLog.client_name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Número</p>
                  <p className="font-mono text-xs">{selectedLog.phone || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Categoria</p>
                  <Badge variant="outline" className="text-xs">
                    {getCategoryLabel(selectedLog.category)}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Horário</p>
                  <p className="text-xs">{formatDetailTimestamp(selectedLog.created_at)}</p>
                </div>
              </div>

              <div>
                <p className="text-muted-foreground text-xs mb-1">Status</p>
                <Badge variant={getLogStatusMeta(selectedLog.status).variant} className="text-xs">
                  {getLogStatusMeta(selectedLog.status).label}
                </Badge>
              </div>

              {selectedLog.error_message && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Motivo do Erro</p>
                  <p className="text-xs text-destructive bg-destructive/10 rounded-lg p-3 font-mono break-all">
                    {selectedLog.error_message}
                  </p>
                </div>
              )}

              {selectedLog.message_sent && (
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Texto Enviado</p>
                  <div className="text-xs bg-muted/50 rounded-lg p-3 max-h-48 overflow-y-auto whitespace-pre-wrap font-mono">
                    {selectedLog.message_sent}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
