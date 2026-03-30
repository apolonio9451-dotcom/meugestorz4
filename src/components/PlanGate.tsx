import { ReactNode } from "react";

interface PlanGateProps {
  children: ReactNode;
  feature?: string;
}

// Plan restrictions removed — all users have full access
export default function PlanGate({ children }: PlanGateProps) {
  return <>{children}</>;
}
