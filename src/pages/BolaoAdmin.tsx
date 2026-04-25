
import DashboardLayout from "@/components/DashboardLayout";
import AnimatedPage from "@/components/AnimatedPage";
import { BolaoChallengeConfig } from "@/components/bolao/BolaoChallengeConfig";

const BolaoAdmin = () => {
  return (
    <DashboardLayout>
      <AnimatedPage>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
              Gestão de Bolão
            </h1>
            <p className="text-muted-foreground">
              Crie desafios, verifique palpites e gerencie ganhadores.
            </p>
          </div>

          <BolaoChallengeConfig />
        </div>
      </AnimatedPage>
    </DashboardLayout>
  );
};

export default BolaoAdmin;
