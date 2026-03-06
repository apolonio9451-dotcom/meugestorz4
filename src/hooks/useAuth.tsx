import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  companyId: string | null;
  parentCompanyId: string | null;
  userRole: string | null;
  resellerCredits: number | null;
  isTrial: boolean;
  trialExpiresAt: string | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string, companyName: string) => Promise<{ data: any; error: any }>;
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
  const [parentCompanyId, setParentCompanyId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [resellerCredits, setResellerCredits] = useState<number | null>(null);
  const [isTrial, setIsTrial] = useState(false);
  const [trialExpiresAt, setTrialExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCompanyData = async (userId: string) => {
    // 1) Base membership (fallback)
    const { data: membership } = await supabase
      .from("company_memberships")
      .select("company_id, role, is_trial, trial_expires_at")
      .eq("user_id", userId)
      .limit(1)
      .single();

    // 2) Reseller row is the source of truth for reseller users
    const { data: resellerData } = await supabase
      .from("resellers")
      .select("id, company_id, credit_balance, status")
      .eq("user_id", userId)
      .maybeSingle();

    if (resellerData) {
      // Reseller uses their OWN company (from membership) for data isolation
      // Parent company is stored separately for shared features (announcements)
      setCompanyId(membership?.company_id || resellerData.company_id);
      setParentCompanyId(resellerData.company_id);
      setResellerCredits(resellerData.credit_balance);
      setUserRole(resellerData.credit_balance > 0 ? "Admin" : "Usuário");

      const resellerIsTrial = resellerData.status === "trial";
      setIsTrial(resellerIsTrial);
      setTrialExpiresAt(resellerIsTrial ? membership?.trial_expires_at || null : null);
      return;
    }

    if (membership) {
      setCompanyId(membership.company_id);
      setIsTrial(membership.is_trial || false);
      setTrialExpiresAt(membership.trial_expires_at || null);
      setUserRole(roleLabels[membership.role] || membership.role);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchCompanyData(session.user.id), 0);
        } else {
          setCompanyId(null);
          setUserRole(null);
          setIsTrial(false);
          setTrialExpiresAt(null);
          // If token refresh failed (user deleted), redirect to auth
          if (event === 'TOKEN_REFRESHED' && !session) {
            window.location.href = '/auth';
          }
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

  // Realtime: update reseller context instantly when credits/status change
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("reseller-role-sync")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "resellers",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const reseller = payload.new as { company_id: string; credit_balance: number; status: string };
          setCompanyId(reseller.company_id);
          setResellerCredits(reseller.credit_balance);
          setUserRole(reseller.credit_balance > 0 ? "Admin" : "Usuário");
          if (reseller.status !== "trial") {
            setIsTrial(false);
            setTrialExpiresAt(null);
          } else {
            setIsTrial(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const signUp = async (email: string, password: string, fullName: string, companyName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, company_name: companyName },
        emailRedirectTo: window.location.origin,
      },
    });
    return { data, error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setCompanyId(null);
    setUserRole(null);
    setResellerCredits(null);
    setIsTrial(false);
    setTrialExpiresAt(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, companyId, userRole, resellerCredits, isTrial, trialExpiresAt, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
