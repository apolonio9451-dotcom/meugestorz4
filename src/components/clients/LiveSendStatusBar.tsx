import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, Radio } from "lucide-react";

interface Props {
  companyId: string | null;
  /** Number of clients expected to receive messages today */
  expectedToday: number;
}

export default function LiveSendStatusBar({ companyId, expectedToday }: Props) {
  const [logs, setLogs] = useState<{ status: string; created_at: string }[]>([]);

  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  useEffect(() => {
    if (!companyId) return;
    const fetchTodayLogs = async () => {
      const { data } = await supabase
        .from("auto_send_logs")
        .select("status, created_at")
        .eq("company_id", companyId)
        .gte("created_at", `${today}T00:00:00`)
        .lte("created_at", `${today}T23:59:59`);
      setLogs(data || []);
    };
    fetchTodayLogs();

    const channel = supabase
      .channel("live-send-status")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "auto_send_logs",
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          const row = payload.new as { status: string; created_at: string };
          if (row.created_at.startsWith(today)) {
            setLogs((prev) => [...prev, row]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, today]);

  const sent = logs.filter((l) => l.status === "success").length;
  const errors = logs.filter((l) => l.status === "error" || l.status === "failed").length;

  // Determine if system recently active (last log within 5 min)
  const isActive = logs.length > 0 && (() => {
    const last = logs[logs.length - 1];
    return Date.now() - new Date(last.created_at).getTime() < 5 * 60 * 1000;
  })();

  return (
    <div className="flex items-center gap-3 px-3.5 py-2 rounded-xl border border-primary/20 bg-primary/5 backdrop-blur-sm text-xs font-medium select-none">
      {/* Pulse dot */}
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span
          className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
            isActive ? "animate-ping bg-emerald-400" : "bg-muted-foreground/40"
          }`}
        />
        <span
          className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
            isActive ? "bg-emerald-400" : "bg-muted-foreground/40"
          }`}
        />
      </span>

      <span className="text-muted-foreground">
        {isActive ? "Sistema Ativo" : "Aguardando"}
      </span>

      <span className="w-px h-3.5 bg-border/50" />

      <span className="text-muted-foreground">
        Previstos: <span className="text-foreground font-semibold">{expectedToday}</span>
      </span>

      <span className="w-px h-3.5 bg-border/50" />

      <span className="flex items-center gap-1 text-emerald-400">
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span className="font-semibold">{sent}</span>
      </span>

      {errors > 0 && (
        <>
          <span className="w-px h-3.5 bg-border/50" />
          <span className="flex items-center gap-1 text-destructive">
            <XCircle className="w-3.5 h-3.5" />
            <span className="font-semibold">{errors}</span>
          </span>
        </>
      )}
    </div>
  );
}
