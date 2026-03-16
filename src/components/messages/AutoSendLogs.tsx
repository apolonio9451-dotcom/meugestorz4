import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { RefreshCw, CheckCircle2, XCircle, Clock, Loader2, Activity, Zap } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase as supabaseClient } from "@/integrations/supabase/client";

interface LogEntry {
  id: string;
  client_name: string;
  category: string;
  status: string;
  error_message: string | null;
  phone: string | null;
  message_sent: string;
  created_at: string;
}

const categoryLabels: Record<string, string> = {
  vence_hoje: "Vence Hoje",
  vence_amanha: "Vence Amanhã",
  a_vencer: "A Vencer",
  vencidos: "Vencidos",
  followup: "Follow-up",
  suporte: "Suporte",
};

const categoryColors: Record<string, string> = {
  vence_hoje: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  vence_amanha: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  a_vencer: "bg-yellow-600/20 text-yellow-500 border-yellow-600/30",
  vencidos: "bg-destructive/20 text-destructive border-destructive/30",
  followup: "bg-cyan-400/20 text-cyan-400 border-cyan-400/50",
  suporte: "bg-violet-400/20 text-violet-400 border-violet-400/50",
};

interface Props {
  companyId: string | null;
}

export default function AutoSendLogs({ companyId }: Props) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [restarting, setRestarting] = useState(false);

  const handleRestart = async () => {
    if (!companyId || restarting) return;
    setRestarting(true);
    try {
      const { data, error } = await supabaseClient.functions.invoke("auto-send-messages", {
        body: { manual: true },
      });
      if (error) throw error;
      const sent = data?.sent ?? 0;
      const errors = data?.errors ?? 0;
      toast({
        title: "Envios retomados",
        description: `${sent + errors} mensagens pendentes processadas (${sent} enviadas, ${errors} erros).`,
      });
      fetchLogs();
    } catch (err: any) {
      toast({
        title: "Erro ao reiniciar",
        description: err?.message || "Não foi possível disparar os envios.",
        variant: "destructive",
      });
    } finally {
      setRestarting(false);
    }
  };

  const fetchLogs = async () => {
    if (!companyId) return;
    setLoading(true);
    const { data } = await supabase
      .from("auto_send_logs")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(100);
    setLogs((data as LogEntry[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, [companyId]);

  // Realtime subscription
  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel("auto-send-logs-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "auto_send_logs",
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          setLogs((prev) => [payload.new as LogEntry, ...prev].slice(0, 100));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId]);

  const successCount = logs.filter((l) => l.status === "success").length;
  const errorCount = logs.filter((l) => l.status === "error").length;
  const totalCount = logs.length;

  // Get today's logs for progress
  const today = new Date().toISOString().split("T")[0];
  const todayLogs = logs.filter((l) => l.created_at.startsWith(today));
  const todaySuccess = todayLogs.filter((l) => l.status === "success").length;
  const todayErrors = todayLogs.filter((l) => l.status === "error").length;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />;
      case "error":
        return <XCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />;
      case "sending":
        return <Loader2 className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 animate-spin" />;
      default:
        return <Clock className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />;
    }
  };

  return (
    <>
      <Card className="mt-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Monitor de Envios
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={handleRestart}
                disabled={restarting}
                className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white border-0"
              >
                {restarting ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4 mr-1" />
                )}
                {restarting ? "Processando…" : "Reiniciar Envios"}
              </Button>
              <Button variant="ghost" size="sm" onClick={fetchLogs} disabled={loading}>
                <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </div>
          </div>

          {/* Progress Summary */}
          {todayLogs.length > 0 && (
            <div className="space-y-2 mt-2">
              {/* Live processing indicator */}
              {todayLogs.length > 0 && (() => {
                const lastLog = todayLogs[0];
                const lastLogTime = new Date(lastLog.created_at).getTime();
                const isRecentlyActive = Date.now() - lastLogTime < 5 * 60 * 1000; // 5 min
                return isRecentlyActive ? (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-primary/10 border border-primary/20 animate-pulse">
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    <span className="text-xs font-medium text-primary">
                      Processando: {todayLogs.length} mensagens enviadas — fila em andamento…
                    </span>
                  </div>
                ) : null;
              })()}
              <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 border border-border/30">
                <div className="flex items-center gap-1.5 text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                  <span className="text-green-400 font-medium">{todaySuccess}</span>
                  <span className="text-muted-foreground">Enviados</span>
                </div>
                {todayErrors > 0 && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <XCircle className="w-3.5 h-3.5 text-destructive" />
                    <span className="text-destructive font-medium">{todayErrors}</span>
                    <span className="text-muted-foreground">Erros</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-xs ml-auto">
                  <span className="text-muted-foreground">Total Hoje:</span>
                  <span className="font-medium text-foreground">{todayLogs.length}</span>
                </div>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              Nenhum envio automático registrado ainda.
            </p>
          ) : (
            <div className="space-y-1.5 max-h-80 overflow-y-auto">
              {logs.map((log) => (
                <div
                  key={log.id}
                  onClick={() => setSelectedLog(log)}
                  className="flex items-center justify-between text-xs border border-border/30 rounded-lg px-3 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {getStatusIcon(log.status)}
                    <span className="truncate font-medium">{log.client_name}</span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 ${categoryColors[log.category] || "bg-muted text-muted-foreground"}`}
                    >
                      {categoryLabels[log.category] || log.category}
                    </Badge>
                    {log.status === "error" && log.error_message && (
                      <span className="text-destructive/70 truncate max-w-[120px]" title={log.error_message}>
                        {log.error_message.slice(0, 40)}…
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <span className="text-muted-foreground">
                      {new Date(log.created_at).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedLog && getStatusIcon(selectedLog.status)}
              Detalhes do Envio
            </DialogTitle>
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
                  <Badge variant="outline" className={`text-xs ${categoryColors[selectedLog.category] || ""}`}>
                    {categoryLabels[selectedLog.category] || selectedLog.category}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">Horário</p>
                  <p className="text-xs">
                    {new Date(selectedLog.created_at).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-muted-foreground text-xs mb-1">Status</p>
                <Badge variant={selectedLog.status === "success" ? "default" : "destructive"} className="text-xs">
                  {selectedLog.status === "success" ? "Concluído" : "Erro"}
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
