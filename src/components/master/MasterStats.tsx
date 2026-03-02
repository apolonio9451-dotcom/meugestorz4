import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, Users, TrendingUp, Coins, UsersRound, Infinity } from "lucide-react";

interface MasterStatsProps {
  totalResellers: number;
  activeResellers: number;
  totalCredits: number;
  totalClients: number;
}

export default function MasterStats({ totalResellers, activeResellers, totalCredits, totalClients }: MasterStatsProps) {
  return (
    <>
      {/* Master Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/25 flex items-center justify-center">
          <Crown className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            Painel Master
            <Badge className="text-[10px] font-mono bg-primary/20 text-primary border-primary/30">ADMIN</Badge>
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Controle total sobre revendedores, sub-revendedores e planos SaaS</p>
        </div>
      </div>

      {/* Master Credit Banner */}
      <Card className="border-primary/30 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
        <CardContent className="flex items-center gap-4 p-4">
          <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
            <Infinity className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-muted-foreground">Seus Créditos Master</p>
            <p className="text-2xl font-bold font-display text-primary flex items-center gap-2">
              Ilimitado
              <span className="text-xs font-normal text-muted-foreground">• Distribua créditos livremente</span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center"><Users className="w-5 h-5 text-primary" /></div>
            <div><p className="text-xs text-muted-foreground">Revendedores</p><p className="text-xl font-bold text-foreground">{totalResellers}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center"><TrendingUp className="w-5 h-5 text-primary" /></div>
            <div><p className="text-xs text-muted-foreground">Ativos</p><p className="text-xl font-bold text-foreground">{activeResellers}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center"><Coins className="w-5 h-5 text-primary" /></div>
            <div><p className="text-xs text-muted-foreground">Créditos Distribuídos</p><p className="text-xl font-bold text-foreground">{totalCredits}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center"><UsersRound className="w-5 h-5 text-primary" /></div>
            <div><p className="text-xs text-muted-foreground">Clientes dos Revendas</p><p className="text-xl font-bold text-foreground">{totalClients}</p></div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
