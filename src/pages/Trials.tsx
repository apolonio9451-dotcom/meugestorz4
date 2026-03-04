import TrialManagement from "@/components/trials/TrialManagement";

export default function Trials() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Gerenciar Testes</h1>
        <p className="text-muted-foreground text-sm mt-1">Visualize e ative usuários em período de teste</p>
      </div>
      <TrialManagement />
    </div>
  );
}
