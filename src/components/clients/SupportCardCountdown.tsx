import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

interface Props {
  supportStartedAt: string;
}

export default function SupportCardCountdown({ supportStartedAt }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const started = new Date(supportStartedAt).getTime();
  const deadline = started + 48 * 60 * 60 * 1000;
  const diffMs = deadline - now;

  if (diffMs <= 0) {
    return (
      <div className="px-3.5 pb-1.5 sm:px-4">
        <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-semibold">
          <Clock className="w-3 h-3" />
          ✅ 48h atingidas — pronto para envio
        </div>
      </div>
    );
  }

  const h = Math.floor(diffMs / (1000 * 60 * 60));
  const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const s = Math.floor((diffMs % (1000 * 60)) / 1000);
  const deadlineDate = new Date(deadline);

  return (
    <div className="px-3.5 pb-1.5 sm:px-4">
      <div className="flex items-center gap-1.5 text-[10px] text-violet-400">
        <Clock className="w-3 h-3" />
        <span className="font-mono font-bold text-sm">
          {String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
        </span>
        <span className="text-muted-foreground">
          (às {deadlineDate.toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" })})
        </span>
      </div>
    </div>
  );
}
