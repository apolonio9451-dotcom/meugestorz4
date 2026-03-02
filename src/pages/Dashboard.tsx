import { useAuth } from "@/hooks/useAuth";
import ResellerDashboard from "@/pages/reseller/ResellerDashboard";
import AdminDashboard from "@/components/AdminDashboard";

export default function Dashboard() {
  const { isReseller } = useAuth();

  if (isReseller) {
    return <ResellerDashboard />;
  }

  return <AdminDashboard />;
}
