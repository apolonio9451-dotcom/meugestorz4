
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Trophy, Send, CheckCircle2, Lock, Smartphone, User, History, Share2, MessageSquare, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import AnimatedPage from "@/components/AnimatedPage";

interface Match {
  id: string;
  home_team: string;
  away_team: string;
  home_logo?: string;
  away_logo?: string;
  league_name?: string;
  match_time: string;
  match_date: string;
}

interface Guess {
  match_id: string;
  home_score: string;
  away_score: string;
}

const BolaoTVMAX = () => {
  const [step, setStep] = useState<"login" | "form" | "betting" | "success">("login");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [challenge, setChallenge] = useState<any>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [guesses, setGuesses] = useState<Record<string, { home: string, away: string }>>({});
  const [existingGuess, setExistingGuess] = useState<any>(null);
  const [supportPhone, setSupportPhone] = useState("");

  useEffect(() => {
    fetchActiveChallenge();
    fetchSupportPhone();
  }, []);

  const fetchSupportPhone = async () => {
    try {
      const { data: settings } = await supabase.from('company_settings').select('support_whatsapp').limit(1).maybeSingle();
      if (settings?.support_whatsapp) {
        setSupportPhone(settings.support_whatsapp.replace(/\D/g, ''));
      }
    } catch (e) {
      console.error("Error fetching support phone:", e);
    }
  };

  const fetchActiveChallenge = async () => {
    const { data: challengeData } = await supabase
      .from("bolao_challenges")
      .select("*")
      .eq("status", "active")
      .maybeSingle();

    if (challengeData) {
      setChallenge(challengeData);
      const { data: matchesData } = await supabase
        .from("sports_matches")
        .select("*")
        .in("id", challengeData.match_ids);
      
      setMatches(matchesData || []);
    }
  };

  const handleLogin = async () => {
    if (phone.length < 10) {
      toast.error("Por favor, insira um número de telefone válido.");
      return;
    }

    setLoading(true);
    try {
      // Normalize phone before search
      const cleanPhone = phone.replace(/\D/g, '');
      
      const { data, error: rpcError } = await supabase.rpc('check_bolao_access' as any, { 
        p_phone: cleanPhone 
      });

      if (rpcError) throw rpcError;

      if (data) {
        setName(data.name || "");
        setIsClient(data.is_client || false);
        setPhone(cleanPhone); // Save normalized phone
        checkExistingGuess(cleanPhone);
      } else {
        // Not a client or lead, ask for name
        setIsClient(false);
        setStep("form");
      }
    } catch (error: any) {
      toast.error("Erro ao verificar acesso.");
    } finally {
      setLoading(false);
    }
  };

  const checkExistingGuess = async (phoneNumber: string) => {
    if (!challenge) return;

    const { data } = await supabase
      .from("bolao_guesses")
      .select("*")
      .eq("challenge_id", challenge.id)
      .eq("participant_phone", phoneNumber.replace(/\D/g, ''))
      .maybeSingle();

    if (data) {
      setExistingGuess(data);
      setIsClient(data.is_client);
      setStep("success");
    } else {
      setStep("betting");
    }
  };

  const handleRegisterLead = async () => {
    if (!name || name.length < 3) {
      toast.error("Por favor, insira seu nome.");
      return;
    }

    setLoading(true);
    try {
      // Save lead
      const cleanPhone = phone.replace(/\D/g, '');
      await supabase.from("bolao_leads" as any).upsert({ name, phone: cleanPhone });
      setPhone(cleanPhone);
      checkExistingGuess(cleanPhone);
    } catch (error) {
      toast.error("Erro ao registrar.");
    } finally {
      setLoading(false);
    }
  };

  const handleGuessChange = (matchId: string, team: 'home' | 'away', value: string) => {
    // Only allow numbers
    const cleanValue = value.replace(/[^0-9]/g, '');
    setGuesses(prev => ({
      ...prev,
      [matchId]: {
        ...(prev[matchId] || { home: "", away: "" }),
        [team]: cleanValue
      }
    }));
  };

  const handleSubmitGuesses = async () => {
    // Validate all games have scores
    const allFilled = matches.every(m => guesses[m.id]?.home !== "" && guesses[m.id]?.away !== "");
    if (!allFilled) {
      toast.error("Por favor, preencha todos os placares.");
      return;
    }

    setSubmitting(true);
    try {
      const formattedGuesses = matches.map(m => ({
        match_id: m.id,
        home_score: parseInt(guesses[m.id].home),
        away_score: parseInt(guesses[m.id].away)
      }));

      const { data, error } = await supabase
        .from("bolao_guesses")
        .insert({
          challenge_id: challenge.id,
          participant_phone: phone,
          participant_name: name,
          guesses: formattedGuesses,
          status: "pending",
          is_client: isClient
        } as any)
        .select()
        .single();

      if (error) throw error;

      setExistingGuess(data);
      setStep("success");
      toast.success("Palpites registrados com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao enviar palpites: " + (error.message || "Tente novamente."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-primary/30">
      {/* Header */}
      <div className="p-6 flex flex-col items-center gap-4">
        <div className="bg-gradient-to-br from-zinc-800 to-zinc-950 p-4 rounded-2xl border border-zinc-800 shadow-2xl">
           <img src="/lovable-uploads/271501d2-0382-4467-9c98-10041d8b6889.png" alt="TV MAX" className="h-12 w-auto" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-black italic tracking-tighter bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 bg-clip-text text-transparent uppercase">
            Bolão TV MAX
          </h1>
          <p className="text-zinc-500 text-xs font-bold uppercase tracking-[0.2em]">Onde o seu palpite vale prêmio</p>
        </div>
      </div>

      <main className="max-w-md mx-auto px-4 pb-12">
        <AnimatedPage>
          {step === "login" && (
            <Card className="bg-zinc-950/50 border-zinc-800 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-lg text-center font-bold">Acesso ao Desafio</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Seu WhatsApp</label>
                  <div className="relative">
                    <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <Input 
                      placeholder="(00) 00000-0000" 
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className="bg-zinc-900/50 border-zinc-800 pl-10 focus:border-primary/50 transition-all h-12"
                    />
                  </div>
                </div>
                <Button 
                  onClick={handleLogin} 
                  disabled={loading}
                  className="w-full bg-primary hover:bg-primary/80 h-12 font-bold uppercase tracking-widest text-black"
                >
                  {loading ? "Verificando..." : "Entrar no Bolão"}
                </Button>
              </CardContent>
            </Card>
          )}

          {step === "form" && (
            <Card className="bg-zinc-950/50 border-zinc-800 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-lg text-center font-bold">Boas-vindas ao Bolão!</CardTitle>
                <p className="text-center text-zinc-500 text-sm italic">Informe seu nome para identificarmos seu palpite:</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Nome Completo</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <Input 
                      placeholder="Seu nome" 
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="bg-zinc-900/50 border-zinc-800 pl-10 focus:border-primary/50 h-12"
                    />
                  </div>
                </div>
                <Button 
                  onClick={handleRegisterLead} 
                  disabled={loading}
                  className="w-full bg-primary hover:bg-primary/80 h-12 font-bold uppercase tracking-widest text-black"
                >
                  {loading ? "Registrando..." : "Confirmar e Jogar"}
                </Button>
              </CardContent>
            </Card>
          )}

          {step === "betting" && (
            <div className="space-y-6">
              <div className="flex flex-col gap-3">
                <Button 
                  onClick={() => {
                    const shareText = `⚽ Desafio Bolão TV MAX! 🏆 Você acha que entende de futebol? Tente acertar os placares de hoje e ganhe prêmios! Participe aqui: ${window.location.origin}/palpites`;
                    if (navigator.share) {
                      navigator.share({ title: 'Bolão TV MAX', text: shareText, url: window.location.origin + '/palpites' });
                    } else {
                      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, '_blank');
                    }
                  }}
                  className="w-full bg-zinc-900 border border-primary/20 hover:border-primary/50 text-primary h-12 font-bold uppercase tracking-widest shadow-[0_0_15px_rgba(0,242,255,0.1)]"
                >
                  <Share2 className="w-5 h-5 mr-2 animate-pulse" /> Compartilhar Bolão
                </Button>

                <div className="bg-zinc-900/80 p-4 rounded-2xl border border-zinc-800 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase">Bem-vindo(a),</p>
                    <p className="font-black text-primary">{name || "Palpiteiro"}</p>
                  </div>
                  <Trophy className="w-8 h-8 text-yellow-500" />
                </div>
              </div>

              <div className="space-y-4">
                {matches.map((match) => (
                  <Card key={match.id} className="bg-zinc-950/40 border-zinc-800/50 backdrop-blur-sm overflow-hidden transition-all hover:border-primary/30 group">
                    <div className="bg-zinc-900/80 p-2 text-center border-b border-zinc-800/50 flex items-center justify-between px-4">
                      <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">
                        {match.league_name || "FUTEBOL PROFISSIONAL"}
                      </span>
                      <span className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(match.match_time), "HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between gap-2">
                        {/* Time Casa */}
                        <div className="flex-1 flex flex-col items-center gap-2 text-center min-w-0">
                          <div className="w-12 h-12 relative group-hover:scale-110 transition-transform">
                            <div className="absolute inset-0 bg-primary/20 blur-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                            <img 
                              src={match.home_logo || "/placeholder.svg"} 
                              alt={match.home_team} 
                              className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_8px_rgba(255,255,255,0.1)]" 
                            />
                          </div>
                          <p className="text-[10px] font-black uppercase tracking-tight leading-tight h-7 flex items-center justify-center overflow-hidden">
                            {match.home_team}
                          </p>
                        </div>

                        {/* Placar */}
                        <div className="flex items-center gap-2">
                          <Input 
                            type="text" 
                            inputMode="numeric"
                            value={guesses[match.id]?.home || ""}
                            onChange={(e) => handleGuessChange(match.id, 'home', e.target.value)}
                            className="w-12 h-14 text-center font-black text-2xl bg-zinc-900/50 border-zinc-800 focus:border-primary focus:ring-1 focus:ring-primary/50 p-0 rounded-xl"
                            placeholder="-"
                          />
                          <span className="text-zinc-700 font-black italic text-sm">X</span>
                          <Input 
                            type="text" 
                            inputMode="numeric"
                            value={guesses[match.id]?.away || ""}
                            onChange={(e) => handleGuessChange(match.id, 'away', e.target.value)}
                            className="w-12 h-14 text-center font-black text-2xl bg-zinc-900/50 border-zinc-800 focus:border-primary focus:ring-1 focus:ring-primary/50 p-0 rounded-xl"
                            placeholder="-"
                          />
                        </div>

                        {/* Time Fora */}
                        <div className="flex-1 flex flex-col items-center gap-2 text-center min-w-0">
                          <div className="w-12 h-12 relative group-hover:scale-110 transition-transform">
                            <div className="absolute inset-0 bg-primary/20 blur-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                            <img 
                              src={match.away_logo || "/placeholder.svg"} 
                              alt={match.away_team} 
                              className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_8px_rgba(255,255,255,0.1)]" 
                            />
                          </div>
                          <p className="text-[10px] font-black uppercase tracking-tight leading-tight h-7 flex items-center justify-center overflow-hidden">
                            {match.away_team}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Button 
                onClick={handleSubmitGuesses} 
                disabled={submitting}
                className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 h-14 font-black text-black uppercase tracking-widest shadow-lg shadow-orange-500/20"
              >
                {submitting ? "Processando..." : <><Send className="w-5 h-5 mr-2" /> Confirmar Palpites</>}
              </Button>
            </div>
          )}

          {step === "success" && existingGuess && (
            <div className="space-y-6">
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-green-500/10 rounded-full border border-green-500/20 mb-4 animate-pulse">
                  <CheckCircle2 className="w-10 h-10 text-green-500" />
                </div>
                <h2 className="text-2xl font-black text-white italic tracking-tighter">PALPITES REGISTRADOS!</h2>
                <p className="text-zinc-500 text-sm">Boa sorte! Agora é só torcer.</p>
              </div>

              {/* Strategic Message for Non-Clients who Win */}
              {existingGuess.status === 'winner' && !existingGuess.is_client && (
                <Card className="bg-orange-500/10 border-orange-500/50 border-2 overflow-hidden shadow-[0_0_30px_rgba(249,115,22,0.1)]">
                  <CardContent className="p-6 text-center space-y-4">
                    <Trophy className="w-12 h-12 text-orange-500 mx-auto animate-bounce" />
                    <h3 className="text-xl font-black italic uppercase text-white leading-tight">
                      🔥 Você mitou e acertou tudo!
                    </h3>
                    <p className="text-sm text-zinc-300 font-medium">
                      Mas atenção: este prêmio é exclusivo para <span className="text-orange-500 font-bold uppercase">Assinantes TV MAX Ativos</span>. Não perca a chance de ganhar no próximo desafio, assine agora e valide seu cadastro!
                    </p>
                    <Button 
                      onClick={() => window.open(`https://api.whatsapp.com/send?phone=${supportPhone || '55'}&text=Quero%20ser%20assinante%20TV%20MAX%20para%20participar%20do%20Bolão!`, '_blank')}
                      className="w-full bg-orange-500 hover:bg-orange-600 h-14 font-black uppercase tracking-widest text-black shadow-lg shadow-orange-500/20"
                    >
                      <MessageSquare className="w-5 h-5 mr-2" /> Falar com Suporte para Assinar
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Betting Ticket View */}
              <div className="relative bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-yellow-500 to-orange-500" />
                <div className="p-6 border-b border-zinc-800 border-dashed bg-zinc-900/30">
                  <div className="flex justify-between items-center mb-4">
                    <img src="/lovable-uploads/271501d2-0382-4467-9c98-10041d8b6889.png" alt="TV MAX" className="h-6 opacity-50" />
                    <span className="text-[10px] font-bold text-zinc-500 flex items-center gap-1">
                      <Lock className="w-3 h-3" /> TICKET #{(existingGuess.id as string).substring(0, 8).toUpperCase()}
                    </span>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">Competidor</p>
                    <p className="text-xl font-black uppercase text-white">{existingGuess.participant_name}</p>
                    {existingGuess.is_client && (
                      <span className="mt-1 inline-block px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[8px] font-black uppercase tracking-widest border border-primary/30">Assinante VIP</span>
                    )}
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  {(existingGuess.guesses as any[]).map((g, idx) => {
                    const match = matches.find(m => m.id === g.match_id);
                    return (
                      <div key={idx} className="flex items-center justify-between text-xs font-bold border-b border-zinc-900 pb-2">
                        <span className="text-zinc-400 w-24 truncate">{match?.home_team}</span>
                        <div className="bg-zinc-900 px-3 py-1 rounded text-primary border border-zinc-800">
                          {g.home_score} x {g.away_score}
                        </div>
                        <span className="text-zinc-400 w-24 text-right truncate">{match?.away_team}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="p-4 bg-zinc-900/50 text-center flex flex-col items-center gap-1">
                  <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Registrado em</p>
                  <p className="text-[10px] font-black text-white">
                    {format(new Date(existingGuess.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <Button 
                  onClick={() => {
                    const shareText = `⚽ Acabei de enviar meus palpites no Bolão TV MAX! 🏆 Tente acertar os placares de hoje e ganhe prêmios! Participe aqui: ${window.location.origin}/palpites`;
                    if (navigator.share) {
                      navigator.share({ title: 'Bolão TV MAX', text: shareText, url: window.location.href });
                    } else {
                      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`, '_blank');
                    }
                  }}
                  className="w-full bg-primary hover:bg-primary/80 h-14 font-black uppercase tracking-widest text-black"
                >
                  <Share2 className="w-5 h-5 mr-2" /> Compartilhar Bolão
                </Button>

                <div className="text-center p-6 bg-zinc-950/80 border border-zinc-800 rounded-2xl">
                  <History className="w-5 h-5 text-zinc-600 mx-auto mb-2" />
                  <p className="text-xs font-bold text-zinc-500 uppercase">Acompanhe os resultados no nosso WhatsApp!</p>
                </div>

                <div className="bg-zinc-900/50 p-4 rounded-xl text-center">
                  <p className="text-xs text-zinc-400">Tire um print do seu ticket acima e guarde para conferência.</p>
                </div>
              </div>
            </div>
          )}

          {!challenge && (
            <div className="py-12 text-center">
              <p className="text-zinc-500 italic">Nenhum desafio ativo no momento.</p>
            </div>
          )}
        </AnimatedPage>
      </main>

      {/* Footer Branding */}
      <footer className="py-8 text-center text-[10px] font-black text-zinc-700 uppercase tracking-[0.4em]">
        © {new Date().getFullYear()} TV MAX ENTERTAINMENT
      </footer>
    </div>
  );
};

export default BolaoTVMAX;
