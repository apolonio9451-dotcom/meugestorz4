import { useState, useEffect } from "react";
import { useReseller } from "@/hooks/useReseller";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Palette, Save } from "lucide-react";

export default function ResellerSettings() {
  const { reseller } = useReseller();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    service_name: "",
    logo_url: "",
    primary_color: "#3b82f6",
    billing_message: "",
  });

  useEffect(() => {
    if (!reseller) return;
    supabase
      .from("reseller_settings")
      .select("*")
      .eq("reseller_id", reseller.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setForm({
            service_name: data.service_name || "",
            logo_url: data.logo_url || "",
            primary_color: data.primary_color || "#3b82f6",
            billing_message: data.billing_message || "",
          });
        }
      });
  }, [reseller]);

  const handleSave = async () => {
    if (!reseller) return;
    setLoading(true);

    const { data: existing } = await supabase
      .from("reseller_settings")
      .select("id")
      .eq("reseller_id", reseller.id)
      .maybeSingle();

    if (existing) {
      await supabase.from("reseller_settings").update(form).eq("id", existing.id);
    } else {
      await supabase.from("reseller_settings").insert({ ...form, reseller_id: reseller.id });
    }

    toast({ title: "Configurações salvas!" });
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Personalização</h1>
        <p className="text-muted-foreground text-sm mt-1">Configure a identidade visual do seu painel</p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-5">
          <div>
            <Label>Nome do Serviço</Label>
            <Input value={form.service_name} onChange={(e) => setForm({ ...form, service_name: e.target.value })} placeholder="Ex: MinhaTV Pro" />
            <p className="text-xs text-muted-foreground mt-1">Exibido no cabeçalho do painel dos seus clientes</p>
          </div>

          <div>
            <Label>URL do Logo</Label>
            <Input value={form.logo_url} onChange={(e) => setForm({ ...form, logo_url: e.target.value })} placeholder="https://..." />
            {form.logo_url && (
              <div className="mt-2 p-3 bg-muted rounded-lg inline-block">
                <img src={form.logo_url} alt="Logo preview" className="max-h-12 object-contain" />
              </div>
            )}
          </div>

          <div>
            <Label className="flex items-center gap-2"><Palette className="w-4 h-4" /> Cor Primária</Label>
            <div className="flex items-center gap-3 mt-1">
              <input
                type="color"
                value={form.primary_color}
                onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                className="w-10 h-10 rounded-lg border border-border cursor-pointer"
              />
              <Input value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })} className="max-w-[140px] font-mono" />
            </div>
          </div>

          <div>
            <Label>Mensagem de Cobrança Automática</Label>
            <Textarea
              value={form.billing_message}
              onChange={(e) => setForm({ ...form, billing_message: e.target.value })}
              rows={4}
              placeholder="Olá {nome}, sua assinatura vence em {data}. Para renovar, entre em contato."
            />
            <p className="text-xs text-muted-foreground mt-1">Variáveis: {"{nome}"}, {"{data}"}, {"{plano}"}, {"{valor}"}</p>
          </div>

          <Button onClick={handleSave} disabled={loading} className="gap-2">
            <Save className="w-4 h-4" /> Salvar Configurações
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
