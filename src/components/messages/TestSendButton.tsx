import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Send, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const categoryOptions = [
  { key: "vence_hoje", label: "Vence Hoje", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  { key: "vence_amanha", label: "Vence Amanhã", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  { key: "a_vencer", label: "A Vencer", color: "bg-yellow-600/20 text-yellow-500 border-yellow-600/30" },
  { key: "vencidos", label: "Vencidos", color: "bg-destructive/20 text-destructive border-destructive/30" },
  { key: "followup", label: "Follow-up", color: "bg-cyan-400/20 text-cyan-400 border-cyan-400/50" },
];

interface Props {
  companyId: string | null;
}

export default function TestSendButton({ companyId }: Props) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [category, setCategory] = useState("vence_hoje");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!phone.trim() || !companyId) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("test-send-message", {
        body: { phone: phone.trim(), category, company_id: companyId },
      });

      // Extract detailed error from edge function response
      if (error) {
        let detailedMessage = error.message || "Erro desconhecido";
        try {
          // FunctionsHttpError contains the response context
          if (error.context && typeof error.context.json === "function") {
            const errorBody = await error.context.json();
            detailedMessage = errorBody?.error || detailedMessage;
          }
        } catch {
          // fallback to generic message
        }
        throw new Error(detailedMessage);
      }
      if (data?.error) throw new Error(data.error);

      toast({
        title: "✅ Mensagem de teste enviada!",
        description: `Enviada para ${data?.phone || phone}`,
      });
      setOpen(false);
      setPhone("");
    } catch (err: any) {
      console.error("[TestSend] Erro detalhado:", err);
      toast({
        title: "Erro no envio",
        description: err?.message || "Não foi possível enviar a mensagem de teste.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Send className="w-4 h-4" />
          Enviar Teste
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Enviar Mensagem de Teste</DialogTitle>
          <DialogDescription>
            Envie uma mensagem de teste para verificar se a integração com a API está funcionando.
            Um cliente de exemplo será usado para preencher as variáveis.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="test-phone">Número de Telefone</Label>
            <Input
              id="test-phone"
              placeholder="81999998888"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Digite o número completo com código do país (ex: 5511999999999).
            </p>
          </div>
          <div className="space-y-2">
            <Label>Template</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((cat) => (
                  <SelectItem key={cat.key} value={cat.key}>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`${cat.color} border text-[10px] px-1.5 py-0`}>
                        {cat.label}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleSend}
            disabled={sending || !phone.trim()}
            className="w-full"
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Enviar Mensagem de Teste
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
