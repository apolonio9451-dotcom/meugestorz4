import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Search, MessageCircle, UserX, Clock, RefreshCw, Users, Megaphone, List } from "lucide-react";
import { differenceInCalendarDays } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CampaignTemplates from "@/components/winback/CampaignTemplates";

interface WinBackClient {
  id: string;
  name: string;
  whatsapp: string;
  server: string;
  status: string;
  last_end_date: string;
  days_expired: number;
  last_plan: string;
  last_amount: number;
}

export default function WinBack() {
  const { companyId } = useAuth();
  const [clients, setClients] = useState<WinBackClient[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "45" | "60" | "90">("all");
  const [templates, setTemplates] = useState<{ category: string; message: string }[]>([]);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);

    Promise.all([
      supabase
        .from("clients")
        .select("id, name, whatsapp, server, status")
        .eq("company_id", companyId),
      supabase
        .from("client_subscriptions")
        .select("client_id, end_date, amount, subscription_plans(name)")
        .eq("company_id", companyId)
        .order("end_date", { ascending: false }),
      supabase
        .from("message_templates")
        .select("category, message")
        .eq("company_id", companyId)
        .eq("category", "winback"),
    ]).then(([clientsRes, subsRes, templatesRes]) => {
      const allClients = clientsRes.data || [];
      const allSubs = subsRes.data || [];
      const today = new Date();

      const winbackList: WinBackClient[] = [];

      for (const client of allClients) {
        // Pega a assinatura mais recente do cliente
        const clientSubs = allSubs.filter((s: any) => s.client_id === client.id);
        if (clientSubs.length === 0 && client.status === "inactive") {
          // Cliente inativo sem assinatura
          winbackList.push({
            ...client,
            last_end_date: "",
            days_expired: 999,
            last_plan: "—",
            last_amount: 0,
          });
          continue;
        }

        const latestSub = clientSubs[0] as any;
        if (!latestSub) continue;

        const endDate = new Date(latestSub.end_date);
        const daysExpired = differenceInCalendarDays(today, endDate);

        // Apenas clientes vencidos há mais de 45 dias OU inativos
        if (daysExpired >= 45 || client.status === "inactive") {
          winbackList.push({
            id: client.id,
            name: client.name,
            whatsapp: client.whatsapp || "",
            server: client.server || "",
            status: client.status,
            last_end_date: latestSub.end_date,
            days_expired: daysExpired > 0 ? daysExpired : 0,
            last_plan: latestSub.subscription_plans?.name || "—",
            last_amount: Number(latestSub.amount),
          });
        }
      }

      // Ordena por dias vencidos (mais antigo primeiro)
      winbackList.sort((a, b) => b.days_expired - a.days_expired);

      setClients(winbackList);
      setTemplates(templatesRes.data || []);
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

  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const handleWhatsApp = (client: WinBackClient) => {
    if (!client.whatsapp) {
      toast.error("Cliente sem WhatsApp cadastrado");
      return;
    }
    const phone = client.whatsapp.replace(/\D/g, "");
    const template = templates[0]?.message || `Olá ${client.name}! Sentimos sua falta. Que tal voltar a aproveitar nossos serviços? Temos condições especiais para você!`;
    const msg = template.replace("{nome}", client.name).replace("{plano}", client.last_plan);
    window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const handleReactivate = async (client: WinBackClient) => {
    if (!companyId) return;
    const { error } = await supabase
      .from("clients")
      .update({ status: "active" })
      .eq("id", client.id);
    if (error) {
      toast.error("Erro ao reativar cliente");
    } else {
      toast.success(`${client.name} reativado com sucesso!`);
      setClients((prev) => prev.filter((c) => c.id !== client.id));
    }
  };

  const daysBadge = (days: number) => {
    if (days >= 90) return <Badge variant="outline" className="bg-destructive/10 text-destructive">{days}d</Badge>;
    if (days >= 60) return <Badge variant="outline" className="bg-warning/10 text-warning">{days}d</Badge>;
    return <Badge variant="outline" className="bg-muted text-muted-foreground">{days}d</Badge>;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Repescagem</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Clientes vencidos há mais de 45 dias — campanhas de recuperação
        </p>
      </div>

      <Tabs defaultValue="clients" className="w-full">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="clients" className="gap-2">
            <List className="w-4 h-4" />
            Clientes
          </TabsTrigger>
          <TabsTrigger value="campaign" className="gap-2">
            <Megaphone className="w-4 h-4" />
            Campanha Guiada
          </TabsTrigger>
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
            <Input
              placeholder="Buscar por nome ou WhatsApp..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
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
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">Carregando...</TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum cliente para repescagem</TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell className="font-medium">{client.name}</TableCell>
                        <TableCell>{client.server || "—"}</TableCell>
                        <TableCell>{client.last_plan}</TableCell>
                        <TableCell className="text-right">{client.last_amount > 0 ? fmt(client.last_amount) : "—"}</TableCell>
                        <TableCell className="text-center">{daysBadge(client.days_expired)}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={client.status === "inactive" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"}>
                            {client.status === "inactive" ? "Inativo" : "Vencido"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Enviar WhatsApp" onClick={() => handleWhatsApp(client)}>
                              <MessageCircle className="w-4 h-4 text-success" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" title="Reativar cliente" onClick={() => handleReactivate(client)}>
                              <RefreshCw className="w-4 h-4 text-primary" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
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
