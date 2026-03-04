import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  companyId: string | null;
  userRole: string | null;
  isTrial: boolean;
  trialExpiresAt: string | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string, companyName: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const roleLabels: Record<string, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  operator: "Operador",
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isTrial, setIsTrial] = useState(false);
  const [trialExpiresAt, setTrialExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCompanyData = async (userId: string) => {
    const { data } = await supabase
      .from("company_memberships")
      .select("company_id, role, is_trial, trial_expires_at")
      .eq("user_id", userId)
      .limit(1)
      .single();
    if (data) {
      setCompanyId(data.company_id);
      setUserRole(roleLabels[data.role] || data.role);
      setIsTrial(data.is_trial || false);
      setTrialExpiresAt(data.trial_expires_at || null);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchCompanyData(session.user.id), 0);
        } else {
          setCompanyId(null);
          setUserRole(null);
          setIsTrial(false);
          setTrialExpiresAt(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchCompanyData(session.user.id);
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
    setUserRole(null);
    setIsTrial(false);
    setTrialExpiresAt(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, companyId, userRole, isTrial, trialExpiresAt, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
