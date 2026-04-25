
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Trophy, Clock, LogOut, Send, Download, Share2 } from "lucide-react";
import { format, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { generateVictoryBanner } from "@/utils/victoryBannerGenerator";

interface BolaoParticipationProps {
  client: any;
  onLogout: () => void;
}

const BolaoParticipation = ({ client, onLogout }: BolaoParticipationProps) => {
  const [challenge, setChallenge] = useState<any>(null);
  const [matches, setMatches] = useState<any[]>([]);
  const [guesses, setGuesses] = useState<Record<string, { home: string; away: string }>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hasAlreadyGuessed, setHasAlreadyGuessed] = useState(false);
  const [myGuess, setMyGuess] = useState<any>(null);
  const [victoryImage, setVictoryImage] = useState<string | null>(null);

  useEffect(() => {
    fetchChallenge();
  }, []);

  const fetchChallenge = async () => {
    try {
      const { data: challengeData, error: challengeError } = await supabase
        .from("bolao_challenges")
        .select("*")
        .eq("status", "active")
        .maybeSingle();

      if (challengeError) throw challengeError;
      if (!challengeData) {
        setLoading(false);
        return;
      }

      setChallenge(challengeData);

      // Check if user already guessed for this challenge
      const { data: existingGuess } = await supabase
        .from("bolao_guesses")
        .select("*")
        .eq("challenge_id", challengeData.id)
        .eq("participant_phone", client.whatsapp || client.phone)
        .maybeSingle();

      if (existingGuess) {
        setHasAlreadyGuessed(true);
        setMyGuess(existingGuess);
        if (existingGuess.status === 'winner' && existingGuess.celebration_image_url) {
            setVictoryImage(existingGuess.celebration_image_url);
        }
      }

      // Fetch matches in the challenge
      const { data: matchesData, error: matchesError } = await supabase
        .from("sports_matches")
        .select("*")
        .in("id", challengeData.match_ids);

      if (matchesError) throw matchesError;
      setMatches(matchesData || []);

      // Initialize guesses if not already guessed
      if (!existingGuess) {
        const initialGuesses: Record<string, { home: string; away: string }> = {};
        matchesData?.forEach((m: any) => {
          initialGuesses[m.id] = { home: "", away: "" };
        });
        setGuesses(initialGuesses);
      } else {
          // Load existing guesses
          const savedGuesses: Record<string, { home: string; away: string }> = {};
          (existingGuess.guesses as any[]).forEach((g: any) => {
              savedGuesses[g.match_id] = { home: g.home_score.toString(), away: g.away_score.toString() };
          });
          setGuesses(savedGuesses);
      }
    } catch (error: any) {
      toast.error("Erro ao carregar desafio: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGuessChange = (matchId: string, side: "home" | "away", value: string) => {
    if (hasAlreadyGuessed) return;
    setGuesses(prev => ({
      ...prev,
      [matchId]: { ...prev[matchId], [side]: value.replace(/\D/g, "") }
    }));
  };

  const handleSubmit = async () => {
    // Validate all scores are filled
    const allFilled = Object.values(guesses).every(g => g.home !== "" && g.away !== "");
    if (!allFilled) {
      toast.error("Preencha todos os placares para enviar seu palpite!");
      return;
    }

    setSubmitting(true);
    try {
      const formattedGuesses = Object.entries(guesses).map(([matchId, scores]) => ({
        match_id: matchId,
        home_score: parseInt(scores.home),
        away_score: parseInt(scores.away)
      }));

      const { error } = await supabase
        .from("bolao_guesses")
        .insert({
          challenge_id: challenge.id,
          client_id: client.id,
          participant_name: client.name,
          participant_phone: client.whatsapp || client.phone,
          guesses: formattedGuesses,
          status: "pending"
        } as any);

      if (error) throw error;
      toast.success("Palpites enviados com sucesso! Boa sorte!");
      setHasAlreadyGuessed(true);
      fetchChallenge();
    } catch (error: any) {
      toast.error("Erro ao enviar: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadArt = () => {
    if (!victoryImage) return;
    const link = document.createElement("a");
    link.href = victoryImage;
    link.download = `Vitoria_Bolao_TVMAX_${client.name}.png`;
    link.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-500 font-black uppercase tracking-widest text-xs">Preparando Arena...</p>
        </div>
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-center">
        <Trophy className="w-16 h-16 text-zinc-800 mb-6" />
        <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">Nenhum Desafio Ativo</h2>
        <p className="text-zinc-500 mt-2 max-w-xs">Aguarde o próximo desafio ser liberado pelo administrador.</p>
        <Button onClick={onLogout} variant="ghost" className="mt-8 text-zinc-500">Sair</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white pb-20 font-sans">
      {/* Header Profile */}
      <div className="bg-zinc-900/80 backdrop-blur-md sticky top-0 z-50 border-b border-zinc-800">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                <span className="text-primary font-black text-sm">{client.name.substring(0, 1).toUpperCase()}</span>
             </div>
             <div>
                <p className="text-xs font-bold text-white truncate max-w-[120px]">{client.name.toUpperCase()}</p>
                <p className="text-[10px] text-primary font-black uppercase tracking-widest">Assinante VIP</p>
             </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onLogout} className="text-zinc-500">
            <LogOut className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Banner Info */}
        <div className="relative overflow-hidden rounded-3xl bg-zinc-900 border border-primary/20 p-8 text-center space-y-4">
            <div className="absolute top-0 right-0 p-4">
                <Trophy className="w-12 h-12 text-yellow-500 opacity-20 rotate-12" />
            </div>
            <h1 className="text-3xl font-black italic tracking-tighter uppercase leading-tight">
                {challenge.title}
            </h1>
            <p className="text-zinc-400 text-sm max-w-md mx-auto">
                {challenge.description}
            </p>
            <div className="flex items-center justify-center gap-2 text-primary font-black text-xs uppercase tracking-[0.2em] pt-2">
                <Clock className="w-4 h-4" />
                Expira em 04:20:00
            </div>
        </div>

        {/* Victory Art if Winner */}
        {victoryImage && (
            <Card className="bg-green-600/10 border-green-500/50 overflow-hidden shadow-[0_0_30px_rgba(34,197,94,0.1)]">
                <CardContent className="p-6 text-center space-y-4">
                    <div className="flex justify-center">
                         <Trophy className="w-12 h-12 text-yellow-500 drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]" />
                    </div>
                    <h2 className="text-2xl font-black italic uppercase text-white">Você é um MITO!</h2>
                    <p className="text-sm text-green-400 font-bold uppercase tracking-widest">Parabéns, você acertou tudo!</p>
                    <div className="relative rounded-xl overflow-hidden border border-zinc-800 shadow-2xl">
                        <img src={victoryImage} alt="Sua Vitória" className="w-full aspect-[9/16] object-cover" />
                    </div>
                    <div className="flex gap-2">
                        <Button onClick={handleDownloadArt} className="flex-1 bg-green-600 hover:bg-green-700 font-bold uppercase tracking-widest">
                            <Download className="w-4 h-4 mr-2" /> Baixar Arte
                        </Button>
                        <Button variant="outline" className="flex-1 border-green-600 text-green-600 hover:bg-green-600/10 font-bold uppercase tracking-widest">
                            <Share2 className="w-4 h-4 mr-2" /> Compartilhar
                        </Button>
                    </div>
                </CardContent>
            </Card>
        )}

        {/* Match List */}
        <div className="grid grid-cols-1 gap-6">
          {matches.map((match) => {
            const isMatchStarted = isAfter(new Date(), new Date(match.match_time));
            const matchGuess = guesses[match.id] || { home: "", away: "" };
            
            return (
              <Card key={match.id} className="glass-card border-zinc-800 bg-zinc-900/40 backdrop-blur-sm overflow-hidden transition-all hover:border-primary/30">
                <div className="p-4 bg-zinc-900/80 border-b border-zinc-800 flex justify-between items-center">
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">
                        {format(new Date(match.match_time), "HH:mm", { locale: ptBR })} • {match.league_name}
                    </span>
                    {isMatchStarted && (
                        <span className="px-2 py-0.5 rounded text-[8px] font-black bg-red-500/10 text-red-500 uppercase tracking-widest">Ao Vivo / Encerrado</span>
                    )}
                </div>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between gap-4">
                    {/* Home Team */}
                    <div className="flex-1 flex flex-col items-center text-center gap-3">
                        <img src={match.home_logo} alt={match.home_team} className="w-12 h-12 object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]" />
                        <span className="text-xs font-black uppercase tracking-tight h-8 flex items-center leading-none">{match.home_team}</span>
                    </div>

                    {/* Score Inputs */}
                    <div className="flex items-center gap-3">
                        <Input 
                            value={matchGuess.home}
                            onChange={(e) => handleGuessChange(match.id, "home", e.target.value)}
                            disabled={hasAlreadyGuessed || isMatchStarted}
                            className="w-14 h-14 text-center text-2xl font-black bg-zinc-950 border-zinc-800 focus:border-primary focus:ring-primary p-0 rounded-xl"
                        />
                        <span className="text-zinc-600 font-black italic">X</span>
                        <Input 
                            value={matchGuess.away}
                            onChange={(e) => handleGuessChange(match.id, "away", e.target.value)}
                            disabled={hasAlreadyGuessed || isMatchStarted}
                            className="w-14 h-14 text-center text-2xl font-black bg-zinc-950 border-zinc-800 focus:border-primary focus:ring-primary p-0 rounded-xl"
                        />
                    </div>

                    {/* Away Team */}
                    <div className="flex-1 flex flex-col items-center text-center gap-3">
                        <img src={match.away_logo} alt={match.away_team} className="w-12 h-12 object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]" />
                        <span className="text-xs font-black uppercase tracking-tight h-8 flex items-center leading-none">{match.away_team}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Submit Button */}
        {!hasAlreadyGuessed && (
            <div className="pt-4">
                <Button 
                    onClick={handleSubmit} 
                    disabled={submitting}
                    className="w-full h-16 bg-primary hover:bg-primary/90 text-black font-black uppercase italic tracking-widest text-lg shadow-[0_0_30px_rgba(0,242,255,0.2)] rounded-2xl"
                >
                    {submitting ? "Registrando Palpites..." : <><Send className="w-5 h-5 mr-3" /> Confirmar Meus Palpites</>}
                </Button>
                <p className="text-[10px] text-zinc-600 text-center mt-4 uppercase tracking-[0.2em]">
                    Você só pode enviar seus palpites uma vez. Revise antes de confirmar.
                </p>
            </div>
        )}

        {hasAlreadyGuessed && !victoryImage && (
            <div className="p-8 rounded-3xl border border-zinc-800 bg-zinc-900/20 text-center space-y-2">
                <Trophy className="w-10 h-10 text-zinc-800 mx-auto mb-2" />
                <h3 className="text-lg font-black italic uppercase text-zinc-400">Palpites Registrados!</h3>
                <p className="text-xs text-zinc-600 uppercase tracking-widest font-bold">Aguarde o encerramento dos jogos para ver o resultado.</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default BolaoParticipation;
