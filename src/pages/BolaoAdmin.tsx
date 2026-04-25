
import DashboardLayout from "@/components/DashboardLayout";
import AnimatedPage from "@/components/AnimatedPage";
import { BolaoChallengeConfig } from "@/components/bolao/BolaoChallengeConfig";
import { Button } from "@/components/ui/button";
import { Share2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const BolaoAdmin = () => {
  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/palpites`;
    const shareText = "⚽ Desafio Bolão TV MAX! 🏆 Você acha que entende de futebol? Tente acertar os placares de hoje e ganhe prêmios! Participe aqui:";
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Bolão TV MAX",
          text: shareText,
          url: shareUrl,
        });
      } catch (err) {
        console.error("Error sharing:", err);
      }
    } else {
      const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + " " + shareUrl)}`;
      window.open(whatsappUrl, "_blank");
    }
  };

  const copyLink = () => {
    const shareUrl = `${window.location.origin}/palpites`;
    navigator.clipboard.writeText(shareUrl);
    toast.success("Link do Bolão copiado!");
  };

  return (
    <DashboardLayout>
      <AnimatedPage>
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
                Gestão de Bolão
              </h1>
              <p className="text-muted-foreground">
                Crie desafios, verifique palpites e gerencie ganhadores.
              </p>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                onClick={handleShare}
                className="bg-zinc-900 border border-primary/20 hover:border-primary/50 text-primary font-bold shadow-[0_0_15px_rgba(0,242,255,0.1)]"
              >
                <Share2 className="w-4 h-4 mr-2 animate-pulse" />
                Compartilhar Link
              </Button>
              <Button 
                variant="outline"
                onClick={copyLink}
                className="border-zinc-800 hover:bg-zinc-900"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Copiar Link
              </Button>
            </div>
          </div>

          <BolaoChallengeConfig />
        </div>
      </AnimatedPage>
    </DashboardLayout>
  );
};

export default BolaoAdmin;
