import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle2, XCircle, Clock } from "lucide-react";

interface LogEntry {
  id: string;
  client_name: string;
  category: string;
  status: string;
  error_message: string;
  phone: string;
  created_at: string;
}

const categoryLabels: Record<string, string> = {
  vence_hoje: "Vence Hoje",
  vence_amanha: "Vence Amanhã",
  a_vencer: "A Vencer",
  vencidos: "Vencidos",
};

const categoryColors: Record<string, string> = {
  vence_hoje: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  vence_amanha: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  a_vencer: "bg-yellow-600/20 text-yellow-500 border-yellow-600/30",
  vencidos: "bg-destructive/20 text-destructive border-destructive/30",
};

interface Props {
  companyId: string | null;
}

export default function AutoSendLogs({ companyId }: Props) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    if (!companyId) return;
    setLoading(true);
    const { data } = await supabase
      .from("auto_send_logs")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(50);
    setLogs((data as LogEntry[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, [companyId]);

  const successCount = logs.filter((l) => l.status === "success").length;
  const errorCount = logs.filter((l) => l.status === "error").length;

  return (
    <Card className="mt-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            Log de Envios Automáticos
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
        {logs.length > 0 && (
          <div className="flex gap-3 text-xs mt-1">
            <span className="flex items-center gap-1 text-green-400">
              <CheckCircle2 className="w-3 h-3" /> {successCount} enviados
            </span>
            {errorCount > 0 && (
              <span className="flex items-center gap-1 text-destructive">
                <XCircle className="w-3 h-3" /> {errorCount} erros
              </span>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">
            Nenhum envio automático registrado ainda.
          </p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {logs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between text-xs border border-border/30 rounded-lg px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {log.status === "success" ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
                  )}
                  <span className="truncate font-medium">{log.client_name}</span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 ${categoryColors[log.category] || "bg-muted text-muted-foreground"}`}
                  >
                    {categoryLabels[log.category] || log.category}
                  </Badge>
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
  );
}
