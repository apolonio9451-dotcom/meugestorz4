import { useState, useEffect } from "react";
import { useReseller } from "@/hooks/useReseller";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ScrollText } from "lucide-react";

const actionLabels: Record<string, string> = {
  create_client: "Criou cliente",
  update_client: "Editou cliente",
  delete_client: "Excluiu cliente",
  renew_client: "Renovou cliente",
};

export default function ResellerLogs() {
  const { reseller } = useReseller();
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    if (!reseller) return;
    supabase
      .from("reseller_activity_logs")
      .select("*")
      .eq("reseller_id", reseller.id)
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => { if (data) setLogs(data); });
  }, [reseller]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ScrollText className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Logs de Atividade</h1>
          <p className="text-muted-foreground text-sm mt-1">Histórico completo das suas ações</p>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Detalhes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum log registrado</TableCell></TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{actionLabels[log.action] || log.action}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{log.entity_type}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.details?.name || "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
