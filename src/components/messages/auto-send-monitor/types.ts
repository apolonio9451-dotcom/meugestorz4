export interface LogEntry {
  id: string;
  client_name: string;
  category: string;
  status: string;
  error_message: string | null;
  phone: string | null;
  message_sent: string;
  created_at: string;
}

export interface ControlState {
  company_id: string;
  status: "idle" | "running" | "paused" | "stopped" | "error";
  stop_requested: boolean;
  pause_requested: boolean;
  last_action: string;
  last_error: string | null;
  last_error_body: string | null;
  last_activity_at: string | null;
  updated_at?: string;
}

export interface RuntimeEvent {
  id: string;
  level: "info" | "warn" | "error" | "success";
  event_type: string;
  message: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

export const categoryLabels: Record<string, string> = {
  vence_hoje: "Vence Hoje",
  vence_amanha: "Vence Amanhã",
  a_vencer: "A Vencer",
  vencidos: "Vencidos",
  followup: "Follow-up",
  suporte: "Suporte",
  erro_config: "Configuração",
};

export function getCategoryLabel(category: string) {
  if (category.startsWith("repescagem_")) {
    return "Winback";
  }

  return categoryLabels[category] || category;
}

export function isErrorStatus(status: string) {
  return status === "error" || status === "failed";
}

export function isToday(dateString: string) {
  return dateString.startsWith(new Date().toISOString().split("T")[0]);
}

export function formatLogTimestamp(dateString: string) {
  return new Date(dateString).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDetailTimestamp(dateString: string) {
  return new Date(dateString).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function summarizeErrorMessage(message: string | null) {
  if (!message) return "";

  const normalized = message.toLowerCase();

  if (
    normalized.includes("401") ||
    normalized.includes("token") ||
    normalized.includes("sessão expirada") ||
    normalized.includes("ação necessária") ||
    normalized.includes("desconectada")
  ) {
    return "Token inválido ou instância desconectada";
  }

  if (normalized.includes("fetch") || normalized.includes("network")) {
    return "Erro de rede";
  }

  if (message.length > 52) {
    return `${message.slice(0, 52)}…`;
  }

  return message;
}

export function getControlStatusMeta(status?: ControlState["status"] | null) {
  switch (status) {
    case "running":
      return { label: "Em execução", variant: "default" as const };
    case "paused":
      return { label: "Pausado", variant: "secondary" as const };
    case "stopped":
      return { label: "Cancelado", variant: "secondary" as const };
    case "error":
      return { label: "Atenção", variant: "destructive" as const };
    default:
      return { label: "Parado", variant: "outline" as const };
  }
}

export function getLogStatusMeta(status: string) {
  switch (status) {
    case "success":
      return { label: "Concluído", variant: "default" as const };
    case "sending":
      return { label: "Enviando", variant: "secondary" as const };
    case "error":
    case "failed":
      return { label: "Erro", variant: "destructive" as const };
    default:
      return { label: status || "Pendente", variant: "outline" as const };
  }
}