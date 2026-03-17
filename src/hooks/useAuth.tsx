import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
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
  /** Always "pro" for owner/admin — use this for UI gating */
  effectivePlanType: "starter" | "pro";
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
  // Hydrate from localStorage cache to prevent flash
  const cached = (() => {
    try {
      const raw = localStorage.getItem("auth_cache");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  })();

  const [companyId, setCompanyId] = useState<string | null>(cached?.companyId ?? null);
  const [parentCompanyId, setParentCompanyId] = useState<string | null>(cached?.parentCompanyId ?? null);
  const [userRole, setUserRole] = useState<string | null>(cached?.userRole ?? null);
  const [resellerCredits, setResellerCredits] = useState<number | null>(cached?.resellerCredits ?? null);
  const [planType, setPlanType] = useState<"starter" | "pro">(cached?.planType === "starter" ? "starter" : "pro");
  const [isTrial, setIsTrial] = useState(cached?.isTrial ?? false);
  const [trialExpiresAt, setTrialExpiresAt] = useState<string | null>(cached?.trialExpiresAt ?? null);
  const [loading, setLoading] = useState(true);

  const persistCache = (data: Record<string, any>) => {
    try { localStorage.setItem("auth_cache", JSON.stringify(data)); } catch {}
  };

  const clearCache = () => {
    try { localStorage.removeItem("auth_cache"); } catch {}
  };

  const fetchSeqRef = useRef(0);
  const hydratedRef = useRef(false);

  const resetCompanyState = (shouldClearCache = true) => {
    setCompanyId(null);
    setParentCompanyId(null);
    setUserRole(null);
    setResellerCredits(null);
    setPlanType("starter");
    setIsTrial(false);
    setTrialExpiresAt(null);
    if (shouldClearCache) clearCache();
  };

  const applyCompanyState = (next: {
    companyId: string | null;
    parentCompanyId: string | null;
    userRole: string | null;
    resellerCredits: number | null;
    planType: "starter" | "pro";
    isTrial: boolean;
    trialExpiresAt: string | null;
  }) => {
    setCompanyId(next.companyId);
    setParentCompanyId(next.parentCompanyId);
    setUserRole(next.userRole);
    setResellerCredits(next.resellerCredits);
    setPlanType(next.planType);
    setIsTrial(next.isTrial);
    setTrialExpiresAt(next.trialExpiresAt);
    persistCache(next);
  };

  const fetchCompanyData = async (userId: string) => {
    const requestId = ++fetchSeqRef.current;

    const [membershipRes, resellerRes] = await Promise.all([
      supabase
        .from("company_memberships")
        .select("company_id, role, is_trial, trial_expires_at")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("resellers")
        .select("id, company_id, credit_balance, status")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    if (requestId !== fetchSeqRef.current) return;

    const membership = membershipRes.data;
    const resellerData = resellerRes.data;

    if (resellerData) {
      const resellerCompanyId = membership?.company_id || resellerData.company_id;
      const membershipRole = membership?.role;
      const resolvedRole = roleLabels[membershipRole || "operator"] || "Usuário";

      const { data: companyData } = await supabase
        .from("companies")
        .select("plan_type")
        .eq("id", resellerCompanyId)
        .maybeSingle();

      if (requestId !== fetchSeqRef.current) return;

      const dbPlan = (companyData as any)?.plan_type;
      const resolvedPlan: "starter" | "pro" = dbPlan === "starter" ? "starter" : "pro";
      const resellerIsTrial = resellerData.status === "trial";
      const trialExp = resellerIsTrial ? membership?.trial_expires_at || null : null;

      applyCompanyState({
        companyId: resellerCompanyId,
        parentCompanyId: resellerData.company_id,
        userRole: resolvedRole,
        resellerCredits: resellerData.credit_balance,
        planType: resolvedPlan,
        isTrial: resellerIsTrial,
        trialExpiresAt: trialExp,
      });
      return;
    }

    if (membership) {
      const role = roleLabels[membership.role] || membership.role;
      const { data: companyData } = await supabase
        .from("companies")
        .select("plan_type")
        .eq("id", membership.company_id)
        .maybeSingle();

      if (requestId !== fetchSeqRef.current) return;

      const plan: "starter" | "pro" = (companyData as any)?.plan_type === "starter" ? "starter" : "pro";

      applyCompanyState({
        companyId: membership.company_id,
        parentCompanyId: null,
        userRole: role,
        resellerCredits: null,
        planType: plan,
        isTrial: membership.is_trial || false,
        trialExpiresAt: membership.trial_expires_at || null,
      });
      return;
    }

    // Only clear when backend confirms user has no membership context
    if (!membershipRes.error && !resellerRes.error) {
      resetCompanyState(true);
    }
  };

  useEffect(() => {
    const syncAuthState = async (nextSession: Session | null, event?: string) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        const shouldShowBlockingLoader = !hydratedRef.current;
        if (shouldShowBlockingLoader) setLoading(true);

        await fetchCompanyData(nextSession.user.id);

        hydratedRef.current = true;
        if (shouldShowBlockingLoader) setLoading(false);
        return;
      }

      hydratedRef.current = false;
      resetCompanyState(true);
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

  // Realtime: refresh auth context instantly when reseller status/credits change
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
          const reseller = payload.new as { credit_balance: number };
          setResellerCredits(reseller.credit_balance);
          void fetchCompanyData(user.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Realtime: refresh plan/permissions instantly when company plan changes
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
        () => {
          void fetchCompanyData(user.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, companyId]);

  // Safety revalidation: keep permissions up to date if any realtime packet is missed
  useEffect(() => {
    if (!user) return;

    const refresh = () => {
      void fetchCompanyData(user.id);
    };

    const interval = window.setInterval(refresh, 120000); // 2 min instead of 30s
    const onFocus = () => refresh();
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
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
    hydratedRef.current = false;
    resetCompanyState(true);
  };

  const isOwnerOrAdmin = userRole === "Proprietário" || userRole === "Admin";
  const effectivePlanType: "starter" | "pro" = isOwnerOrAdmin ? "pro" : planType;

  return (
    <AuthContext.Provider value={{ session, user, companyId, effectiveCompanyId: companyId, parentCompanyId, userRole, resellerCredits, planType, effectivePlanType, isTrial, trialExpiresAt, loading, signUp, signIn, signOut }}>
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
