import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface ResellerData {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  credit_balance: number;
  status: string;
  company_id: string;
}

interface ResellerContextType {
  session: Session | null;
  user: User | null;
  reseller: ResellerData | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshReseller: () => Promise<void>;
}

const ResellerContext = createContext<ResellerContextType | undefined>(undefined);

export function ResellerProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [reseller, setReseller] = useState<ResellerData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReseller = async (userId: string) => {
    const { data } = await supabase
      .from("resellers")
      .select("id, name, email, whatsapp, credit_balance, status, company_id")
      .eq("user_id", userId)
      .limit(1)
      .single();
    if (data) setReseller(data);
    return data;
  };

  const refreshReseller = async () => {
    if (user) await fetchReseller(user.id);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchReseller(session.user.id);
        } else {
          setReseller(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchReseller(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setReseller(null);
  };

  return (
    <ResellerContext.Provider value={{ session, user, reseller, loading, signIn, signOut, refreshReseller }}>
      {children}
    </ResellerContext.Provider>
  );
}

export function useReseller() {
  const context = useContext(ResellerContext);
  if (!context) throw new Error("useReseller must be used within ResellerProvider");
  return context;
}
