import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";

interface GhostModeContextType {
  ghostUserId: string | null;
  ghostCompanyId: string | null;
  ghostName: string | null;
  ghostResellerId: string | null;
  isGhostMode: boolean;
  enterGhostMode: (userId: string, companyId: string, name: string, resellerId: string) => void;
  exitGhostMode: () => void;
}

const GhostModeContext = createContext<GhostModeContextType | undefined>(undefined);

const STORAGE_KEY = "ghost_mode";

export function GhostModeProvider({ children }: { children: ReactNode }) {
  const [ghostUserId, setGhostUserId] = useState<string | null>(null);
  const [ghostCompanyId, setGhostCompanyId] = useState<string | null>(null);
  const [ghostName, setGhostName] = useState<string | null>(null);
  const [ghostResellerId, setGhostResellerId] = useState<string | null>(null);

  // Restore from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.userId && parsed.companyId && parsed.name) {
          setGhostUserId(parsed.userId);
          setGhostCompanyId(parsed.companyId);
          setGhostName(parsed.name);
        }
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const enterGhostMode = useCallback((userId: string, companyId: string, name: string) => {
    setGhostUserId(userId);
    setGhostCompanyId(companyId);
    setGhostName(name);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ userId, companyId, name }));
  }, []);

  const exitGhostMode = useCallback(() => {
    setGhostUserId(null);
    setGhostCompanyId(null);
    setGhostName(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <GhostModeContext.Provider
      value={{
        ghostUserId,
        ghostCompanyId,
        ghostName,
        isGhostMode: !!ghostUserId,
        enterGhostMode,
        exitGhostMode,
      }}
    >
      {children}
    </GhostModeContext.Provider>
  );
}

export function useGhostMode() {
  const context = useContext(GhostModeContext);
  if (!context) throw new Error("useGhostMode must be used within GhostModeProvider");
  return context;
}
