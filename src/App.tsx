import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ResellerProvider } from "@/hooks/useReseller";
import ProtectedRoute from "@/components/ProtectedRoute";
import ResellerProtectedRoute from "@/components/ResellerProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import ResellerLayout from "@/components/ResellerLayout";
import Auth from "@/pages/Auth";
import Dashboard from "@/pages/Dashboard";
import Clients from "@/pages/Clients";
import Plans from "@/pages/Plans";
import Subscriptions from "@/pages/Subscriptions";
import Servers from "@/pages/Servers";
import Financial from "@/pages/Financial";
import WinBack from "@/pages/WinBack";
import Marketing from "@/pages/Marketing";
import Resellers from "@/pages/Resellers";
import SettingsPage from "@/pages/Settings";
import Messages from "@/pages/Messages";
import NotFound from "@/pages/NotFound";
import ResellerAuth from "@/pages/reseller/ResellerAuth";
import ResellerDashboard from "@/pages/reseller/ResellerDashboard";
import ResellerClients from "@/pages/reseller/ResellerClients";
import ResellerCredits from "@/pages/reseller/ResellerCredits";

const queryClient = new QueryClient();

const DashboardRoute = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <DashboardLayout>{children}</DashboardLayout>
  </ProtectedRoute>
);

const ResellerRoute = ({ children }: { children: React.ReactNode }) => (
  <ResellerProtectedRoute>
    <ResellerLayout>{children}</ResellerLayout>
  </ResellerProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ResellerProvider>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/dashboard" element={<DashboardRoute><Dashboard /></DashboardRoute>} />
              <Route path="/dashboard/clients" element={<DashboardRoute><Clients /></DashboardRoute>} />
              <Route path="/dashboard/servers" element={<DashboardRoute><Servers /></DashboardRoute>} />
              <Route path="/dashboard/plans" element={<DashboardRoute><Plans /></DashboardRoute>} />
              <Route path="/dashboard/subscriptions" element={<DashboardRoute><Subscriptions /></DashboardRoute>} />
              <Route path="/dashboard/winback" element={<DashboardRoute><WinBack /></DashboardRoute>} />
              <Route path="/dashboard/marketing" element={<DashboardRoute><Marketing /></DashboardRoute>} />
              <Route path="/dashboard/resellers" element={<DashboardRoute><Resellers /></DashboardRoute>} />
              <Route path="/dashboard/messages" element={<DashboardRoute><Messages /></DashboardRoute>} />
              <Route path="/dashboard/settings" element={<DashboardRoute><SettingsPage /></DashboardRoute>} />
              {/* Reseller Panel */}
              <Route path="/reseller/auth" element={<ResellerAuth />} />
              <Route path="/reseller" element={<ResellerRoute><ResellerDashboard /></ResellerRoute>} />
              <Route path="/reseller/clients" element={<ResellerRoute><ResellerClients /></ResellerRoute>} />
              <Route path="/reseller/credits" element={<ResellerRoute><ResellerCredits /></ResellerRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ResellerProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
