
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Plus, Save, Trash2, ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TemplateConfig } from "@/utils/bannerGenerator";

interface TemplateConfigPanelProps {
  companyId: string;
  onTemplateCreated: () => void;
  templates: any[];
}

export const TemplateConfigPanel = ({ companyId, onTemplateCreated, templates }: TemplateConfigPanelProps) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    background_url: "",
    config: {
      title: { x: 540, y: 280, fontSize: 140, color: "#FFFFFF", text: "JOGOS" },
      dayOfWeek: { x: 540, y: 350, fontSize: 50, color: "#3b82f6" },
      logo: { x: 840, y: 60, width: 180 },
      matches: {
        startY: 420,
        rowHeight: 180,
        shieldSize: 100,
        nameFontSize: 44,
        infoFontSize: 34,
        maxPerPage: 8
      },
      footer: { y: 1740, text: "ASSINE AGORA E ASSISTA EM 4K", bgColor: "#2563eb" }
    } as TemplateConfig
  });
  const [uploading, setUploading] = useState(false);

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !companyId) return;

    try {
      setUploading(true);
      const fileExt = file.name.split(".").pop();
      const filePath = `${companyId}/bg-template-${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("company-assets")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("company-assets")
        .getPublicUrl(filePath);

      setNewTemplate(prev => ({ ...prev, background_url: publicUrl }));
      toast.success("Fundo enviado com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao subir fundo: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!newTemplate.name || !newTemplate.background_url) {
      toast.error("Preencha o nome e envie uma imagem de fundo");
      return;
    }

    const { error } = await (supabase.from("banner_templates") as any).insert([{
      company_id: companyId,
      name: newTemplate.name,
      background_url: newTemplate.background_url,
      config: newTemplate.config
    }]);


    if (error) {
      toast.error("Erro ao salvar template: " + error.message);
    } else {
      toast.success("Template salvo com sucesso!");
      setIsCreating(false);
      onTemplateCreated();
    }
  };

  const deleteTemplate = async (id: string) => {
    const { error } = await supabase.from("banner_templates").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao deletar: " + error.message);
    } else {
      toast.success("Template removido");
      onTemplateCreated();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Templates de Banners</h2>
        <Button onClick={() => setIsCreating(!isCreating)} variant={isCreating ? "outline" : "default"}>
          {isCreating ? "Cancelar" : <><Plus className="w-4 h-4 mr-2" /> Novo Template</>}
        </Button>
      </div>

      {isCreating && (
        <Card className="glass-card border-primary/20">
          <CardHeader>
            <CardTitle>Configurar Novo Template</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome do Template</Label>
                <Input 
                  value={newTemplate.name} 
                  onChange={e => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Template TV MAX Vertical"
                />
              </div>
              <div className="space-y-2">
                <Label>Fundo (9:16)</Label>
                <div className="flex gap-2">
                  <Input 
                    type="file" 
                    onChange={handleBgUpload} 
                    className="hidden" 
                    id="bg-upload"
                  />
                  <Label 
                    htmlFor="bg-upload" 
                    className="flex-1 flex items-center justify-center border-2 border-dashed border-zinc-700 rounded-md cursor-pointer hover:border-primary/50"
                  >
                    {uploading ? "Enviando..." : newTemplate.background_url ? "Imagem Carregada" : "Selecionar PNG/JPG"}
                  </Label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Max Jogos p/ Página</Label>
                <Input 
                  type="number" 
                  value={newTemplate.config.matches.maxPerPage} 
                  onChange={e => setNewTemplate(prev => ({ 
                    ...prev, 
                    config: { 
                      ...prev.config, 
                      matches: { ...prev.config.matches, maxPerPage: parseInt(e.target.value) } 
                    } 
                  }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Início da Lista (Y)</Label>
                <Input 
                  type="number" 
                  value={newTemplate.config.matches.startY} 
                  onChange={e => setNewTemplate(prev => ({ 
                    ...prev, 
                    config: { 
                      ...prev.config, 
                      matches: { ...prev.config.matches, startY: parseInt(e.target.value) } 
                    } 
                  }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Altura da Linha</Label>
                <Input 
                  type="number" 
                  value={newTemplate.config.matches.rowHeight} 
                  onChange={e => setNewTemplate(prev => ({ 
                    ...prev, 
                    config: { 
                      ...prev.config, 
                      matches: { ...prev.config.matches, rowHeight: parseInt(e.target.value) } 
                    } 
                  }))}
                />
              </div>
            </div>

            <Button onClick={handleSave} className="w-full">
              <Save className="w-4 h-4 mr-2" /> Salvar Template
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {templates.map(template => (
          <Card key={template.id} className="overflow-hidden group relative">
            <div className="aspect-[9/16] relative bg-zinc-900">
              <img src={template.background_url} alt={template.name} className="w-full h-full object-cover opacity-60" />
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                <span className="font-bold text-lg">{template.name}</span>
                <span className="text-xs text-muted-foreground">{template.config.matches.maxPerPage} jogos por página</span>
              </div>
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => deleteTemplate(template.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
