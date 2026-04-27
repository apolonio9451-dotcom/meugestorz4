import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Zap, Timer } from "lucide-react";

interface Props {
  companyId: string;
}

export default function SupportCountdown({ companyId }: Props) {
  const [apiConfigured, setApiConfigured] = useState(false);
  const [nearestDeadline, setNearestDeadline] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    if (!companyId) return;

    const fetchData = async () => {
      const [apiResult, clientsResult] = await Promise.all([
        supabase
          .from("whats_api" as any)
          .select("instance_token")
          .limit(1)
          .maybeSingle(),
        supabase
          .from("clients")
          .select("support_started_at")
          .eq("company_id", companyId)
          .not("support_started_at", "is", null),
      ]);

      setApiConfigured(!!apiResult.data?.instance_token);

      // Find the nearest 48h deadline among support clients
      if (clientsResult.data && clientsResult.data.length > 0) {
        const now = Date.now();
        const HOURS_48 = 48 * 60 * 60 * 1000;
        let nearest: Date | null = null;

        for (const c of clientsResult.data) {
          const started = new Date((c as any).support_started_at).getTime();
          const deadline = new Date(started + HOURS_48);
          // Only consider future deadlines, or pick the most recent past one
          if (!nearest || Math.abs(deadline.getTime() - now) < Math.abs(nearest.getTime() - now)) {
            nearest = deadline;
          }
        }

        // Find the next upcoming deadline
        let nextUpcoming: Date | null = null;
        for (const c of clientsResult.data) {
          const started = new Date((c as any).support_started_at).getTime();
          const deadline = new Date(started + HOURS_48);
          if (deadline.getTime() > now) {
            if (!nextUpcoming || deadline.getTime() < nextUpcoming.getTime()) {
              nextUpcoming = deadline;
            }
          }
        }

        setNearestDeadline(nextUpcoming || nearest);
      }
    };

    fetchData();
  }, [companyId]);

  useEffect(() => {
    if (!nearestDeadline) return;

    const calcCountdown = () => {
      const now = Date.now();
      const diffMs = nearestDeadline.getTime() - now;

      if (diffMs <= 0) {
        setCountdown("00:00:00");
        return;
      }

      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

      setCountdown(
        `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      );
    };

    calcCountdown();
    const interval = setInterval(calcCountdown, 1000);
    return () => clearInterval(interval);
  }, [nearestDeadline]);

  if (apiConfigured && nearestDeadline) {
    const isReady = nearestDeadline.getTime() <= Date.now();
    return (
      <div className="flex items-center gap-2 bg-violet-500/10 border border-violet-400/20 rounded-lg px-3 py-2">
        <Zap className="w-4 h-4 text-violet-400 shrink-0" />
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-xs">
          {isReady ? (
            <span className="font-semibold text-emerald-400">
              ✅ Próximo envio automático pronto — será disparado em breve
            </span>
          ) : (
            <>
              <span className="text-muted-foreground">
                Próximo envio automático (48h) em:
              </span>
              <span className="font-mono font-bold text-violet-400 text-sm">{countdown}</span>
              <span className="text-muted-foreground">
                (às {nearestDeadline.toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo" })})
              </span>
            </>
          )}
        </div>
      </div>
    );
  }

  if (!apiConfigured) {
    return (
      <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-400/20 rounded-lg px-3 py-2">
        <Timer className="w-4 h-4 text-yellow-400 shrink-0" />
        <span className="text-xs text-muted-foreground">
          <span className="font-semibold text-yellow-400">Envio manual</span> — API não configurada. O check-up de suporte deve ser enviado manualmente após{" "}
          <span className="font-semibold text-yellow-400">48h</span> do cliente ser encaminhado.
        </span>
      </div>
    );
  }

  return null;
}
