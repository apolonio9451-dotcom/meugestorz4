import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Package } from "lucide-react";
import MasterStats from "@/components/master/MasterStats";
import MasterResellers from "@/components/master/MasterResellers";
import MasterSaasPlans from "@/components/master/MasterSaasPlans";

export default function MasterPanel() {
  const { companyId } = useAuth();
  const [stats, setStats] = useState({ totalResellers: 0, activeResellers: 0, totalCredits: 0, totalClients: 0 });

  const fetchStats = async () => {
    if (!companyId) return;
    const { data: resellers } = await supabase.from("resellers").select("credit_balance, status").eq("company_id", companyId);
    const { count } = await supabase.from("clients").select("*", { count: "exact", head: true }).eq("company_id", companyId).not("reseller_id", "is", null);
    if (resellers) {
      setStats({
        totalResellers: resellers.length,
        activeResellers: resellers.filter(r => r.status === "active").length,
        totalCredits: resellers.reduce((s, r) => s + r.credit_balance, 0),
        totalClients: count || 0,
      });
    }
  };

  useEffect(() => { fetchStats(); }, [companyId]);

  return (
    <div className="space-y-6">
      <MasterStats {...stats} />

      <Tabs defaultValue="resellers" className="space-y-4">
        <TabsList>
          <TabsTrigger value="resellers" className="gap-2"><Users className="w-4 h-4" /> Revendedores</TabsTrigger>
          <TabsTrigger value="plans" className="gap-2"><Package className="w-4 h-4" /> Planos SaaS</TabsTrigger>
        </TabsList>
        <TabsContent value="resellers">
          <MasterResellers onDataChange={fetchStats} />
        </TabsContent>
        <TabsContent value="plans">
          <MasterSaasPlans />
        </TabsContent>
      </Tabs>
    </div>
  );
}
