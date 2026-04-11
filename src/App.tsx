import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { GhostModeProvider } from "@/hooks/useGhostMode";
import ProtectedRoute from "@/components/ProtectedRoute";
import ErrorBoundary from "@/components/ErrorBoundary";
import PlanGate from "@/components/PlanGate";
import DashboardLayout from "@/components/DashboardLayout";
import { Skeleton } from "@/components/ui/skeleton";

// Lazy-loaded pages — only downloaded when the route is visited
const Auth = lazy(() => import("@/pages/Auth"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Clients = lazy(() => import("@/pages/Clients"));
const Plans = lazy(() => import("@/pages/Plans"));
const Subscriptions = lazy(() => import("@/pages/Subscriptions"));
const Servers = lazy(() => import("@/pages/Servers"));
const Financial = lazy(() => import("@/pages/Financial"));
const WinBack = lazy(() => import("@/pages/WinBack"));
const Marketing = lazy(() => import("@/pages/Marketing"));

const Resellers = lazy(() => import("@/pages/Resellers"));
const SettingsPage = lazy(() => import("@/pages/Settings"));
const Messages = lazy(() => import("@/pages/Messages"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const TrialAccess = lazy(() => import("@/pages/TrialAccess"));
const Trials = lazy(() => import("@/pages/Trials"));
const Profile = lazy(() => import("@/pages/Profile"));
const ResellerPanel = lazy(() => import("@/pages/ResellerPanel"));
const Chatbot = lazy(() => import("@/pages/Chatbot"));
const GeneralSettings = lazy(() => import("@/pages/GeneralSettings"));

const PageLoader = () => (
  <div className="flex flex-col gap-4 p-6">
    <Skeleton className="h-8 w-48" />
    <Skeleton className="h-4 w-32" />
    <Skeleton className="h-64 w-full rounded-xl" />
  </div>
);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

const DashboardRoute = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <DashboardLayout>
      <ErrorBoundary>{children}</ErrorBoundary>
    </DashboardLayout>
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <GhostModeProvider>
          <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<DashboardRoute><Dashboard /></DashboardRoute>} />
            <Route path="/dashboard/clients" element={<DashboardRoute><Clients /></DashboardRoute>} />
            <Route path="/dashboard/servers" element={<DashboardRoute><Servers /></DashboardRoute>} />
            <Route path="/dashboard/plans" element={<DashboardRoute><Plans /></DashboardRoute>} />
            <Route path="/dashboard/financial" element={<DashboardRoute><Financial /></DashboardRoute>} />
            <Route path="/dashboard/subscriptions" element={<DashboardRoute><Subscriptions /></DashboardRoute>} />
            <Route path="/dashboard/winback" element={<DashboardRoute><PlanGate feature="Repescagem"><WinBack /></PlanGate></DashboardRoute>} />
            <Route path="/dashboard/marketing" element={<DashboardRoute><Marketing /></DashboardRoute>} />
            
            <Route path="/dashboard/resellers" element={<DashboardRoute><PlanGate feature="Revendedores"><Resellers /></PlanGate></DashboardRoute>} />
            
            <Route path="/dashboard/trials" element={<DashboardRoute><Trials /></DashboardRoute>} />
            <Route path="/dashboard/messages" element={<DashboardRoute><Messages /></DashboardRoute>} />
            <Route path="/dashboard/settings" element={<DashboardRoute><PlanGate feature="Configurações Avançadas"><SettingsPage /></PlanGate></DashboardRoute>} />
            <Route path="/dashboard/general-settings" element={<DashboardRoute><GeneralSettings /></DashboardRoute>} />
            <Route path="/dashboard/chatbot" element={<DashboardRoute><PlanGate feature="Agente IA"><Chatbot /></PlanGate></DashboardRoute>} />
            <Route path="/dashboard/reseller-panel" element={<DashboardRoute><PlanGate feature="Painel de Revenda"><ResellerPanel /></PlanGate></DashboardRoute>} />
            <Route path="/dashboard/profile" element={<DashboardRoute><Profile /></DashboardRoute>} />
            
            <Route path="/trial/:token" element={<TrialAccess />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
          </ErrorBoundary>
          </GhostModeProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
