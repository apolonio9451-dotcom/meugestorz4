import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { UserCog, LogIn } from "lucide-react";

export default function ResellerAuth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      toast({ title: "Erro ao entrar", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    // Check if user is a reseller
    const { data: session } = await supabase.auth.getSession();
    if (session?.session?.user) {
      const { data: reseller } = await supabase
        .from("resellers")
        .select("id")
        .eq("user_id", session.session.user.id)
        .limit(1)
        .single();

      if (!reseller) {
        await supabase.auth.signOut();
        toast({ title: "Acesso negado", description: "Esta conta não é de um revendedor", variant: "destructive" });
        setLoading(false);
        return;
      }
    }

    navigate("/reseller");
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center mb-3">
            <UserCog className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-xl font-display">Painel do Revendedor</CardTitle>
          <p className="text-sm text-muted-foreground">Faça login para acessar seu painel</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <Label>Senha</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full gap-2" disabled={loading}>
              <LogIn className="w-4 h-4" />
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
