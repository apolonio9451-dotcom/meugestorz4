import { useReseller } from "@/hooks/useReseller";
import { Navigate } from "react-router-dom";

export default function ResellerProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, reseller, loading } = useReseller();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!session) return <Navigate to="/reseller/auth" replace />;
  if (!reseller) return <Navigate to="/reseller/auth" replace />;

  return <>{children}</>;
}
