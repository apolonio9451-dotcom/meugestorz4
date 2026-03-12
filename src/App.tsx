import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
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
import UserManagement from "@/pages/UserManagement";

import NotFound from "@/pages/NotFound";
import TrialAccess from "@/pages/TrialAccess";
import Trials from "@/pages/Trials";
import Profile from "@/pages/Profile";
import ResellerPanel from "@/pages/ResellerPanel";
import Chatbot from "@/pages/Chatbot";

const queryClient = new QueryClient();

const DashboardRoute = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <DashboardLayout>{children}</DashboardLayout>
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<DashboardRoute><Dashboard /></DashboardRoute>} />
            <Route path="/dashboard/clients" element={<DashboardRoute><Clients /></DashboardRoute>} />
            <Route path="/dashboard/servers" element={<DashboardRoute><Servers /></DashboardRoute>} />
            <Route path="/dashboard/plans" element={<DashboardRoute><Plans /></DashboardRoute>} />
            <Route path="/dashboard/financial" element={<DashboardRoute><Financial /></DashboardRoute>} />
            <Route path="/dashboard/subscriptions" element={<DashboardRoute><Subscriptions /></DashboardRoute>} />
            <Route path="/dashboard/winback" element={<DashboardRoute><WinBack /></DashboardRoute>} />
            <Route path="/dashboard/marketing" element={<DashboardRoute><Marketing /></DashboardRoute>} />
            <Route path="/dashboard/resellers" element={<DashboardRoute><Resellers /></DashboardRoute>} />
            
            <Route path="/dashboard/trials" element={<DashboardRoute><Trials /></DashboardRoute>} />
            <Route path="/dashboard/messages" element={<DashboardRoute><Messages /></DashboardRoute>} />
            <Route path="/dashboard/settings" element={<DashboardRoute><SettingsPage /></DashboardRoute>} />
            <Route path="/dashboard/chatbot" element={<DashboardRoute><Chatbot /></DashboardRoute>} />
            <Route path="/dashboard/reseller-panel" element={<DashboardRoute><ResellerPanel /></DashboardRoute>} />
            <Route path="/dashboard/profile" element={<DashboardRoute><Profile /></DashboardRoute>} />
            <Route path="/trial/:token" element={<TrialAccess />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
