import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import DashboardSkeleton from "@/components/DashboardSkeleton";

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex bg-background">
        {/* Sidebar placeholder */}
        <div className="hidden lg:block w-64 bg-card/50 border-r border-border/30" />
        <div className="flex-1 p-6">
          <DashboardSkeleton />
        </div>
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;

  return <>{children}</>;
}
