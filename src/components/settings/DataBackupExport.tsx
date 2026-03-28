import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Download, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export default function DataBackupExport() {
  const { effectiveCompanyId: companyId, userRole } = useAuth();
  const [loading, setLoading] = useState(false);

  const isOwner = userRole === "Proprietário";
  if (!isOwner) return null;

  const handleExport = async () => {
    if (!companyId) {
      toast.error("Empresa não identificada.");
      return;
    }

    setLoading(true);
    try {
      // Fetch clients
      const { data: clients, error: clientsErr } = await supabase
        .from("clients")
        .select("name, whatsapp, email, server, status, created_at, phone, cpf, reseller_id")
        .eq("company_id", companyId);
      if (clientsErr) throw clientsErr;

      // Fetch resellers
      const { data: resellers, error: resellersErr } = await supabase
        .from("resellers")
        .select("name, whatsapp, email, status, credit_balance, subscription_expires_at, created_at")
        .eq("company_id", companyId);
      if (resellersErr) throw resellersErr;

      // Fetch subscriptions with client name and plan name
      const { data: subscriptions, error: subsErr } = await supabase
        .from("client_subscriptions")
        .select("start_date, end_date, amount, payment_status, client_id, plan_id")
        .eq("company_id", companyId);
      if (subsErr) throw subsErr;

      // Fetch plan names for mapping
      const { data: plans } = await supabase
        .from("subscription_plans")
        .select("id, name")
        .eq("company_id", companyId);
      const planMap = new Map((plans || []).map((p) => [p.id, p.name]));

      // Fetch client names for subscription mapping
      const clientMap = new Map((clients || []).map((c) => [undefined, c.name]));
      // Build a proper map from client_id -> name
      const { data: allClients } = await supabase
        .from("clients")
        .select("id, name")
        .eq("company_id", companyId);
      const clientIdMap = new Map((allClients || []).map((c) => [c.id, c.name]));

      // Build CSV
      const lines: string[] = [];

      // --- Clients section ---
      lines.push("=== CLIENTES ===");
      lines.push("Nome,WhatsApp,Email,Servidor,Status,Telefone,CPF,Criado Em");
      (clients || []).forEach((c) => {
        lines.push(
          [
            esc(c.name),
            esc(c.whatsapp),
            esc(c.email),
            esc(c.server),
            esc(c.status),
            esc(c.phone),
            esc(c.cpf),
            esc(c.created_at),
          ].join(",")
        );
      });

      lines.push("");

      // --- Resellers section ---
      lines.push("=== REVENDEDORES ===");
      lines.push("Nome,WhatsApp,Email,Status,Créditos,Vencimento Assinatura,Criado Em");
      (resellers || []).forEach((r) => {
        lines.push(
          [
            esc(r.name),
            esc(r.whatsapp),
            esc(r.email),
            esc(r.status),
            String(r.credit_balance),
            esc(r.subscription_expires_at),
            esc(r.created_at),
          ].join(",")
        );
      });

      lines.push("");

      // --- Subscriptions section ---
      lines.push("=== ASSINATURAS ===");
      lines.push("Cliente,Plano,Início,Vencimento,Valor,Status Pagamento");
      (subscriptions || []).forEach((s) => {
        lines.push(
          [
            esc(clientIdMap.get(s.client_id) || s.client_id),
            esc(planMap.get(s.plan_id) || s.plan_id),
            esc(s.start_date),
            esc(s.end_date),
            String(s.amount),
            esc(s.payment_status),
          ].join(",")
        );
      });

      const csvContent = "\uFEFF" + lines.join("\n"); // BOM for Excel UTF-8
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);

      const now = new Date().toISOString().slice(0, 10);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup_dados_${now}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Backup exportado com sucesso! ${(clients || []).length} clientes, ${(resellers || []).length} revendedores, ${(subscriptions || []).length} assinaturas.`);
    } catch (err: any) {
      console.error("Backup export error:", err);
      toast.error("Erro ao gerar backup: " + (err.message || "erro desconhecido"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card rounded-xl p-6 border border-border/60 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-display font-semibold text-foreground">
          Backup de Dados
        </h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Exporte todos os seus clientes, revendedores e assinaturas em um arquivo CSV seguro.
        Apenas o Proprietário pode executar esta ação.
      </p>
      <Button onClick={handleExport} disabled={loading} className="gap-2">
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Processando...
          </>
        ) : (
          <>
            <Download className="h-4 w-4" />
            Gerar Backup de Clientes
          </>
        )}
      </Button>
    </div>
  );
}

function esc(val: string | null | undefined): string {
  if (val == null) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}
