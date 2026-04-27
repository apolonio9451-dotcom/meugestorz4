import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Database, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const TABLES_TO_BACKUP = [
  "clients",
  "servers",
  "saas_plans",
  "saas_subscriptions",
  "companies",
  "profiles",
  "resellers",
  "whatsapp_instances",
  "chatbot_settings",
  "message_templates"
];

const BackupPage = () => {
  const [downloading, setDownloading] = useState<string | null>(null);

  const downloadAsCSV = async (tableName: string) => {
    setDownloading(tableName);
    try {
      const { data, error } = await supabase
        .from(tableName as any)
        .select("*");

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.info(`A tabela ${tableName} está vazia.`);
        return;
      }

      // Convert to CSV
      const headers = Object.keys(data[0]);
      const csvRows = [
        headers.join(","), // header row
        ...data.map(row => 
          headers.map(fieldName => {
            const value = row[fieldName];
            const escaped = ('' + (value === null ? "" : value)).replace(/"/g, '""');
            return `"${escaped}"`;
          }).join(",")
        )
      ];
      
      const csvString = csvRows.join("\n");
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `backup_${tableName}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success(`Backup da tabela ${tableName} concluído!`);
    } catch (error: any) {
      console.error(`Erro ao exportar ${tableName}:`, error);
      toast.error(`Erro ao exportar ${tableName}: ${error.message}`);
    } finally {
      setDownloading(null);
    }
  };

  const downloadAll = async () => {
    toast.info("Iniciando backup de todas as tabelas...");
    for (const table of TABLES_TO_BACKUP) {
      await downloadAsCSV(table);
      // Small delay between downloads to prevent browser blocking
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Database className="h-8 w-8 text-primary" />
          Backup do Sistema
        </h1>
        <p className="text-muted-foreground">
          Exporte os dados das suas tabelas em formato CSV para segurança e conferência.
        </p>
      </div>

      <Alert variant="default" className="bg-primary/5 border-primary/20">
        <AlertCircle className="h-4 w-4 text-primary" />
        <AlertTitle className="text-primary font-semibold">Informação de Segurança</AlertTitle>
        <AlertDescription className="text-muted-foreground">
          Os arquivos CSV contêm dados brutos do seu banco de dados. Mantenha esses arquivos em local seguro e não os compartilhe com pessoas não autorizadas.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="glass-card col-span-full">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Exportação Completa</CardTitle>
              <CardDescription>Baixe todos os dados disponíveis de uma vez.</CardDescription>
            </div>
            <Button 
              onClick={downloadAll} 
              disabled={!!downloading}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {downloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Baixar Tudo
            </Button>
          </CardHeader>
        </Card>

        {TABLES_TO_BACKUP.map((table) => (
          <Card key={table} className="glass-card hover:border-primary/50 transition-colors">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center justify-between">
                <span className="capitalize">{table.replace(/_/g, " ")}</span>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardTitle>
              <CardDescription>Tabela: {table}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => downloadAsCSV(table)}
                disabled={!!downloading}
              >
                {downloading === table ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Exportar CSV
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default BackupPage;
