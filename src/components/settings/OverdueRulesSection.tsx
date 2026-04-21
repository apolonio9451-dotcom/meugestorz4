import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Save, Loader2, AlarmClockOff, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  companyId: string | null;
}

// Validação rigorosa server/client-side dos parâmetros
const rulesSchema = z.object({
  sendsPerCycle: z.coerce.number().int().min(1, "Mínimo 1").max(7, "Máximo 7"),
  cooldownDays: z.coerce.number().int().min(1, "Mínimo 1").max(15, "Máximo 15"),
  maxCycles: z.coerce.number().int().min(1, "Mínimo 1").max(10, "Máximo 10"),
  inactiveAfterDays: z.coerce.number().int().min(7, "Mínimo 7").max(180, "Máximo 180"),
});

const DEFAULTS = { sendsPerCycle: 2, cooldownDays: 3, maxCycles: 2, inactiveAfterDays: 30 };

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
      <div className="glass-card rounded-xl p-6 space-y-6">
        <div>
          <h2 className="text-lg font-display font-semibold text-foreground flex items-center gap-2">
            <AlarmClockOff className="h-5 w-5 text-primary" />
            Régua de Cobrança Anti-Spam
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Defina o ritmo de cobrança para clientes vencidos.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            label="Envios por ciclo"
            tooltip="Quantos dias seguidos a mensagem de cobrança será enviada antes de uma pausa."
            value={values.sendsPerCycle}
            onChange={(v) => setValues({ ...values, sendsPerCycle: v })}
            min={1} max={7} suffix="envios"
            error={errors.sendsPerCycle}
          />
          <Field
            label="Pausa entre ciclos"
            tooltip="Quantos dias o cliente fica sem receber cobrança após cada ciclo."
            value={values.cooldownDays}
            onChange={(v) => setValues({ ...values, cooldownDays: v })}
            min={1} max={15} suffix="dias"
            error={errors.cooldownDays}
          />
          <Field
            label="Máximo de ciclos"
            tooltip="Após esse número de ciclos completos, a cobrança automática para."
            value={values.maxCycles}
            onChange={(v) => setValues({ ...values, maxCycles: v })}
            min={1} max={10} suffix="ciclos"
            error={errors.maxCycles}
          />
          <Field
            label="Inativar após"
            tooltip="Dias vencidos para marcar o cliente como inativo automaticamente."
            value={values.inactiveAfterDays}
            onChange={(v) => setValues({ ...values, inactiveAfterDays: v })}
            min={7} max={180} suffix="dias"
            error={errors.inactiveAfterDays}
          />
        </div>

        <div className="rounded-lg border border-border/50 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          Resumo: <strong className="text-foreground">{values.sendsPerCycle}</strong> envios seguidos →
          pausa de <strong className="text-foreground">{values.cooldownDays}</strong> dias → repete por até{" "}
          <strong className="text-foreground">{values.maxCycles}</strong> ciclos
          (<strong className="text-foreground">{totalSends}</strong> envios no total).
          Após <strong className="text-foreground">{values.inactiveAfterDays}</strong> dias vencido, vira inativo.
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar régua
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}

function Field({
  label, tooltip, value, onChange, min, max, suffix, error,
}: {
  label: string; tooltip: string; value: number;
  onChange: (v: number) => void; min: number; max: number; suffix: string; error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-semibold text-foreground flex items-center gap-1.5">
        {label}
        <Tooltip>
          <TooltipTrigger asChild>
            <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">{tooltip}</TooltipContent>
        </Tooltip>
      </Label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            onChange(Number.isFinite(n) ? n : 0);
          }}
          className="bg-secondary/50 border-border max-w-[120px]"
        />
        <span className="text-xs text-muted-foreground">{suffix}</span>
      </div>
      <p className="text-xs text-muted-foreground">Permitido: {min}–{max}</p>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
