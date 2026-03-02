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
  level: number;
  parent_reseller_id: string | null;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  companyId: string | null;
  loading: boolean;
  isReseller: boolean;
  reseller: ResellerData | null;
  signUp: (email: string, password: string, fullName: string, companyName: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  refreshReseller: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [reseller, setReseller] = useState<ResellerData | null>(null);
  const [isReseller, setIsReseller] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (userId: string) => {
    // Try company membership first (admin/owner)
    const { data: membership } = await supabase
      .from("company_memberships")
      .select("company_id")
      .eq("user_id", userId)
      .limit(1)
      .single();

    if (membership) {
      setCompanyId(membership.company_id);
      setIsReseller(false);
      setReseller(null);
      return;
    }

    // Try reseller
    const { data: resellerData } = await supabase
      .from("resellers")
      .select("id, name, email, whatsapp, credit_balance, status, company_id, level, parent_reseller_id")
      .eq("user_id", userId)
      .limit(1)
      .single();

    if (resellerData) {
      setReseller(resellerData);
      setCompanyId(resellerData.company_id);
      setIsReseller(true);
    } else {
      setCompanyId(null);
      setIsReseller(false);
      setReseller(null);
    }
  };

  const refreshReseller = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("resellers")
      .select("id, name, email, whatsapp, credit_balance, status, company_id, level, parent_reseller_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();
    if (data) setReseller(data);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchUserData(session.user.id), 0);
        } else {
          setCompanyId(null);
          setReseller(null);
          setIsReseller(false);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string, companyName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, company_name: companyName },
        emailRedirectTo: window.location.origin,
      },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setCompanyId(null);
    setReseller(null);
    setIsReseller(false);
  };

  return (
    <AuthContext.Provider value={{ session, user, companyId, loading, isReseller, reseller, signUp, signIn, signOut, refreshReseller }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
