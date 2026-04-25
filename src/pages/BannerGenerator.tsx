import { useState, useEffect, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import AnimatedPage from "@/components/AnimatedPage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Image as ImageIcon, Download, Share2, Edit2, Upload, Trash2, Settings, Plus, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, addHours } from "date-fns";
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
  const [customChannels, setCustomChannels] = useState("");
  const [brandLogo, setBrandLogo] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("generator");

  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditorOpen && selectedMatch) {
      updatePreview();
    }
  }, [isEditorOpen, selectedMatch, customChannels, brandLogo, selectedTemplateId]);

  const updatePreview = async () => {
    if (!selectedMatch) return;
    try {
      const isDaily = selectedMatch.id === "daily";
      const matchesToDraw = isDaily 
        ? matches.map(m => ({ ...m, channels: m.channels || [] }))
        : [{ ...selectedMatch, channels: customChannels.split(",").map(c => c.trim()).filter(c => c !== "") }];
      
      const dayOfWeek = format(new Date(), "EEEE", { locale: ptBR });
      const currentTemplate = templates.find(t => t.id === selectedTemplateId);
      
      const dataUrl = await generateBannerCanvas(
        matchesToDraw, 
        brandLogo, 
        dayOfWeek, 
        selectedTemplateId,
        currentTemplate?.background_url,
        currentTemplate?.config
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
    const { data, error } = await supabase
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
        .eq("match_date", today)
        .order("match_time", { ascending: true });

      if (error) throw error;
      setMatches(data || []);
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
      setSelectedTemplateId("default");
    } catch (error: any) {
      toast.error("Erro ao atualizar jogos: " + error.message);
    } finally {
      setFetching(false);
    }
  };

  const openEditor = (match: Match) => {
    setSelectedMatch(match);
    setCustomChannels(match.channels?.join(", ") || "");
    setSelectedTemplateId("default"); 
    setIsEditorOpen(true);
  };

  const downloadBanner = async () => {
    if (!selectedMatch) return;
    try {
      const isDaily = selectedMatch.id === "daily";
      const currentTemplate = templates.find(t => t.id === selectedTemplateId);
      const maxPerPage = currentTemplate?.config?.matches?.maxPerPage || 8;
      
      const dayOfWeek = format(new Date(), "EEEE", { locale: ptBR });
      
      if (isDaily && matches.length > maxPerPage) {
        // Multi-page logic
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
            { current: i + 1, total: totalPages }
          );
          
          const link = document.createElement("a");
          link.download = `jogos-do-dia-${format(new Date(), "dd-MM")}-parte-${i + 1}.png`;
          link.href = dataUrl;
          link.click();
          // Small delay to avoid browser blocking multiple downloads
          await new Promise(r => setTimeout(r, 500));
        }
        toast.success(`${totalPages} imagens geradas com sucesso!`);
      } else {
        const matchesToDraw = isDaily 
          ? matches.map(m => ({ ...m, channels: m.channels || [] }))
          : [{ ...selectedMatch, channels: customChannels.split(",").map(c => c.trim()).filter(c => c !== "") }];
        
        const dataUrl = await generateBannerCanvas(
          matchesToDraw, 
          brandLogo, 
          dayOfWeek, 
          selectedTemplateId,
          currentTemplate?.background_url,
          currentTemplate?.config
        );
        
        const link = document.createElement("a");
        const filename = isDaily 
          ? `jogos-do-dia-${format(new Date(), "dd-MM")}.png`
          : `banner-${selectedMatch.home_team}-vs-${selectedMatch.away_team}.png`;
        link.download = filename;
        link.href = dataUrl;
        link.click();
        toast.success("Banner baixado com sucesso!");
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
        ? matches.map(m => ({ ...m, channels: m.channels || [] }))
        : [{ ...selectedMatch, channels: customChannels.split(",").map(c => c.trim()).filter(c => c !== "") }];
      
      const dayOfWeek = format(new Date(), "EEEE", { locale: ptBR });
      const dataUrl = await generateBannerCanvas(matchesToDraw, brandLogo, dayOfWeek, selectedTemplate);
      
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const file = new File([blob], "banner.png", { type: "image/png" });
      
      if (navigator.share) {
        await navigator.share({
          files: [file],
          title: "Banner de Jogo",
        });
      } else {
        toast.info("Compartilhamento não suportado neste navegador. Baixe a imagem.");
      }
    } catch (error) {
      toast.error("Erro ao preparar imagem");
    }
  };

  const openDailyEditor = () => {
    if (matches.length === 0) return;
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
    setCustomChannels("");
    setSelectedTemplate(1);
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

      const { error: updateError } = await supabase
        .from("company_settings")
        .update({ brand_logo_url: publicUrl } as any)
        .eq("company_id", effectiveCompanyId);

      if (updateError) throw updateError;

      setBrandLogo(publicUrl);
      toast.success("Logo atualizada com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao subir logo: " + error.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  return (
    <DashboardLayout>
      <AnimatedPage>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                Gerador de Banners
              </h1>
              <p className="text-muted-foreground">
                Crie banners profissionais para os jogos de hoje.
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={openDailyEditor}
                disabled={loading || matches.length === 0}
                variant="outline"
                className="bg-purple-600/10 border-purple-600/30 text-purple-400 hover:bg-purple-600/20"
              >
                <Download className="w-4 h-4 mr-2" />
                Gerar Banner com Lista de Jogos
              </Button>
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
            <TabsList className="bg-zinc-900 border border-zinc-800">
              <TabsTrigger value="generator">Gerador</TabsTrigger>
              <TabsTrigger value="templates">Configurar Templates</TabsTrigger>
            </TabsList>

            <TabsContent value="generator" className="space-y-6 mt-6">
              {/* Brand Settings Section */}
              <Card className="glass-card border-primary/20 bg-primary/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-primary" />
                    Configurações de Marca
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col md:flex-row items-center gap-6">
                  <div className="relative group w-32 h-32 rounded-lg border-2 border-dashed border-primary/30 flex items-center justify-center bg-zinc-900/50 overflow-hidden">
                    {brandLogo ? (
                      <>
                        <img src={brandLogo} alt="Logo" className="w-full h-full object-contain p-2" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Button 
                            variant="destructive" 
                            size="icon" 
                            className="h-8 w-8"
                            onClick={() => setBrandLogo(null)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </>
                    ) : (
                      <div className="text-center p-2">
                        <ImageIcon className="w-8 h-8 text-primary/30 mx-auto mb-1" />
                        <span className="text-[10px] text-muted-foreground italic">Sem Logo</span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 space-y-4 text-center md:text-left">
                    <div>
                      <h4 className="text-sm font-medium">Sua Logo Personalizada</h4>
                      <p className="text-xs text-muted-foreground">Aparecerá automaticamente no topo dos seus banners.</p>
                    </div>
                    <div className="flex items-center justify-center md:justify-start gap-3">
                      <Button 
                        asChild 
                        variant="outline" 
                        size="sm" 
                        disabled={uploadingLogo}
                        className="bg-primary/10 border-primary/30 hover:bg-primary/20"
                      >
                        <label className="cursor-pointer">
                          <Upload className="w-4 h-4 mr-2" />
                          {uploadingLogo ? "Enviando..." : "Upload Logo"}
                          <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                        </label>
                      </Button>
                      {!brandLogo && (
                        <span className="text-[10px] text-blue-400 animate-pulse font-medium">
                          Usando padrão TV MAX
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-40 w-full rounded-xl" />
                  ))}
                </div>
              ) : matches.length === 0 ? (
                <Card className="border-dashed border-2 bg-muted/50">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <ImageIcon className="w-12 h-12 text-muted-foreground mb-4" />
                    <p className="text-xl font-medium">Nenhum jogo encontrado para hoje</p>
                    <p className="text-muted-foreground mb-6">Tente sincronizar com a API de futebol.</p>
                    <Button onClick={handleRefresh}>Sincronizar Agora</Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {matches.map((match) => (
                    <Card key={match.id} className="overflow-hidden glass-card hover:border-primary/50 transition-all group">
                      <CardHeader className="pb-2 space-y-0">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-primary px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                            {match.league_name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(match.match_time), "HH:mm")}
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center justify-between gap-4 mb-4">
                          <div className="flex flex-col items-center gap-2 flex-1 text-center">
                            <img src={match.home_logo} alt={match.home_team} className="w-12 h-12 object-contain drop-shadow-md" />
                            <span className="text-xs font-bold line-clamp-1">{match.home_team}</span>
                          </div>
                          <div className="text-lg font-black text-muted-foreground/30 italic">VS</div>
                          <div className="flex flex-col items-center gap-2 flex-1 text-center">
                            <img src={match.away_logo} alt={match.away_team} className="w-12 h-12 object-contain drop-shadow-md" />
                            <span className="text-xs font-bold line-clamp-1">{match.away_team}</span>
                          </div>
                        </div>
                        
                        {match.channels && match.channels.length > 0 && (
                          <div className="text-[10px] text-muted-foreground mb-4 flex items-center gap-1 flex-wrap">
                            <span className="font-semibold text-primary/70">Transmissão:</span>
                            {match.channels.map((ch, i) => (
                              <span key={i} className="bg-muted px-1.5 py-0.5 rounded">{ch}</span>
                            ))}
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2">
                          <Button 
                            variant="outline"
                            size="sm"
                            className="border-primary/20 text-primary hover:bg-primary/10"
                            onClick={() => openEditor(match)}
                          >
                            <Edit2 className="w-3 h-3 mr-1.5" />
                            Personalizar
                          </Button>
                          <Button 
                            size="sm"
                            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white border-0"
                            onClick={async () => {
                              try {
                                const dayOfWeek = format(new Date(), "EEEE", { locale: ptBR });
                                const dataUrl = await generateBannerCanvas(
                                  [{ ...match, channels: match.channels || [] }], 
                                  brandLogo, 
                                  dayOfWeek, 
                                  "default"
                                );
                                const link = document.createElement("a");
                                link.download = `banner-${match.home_team}-vs-${match.away_team}.png`;
                                link.href = dataUrl;
                                link.click();
                                toast.success("Banner baixado!");
                              } catch (error) {
                                toast.error("Erro ao gerar banner");
                              }
                            }}
                          >
                            <Download className="w-3 h-3 mr-1.5" />
                            Baixar PNG
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="templates">
              {effectiveCompanyId && (
                <TemplateConfigPanel 
                  companyId={effectiveCompanyId} 
                  onTemplateCreated={fetchTemplates}
                  templates={templates}
                />
              )}
            </TabsContent>
          </Tabs>

          <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-zinc-950 border-zinc-800 text-white">
              <DialogHeader>
                <DialogTitle className="text-blue-400">Personalizar Banner</DialogTitle>
              </DialogHeader>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 py-4">
                <div className="space-y-6">
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold text-zinc-300">Escolha o Modelo</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        variant={selectedTemplateId === "default" ? "default" : "outline"}
                        className={selectedTemplateId === "default" ? "bg-blue-600 hover:bg-blue-700" : "border-zinc-700"}
                        onClick={() => setSelectedTemplateId("default")}
                      >
                        Padrão TV MAX
                      </Button>
                      {templates.map(t => (
                        <Button
                          key={t.id}
                          variant={selectedTemplateId === t.id ? "default" : "outline"}
                          className={selectedTemplateId === t.id ? "bg-blue-600 hover:bg-blue-700" : "border-zinc-700"}
                          onClick={() => setSelectedTemplateId(t.id)}
                        >
                          {t.name}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-sm font-semibold text-zinc-300">Canais de Transmissão (Separados por vírgula)</Label>
                    <Input 
                      value={customChannels}
                      onChange={(e) => setCustomChannels(e.target.value)}
                      placeholder="Ex: Globo, Premiere, SporTV"
                      className="bg-zinc-900 border-zinc-700"
                    />
                    <p className="text-[10px] text-zinc-500 italic">Deixe vazio para usar a detecção automática.</p>
                  </div>

                  <div className="pt-4 border-t border-zinc-800 flex gap-3">
                    <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={downloadBanner}>
                      <Download className="w-4 h-4 mr-2" /> Gerar e Baixar PNG
                    </Button>
                    <Button variant="outline" className="border-zinc-700" onClick={shareOnWhatsApp}>
                      <Share2 className="w-4 h-4 mr-2" /> Compartilhar
                    </Button>
                  </div>
                </div>

                <div className="relative">
                  <Label className="text-sm font-semibold text-zinc-300 mb-2 block">Prévia</Label>
                  <div className="aspect-[9/16] bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 flex items-center justify-center">
                    {previewUrl ? (
                      <img src={previewUrl} alt="Preview" className="w-full h-full object-contain" />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-zinc-600">
                        <ImageIcon className="w-12 h-12" />
                        <span>Gerando prévia...</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </AnimatedPage>
    </DashboardLayout>
  );
};

export default BannerGenerator;

