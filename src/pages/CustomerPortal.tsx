
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Tv, Trophy, Phone, User, Loader2 } from "lucide-react";
import BolaoParticipation from "@/components/bolao/BolaoParticipation";

const CustomerPortal = () => {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const [userData, setUserData] = useState<any>(null);

  const handleCheckPhone = async () => {
    if (!phone) {
      toast.error("Por favor, insira seu WhatsApp.");
      return;
    }

    setLoading(true);
    try {
      // Clean phone for lookup
      const cleanPhone = phone.replace(/\D/g, "");
      
      // Search in clients table
      const { data: existingClient, error } = await supabase
        .from("clients")
        .select("*")
        .or(`whatsapp.eq.${cleanPhone},phone.eq.${cleanPhone}`)
        .maybeSingle();

      if (error) throw error;

      if (existingClient) {
        setUserData(existingClient);
        setIsAuthenticated(true);
        toast.success(`Bem-vindo de volta, ${existingClient.name}!`);
      } else {
        setIsNewUser(true);
        toast.info("Não encontramos seu número. Complete seu cadastro para participar!");
      }
    } catch (error: any) {
      toast.error("Erro ao verificar acesso: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!name || !phone) {
      toast.error("Preencha nome e telefone.");
      return;
    }

    setLoading(true);
    try {
      const cleanPhone = phone.replace(/\D/g, "");
      
      // We insert as a lead. In this system, clients have a company_id. 
      // For now, we'll pick the first company_id or a default one if needed.
      // Better: we should have a way to know which company this portal belongs to.
      // For now, let's fetch the first company as a placeholder.
      const { data: company } = await supabase.from("companies").select("id").limit(1).single();

      const { data, error } = await supabase
        .from("clients")
        .insert({
          name,
          whatsapp: cleanPhone,
          phone: cleanPhone,
          status: "lead",
          company_id: company?.id,
          notes: "Cadastrado via Portal de Bolão"
        } as any)
        .select()
        .single();

      if (error) throw error;

      setUserData(data);
      setIsAuthenticated(true);
      toast.success("Cadastro realizado com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao realizar cadastro: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (isAuthenticated) {
    return <BolaoParticipation client={userData} onLogout={() => setIsAuthenticated(false)} />;
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 font-sans">
      {/* Premium Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full" />
      </div>

      <div className="w-full max-w-md relative z-10 space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-xl mb-4">
            <Tv className="w-8 h-8 text-primary animate-pulse" />
          </div>
          <h1 className="text-4xl font-black italic tracking-tighter text-white uppercase">
            TV <span className="text-primary">MAX</span> BOLÃO
          </h1>
          <p className="text-zinc-400 text-sm font-medium uppercase tracking-[0.2em]">
            Portal do Cliente Elite
          </p>
        </div>

        <Card className="glass-card border-zinc-800 bg-zinc-900/50 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-primary via-purple-500 to-primary" />
          <CardHeader>
            <CardTitle className="text-xl font-bold text-center flex items-center justify-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              {isNewUser ? "Complete seu Cadastro" : "Acesse o Desafio"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isNewUser ? (
              <>
                <div className="space-y-2">
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <Input 
                      placeholder="Seu Nome Completo" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="bg-zinc-950/50 border-zinc-800 pl-10 h-12 text-white placeholder:text-zinc-600 focus:ring-primary"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <Input 
                      placeholder="WhatsApp (ex: 11999999999)" 
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="bg-zinc-950/50 border-zinc-800 pl-10 h-12 text-white placeholder:text-zinc-600 focus:ring-primary"
                    />
                  </div>
                </div>
                <Button 
                  onClick={handleRegister} 
                  disabled={loading}
                  className="w-full h-12 bg-primary hover:bg-primary/90 text-black font-black uppercase tracking-widest shadow-[0_0_20px_rgba(0,242,255,0.3)]"
                >
                  {loading ? <Loader2 className="animate-spin mr-2" /> : "Participar Agora"}
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                    <Input 
                      placeholder="Seu WhatsApp" 
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="bg-zinc-950/50 border-zinc-800 pl-10 h-12 text-white placeholder:text-zinc-600 focus:ring-primary"
                    />
                  </div>
                  <p className="text-[10px] text-zinc-500 text-center uppercase tracking-wider">
                    Use o mesmo número da sua assinatura
                  </p>
                </div>
                <Button 
                  onClick={handleCheckPhone} 
                  disabled={loading}
                  className="w-full h-12 bg-primary hover:bg-primary/90 text-black font-black uppercase tracking-widest shadow-[0_0_20px_rgba(0,242,255,0.3)]"
                >
                  {loading ? <Loader2 className="animate-spin mr-2" /> : "Entrar no Portal"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        <div className="text-center pt-8">
          <p className="text-zinc-600 text-[10px] font-bold uppercase tracking-widest">
            Desenvolvido por TV MAX & Meu Gestor
          </p>
        </div>
      </div>
    </div>
  );
};

export default CustomerPortal;
