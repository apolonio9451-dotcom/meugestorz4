import { useState, useEffect, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import AnimatedPage from "@/components/AnimatedPage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Image as ImageIcon, Download, Share2, Edit2, Upload, Trash2, Settings, Plus, Save, Tv } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { generateBannerCanvas, MatchData, TemplateConfig } from "@/utils/bannerGenerator";
import { TemplateConfigPanel } from "@/components/TemplateConfigPanel";

interface Match {
  id: string;
  home_team: string;
  away_team: string;
  home_logo: string;
  away_logo: string;
  match_time: string;
  league_name: string;
  channels: string[];
}

interface BannerTemplate {
  id: string;
  name: string;
  background_url: string;
  config: TemplateConfig;
}

const BannerGenerator = () => {
  const { effectiveCompanyId } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("default");
  const [templates, setTemplates] = useState<BannerTemplate[]>([]);
  const [brandLogo, setBrandLogo] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("generator");
  const [hideFrames, setHideFrames] = useState(false);
  const [hideHeaderBox, setHideHeaderBox] = useState(false);

  useEffect(() => {
    if (isEditorOpen && selectedMatch) {
      updatePreview();
    }
  }, [isEditorOpen, selectedMatch, selectedTemplateId, matches, hideFrames, hideHeaderBox]);

  const updatePreview = async () => {
    if (!selectedMatch) return;
    try {
      const isDaily = selectedMatch.id === "daily";
      const currentTemplate = templates.find(t => t.id === selectedTemplateId);
      const maxPerPage = currentTemplate?.config?.matches?.maxPerPage || 6;
      
      const matchesToDraw = isDaily 
        ? matches.slice(0, maxPerPage).map(m => ({ ...m, channels: m.channels || [] }))
        : [{ ...selectedMatch, channels: selectedMatch.channels || [] }];
      
      const dayOfWeek = format(new Date(), "EEEE", { locale: ptBR });
      
      const dataUrl = await generateBannerCanvas(
        matchesToDraw, 
        brandLogo, 
        dayOfWeek, 
        selectedTemplateId,
        currentTemplate?.background_url,
        currentTemplate?.config,
        isDaily ? { current: 1, total: Math.ceil(matches.length / maxPerPage) } : undefined,
        { hideFrames, hideHeaderBox }
      );
      setPreviewUrl(dataUrl);
    } catch (error) {
      console.error("Error generating preview", error);
    }
  };

  useEffect(() => {
    fetchMatches();
    fetchBrandLogo();
    fetchTemplates();
  }, [effectiveCompanyId]);

  const fetchTemplates = async () => {
    if (!effectiveCompanyId) return;
    const { data } = await supabase
      .from("banner_templates")
      .select("*")
      .eq("company_id", effectiveCompanyId);
    
    if (data) {
      setTemplates(data as any);
    }
  };

  const fetchBrandLogo = async () => {
    if (!effectiveCompanyId) return;
    const { data } = await supabase
      .from("company_settings")
      .select("brand_logo_url")
      .eq("company_id", effectiveCompanyId)
      .maybeSingle();
    if (data?.brand_logo_url) {
      setBrandLogo(data.brand_logo_url);
    }
  };

  const fetchMatches = async () => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("sports_matches")
        .select("*")
        .eq("match_date", today);

      if (error) throw error;
      
      const priorityLeagues = [71, 13, 11, 73, 2, 3, 39, 140, 135, 78, 61, 72];
      const sortedMatches = (data || []).sort((a, b) => {
        const indexA = priorityLeagues.indexOf(a.league_id);
        const indexB = priorityLeagues.indexOf(b.league_id);
        
        if (indexA !== -1 && indexB !== -1) {
          if (indexA !== indexB) return indexA - indexB;
        } else if (indexA !== -1) {
          return -1;
        } else if (indexB !== -1) {
          return 1;
        }
        return new Date(a.match_time).getTime() - new Date(b.match_time).getTime();
      });

      setMatches(sortedMatches);
    } catch (error: any) {
      toast.error("Erro ao buscar jogos: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setFetching(true);
      const { data, error } = await supabase.functions.invoke("fetch-sports-matches");
      if (error) throw error;
      
      toast.success(`${data.count} jogos atualizados!`);
      fetchMatches();
    } catch (error: any) {
      toast.error("Erro ao atualizar jogos: " + error.message);
    } finally {
      setFetching(false);
    }
  };

  const downloadBanner = async () => {
    if (!selectedMatch) return;
    try {
      const isDaily = selectedMatch.id === "daily";
      const currentTemplate = templates.find(t => t.id === selectedTemplateId);
      const maxPerPage = currentTemplate?.config?.matches?.maxPerPage || 6;
      
      const dayOfWeek = format(new Date(), "EEEE", { locale: ptBR });
      
      if (isDaily && matches.length > 0) {
        const totalPages = Math.ceil(matches.length / maxPerPage);
        for (let i = 0; i < totalPages; i++) {
          const start = i * maxPerPage;
          const end = start + maxPerPage;
          const matchesSlice = matches.slice(start, end).map(m => ({ ...m, channels: m.channels || [] }));
          
          const dataUrl = await generateBannerCanvas(
            matchesSlice, 
            brandLogo, 
            dayOfWeek, 
            selectedTemplateId,
            currentTemplate?.background_url,
            currentTemplate?.config,
            { current: i + 1, total: totalPages },
            { hideFrames, hideHeaderBox }
          );
          
          const link = document.createElement("a");
          link.download = `jogos-do-dia-${format(new Date(), "dd-MM")}-parte-${i + 1}.png`;
          link.href = dataUrl;
          link.click();
          await new Promise(r => setTimeout(r, 500));
        }
        toast.success(`${totalPages} imagens geradas com sucesso!`);
      }
    } catch (error) {
      console.error(error);
      toast.error("Erro ao gerar imagem");
    }
  };

  const shareOnWhatsApp = async () => {
    if (!selectedMatch) return;
    try {
      const isDaily = selectedMatch.id === "daily";
      const matchesToDraw = isDaily 
        ? matches.slice(0, 6).map(m => ({ ...m, channels: m.channels || [] }))
        : [{ ...selectedMatch, channels: selectedMatch.channels || [] }];
      
      const dayOfWeek = format(new Date(), "EEEE", { locale: ptBR });
      const currentTemplate = templates.find(t => t.id === selectedTemplateId);

      const dataUrl = await generateBannerCanvas(
        matchesToDraw, 
        brandLogo, 
        dayOfWeek, 
        selectedTemplateId,
        currentTemplate?.background_url,
        currentTemplate?.config,
        undefined,
        { hideFrames, hideHeaderBox }
      );
      
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const file = new File([blob], "banner.png", { type: "image/png" });
      
      if (navigator.share) {
        await navigator.share({
          files: [file],
          title: "Banner de Jogos",
        });
      } else {
        toast.info("Compartilhamento não suportado. Baixe a imagem.");
      }
    } catch (error) {
      toast.error("Erro ao preparar imagem");
    }
  };

  const openDailyEditor = () => {
    if (matches.length === 0) {
      toast.info("Aguarde a sincronização dos jogos.");
      return;
    }
    const dailyMock: Match = {
      id: "daily",
      home_team: "",
      away_team: "",
      home_logo: "",
      away_logo: "",
      match_time: new Date().toISOString(),
      league_name: "Geral",
      channels: []
    };
    setSelectedMatch(dailyMock);
    setIsEditorOpen(true);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !effectiveCompanyId) return;

    try {
      setUploadingLogo(true);
      const fileExt = file.name.split(".").pop();
      const filePath = `${effectiveCompanyId}/brand-logo-${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("company-assets")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("company-assets")
        .getPublicUrl(filePath);

      await supabase
        .from("company_settings")
        .update({ brand_logo_url: publicUrl } as any)
        .eq("company_id", effectiveCompanyId);

      setBrandLogo(publicUrl);
      toast.success("Logo atualizada!");
    } catch (error: any) {
      toast.error("Erro ao subir logo: " + error.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  const updateMatchChannel = (index: number, value: string) => {
    const updatedMatches = [...matches];
    updatedMatches[index] = { ...updatedMatches[index], channels: value.split(",").map(c => c.trim()) };
    setMatches(updatedMatches);
  };

  return (
    <DashboardLayout>
      <AnimatedPage>
        <div className="space-y-6 pb-20">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                Centro de Banners
              </h1>
              <p className="text-muted-foreground">
                Selecione o seu template e gere as artes automaticamente.
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={handleRefresh} 
                disabled={fetching}
                variant="outline"
                className="border-primary/50 text-primary hover:bg-primary/10"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${fetching ? "animate-spin" : ""}`} />
                {fetching ? "Sincronizando..." : "Sincronizar Jogos"}
              </Button>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="bg-zinc-900 border border-zinc-800 p-1">
              <TabsTrigger value="generator" className="data-[state=active]:bg-primary/20">
                <ImageIcon className="w-4 h-4 mr-2" />
                Modelos de Arte
              </TabsTrigger>
              <TabsTrigger value="templates" className="data-[state=active]:bg-primary/20">
                <Settings className="w-4 h-4 mr-2" />
                Configurações
              </TabsTrigger>
            </TabsList>

            <TabsContent value="generator" className="space-y-8 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {/* Default Template */}
                <Card className="overflow-hidden glass-card border-2 border-blue-500/20 hover:border-blue-500/50 transition-all group relative cursor-pointer" onClick={() => { setSelectedTemplateId("default"); openDailyEditor(); }}>
                  <div className="aspect-[9/16] relative bg-zinc-900">
                    <img 
                      src="https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&q=80&w=1080" 
                      alt="Padrão" 
                      className="w-full h-full object-cover opacity-40 group-hover:scale-105 transition-all duration-700" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                    <div className="absolute inset-0 flex flex-col items-center justify-end p-8 text-center">
                      <h3 className="text-2xl font-black text-white mb-2 uppercase italic tracking-tighter">Padrão TV MAX</h3>
                      <p className="text-xs text-blue-400 font-bold mb-6 tracking-widest uppercase">Modelo de Sistema</p>
                      <Button className="w-full bg-blue-600 hover:bg-blue-700 font-black uppercase text-xs tracking-widest">
                        Usar este Modelo
                      </Button>
                    </div>
                  </div>
                </Card>

                {/* Custom Templates */}
                {templates.map((template) => (
                  <Card 
                    key={template.id} 
                    className="overflow-hidden glass-card border-2 border-purple-500/20 hover:border-purple-500/50 transition-all group relative cursor-pointer"
                    onClick={() => { setSelectedTemplateId(template.id); openDailyEditor(); }}
                  >
                    <div className="aspect-[9/16] relative bg-zinc-900">
                      <img 
                        src={template.background_url} 
                        alt={template.name} 
                        className="w-full h-full object-cover opacity-40 group-hover:scale-105 transition-all duration-700" 
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
                      <div className="absolute inset-0 flex flex-col items-center justify-end p-8 text-center">
                        <h3 className="text-2xl font-black text-white mb-2 uppercase italic tracking-tighter">{template.name}</h3>
                        <p className="text-xs text-purple-400 font-bold mb-6 tracking-widest uppercase">Modelo Personalizado</p>
                        <Button className="w-full bg-purple-600 hover:bg-purple-700 font-black uppercase text-xs tracking-widest">
                          Usar este Modelo
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}

                {/* Add New Template Placeholder */}
                <Card 
                  className="aspect-[9/16] flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 bg-zinc-900/20 hover:bg-zinc-900/40 hover:border-zinc-700 transition-all cursor-pointer group"
                  onClick={() => setActiveTab("templates")}
                >
                  <div className="p-6 rounded-full bg-zinc-800 group-hover:bg-zinc-700 transition-colors mb-4">
                    <Plus className="w-10 h-10 text-zinc-500" />
                  </div>
                  <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">Novo Template</p>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="templates" className="mt-6">
              <TemplateConfigPanel 
                companyId={effectiveCompanyId || ""} 
                onTemplateCreated={fetchTemplates}
                templates={templates}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Modal de Preparação e Gerenciamento */}
        <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
          <DialogContent className="max-w-5xl bg-zinc-950 border-zinc-800 text-white max-h-[95vh] overflow-hidden flex flex-col p-0">
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
              <div>
                <DialogTitle className="text-2xl font-black uppercase italic tracking-tighter flex items-center gap-3">
                  <div className="p-2 bg-primary/20 rounded-lg">
                    <Tv className="w-6 h-6 text-primary" />
                  </div>
                  Preparar Transmissões
                </DialogTitle>
                <p className="text-xs text-zinc-500 font-medium mt-1 uppercase tracking-widest">
                  {matches.length} JOGOS IDENTIFICADOS • 6 POR PÁGINA
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="border-zinc-800 hover:bg-zinc-800" onClick={() => setIsEditorOpen(false)}>
                  FECHAR
                </Button>
                <Button className="bg-green-600 hover:bg-green-700 font-bold px-8 shadow-lg shadow-green-600/20" onClick={downloadBanner}>
                  <Download className="w-4 h-4 mr-2" /> GERAR TUDO
                </Button>
              </div>
            </div>
            
            <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-2">
              {/* Lado Esquerdo: Preview */}
              <div className="p-8 bg-black/40 flex items-center justify-center border-r border-zinc-800">
                <div className="w-full max-w-[320px] relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-primary to-purple-600 rounded-[2rem] blur opacity-25 group-hover:opacity-40 transition duration-1000"></div>
                  <div className="relative aspect-[9/16] bg-zinc-900 rounded-[1.5rem] overflow-hidden border-4 border-zinc-800 shadow-2xl">
                    {previewUrl ? (
                      <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                        <RefreshCw className="w-10 h-10 text-zinc-700 animate-spin" />
                        <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Gerando Prévia...</span>
                      </div>
                    )}
                    <div className="absolute top-4 right-4">
                      <div className="bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                        <span className="text-[10px] font-bold text-white uppercase tracking-tighter italic">Preview Real</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Lado Direito: Lista de Jogos e Edição */}
              <div className="p-6 overflow-y-auto custom-scrollbar space-y-4">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/50">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 block">Logo da Marca</Label>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-zinc-800 rounded-lg flex items-center justify-center p-2 border border-zinc-700">
                        {brandLogo ? <img src={brandLogo} className="max-w-full max-h-full object-contain" /> : <ImageIcon className="w-4 h-4 text-zinc-600" />}
                      </div>
                      <div className="flex-1">
                        <Button asChild variant="link" className="p-0 h-auto text-[10px] text-primary hover:text-primary/80 uppercase font-bold">
                          <label className="cursor-pointer">
                            Alterar
                            <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                          </label>
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/50 flex flex-col justify-center gap-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block">Opções Visuais</Label>
                    <div className="flex flex-col gap-2">
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input 
                          type="checkbox" 
                          checked={hideFrames} 
                          onChange={(e) => setHideFrames(e.target.checked)}
                          className="w-3 h-3 rounded border-zinc-700 bg-zinc-800 text-primary focus:ring-primary"
                        />
                        <span className="text-[10px] font-bold text-zinc-400 group-hover:text-zinc-200 transition-colors uppercase">Ocultar Molduras</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input 
                          type="checkbox" 
                          checked={hideHeaderBox} 
                          onChange={(e) => setHideHeaderBox(e.target.checked)}
                          className="w-3 h-3 rounded border-zinc-700 bg-zinc-800 text-primary focus:ring-primary"
                        />
                        <span className="text-[10px] font-bold text-zinc-400 group-hover:text-zinc-200 transition-colors uppercase">Ocultar Caixa Título</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/50 mb-6">

                <div className="space-y-3">
                  <div className="flex items-center justify-between px-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Curadoria de Jogos</Label>
                    <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">Clique para editar</span>
                  </div>
                  
                  {matches.map((match, idx) => (
                    <div key={match.id} className="group relative p-4 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-all hover:bg-zinc-900/80">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">{match.league_name}</span>
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                          <span className="text-[10px] font-black text-blue-400">{format(new Date(match.match_time), "HH:mm")}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3 justify-center mb-4 px-2">
                        <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                          <img src={match.home_logo} alt="" className="w-7 h-7 object-contain" />
                          <span className="text-[10px] font-black text-center truncate w-full uppercase">{match.home_team}</span>
                        </div>
                        <span className="text-[8px] font-black text-zinc-700 italic">VS</span>
                        <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
                          <img src={match.away_logo} alt="" className="w-7 h-7 object-contain" />
                          <span className="text-[10px] font-black text-center truncate w-full uppercase">{match.away_team}</span>
                        </div>
                      </div>
                      
                      <div className="relative">
                        <div className="absolute -top-2 left-2 px-1.5 bg-zinc-900 text-[8px] font-black text-zinc-500 uppercase tracking-widest">
                          Onde Assistir
                        </div>
                        <Input 
                          defaultValue={match.channels?.join(", ")}
                          placeholder="Ex: Premiere, Globo"
                          className="h-9 text-[11px] font-bold bg-zinc-950 border-zinc-800 focus:border-primary/50 uppercase"
                          onChange={(e) => updateMatchChannel(idx, e.target.value)}
                        />
                      </div>
                      
                      {match.channels && match.channels.length > 0 && (
                        <div className="mt-2 flex items-center gap-1">
                          <div className="w-1 h-1 rounded-full bg-green-500" />
                          <span className="text-[8px] font-bold text-green-500 uppercase tracking-widest">
                            Transmissão Detectada: {match.channels[0]}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-zinc-900/80 border-t border-zinc-800 flex justify-center gap-4">
               <Button variant="ghost" className="text-zinc-500 text-[10px] font-black uppercase tracking-widest hover:text-white" onClick={shareOnWhatsApp}>
                 <Share2 className="w-4 h-4 mr-2" /> Compartilhar Preview
               </Button>
            </div>
          </DialogContent>
        </Dialog>
      </AnimatedPage>
    </DashboardLayout>
  );
};

export default BannerGenerator;
