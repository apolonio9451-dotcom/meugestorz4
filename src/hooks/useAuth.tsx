import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useGhostMode } from "@/hooks/useGhostMode";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  companyId: string | null;
  /** Returns ghostCompanyId when in ghost mode, otherwise companyId */
  effectiveCompanyId: string | null;
  parentCompanyId: string | null;
  userRole: string | null;
  resellerCredits: number | null;
  planType: "starter" | "pro";
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
  admin: "Admin",
  operator: "Usuário",
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [parentCompanyId, setParentCompanyId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [resellerCredits, setResellerCredits] = useState<number | null>(null);
  const [planType, setPlanType] = useState<"starter" | "pro">("pro");
  const [isTrial, setIsTrial] = useState(false);
  const [trialExpiresAt, setTrialExpiresAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCompanyData = async (userId: string) => {
    setCompanyId(null);
    setParentCompanyId(null);
    setUserRole(null);
    setResellerCredits(null);
    setPlanType("starter");
    setIsTrial(false);
    setTrialExpiresAt(null);

    // 1) Base membership (fallback)
    const { data: membership } = await supabase
      .from("company_memberships")
      .select("company_id, role, is_trial, trial_expires_at")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    // 2) Reseller row is the source of truth for reseller users
    const { data: resellerData } = await supabase
      .from("resellers")
      .select("id, company_id, credit_balance, status")
      .eq("user_id", userId)
      .maybeSingle();

    if (resellerData) {
      // Reseller uses their OWN company (from membership) for data isolation
      // Parent company is stored separately for shared features (announcements)
      const resellerCompanyId = membership?.company_id || resellerData.company_id;
      setCompanyId(resellerCompanyId);
      setParentCompanyId(resellerData.company_id);
      setResellerCredits(resellerData.credit_balance);

      // Role comes from actual membership, not from credits
      const membershipRole = membership?.role;
      const resolvedRole = roleLabels[membershipRole || "operator"] || "Usuário";
      setUserRole(resolvedRole);

      const { data: companyData } = await supabase
        .from("companies")
        .select("plan_type")
        .eq("id", resellerCompanyId)
        .maybeSingle();

      // Admins are always Pro regardless of company plan_type
      const isAdminOrOwner = membershipRole === "admin" || membershipRole === "owner";
      const dbPlan = (companyData as any)?.plan_type;
      setPlanType(isAdminOrOwner || dbPlan === "pro" ? "pro" : "starter");

      const resellerIsTrial = resellerData.status === "trial";
      setIsTrial(resellerIsTrial);
      setTrialExpiresAt(resellerIsTrial ? membership?.trial_expires_at || null : null);
      return;
    }

    if (membership) {
      setCompanyId(membership.company_id);
      setParentCompanyId(null);
      setResellerCredits(null);
      setIsTrial(membership.is_trial || false);
      setTrialExpiresAt(membership.trial_expires_at || null);
      setUserRole(roleLabels[membership.role] || membership.role);

      // Fetch plan_type from companies
      const { data: companyData } = await supabase
        .from("companies")
        .select("plan_type")
        .eq("id", membership.company_id)
        .maybeSingle();
      setPlanType((companyData as any)?.plan_type === "starter" ? "starter" : "pro");
    }
  };

  useEffect(() => {
    const syncAuthState = async (nextSession: Session | null, event?: string) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        setLoading(true);
        await fetchCompanyData(nextSession.user.id);
        setLoading(false);
        return;
      }

      setCompanyId(null);
      setParentCompanyId(null);
      setUserRole(null);
      setResellerCredits(null);
      setPlanType("starter");
      setIsTrial(false);
      setTrialExpiresAt(null);
      setLoading(false);

      // If token refresh failed (user deleted), redirect to auth
      if (event === "TOKEN_REFRESHED" && !nextSession) {
        window.location.href = "/auth";
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      void syncAuthState(nextSession, event);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      void syncAuthState(session);
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
          setResellerCredits(reseller.credit_balance);
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

  // Realtime: update plan_type instantly when admin changes it
  useEffect(() => {
    if (!user || !companyId) return;

    const channel = supabase
      .channel("company-plan-sync")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "companies",
          filter: `id=eq.${companyId}`,
        },
        (payload) => {
          const company = payload.new as { plan_type: string };
          // Owners/admins stay pro regardless
          void (async () => {
            const { data: membership } = await supabase
              .from("company_memberships")
              .select("role")
              .eq("user_id", user.id)
              .limit(1)
              .maybeSingle();
            const isAdminOrOwner = membership?.role === "admin" || membership?.role === "owner";
            setPlanType(isAdminOrOwner || company.plan_type === "pro" ? "pro" : "starter");
          })();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, companyId]);

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
    setParentCompanyId(null);
    setUserRole(null);
    setResellerCredits(null);
    setPlanType("pro");
    setIsTrial(false);
    setTrialExpiresAt(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, companyId, effectiveCompanyId: companyId, parentCompanyId, userRole, resellerCredits, planType, isTrial, trialExpiresAt, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  
  // Override effectiveCompanyId when ghost mode is active
  let ghostCtx: { ghostCompanyId: string | null; isGhostMode: boolean } | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { ghostCompanyId, isGhostMode } = useGhostMode();
    ghostCtx = { ghostCompanyId, isGhostMode };
  } catch {
    // GhostModeProvider not available
  }

  if (ghostCtx?.isGhostMode && ghostCtx.ghostCompanyId) {
    return {
      ...context,
      effectiveCompanyId: ghostCtx.ghostCompanyId,
    };
  }

  return context;
}
