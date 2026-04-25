
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Trophy, Plus, Trash2, Save, Calendar, CheckCircle2, RefreshCw, Wand2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { generateVictoryBanner } from "@/utils/victoryBannerGenerator";

interface Match {
  id: string;
  home_team: string;
  away_team: string;
  match_time: string;
  match_date: string;
}

export const BolaoChallengeConfig = () => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatchIds, setSelectedMatchIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [existingChallenge, setExistingChallenge] = useState<any>(null);
  const [brandLogo, setBrandLogo] = useState<string | null>(null);

  useEffect(() => {
    fetchMatches();
    fetchActiveChallenge();
    fetchBrandLogo();
  }, []);

  const fetchBrandLogo = async () => {
    const { data } = await supabase
      .from("company_settings")
      .select("brand_logo_url")
      .limit(1)
      .maybeSingle();
    if (data?.brand_logo_url) setBrandLogo(data.brand_logo_url);
  };

  const fetchMatches = async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("sports_matches")
        .select("id, home_team, away_team, match_time, match_date")
        .gte("match_date", today)
        .order("match_time", { ascending: true });

      if (error) throw error;
      setMatches(data || []);
    } catch (error: any) {
      toast.error("Erro ao buscar jogos: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveChallenge = async () => {
    const { data } = await supabase
      .from("bolao_challenges")
      .select("*")
      .eq("status", "active")
      .maybeSingle();
    
    if (data) {
      setExistingChallenge(data);
      setSelectedMatchIds(data.match_ids);
    }
  };

  const toggleMatch = (id: string) => {
    setSelectedMatchIds(prev => 
      prev.includes(id) ? prev.filter(mid => mid !== id) : [...prev, id]
    );
  };

  const saveChallenge = async () => {
    if (selectedMatchIds.length < 4 || selectedMatchIds.length > 6) {
      toast.error("Selecione entre 4 e 6 jogos para o desafio.");
      return;
    }

    setSaving(true);
    try {
      if (existingChallenge) {
        // Deactivate current
        await supabase
          .from("bolao_challenges")
          .update({ status: "finished" } as any)
          .eq("id", existingChallenge.id);
      }

      const { error } = await supabase
        .from("bolao_challenges")
        .insert({
          title: `DESAFIO DO DIA - ${format(new Date(), "dd/MM")}`,
          description: "Acerte todos os placares e ganhe 30 dias grátis!",
          match_ids: selectedMatchIds,
          status: "active"
        } as any);

      if (error) throw error;
      toast.success("Desafio configurado com sucesso!");
      fetchActiveChallenge();
    } catch (error: any) {
      toast.error("Erro ao salvar: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const checkWinners = async () => {
    if (!existingChallenge) return;
    setChecking(true);
    try {
      // 1. Fetch results for matches in the challenge
      const { data: results } = await supabase
        .from("sports_matches")
        .select("id, home_score, away_score")
        .in("id", existingChallenge.match_ids);

      const resultMap: Record<string, { home: number; away: number }> = {};
      results?.forEach(r => {
        if (r.home_score !== null && r.away_score !== null) {
          resultMap[r.id] = { home: r.home_score, away: r.away_score };
        }
      });

      // 2. Fetch all guesses for this challenge
      const { data: guesses } = await supabase
        .from("bolao_guesses")
        .select("*")
        .eq("challenge_id", existingChallenge.id)
        .eq("status", "pending");

      if (!guesses || guesses.length === 0) {
        toast.info("Nenhum palpite pendente para verificar.");
        return;
      }

      let winnersCount = 0;

      for (const guess of guesses) {
        const participantGuesses = guess.guesses as any[];
        let isWinner = true;

        for (const pg of participantGuesses) {
          const result = resultMap[pg.match_id];
          if (!result || pg.home_score !== result.home || pg.away_score !== result.away) {
            isWinner = false;
            break;
          }
        }

        if (isWinner) {
          winnersCount++;
          
          // Re-verify client status
          const { data: clientStatus } = await supabase
            .from("clients")
            .select("status")
            .eq("phone", guess.participant_phone)
            .maybeSingle();
          
          const isActiveClient = clientStatus?.status === 'active';
          const adminNotification = isActiveClient 
            ? 'GANHADOR CONFIRMADO - LIBERAR PRÊMIO' 
            : 'QUASE GANHADOR - POTENCIAL CLIENTE';

          // Generate Victory Banner
          const dataUrl = await generateVictoryBanner(guess.participant_name, brandLogo);
          
          // Upload to storage
          const blob = await (await fetch(dataUrl)).blob();
          const fileName = `${guess.id}/victory.png`;
          const { error: uploadError } = await supabase.storage
            .from("bolao-celebrations")
            .upload(fileName, blob, { upsert: true });

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from("bolao-celebrations")
            .getPublicUrl(fileName);

          // Update guess status and notification
          await supabase
            .from("bolao_guesses")
            .update({ 
              status: "winner", 
              celebration_image_url: publicUrl,
              is_client: isActiveClient,
              admin_notification: adminNotification
            } as any)
            .eq("id", guess.id);
        } else {
           // Optional: mark as loser if all games are finished
           // For now just keep as pending until manually verified or logic expanded
        }
      }

      toast.success(`${winnersCount} ganhadores identificados e artes geradas!`);
    } catch (error: any) {
      toast.error("Erro ao verificar ganhadores: " + error.message);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="glass-card border-primary/20 bg-zinc-950/50 backdrop-blur-xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <Trophy className="w-6 h-6 text-yellow-500" />
              Configurar Desafio do Dia
            </CardTitle>
            <p className="text-sm text-zinc-400 mt-1">Selecione 4 a 6 jogos para o Bolão TV MAX</p>
          </div>
          <Button 
            onClick={saveChallenge} 
            disabled={saving || selectedMatchIds.length === 0}
            className="bg-primary hover:bg-primary/80"
          >
            {saving ? "Salvando..." : <><Save className="w-4 h-4 mr-2" /> Ativar Desafio</>}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {matches.map(match => (
              <div 
                key={match.id}
                onClick={() => toggleMatch(match.id)}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  selectedMatchIds.includes(match.id) 
                    ? "bg-primary/10 border-primary shadow-[0_0_15px_rgba(0,242,255,0.1)]" 
                    : "bg-zinc-900/50 border-zinc-800 hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                    {format(new Date(match.match_time), "HH:mm", { locale: ptBR })}
                  </span>
                  <Checkbox checked={selectedMatchIds.includes(match.id)} />
                </div>
                <div className="text-sm font-black flex flex-col gap-1">
                  <div className="flex justify-between items-center">
                    <span className="truncate">{match.home_team}</span>
                    <span className="text-zinc-600 text-[10px]">CASA</span>
                  </div>
                  <div className="text-primary text-center my-1 italic font-serif">vs</div>
                  <div className="flex justify-between items-center">
                    <span className="truncate">{match.away_team}</span>
                    <span className="text-zinc-600 text-[10px]">FORA</span>
                  </div>
                </div>
              </div>
            ))}
            {matches.length === 0 && (
              <div className="col-span-full py-12 text-center text-zinc-500">
                Nenhum jogo encontrado para hoje ou amanhã.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      {existingChallenge && (
        <Card className="glass-card border-green-500/20 bg-zinc-950/50">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-sm font-bold text-white">Desafio Ativo: {existingChallenge.title}</p>
                <p className="text-xs text-zinc-500">{existingChallenge.match_ids.length} jogos selecionados</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={checkWinners} 
                disabled={checking}
                variant="outline" 
                className="border-green-500/50 text-green-500 hover:bg-green-500/10 font-bold"
              >
                {checking ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
                Verificar Ganhadores
              </Button>
              <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-400 hover:bg-red-500/10">
                <Trash2 className="w-4 h-4 mr-2" /> Encerrar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
