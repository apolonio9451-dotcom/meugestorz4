import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Clock, UserX, Users, Megaphone, List, Pause, Play } from "lucide-react";
import { differenceInCalendarDays } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import CampaignTemplates from "@/components/winback/CampaignTemplates";
import WinBackClientRow, { type WinBackClient } from "@/components/winback/WinBackClientRow";

export default function WinBack() {
  const { companyId } = useAuth();
  const [clients, setClients] = useState<WinBackClient[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "45" | "60" | "90">("all");
  const [progress, setProgress] = useState<Record<string, { step: number; lastSentAt: string | null }>>({});
  const [templates, setTemplates] = useState<Record<string, string>>({});
  const [winbackPaused, setWinbackPaused] = useState(false);
  const [togglingPause, setTogglingPause] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);

    Promise.all([
      supabase.from("clients").select("id, name, whatsapp, server, status").eq("company_id", companyId),
      supabase.from("client_subscriptions").select("client_id, end_date, amount, subscription_plans(name)").eq("company_id", companyId).order("end_date", { ascending: false }),
      supabase.from("winback_campaign_progress").select("client_id, current_step, last_sent_at").eq("company_id", companyId),
      supabase.from("message_templates").select("category, message").eq("company_id", companyId).like("category", "winback_%"),
      supabase.from("api_settings" as any).select("winback_paused").eq("company_id", companyId).maybeSingle(),
    ]).then(([clientsRes, subsRes, progressRes, templatesRes, apiRes]) => {
      const allClients = clientsRes.data || [];
      const allSubs = subsRes.data || [];
      const today = new Date();

      // Build progress map
      const pMap: Record<string, { step: number; lastSentAt: string | null }> = {};
      (progressRes.data || []).forEach((p: any) => { pMap[p.client_id] = { step: p.current_step, lastSentAt: p.last_sent_at }; });
      setProgress(pMap);

      // Build templates map
      const tMap: Record<string, string> = {};
      (templatesRes.data || []).forEach((t: any) => { tMap[t.category] = t.message; });
      setTemplates(tMap);

      const winbackList: WinBackClient[] = [];

      for (const client of allClients) {
        const clientSubs = allSubs.filter((s: any) => s.client_id === client.id);
        if (clientSubs.length === 0 && client.status === "inactive") {
          winbackList.push({ ...client, last_end_date: "", days_expired: 999, last_plan: "—", last_amount: 0 });
          continue;
        }
        const latestSub = clientSubs[0] as any;
        if (!latestSub) continue;
        const endDate = new Date(latestSub.end_date);
        const daysExpired = differenceInCalendarDays(today, endDate);
        if (daysExpired >= 45 || client.status === "inactive") {
          winbackList.push({
            id: client.id, name: client.name, whatsapp: client.whatsapp || "", server: client.server || "",
            status: client.status, last_end_date: latestSub.end_date, days_expired: daysExpired > 0 ? daysExpired : 0,
            last_plan: latestSub.subscription_plans?.name || "—", last_amount: Number(latestSub.amount),
          });
        }
      }

      winbackList.sort((a, b) => b.days_expired - a.days_expired);
      setClients(winbackList);
      setLoading(false);
    });
  }, [companyId]);

  const filtered = useMemo(() => {
    let list = clients;
    if (filter === "45") list = list.filter((c) => c.days_expired >= 45 && c.days_expired < 60);
    else if (filter === "60") list = list.filter((c) => c.days_expired >= 60 && c.days_expired < 90);
    else if (filter === "90") list = list.filter((c) => c.days_expired >= 90);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.whatsapp.includes(q));
    }
    return list;
  }, [clients, filter, search]);

  const stats = useMemo(() => ({
    total: clients.length,
    d45: clients.filter((c) => c.days_expired >= 45 && c.days_expired < 60).length,
    d60: clients.filter((c) => c.days_expired >= 60 && c.days_expired < 90).length,
    d90: clients.filter((c) => c.days_expired >= 90).length,
  }), [clients]);

  const handleStepAdvanced = (clientId: string, newStep: number, sentAt: string) => {
    setProgress((prev) => ({ ...prev, [clientId]: { step: newStep, lastSentAt: sentAt } }));
  };

  const handleReactivated = (clientId: string) => {
    setClients((prev) => prev.filter((c) => c.id !== clientId));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Repescagem</h1>
        <p className="text-muted-foreground text-sm mt-1">Clientes vencidos há mais de 45 dias — campanhas de recuperação</p>
      </div>

      <Tabs defaultValue="clients" className="w-full">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="clients" className="gap-2"><List className="w-4 h-4" />Clientes</TabsTrigger>
          <TabsTrigger value="campaign" className="gap-2"><Megaphone className="w-4 h-4" />Campanha Guiada</TabsTrigger>
        </TabsList>

        <TabsContent value="clients" className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="glass-card border-border/30 cursor-pointer" onClick={() => setFilter("all")}>
              <CardContent className="p-4">
                <Users className="w-4 h-4 text-muted-foreground mb-1" />
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-lg font-display font-bold text-foreground">{stats.total}</p>
              </CardContent>
            </Card>
            <Card className={`glass-card border-border/30 cursor-pointer ${filter === "45" ? "ring-1 ring-primary" : ""}`} onClick={() => setFilter(filter === "45" ? "all" : "45")}>
              <CardContent className="p-4">
                <Clock className="w-4 h-4 text-muted-foreground mb-1" />
                <p className="text-xs text-muted-foreground">45-59 dias</p>
                <p className="text-lg font-display font-bold text-foreground">{stats.d45}</p>
              </CardContent>
            </Card>
            <Card className={`glass-card border-border/30 cursor-pointer ${filter === "60" ? "ring-1 ring-warning" : ""}`} onClick={() => setFilter(filter === "60" ? "all" : "60")}>
              <CardContent className="p-4">
                <Clock className="w-4 h-4 text-warning mb-1" />
                <p className="text-xs text-muted-foreground">60-89 dias</p>
                <p className="text-lg font-display font-bold text-warning">{stats.d60}</p>
              </CardContent>
            </Card>
            <Card className={`glass-card border-border/30 cursor-pointer ${filter === "90" ? "ring-1 ring-destructive" : ""}`} onClick={() => setFilter(filter === "90" ? "all" : "90")}>
              <CardContent className="p-4">
                <UserX className="w-4 h-4 text-destructive mb-1" />
                <p className="text-xs text-muted-foreground">90+ dias</p>
                <p className="text-lg font-display font-bold text-destructive">{stats.d90}</p>
              </CardContent>
            </Card>
          </div>

          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome ou WhatsApp..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>

          {/* Table */}
          <Card className="glass-card border-border/30">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Servidor</TableHead>
                    <TableHead>Último Plano</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-center">Vencido há</TableHead>
                    <TableHead className="text-center">Campanha</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Carregando...</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum cliente para repescagem</TableCell></TableRow>
                  ) : (
                    filtered.map((client) => (
                      <WinBackClientRow
                        key={client.id}
                        client={client}
                        companyId={companyId!}
                        currentStep={progress[client.id]?.step || 0}
                        lastSentAt={progress[client.id]?.lastSentAt || null}
                        templates={templates}
                        onReactivated={handleReactivated}
                        onStepAdvanced={handleStepAdvanced}
                      />
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaign">
          <CampaignTemplates companyId={companyId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
