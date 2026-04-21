import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Save, Loader2, AlarmClockOff, Info, Send, Pause, RotateCw, UserX } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  companyId: string | null;
}

const rulesSchema = z.object({
  sendsPerCycle: z.coerce.number().int().min(1, "Mín 1").max(7, "Máx 7"),
  cooldownDays: z.coerce.number().int().min(1, "Mín 1").max(15, "Máx 15"),
  maxCycles: z.coerce.number().int().min(1, "Mín 1").max(10, "Máx 10"),
  inactiveAfterDays: z.coerce.number().int().min(7, "Mín 7").max(180, "Máx 180"),
});

const DEFAULTS = { sendsPerCycle: 2, cooldownDays: 3, maxCycles: 2, inactiveAfterDays: 30 };

const FIELDS = [
  { key: "sendsPerCycle", label: "Envios/ciclo", icon: Send, suffix: "x", min: 1, max: 7,
    tip: "Dias seguidos enviando cobrança antes da pausa." },
  { key: "cooldownDays", label: "Pausa", icon: Pause, suffix: "d", min: 1, max: 15,
    tip: "Dias sem cobrança após cada ciclo." },
  { key: "maxCycles", label: "Ciclos máx.", icon: RotateCw, suffix: "x", min: 1, max: 10,
    tip: "Após esse número de ciclos, a cobrança para." },
  { key: "inactiveAfterDays", label: "Inativar", icon: UserX, suffix: "d", min: 7, max: 180,
    tip: "Dias vencidos para marcar como inativo." },
] as const;

export default function OverdueRulesSection({ companyId }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [values, setValues] = useState(DEFAULTS);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!companyId) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("api_settings" as any)
        .select("id, overdue_sends_per_cycle, overdue_cycle_cooldown_days, overdue_max_cycles, overdue_inactive_after_days")
        .eq("company_id", companyId)
        .maybeSingle();
      if (data) {
        const d = data as any;
        setExistingId(d.id);
        setValues({
          sendsPerCycle: Number(d.overdue_sends_per_cycle ?? DEFAULTS.sendsPerCycle),
          cooldownDays: Number(d.overdue_cycle_cooldown_days ?? DEFAULTS.cooldownDays),
          maxCycles: Number(d.overdue_max_cycles ?? DEFAULTS.maxCycles),
          inactiveAfterDays: Number(d.overdue_inactive_after_days ?? DEFAULTS.inactiveAfterDays),
        });
      }
      setLoading(false);
    })();
  }, [companyId]);

  const handleSave = async () => {
    if (!companyId) return;
    const result = rulesSchema.safeParse(values);
    if (!result.success) {
      const fe: Record<string, string> = {};
      result.error.issues.forEach((i) => { fe[String(i.path[0])] = i.message; });
      setErrors(fe);
      toast({ title: "Verifique os valores", description: "Existem campos fora dos limites permitidos.", variant: "destructive" });
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const payload = {
        overdue_sends_per_cycle: result.data.sendsPerCycle,
        overdue_cycle_cooldown_days: result.data.cooldownDays,
        overdue_max_cycles: result.data.maxCycles,
        overdue_inactive_after_days: result.data.inactiveAfterDays,
      };
      let error;
      if (existingId) {
        ({ error } = await supabase.from("api_settings" as any).update(payload).eq("id", existingId));
      } else {
        const { data, error: e } = await supabase
          .from("api_settings" as any)
          .insert({ company_id: companyId, ...payload })
          .select()
          .single();
        error = e;
        if (data) setExistingId((data as any).id);
      }
      if (error) throw error;
      toast({ title: "Régua atualizada!", description: "Os novos parâmetros já estão valendo." });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  const totalSends = values.sendsPerCycle * values.maxCycles;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="glass-card rounded-xl p-5 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <AlarmClockOff className="h-4.5 w-4.5 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-display font-semibold text-foreground leading-tight">
                Régua de Cobrança
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Ritmo anti-spam para clientes vencidos
              </p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} size="sm" className="shrink-0">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin sm:mr-1.5" /> : <Save className="h-3.5 w-3.5 sm:mr-1.5" />}
            <span className="hidden sm:inline">Salvar</span>
          </Button>
        </div>

        {/* Compact grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {FIELDS.map((f) => {
            const Icon = f.icon;
            const value = values[f.key];
            const err = errors[f.key];
            return (
              <div
                key={f.key}
                className={`group rounded-lg border bg-secondary/30 p-3 transition-colors ${
                  err ? "border-destructive/60" : "border-border/60 hover:border-primary/40"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                    <Label className="text-xs font-medium text-foreground truncate">{f.label}</Label>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground/60 cursor-help shrink-0" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[200px] text-xs">{f.tip}</TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex items-baseline gap-1">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={f.min}
                    max={f.max}
                    value={Number.isFinite(value) ? value : ""}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      setValues({ ...values, [f.key]: Number.isFinite(n) ? n : 0 });
                    }}
                    className="h-9 px-2 bg-background/50 border-border/60 text-base font-semibold tabular-nums focus-visible:ring-1"
                  />
                  <span className="text-xs text-muted-foreground font-medium">{f.suffix}</span>
                </div>
                <p className="text-[10px] text-muted-foreground/70 mt-1">
                  {err || `${f.min}–${f.max}`}
                </p>
              </div>
            );
          })}
        </div>

        {/* Compact summary */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs">
          <span className="text-muted-foreground">Fluxo:</span>
          <Pill>{values.sendsPerCycle} envios</Pill>
          <Arrow />
          <Pill>{values.cooldownDays}d pausa</Pill>
          <Arrow />
          <Pill>×{values.maxCycles} ciclos</Pill>
          <span className="text-muted-foreground">=</span>
          <Pill highlight>{totalSends} envios totais</Pill>
          <span className="text-muted-foreground hidden sm:inline">•</span>
          <span className="text-muted-foreground">
            inativo após <strong className="text-foreground">{values.inactiveAfterDays}d</strong>
          </span>
        </div>
      </div>
    </TooltipProvider>
  );
}

function Pill({ children, highlight }: { children: React.ReactNode; highlight?: boolean }) {
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded font-semibold tabular-nums ${
        highlight ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
      }`}
    >
      {children}
    </span>
  );
}

function Arrow() {
  return <span className="text-muted-foreground/60">→</span>;
}
