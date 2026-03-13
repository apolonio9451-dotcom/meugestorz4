import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Clock, Zap, Timer } from "lucide-react";

interface Props {
  companyId: string;
}

export default function SupportCountdown({ companyId }: Props) {
  const [apiConfigured, setApiConfigured] = useState(false);
  const [autoSendHour, setAutoSendHour] = useState(8);
  const [autoSendMinute, setAutoSendMinute] = useState(0);
  const [suporteActive, setSuporteActive] = useState(false);
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    if (!companyId) return;

    const fetchSettings = async () => {
      const [apiResult, catResult] = await Promise.all([
        supabase
          .from("api_settings")
          .select("api_url, api_token, auto_send_hour, auto_send_minute")
          .eq("company_id", companyId)
          .maybeSingle(),
        supabase
          .from("auto_send_category_settings")
          .select("is_active")
          .eq("company_id", companyId)
          .eq("category", "suporte")
          .maybeSingle(),
      ]);

      const hasApi = !!(apiResult.data?.api_url && apiResult.data?.api_token);
      setApiConfigured(hasApi);
      setAutoSendHour(apiResult.data?.auto_send_hour ?? 8);
      setAutoSendMinute(apiResult.data?.auto_send_minute ?? 0);
      setSuporteActive(catResult.data?.is_active ?? true);
    };

    fetchSettings();
  }, [companyId]);

  useEffect(() => {
    if (!apiConfigured) return;

    const calcCountdown = () => {
      const now = new Date();
      // Convert to Brasília time (UTC-3)
      const brasiliaOffset = -3 * 60;
      const localOffset = now.getTimezoneOffset();
      const diff = (brasiliaOffset + localOffset) * 60 * 1000;
      const brasilia = new Date(now.getTime() + diff);

      const targetToday = new Date(brasilia);
      targetToday.setHours(autoSendHour, autoSendMinute, 0, 0);

      let target = targetToday;
      if (brasilia >= targetToday) {
        target = new Date(targetToday.getTime() + 24 * 60 * 60 * 1000);
      }

      const diffMs = target.getTime() - brasilia.getTime();
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
  }, [apiConfigured, autoSendHour, autoSendMinute]);

  if (apiConfigured) {
    return (
      <div className="flex items-center gap-2 bg-violet-500/10 border border-violet-400/20 rounded-lg px-3 py-2">
        <Zap className="w-4 h-4 text-violet-400 shrink-0" />
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-xs">
          <span className="text-muted-foreground">
            Próximo envio automático {suporteActive ? "" : "(desativado)"} em:
          </span>
          <span className="font-mono font-bold text-violet-400 text-sm">{countdown}</span>
          <span className="text-muted-foreground">
            (às {String(autoSendHour).padStart(2, "0")}:{String(autoSendMinute).padStart(2, "0")} Brasília)
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-400/20 rounded-lg px-3 py-2">
      <Timer className="w-4 h-4 text-yellow-400 shrink-0" />
      <span className="text-xs text-muted-foreground">
        <span className="font-semibold text-yellow-400">Envio manual</span> — API não configurada. O check-up de suporte deve ser enviado manualmente após <span className="font-semibold text-yellow-400">48h</span> do cliente ser encaminhado.
      </span>
    </div>
  );
}
