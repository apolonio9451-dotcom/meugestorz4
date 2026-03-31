import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, ChevronDown, ChevronUp, AlertCircle, Phone, RefreshCw } from "lucide-react";
import { getCategoryLabel } from "./types";

interface PendingClient {
  id: string;
  name: string;
  whatsapp: string;
  category: string;
  endDate: string;
  diffDays: number;
  skipReason?: string;
}

interface Props {
  companyId: string | null;
}

function getCategory(diffDays: number): string | null {
  if (diffDays === 0) return "vence_hoje";
  if (diffDays === 1) return "vence_amanha";
  if (diffDays === 3) return "a_vencer";
  if (diffDays < 0) return "vencidos";
  return null;
}

const categoryColors: Record<string, string> = {
  vence_hoje: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  vence_amanha: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  a_vencer: "bg-yellow-600/20 text-yellow-500 border-yellow-600/30",
  vencidos: "bg-destructive/20 text-destructive border-destructive/30",
};

export default function PendingSendsPreview({ companyId }: Props) {
  const [pendingClients, setPendingClients] = useState<PendingClient[]>([]);
  const [skippedClients, setSkippedClients] = useState<PendingClient[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [showSkipped, setShowSkipped] = useState(false);
  const [categorySettings, setCategorySettings] = useState<Record<string, boolean>>({});
  const [overdueSettings, setOverdueSettings] = useState({ enabled: true, days: 10 });

  const fetchPendingQueue = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);

    try {
      const today = new Date().toISOString().split("T")[0];

      const [clientsRes, catRes, apiRes] = await Promise.all([
        supabase
          .from("clients")
          .select(`
            id, name, whatsapp, phone, status, ultimo_envio_auto, charge_pause_until, charge_pause_note,
            client_subscriptions (
              end_date, amount, custom_price,
              subscription_plans ( name )
            )
          `)
          .eq("company_id", companyId)
          .eq("status", "active")
          .limit(5000),
        supabase
          .from("auto_send_category_settings")
          .select("category, is_active")
          .eq("company_id", companyId),
        supabase
          .from("api_settings")
          .select("overdue_charge_pause_enabled, overdue_charge_pause_days")
          .eq("company_id", companyId)
          .maybeSingle(),
      ]);

      const cats: Record<string, boolean> = {};
      (catRes.data || []).forEach((c: any) => { cats[c.category] = c.is_active; });
      setCategorySettings(cats);

      const odEnabled = Boolean((apiRes.data as any)?.overdue_charge_pause_enabled ?? true);
      const odDays = Math.max(1, Number((apiRes.data as any)?.overdue_charge_pause_days ?? 10));
      setOverdueSettings({ enabled: odEnabled, days: odDays });

      const todayDate = new Date(today + "T00:00:00");
      const eligible: PendingClient[] = [];
      const skipped: PendingClient[] = [];

      for (const client of (clientsRes.data || [])) {
        const phone = client.whatsapp || client.phone || "";
        const phoneDigits = phone.replace(/\D/g, "");

        const subs = (client as any).client_subscriptions;
        if (!subs || subs.length === 0) continue;
        // Use latest subscription by end_date (same logic as edge function)
        const sub = [...subs].sort((a: any, b: any) => {
          const aTime = new Date(`${a.end_date}T00:00:00`).getTime();
          const bTime = new Date(`${b.end_date}T00:00:00`).getTime();
          return bTime - aTime;
        })[0];
        const endDate = new Date(sub.end_date + "T00:00:00");
        const diffDays = Math.round((endDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

        const category = getCategory(diffDays);
        if (!category) continue;

        const base: PendingClient = {
          id: client.id,
          name: client.name,
          whatsapp: phone,
          category,
          endDate: sub.end_date,
          diffDays,
        };

        // Check skip reasons
        if (phoneDigits.length < 8) {
          skipped.push({ ...base, skipReason: "Sem WhatsApp válido" });
          continue;
        }

        if (client.ultimo_envio_auto === today) {
          skipped.push({ ...base, skipReason: "Já enviado hoje" });
          continue;
        }

        if (cats[category] === false) {
          skipped.push({ ...base, skipReason: `Categoria "${getCategoryLabel(category)}" desativada` });
          continue;
        }

        const pauseUntil = (client as any).charge_pause_until as string | null;
        if (pauseUntil) {
          const pauseDate = new Date(pauseUntil + "T00:00:00");
          const remaining = Math.round((pauseDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
          if (remaining >= 0) {
            skipped.push({ ...base, skipReason: `Cobrança pausada até ${new Date(pauseUntil).toLocaleDateString("pt-BR")}` });
            continue;
          }
        }

        const chargePauseNote = String((client as any).charge_pause_note || "").trim();
        const hasResumeOverride = chargePauseNote.startsWith("resumed");
        if (category === "vencidos" && odEnabled && Math.abs(diffDays) > odDays && !hasResumeOverride) {
          skipped.push({ ...base, skipReason: `Vencido há ${Math.abs(diffDays)} dias (limite: ${odDays}d)` });
          continue;
        }

        eligible.push(base);
      }

      eligible.sort((a, b) => a.diffDays - b.diffDays);
      setPendingClients(eligible);
      setSkippedClients(skipped);
    } catch (err) {
      console.warn("[PendingSendsPreview] Erro ao calcular fila:", err);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchPendingQueue();
    const interval = setInterval(fetchPendingQueue, 60000);
    return () => clearInterval(interval);
  }, [fetchPendingQueue]);

  if (!companyId) return null;

  const grouped = pendingClients.reduce<Record<string, PendingClient[]>>((acc, c) => {
    if (!acc[c.category]) acc[c.category] = [];
    acc[c.category].push(c);
    return acc;
  }, {});

  const categoryOrder = ["vence_hoje", "vence_amanha", "a_vencer", "vencidos"];

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="w-4 h-4 text-primary" />
            Envios a Realizar
            <Badge variant="outline" className="text-xs font-bold">
              {loading ? "…" : pendingClients.length}
            </Badge>
          </CardTitle>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchPendingQueue} disabled={loading}>
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
        </div>
        {!expanded && (
          <div className="flex flex-wrap gap-2 mt-1">
            {categoryOrder.map((cat) => {
              const count = grouped[cat]?.length || 0;
              if (count === 0) return null;
              return (
                <Badge key={cat} variant="outline" className={`${categoryColors[cat] || ""} text-xs`}>
                  {getCategoryLabel(cat)}: {count}
                </Badge>
              );
            })}
            {skippedClients.length > 0 && (
              <Badge variant="outline" className="text-xs bg-muted/50 text-muted-foreground">
                Pulados: {skippedClients.length}
              </Badge>
            )}
            {pendingClients.length === 0 && !loading && (
              <span className="text-xs text-muted-foreground">Nenhum envio pendente para hoje</span>
            )}
          </div>
        )}
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0 space-y-3">
          {pendingClients.length === 0 && !loading ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>Nenhum cliente elegível para envio automático hoje.</p>
              <p className="text-xs mt-1">
                {skippedClients.length > 0
                  ? `${skippedClients.length} cliente(s) foram pulados — veja abaixo.`
                  : "Verifique se há clientes ativos com planos a vencer."}
              </p>
            </div>
          ) : (
            categoryOrder.map((cat) => {
              const clients = grouped[cat];
              if (!clients || clients.length === 0) return null;
              return (
                <div key={cat}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Badge variant="outline" className={`${categoryColors[cat] || ""} text-xs`}>
                      {getCategoryLabel(cat)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{clients.length} cliente(s)</span>
                  </div>
                  <div className="space-y-1 ml-1">
                    {clients.slice(0, 20).map((c) => (
                      <div key={c.id} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-muted/20">
                        <span className="font-medium truncate max-w-[180px]">{c.name}</span>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          {c.whatsapp && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {c.whatsapp.replace(/\D/g, "").slice(-4)}
                            </span>
                          )}
                          <span>
                            {c.diffDays === 0 ? "Hoje" : c.diffDays === 1 ? "Amanhã" : c.diffDays > 0 ? `${c.diffDays}d` : `${Math.abs(c.diffDays)}d vencido`}
                          </span>
                        </div>
                      </div>
                    ))}
                    {clients.length > 20 && (
                      <p className="text-xs text-muted-foreground ml-2">+ {clients.length - 20} mais...</p>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {skippedClients.length > 0 && (
            <div className="border-t border-border/50 pt-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 text-muted-foreground gap-1"
                onClick={() => setShowSkipped(!showSkipped)}
              >
                {showSkipped ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {skippedClients.length} cliente(s) pulados
              </Button>
              {showSkipped && (
                <div className="space-y-1 mt-1.5 ml-1">
                  {skippedClients.slice(0, 30).map((c) => (
                    <div key={c.id + c.category} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-muted/10">
                      <span className="truncate max-w-[140px] text-muted-foreground">{c.name}</span>
                      <Badge variant="outline" className="text-[10px] bg-muted/30 text-muted-foreground border-border/40">
                        {c.skipReason}
                      </Badge>
                    </div>
                  ))}
                  {skippedClients.length > 30 && (
                    <p className="text-xs text-muted-foreground ml-2">+ {skippedClients.length - 30} mais...</p>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}