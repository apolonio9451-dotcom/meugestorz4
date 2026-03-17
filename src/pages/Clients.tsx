import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { SlotDatePicker } from "@/components/ui/slot-date-picker";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Plus, Search, MoreVertical, Pencil, Trash2, Clock, Key, X, DollarSign, RefreshCw, MessageCircle, LayoutGrid, Activity, AlertTriangle, History, Handshake, Eye, HeadsetIcon, CheckCircle2, Globe, Package, TvMinimal } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { addDays, addMonths, differenceInCalendarDays, format, parse, parseISO } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";
import SupportCardCountdown from "@/components/clients/SupportCardCountdown";
import { defaultMessageTemplates } from "@/lib/defaultMessageTemplates";

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  whatsapp: string;
  cpf: string;
  notes: string;
  server: string;
  iptv_user: string;
  iptv_password: string;
  address: string;
  status: string;
  created_at: string;
  referred_by: string;
}

interface Subscription {
  id: string;
  client_id: string;
  end_date: string;
  amount: number;
  plan_id: string;
  plan_name?: string;
  payment_status?: string;
}

interface MacKey {
  id?: string;
  mac: string;
  key: string;
  app_name: string;
  expires_at: string;
}

interface Credential {
  id?: string;
  username: string;
  password: string;
  label: string;
}

export default function Clients() {
  const { effectiveCompanyId: companyId, user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [clients, setClients] = useState<Client[]>([]);
  const [subscriptions, setSubscriptions] = useState<Record<string, Subscription>>({});
  const [macKeys, setMacKeys] = useState<Record<string, MacKey[]>>({});
  const [search, setSearch] = useState("");
  const [mainFilter, setMainFilter] = useState<"todos" | "status" | "vencidos" | "pendentes" | "excluidos" | "log">("todos");
  const [statusSubFilter, setStatusSubFilter] = useState<"ativos" | "vence_hoje" | "vence_amanha" | "a_vencer" | "followup" | "suporte">("ativos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [loading, setLoading] = useState(false);
  const [formMacKeys, setFormMacKeys] = useState<MacKey[]>([]);
  const [formCredentials, setFormCredentials] = useState<Credential[]>([{ username: "", password: "", label: "" }]);
  const [plans, setPlans] = useState<{ id: string; name: string; price: number; duration_days: number }[]>([]);
  const [formPlanId, setFormPlanId] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formEndDate, setFormEndDate] = useState<Date | undefined>(undefined);
  const [servers, setServers] = useState<{ id: string; name: string }[]>([]);
  const [formBirthDate, setFormBirthDate] = useState<Date | undefined>(undefined);
  const [messageTemplates, setMessageTemplates] = useState<Record<string, string>>({});
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [welcomeModalOpen, setWelcomeModalOpen] = useState(false);
  const [welcomeData, setWelcomeData] = useState<{
    name: string; planName: string; amount: string; endDate: string; user: string; password: string; whatsapp: string;
  } | null>(null);
  const [formReferredBy, setFormReferredBy] = useState("");
  const [referralSearch, setReferralSearch] = useState("");
  const [macModalClientId, setMacModalClientId] = useState<string | null>(null);
  const [showReferralDropdown, setShowReferralDropdown] = useState(false);
  const [formFollowUpActive, setFormFollowUpActive] = useState(false);
  const [pixKey, setPixKey] = useState("");
  const [renewConfirm, setRenewConfirm] = useState<{ clientId: string; type: "same" | "days" | "months"; days?: number; label: string } | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<{ name: string; whatsapp: string } | null>(null);
  const [pendingSubmitEvent, setPendingSubmitEvent] = useState<React.FormEvent<HTMLFormElement> | null>(null);
  const formRef = useState<HTMLFormElement | null>(null);

  const checkDuplicateWhatsapp = (whatsapp: string) => {
    if (!whatsapp.trim() || !clients.length) {
      setDuplicateWarning(null);
      return;
    }
    const digits = whatsapp.replace(/\D/g, "");
    if (digits.length < 8) { setDuplicateWarning(null); return; }
    const found = clients.find(c => {
      if (editing && c.id === editing.id) return false;
      const cDigits = (c.whatsapp || "").replace(/\D/g, "");
      return cDigits === digits;
    });
    setDuplicateWarning(found ? { name: found.name, whatsapp: found.whatsapp || "" } : null);
  };
  const fetchClients = async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    setClients(data || []);
  };

  const fetchSubscriptions = async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from("client_subscriptions")
      .select("id, client_id, end_date, amount, plan_id, payment_status")
      .eq("company_id", companyId);
    
    if (data) {
      const planIds = [...new Set(data.map(s => s.plan_id))];
      const { data: plans } = await supabase
        .from("subscription_plans")
        .select("id, name")
        .in("id", planIds);
      const planMap = Object.fromEntries((plans || []).map(p => [p.id, p.name]));

      const map: Record<string, Subscription> = {};
      for (const sub of data) {
        if (!map[sub.client_id] || sub.end_date > map[sub.client_id].end_date) {
          map[sub.client_id] = { ...sub, plan_name: planMap[sub.plan_id] || "Plano" };
        }
      }
      setSubscriptions(map);
    }
  };

  const fetchMacKeys = async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from("client_mac_keys")
      .select("id, client_id, mac, key, app_name, expires_at")
      .eq("company_id", companyId);
    
    if (data) {
      const map: Record<string, MacKey[]> = {};
      for (const mk of data) {
        if (!map[mk.client_id]) map[mk.client_id] = [];
        map[mk.client_id].push({ id: mk.id, mac: mk.mac, key: mk.key, app_name: (mk as any).app_name || "", expires_at: (mk as any).expires_at || "" });
      }
      setMacKeys(map);
    }
  };

  const fetchPlans = async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from("subscription_plans")
      .select("id, name, price, duration_days")
      .eq("company_id", companyId)
      .eq("is_active", true);
    setPlans(data || []);
  };

  const fetchServers = async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from("servers")
      .select("id, name")
      .eq("company_id", companyId)
      .order("name");
    setServers(data || []);
  };

  const mapTemplatesFromRows = (rows: { category: string; message: string }[] | null) => {
    const map: Record<string, string> = {};
    (rows || []).forEach((t) => {
      map[t.category] = t.message;
    });
    return map;
  };

  const fetchMessageTemplates = async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from("message_templates")
      .select("category, message")
      .eq("company_id", companyId);

    setMessageTemplates(mapTemplatesFromRows(data));
  };

  const fetchLatestMessageTemplates = async () => {
    if (!companyId) return { ...messageTemplates };

    const { data, error } = await supabase
      .from("message_templates")
      .select("category, message")
      .eq("company_id", companyId);

    if (error) {
      console.error("Erro ao buscar templates atualizados:", error);
      return { ...messageTemplates };
    }

    const freshTemplates = mapTemplatesFromRows(data);
    setMessageTemplates(freshTemplates);
    return freshTemplates;
  };

  const fetchActivityLogs = async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from("client_activity_logs")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(50);
    setActivityLogs(data || []);
  };

  const logActivity = async (action: string, clientName: string, clientId?: string, details?: string) => {
    if (!companyId) return;
    await supabase.from("client_activity_logs").insert({
      company_id: companyId,
      client_id: clientId || null,
      client_name: clientName,
      action,
      details: details || "",
      created_by: user?.id || null,
    });
  };

  const fetchPixKey = async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from("api_settings")
      .select("pix_key")
      .eq("company_id", companyId)
      .maybeSingle();
    if (data) setPixKey(data.pix_key || "");
  };

  useEffect(() => { fetchClients(); fetchSubscriptions(); fetchMacKeys(); fetchPlans(); fetchServers(); fetchMessageTemplates(); fetchActivityLogs(); fetchPixKey(); }, [companyId]);

  // Sync dialog state to URL params and localStorage flag
  const REGISTERING_KEY = `meugestor-is-registering-${companyId}`;

  const setDialogOpenSynced = useCallback((open: boolean) => {
    setDialogOpen(open);
    if (open) {
      setSearchParams(prev => { prev.set("novo", "true"); return prev; }, { replace: true });
      try { localStorage.setItem(REGISTERING_KEY, "true"); } catch {}
    } else {
      setSearchParams(prev => { prev.delete("novo"); return prev; }, { replace: true });
      try { localStorage.removeItem(REGISTERING_KEY); } catch {}
    }
  }, [setSearchParams, REGISTERING_KEY]);

  // Auto-restore modal on mount if URL has ?novo=true or localStorage flag is set
  useEffect(() => {
    const shouldReopen = searchParams.get("novo") === "true" || 
      (() => { try { return localStorage.getItem(REGISTERING_KEY) === "true"; } catch { return false; } })();
    if (shouldReopen && !dialogOpen && !editing) {
      openDialog(); // This will restore draft from localStorage
    }
  }, [companyId]); // Only on mount / companyId change


  useEffect(() => {
    if (!companyId) return;

    const refreshTemplates = () => {
      void fetchMessageTemplates();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshTemplates();
      }
    };

    window.addEventListener("focus", refreshTemplates);
    window.addEventListener("templates-updated", refreshTemplates);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", refreshTemplates);
      window.removeEventListener("templates-updated", refreshTemplates);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [companyId]);

  const normalizeWhatsappPhone = (rawPhone: string) => {
    return (rawPhone || "").replace(/\D/g, "");
  };

  const sanitizeWhatsappMessage = (message: string) =>
    (message || "").replace(/\r\n/g, "\n").normalize("NFC");

  const isMobileWhatsAppClient = () =>
    /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(navigator.userAgent);

  const getWhatsAppSendUrl = (phone: string, message: string) => {
    const normalizedPhone = normalizeWhatsappPhone(phone);
    const whatsappBaseUrl = isMobileWhatsAppClient()
      ? "https://api.whatsapp.com/send"
      : "https://web.whatsapp.com/send";

    return `${whatsappBaseUrl}?phone=${normalizedPhone}&text=${encodeURIComponent(sanitizeWhatsappMessage(message))}`;
  };

  const getMessageCategory = (days: number | null, forcedCategory?: "vencidos" | "vence_hoje" | "vence_amanha" | "a_vencer"): string => {
    if (forcedCategory) return forcedCategory;
    if (days === null) return "vencidos";
    if (days < 0) return "vencidos";
    if (days === 0) return "vence_hoje";
    if (days === 1) return "vence_amanha";
    if (days <= 7) return "a_vencer";
    return "a_vencer";
  };

  const buildCobrancaMessage = (
    client: Client,
    sub: Subscription | undefined,
    days: number | null,
    templatesOverride?: Record<string, string>,
    forcedCategory?: "vencidos" | "vence_hoje" | "vence_amanha" | "a_vencer"
  ): string => {
    const category = getMessageCategory(days, forcedCategory);
    const templateSource = templatesOverride || messageTemplates;
    // Priority: DB custom message > rich defaults
    let msg = templateSource[category] || defaultMessageTemplates[category] || `Olá {primeiro_nome}! Plano: {plano} Valor: R$ {valor}`;
    const clientMks = macKeys[client.id] || [];
    const firstName = (client.name || "").split(" ")[0];
    const now = new Date();
    const brasilHour = (now.getUTCHours() - 3 + 24) % 24;
    const saudacao = brasilHour >= 5 && brasilHour < 12 ? "Bom dia" : brasilHour >= 12 && brasilHour < 18 ? "Boa tarde" : "Boa noite";
    const diasSemana = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    const endDateObj = sub ? parseISO(sub.end_date) : new Date();

    msg = msg
      .replace(/{primeiro_nome}/g, firstName)
      .replace(/{nome}/g, client.name || "")
      .replace(/{saudacao}/g, saudacao)
      .replace(/{dia_semana}/g, diasSemana[endDateObj.getDay()])
      .replace(/{dia}/g, String(endDateObj.getDate()))
      .replace(/{plano}/g, sub?.plan_name || "")
      .replace(/{valor}/g, sub ? Number(sub.amount).toFixed(2).replace(".", ",") : "")
      .replace(/{vencimento}/g, sub ? format(endDateObj, "dd/MM/yyyy") : "")
      .replace(/{dias}/g, days !== null ? String(Math.abs(days)) : "")
      .replace(/{mac}/g, clientMks[0]?.mac || "")
      .replace(/{usuario}/g, client.iptv_user || "")
      .replace(/{senha}/g, client.iptv_password || "")
      .replace(/{servidor}/g, client.server || "")
      .replace(/{sua_chave_pix}/g, pixKey);
    return msg;
  };

  const FORM_STORAGE_KEY = `meugestor-client-form-${companyId}`;

  const saveFormDraft = (data: Record<string, any>) => {
    try { localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(data)); } catch {}
  };

  const loadFormDraft = (): Record<string, any> | null => {
    try {
      const raw = localStorage.getItem(FORM_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  };

  const clearFormDraft = () => {
    try { localStorage.removeItem(FORM_STORAGE_KEY); } catch {}
  };

  // Auto-save form fields on change (only for new clients)
  const autoSaveForm = () => {
    if (editing) return; // don't auto-save when editing existing
    const formEl = document.getElementById("client-form") as HTMLFormElement | null;
    if (!formEl) return;
    const fd = new FormData(formEl);
    const draft: Record<string, any> = {};
    fd.forEach((v, k) => { draft[k] = v; });
    draft._formCredentials = formCredentials;
    draft._formMacKeys = formMacKeys;
    draft._formPlanId = formPlanId;
    draft._formAmount = formAmount;
    draft._formEndDate = formEndDate ? formEndDate.toISOString() : null;
    draft._formBirthDate = formBirthDate ? formBirthDate.toISOString() : null;
    draft._formReferredBy = formReferredBy;
    draft._formFollowUpActive = formFollowUpActive;
    saveFormDraft(draft);
  };

  // Debounced auto-save
  useEffect(() => {
    if (!dialogOpen || editing) return;
    const timer = setTimeout(autoSaveForm, 500);
    return () => clearTimeout(timer);
  }, [dialogOpen, editing, formCredentials, formMacKeys, formPlanId, formAmount, formEndDate, formBirthDate, formReferredBy, formFollowUpActive]);

  const openDialog = (client?: Client) => {
    if (client) {
      setEditing(client);
      setFormMacKeys(macKeys[client.id] || []);
      setFormFollowUpActive((client as any).follow_up_active !== false);
      setFormBirthDate(client.cpf ? (() => { try { return parse(client.cpf, "dd/MM/yyyy", new Date()); } catch { return undefined; } })() : undefined);
      setFormReferredBy(client.referred_by || "");
      setReferralSearch(client.referred_by || "");
      supabase.from("client_credentials").select("id, username, password, label").eq("client_id", client.id).then(({ data }) => {
        if (data && data.length > 0) {
          setFormCredentials(data.map(c => ({ id: c.id, username: c.username, password: c.password, label: c.label || "" })));
        } else {
          setFormCredentials([{ username: client.iptv_user || "", password: client.iptv_password || "", label: "" }]);
        }
      });
      const sub = subscriptions[client.id];
      if (sub) {
        setFormPlanId(sub.plan_id);
        setFormAmount(String(sub.amount));
        setFormEndDate(parseISO(sub.end_date));
      } else {
        setFormPlanId("");
        setFormAmount("");
        setFormEndDate(undefined);
      }
    } else {
      // Restore draft if available
      const draft = loadFormDraft();
      if (draft) {
        setFormCredentials(draft._formCredentials || [{ username: "", password: "", label: "" }]);
        setFormMacKeys(draft._formMacKeys || []);
        setFormPlanId(draft._formPlanId || "");
        setFormAmount(draft._formAmount || "");
        setFormEndDate(draft._formEndDate ? new Date(draft._formEndDate) : undefined);
        setFormBirthDate(draft._formBirthDate ? new Date(draft._formBirthDate) : undefined);
        setFormReferredBy(draft._formReferredBy || "");
        setReferralSearch(draft._formReferredBy || "");
        setFormFollowUpActive(draft._formFollowUpActive || false);
        // Restore native inputs after mount
        setTimeout(() => {
          const formEl = document.getElementById("client-form") as HTMLFormElement | null;
          if (formEl) {
            const fields = ["name", "whatsapp", "email", "cpf", "notes"];
            fields.forEach(f => {
              const input = formEl.querySelector(`[name="${f}"]`) as HTMLInputElement | null;
              if (input && draft[f]) input.value = draft[f];
            });
          }
        }, 100);
      } else {
        setFormMacKeys([]);
        setFormCredentials([{ username: "", password: "", label: "" }]);
        setFormBirthDate(undefined);
        setFormReferredBy("");
        setReferralSearch("");
        setFormFollowUpActive(false);
        setFormPlanId("");
        setFormAmount("");
        setFormEndDate(undefined);
      }
      setEditing(null);
    }
    setDuplicateWarning(null);
    setDuplicateConfirmed(false);
    setPendingSubmitEvent(null);
    setDialogOpenSynced(true);
  };

  const [duplicateConfirmed, setDuplicateConfirmed] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!companyId) return;

    // Check duplicate before proceeding
    const form = new FormData(e.currentTarget);
    const whatsappValue = (form.get("whatsapp") as string || "").replace(/\D/g, "");
    if (whatsappValue.length >= 8 && !duplicateConfirmed) {
      const found = clients.find(c => {
        if (editing && c.id === editing.id) return false;
        return (c.whatsapp || "").replace(/\D/g, "") === whatsappValue;
      });
      if (found) {
        setDuplicateWarning({ name: found.name, whatsapp: found.whatsapp || "" });
        setPendingSubmitEvent(e);
        return;
      }
    }

    setDuplicateConfirmed(false);
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const payload = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      whatsapp: formData.get("whatsapp") as string,
      cpf: formBirthDate ? format(formBirthDate, "dd/MM/yyyy") : "",
      notes: formData.get("notes") as string,
      server: formData.get("server") as string,
      iptv_user: formCredentials[0]?.username || "",
      iptv_password: formCredentials[0]?.password || "",
      phone: "",
      address: "",
      status: "active",
      company_id: companyId,
      referred_by: formReferredBy.trim(),
      follow_up_active: formFollowUpActive,
    };

    let clientId = editing?.id;

    if (editing) {
      const { error } = await supabase.from("clients").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); setLoading(false); return; }
    } else {
      const { data, error } = await supabase.from("clients").insert(payload).select("id").single();
      if (error) { toast.error(error.message); setLoading(false); return; }
      clientId = data.id;
    }

    // Save MAC & KEY entries
    if (clientId) {
      // Delete existing mac keys for this client
      await supabase.from("client_mac_keys").delete().eq("client_id", clientId);
      
      // Insert new ones
      const validMacKeys = formMacKeys.filter(mk => mk.mac.trim() || mk.key.trim() || mk.app_name.trim());
      if (validMacKeys.length > 0) {
        await supabase.from("client_mac_keys").insert(
          validMacKeys.map(mk => ({
            client_id: clientId!,
            company_id: companyId,
            mac: mk.mac.trim(),
            key: mk.key.trim(),
            app_name: mk.app_name.trim(),
            expires_at: mk.expires_at || null,
          } as any))
        );
      }

      // Save credentials
      await supabase.from("client_credentials").delete().eq("client_id", clientId);
      const validCreds = formCredentials.filter(c => c.username.trim() || c.password.trim());
      if (validCreds.length > 0) {
        await supabase.from("client_credentials").insert(
          validCreds.map(c => ({
            client_id: clientId!,
            company_id: companyId,
            username: c.username.trim(),
            password: c.password.trim(),
            label: c.label.trim(),
          }))
        );
      }

      // Save subscription
      if (formPlanId && formEndDate) {
        await supabase.from("client_subscriptions").delete().eq("client_id", clientId);
        await supabase.from("client_subscriptions").insert({
          client_id: clientId!,
          company_id: companyId,
          plan_id: formPlanId,
          amount: parseFloat(formAmount) || 0,
          end_date: format(formEndDate, "yyyy-MM-dd"),
          payment_status: "paid",
        });
      }
    }

    const isNew = !editing;
    const selectedPlan = plans.find(p => p.id === formPlanId);

    clearFormDraft();
    setLoading(false);
    setDialogOpenSynced(false);
    setEditing(null);
    setFormMacKeys([]);
    setFormCredentials([{ username: "", password: "", label: "" }]);
    setFormPlanId("");
    setFormAmount("");
    setFormEndDate(undefined);
    setFormReferredBy("");
    setReferralSearch("");
    fetchClients();
    fetchMacKeys();
    fetchSubscriptions();

    if (isNew) {
      await logActivity("criação", payload.name, clientId, `Plano: ${selectedPlan?.name || "—"}`);
      setWelcomeData({
        name: payload.name,
        planName: selectedPlan?.name || "—",
        amount: formAmount ? parseFloat(formAmount).toFixed(2).replace(".", ",") : "0,00",
        endDate: formEndDate ? format(formEndDate, "dd/MM/yyyy") : "—",
        user: payload.iptv_user,
        password: payload.iptv_password,
        whatsapp: payload.whatsapp,
      });
      setWelcomeModalOpen(true);
    } else {
      await logActivity("edição", payload.name, clientId, "Dados do cliente atualizados");
      toast.success("Cliente atualizado!");
    }
    fetchActivityLogs();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este cliente?")) return;
    const client = clients.find(c => c.id === id);
    const { error } = await supabase.from("clients").update({ status: "excluded" }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Cliente excluído!");
      await logActivity("exclusão", client?.name || "", id, "Cliente movido para excluídos");
      fetchClients(); fetchMacKeys(); fetchActivityLogs();
    }
  };

  const handlePermanentDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja EXCLUIR PERMANENTEMENTE este cliente? Esta ação não pode ser desfeita.")) return;
    const client = clients.find(c => c.id === id);
    // Delete related data first
    await supabase.from("client_mac_keys").delete().eq("client_id", id);
    await supabase.from("client_credentials").delete().eq("client_id", id);
    await supabase.from("client_subscriptions").delete().eq("client_id", id);
    await supabase.from("client_activity_logs").delete().eq("client_id", id);
    await supabase.from("winback_campaign_progress").delete().eq("client_id", id);
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Cliente excluído permanentemente!");
      await logActivity("exclusão_permanente", client?.name || "", null, "Cliente removido definitivamente do sistema");
      fetchClients(); fetchMacKeys(); fetchActivityLogs();
    }
  };

  const handleRestore = async (id: string) => {
    const client = clients.find(c => c.id === id);
    const { error } = await supabase.from("clients").update({ status: "active" }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Cliente restaurado!");
      await logActivity("restauração", client?.name || "", id, "Cliente restaurado dos excluídos");
      fetchClients(); fetchActivityLogs();
    }
  };

  const handleRenew = async (clientId: string, months: number, paid: boolean = true) => {
    const sub = subscriptions[clientId];
    if (!sub) { toast.error("Cliente sem assinatura ativa"); return; }
    const currentEnd = parseISO(sub.end_date);
    const baseDate = currentEnd > new Date() ? currentEnd : new Date();
    const newEnd = addMonths(baseDate, months);
    const { error } = await supabase
      .from("client_subscriptions")
      .update({ end_date: format(newEnd, "yyyy-MM-dd"), payment_status: paid ? "paid" : "pending", updated_at: new Date().toISOString() })
      .eq("id", sub.id);
    if (error) toast.error(error.message);
    else {
      const client = clients.find(c => c.id === clientId);
      await logActivity("renovação", client?.name || "", clientId, `Renovado +${months} mês(es)${!paid ? " (pgto pendente)" : ""}`);
      toast.success(`Renovado por +${months} mês(es)!`); fetchSubscriptions(); fetchActivityLogs();
    }
  };

  const handleRenewSameDate = async (clientId: string, paid: boolean = true) => {
    const sub = subscriptions[clientId];
    if (!sub) { toast.error("Cliente sem assinatura ativa"); return; }
    const currentEnd = parseISO(sub.end_date);
    const dayOfMonth = currentEnd.getDate();
    let newEnd = new Date(currentEnd);
    newEnd.setMonth(newEnd.getMonth() + 1);
    newEnd.setDate(dayOfMonth);
    if (newEnd <= new Date()) {
      newEnd = new Date();
      newEnd.setMonth(newEnd.getMonth() + 1);
      newEnd.setDate(dayOfMonth);
    }
    const { error } = await supabase
      .from("client_subscriptions")
      .update({ end_date: format(newEnd, "yyyy-MM-dd"), payment_status: paid ? "paid" : "pending", updated_at: new Date().toISOString() })
      .eq("id", sub.id);
    if (error) toast.error(error.message);
    else {
      const client = clients.find(c => c.id === clientId);
      await logActivity("renovação", client?.name || "", clientId, `Renovado para dia ${dayOfMonth}${!paid ? " (pgto pendente)" : ""}`);
      toast.success(`Renovado para dia ${dayOfMonth} do próximo mês!`); fetchSubscriptions(); fetchActivityLogs();
    }
  };

  const addMacKey = () => setFormMacKeys([...formMacKeys, { mac: "", key: "", app_name: "", expires_at: "" }]);
  const removeMacKey = (index: number) => setFormMacKeys(formMacKeys.filter((_, i) => i !== index));
  const formatMac = (value: string) => {
    const raw = value.replace(/[^0-9a-fA-F]/g, "").slice(0, 12);
    return raw.match(/.{1,2}/g)?.join(":") || raw;
  };

  const updateMacKey = (index: number, field: "mac" | "key", value: string) => {
    const updated = [...formMacKeys];
    updated[index] = { ...updated[index], [field]: field === "mac" ? formatMac(value) : value };
    setFormMacKeys(updated);
  };

  const getDaysRemaining = (endDate: string) => differenceInCalendarDays(parseISO(endDate), new Date());

  // Separate excluded clients — memoized to prevent re-computation on every render
  const activeClients = useMemo(() => clients.filter(c => c.status !== "excluded"), [clients]);
  const excludedClients = useMemo(() => clients.filter(c => c.status === "excluded"), [clients]);

  const searchLower = useMemo(() => search.toLowerCase(), [search]);

  const searchFiltered = useMemo(() => activeClients.filter(
    (c) => c.name.toLowerCase().includes(searchLower) || (c.whatsapp || "").includes(search) || 
    (macKeys[c.id] || []).some(mk => mk.mac.toLowerCase().includes(searchLower))
  ), [activeClients, searchLower, search, macKeys]);

  const searchFilteredExcluded = useMemo(() => excludedClients.filter(
    (c) => c.name.toLowerCase().includes(searchLower) || (c.whatsapp || "").includes(search)
  ), [excludedClients, searchLower, search]);

  const getClientDays = useCallback((clientId: string) => {
    const sub = subscriptions[clientId];
    return sub ? getDaysRemaining(sub.end_date) : null;
  }, [subscriptions]);

  const getClientActiveDays = useCallback((clientId: string) => {
    const sub = subscriptions[clientId];
    if (!sub) return null;
    const days = getDaysRemaining(sub.end_date);
    if (days === null || days <= 0) return null;
    const client = clients.find(c => c.id === clientId);
    if (!client) return null;
    return differenceInCalendarDays(new Date(), parseISO(client.created_at));
  }, [subscriptions, clients]);

  const filtered = useMemo(() => {
    if (mainFilter === "excluidos") return searchFilteredExcluded;
    if (mainFilter === "log") return [];
    if (mainFilter === "vencidos") return searchFiltered.filter(c => { const d = getClientDays(c.id); return d !== null && d < 0; });
    if (mainFilter === "pendentes") return searchFiltered.filter(c => { const sub = subscriptions[c.id]; return sub && sub.payment_status === "pending"; });
    if (mainFilter === "status") {
      return searchFiltered.filter((c) => {
        const days = getClientDays(c.id);
        switch (statusSubFilter) {
          case "ativos": return days !== null && days > 0;
          case "vence_hoje": return days !== null && days === 0;
          case "vence_amanha": return days !== null && days === 1;
          case "a_vencer": return days !== null && days === 3;
          case "followup": {
            const activeDays = getClientActiveDays(c.id);
            return activeDays !== null && activeDays >= 15 && (c as any).follow_up_active !== false;
          }
          case "suporte": {
            const supportDate = (c as any).support_started_at;
            return !!supportDate;
          }
          default: return true;
        }
      });
    }
    return searchFiltered; // "todos"
  }, [mainFilter, statusSubFilter, searchFiltered, searchFilteredExcluded, subscriptions, getClientDays, getClientActiveDays]);

  const filterCounts = useMemo(() => ({
    todos: activeClients.length,
    vencidos: searchFiltered.filter(c => { const d = getClientDays(c.id); return d !== null && d < 0; }).length,
    pendentes: searchFiltered.filter(c => { const sub = subscriptions[c.id]; return sub && sub.payment_status === "pending"; }).length,
    excluidos: excludedClients.length,
    ativos: searchFiltered.filter(c => { const d = getClientDays(c.id); return d !== null && d > 0; }).length,
    vence_hoje: searchFiltered.filter(c => getClientDays(c.id) === 0).length,
    vence_amanha: searchFiltered.filter(c => getClientDays(c.id) === 1).length,
    a_vencer: searchFiltered.filter(c => { const d = getClientDays(c.id); return d === 3; }).length,
    followup: searchFiltered.filter(c => { const ad = getClientActiveDays(c.id); return ad !== null && ad >= 15 && (c as any).follow_up_active !== false; }).length,
    suporte: searchFiltered.filter(c => !!(c as any).support_started_at).length,
  }), [activeClients, excludedClients, searchFiltered, subscriptions, getClientDays, getClientActiveDays]);

  // Progressive loading: show first BATCH_SIZE items, load more on scroll
  const BATCH_SIZE = 30;
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset visible count when filter changes
  useEffect(() => { setVisibleCount(BATCH_SIZE); }, [mainFilter, statusSubFilter, search]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && visibleCount < filtered.length) {
          setVisibleCount(prev => Math.min(prev + BATCH_SIZE, filtered.length));
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [visibleCount, filtered.length]);

  const visibleFiltered = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);

  const mainBlocks = [
    { key: "todos" as const, label: "Todos", icon: LayoutGrid, count: filterCounts.todos },
    { key: "status" as const, label: "Status", icon: Activity, count: filterCounts.ativos },
    { key: "vencidos" as const, label: "Vencidos", icon: AlertTriangle, count: filterCounts.vencidos },
    { key: "pendentes" as const, label: "Pendentes", icon: Clock, count: filterCounts.pendentes },
    { key: "excluidos" as const, label: "Excluídos", icon: Trash2, count: filterCounts.excluidos },
    { key: "log" as const, label: "Log", icon: History, count: activityLogs.length },
  ];

  const statusSubFilters = [
    { key: "ativos" as const, label: "Ativos", count: filterCounts.ativos, color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    { key: "vence_hoje" as const, label: "Vence Hoje", count: filterCounts.vence_hoje, color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
    { key: "vence_amanha" as const, label: "Vence Amanhã", count: filterCounts.vence_amanha, color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
    { key: "a_vencer" as const, label: "A Vencer", count: filterCounts.a_vencer, color: "bg-yellow-600/20 text-yellow-500 border-yellow-600/30" },
    { key: "followup" as const, label: "Follow-up", count: filterCounts.followup, color: "bg-cyan-400/20 text-cyan-400 border-cyan-400/50" },
    { key: "suporte" as const, label: "Suporte", count: filterCounts.suporte, color: "bg-violet-400/20 text-violet-400 border-violet-400/50" },
  ];

  const getBarColor = (days: number) => {
    if (days < 0) return "bg-destructive/60";
    if (days === 0) return "bg-orange-500";
    if (days <= 7) return "bg-yellow-500";
    return "bg-emerald-500";
  };

  const getBarTrackColor = (days: number) => {
    if (days < 0) return "bg-destructive/20";
    if (days === 0) return "bg-orange-500/20";
    if (days <= 7) return "bg-yellow-500/20";
    return "bg-emerald-500/20";
  };

  const getBarPercent = (days: number, max: number = 30) => {
    if (days <= 0) return 100;
    return Math.min(100, (days / max) * 100);
  };

  const getDaysLabel = (days: number) => {
    if (days < 0) return "Vencido";
    if (days === 0) return "Vence hoje";
    if (days === 1) return "1 dia restante";
    return `${days} dias restantes`;
  };

  const getExpiryBadge = (days: number) => {
    if (days < 0) return <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-[10px] font-bold uppercase">Vencido</Badge>;
    if (days === 0) return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-[10px] font-bold uppercase">Vence Hoje</Badge>;
    if (days === 1) return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[10px] font-bold uppercase">Vence Amanhã</Badge>;
    if (days === 3) return <Badge className="bg-yellow-600/20 text-yellow-500 border-yellow-600/30 text-[10px] font-bold uppercase">A Vencer ({days}D)</Badge>;
    return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] font-bold uppercase">Ativo</Badge>;
  };

  return (
    <div className="space-y-3 sm:space-y-6 animate-page-enter">
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpenSynced(o); if (!o) { if (!editing) clearFormDraft(); setEditing(null); setFormMacKeys([]); setFormCredentials([{ username: "", password: "", label: "" }]); setFormPlanId(""); setFormAmount(""); setFormEndDate(undefined); setFormBirthDate(undefined); setFormReferredBy(""); setReferralSearch(""); } }}>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Buscar por nome, WhatsApp ou MAC..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <DialogTrigger asChild>
              <Button size="icon" className="h-9 w-9 rounded-full shrink-0" onClick={() => openDialog()}><Plus className="w-5 h-5" /></Button>
            </DialogTrigger>
          </div>
          <DialogContent className="max-w-xl max-h-[98vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle className="text-base">{editing ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
            </DialogHeader>
            <form id="client-form" onSubmit={handleSubmit} onChange={() => { if (!editing) setTimeout(autoSaveForm, 300); }} className="space-y-5 overflow-y-auto max-h-[calc(98vh-80px)] scrollbar-hide">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Dados Pessoais</p>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm">Nome *</Label>
                    <Input name="name" required autoFocus placeholder="Nome completo" defaultValue={editing?.name || ""} className="h-10 text-[16px] md:text-sm border-primary/20 focus:border-primary/50" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-sm">WhatsApp *</Label>
                      <Input 
                        name="whatsapp" 
                        required 
                        type="tel"
                        inputMode="numeric"
                        placeholder="5521999990000" 
                        defaultValue={editing?.whatsapp || ""} 
                        className={cn("h-10 text-sm border-primary/20 focus:border-primary/50", duplicateWarning && "border-destructive")}
                        onChange={(e) => checkDuplicateWhatsapp(e.target.value)}
                      />
                      {duplicateWarning && (
                        <p className="text-xs text-destructive flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Contato já cadastrado em: <strong>{duplicateWarning.name}</strong>
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Email</Label>
                      <Input name="email" type="email" placeholder="email@ex.com" defaultValue={editing?.email || ""} className="h-10 text-sm border-primary/20 focus:border-primary/50" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-sm">CPF</Label>
                      <Input name="cpf" inputMode="numeric" placeholder="000.000.000-00" defaultValue={editing?.cpf || ""} className="h-10 text-sm border-primary/20 focus:border-primary/50" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Nascimento</Label>
                      <SlotDatePicker date={formBirthDate} onDateChange={setFormBirthDate} placeholder="Selecione..." fromYear={1940} toYear={new Date().getFullYear()} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5 relative">
                      <Label className="text-sm">Indicado por</Label>
                      <Input
                        placeholder="Nome..."
                        value={referralSearch}
                        onChange={(e) => {
                          setReferralSearch(e.target.value);
                          setFormReferredBy(e.target.value);
                          setShowReferralDropdown(true);
                        }}
                        onFocus={() => setShowReferralDropdown(true)}
                        onBlur={() => setTimeout(() => setShowReferralDropdown(false), 200)}
                        className="h-10 text-sm border-primary/20 focus:border-primary/50"
                      />
                      {showReferralDropdown && referralSearch.length > 0 && (() => {
                        const matches = activeClients.filter(c => 
                          c.name.toLowerCase().includes(referralSearch.toLowerCase()) &&
                          c.id !== editing?.id
                        ).slice(0, 5);
                        if (matches.length === 0) return null;
                        return (
                          <div className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-md shadow-lg max-h-28 overflow-y-auto">
                            {matches.map(c => (
                              <button
                                key={c.id}
                                type="button"
                                className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors"
                                onMouseDown={() => {
                                  setFormReferredBy(c.name);
                                  setReferralSearch(c.name);
                                  setShowReferralDropdown(false);
                                }}
                              >
                                {c.name}
                              </button>
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Observações</Label>
                      <Input name="notes" placeholder="Notas internas..." defaultValue={editing?.notes || ""} className="h-10 text-sm border-primary/20 focus:border-primary/50" />
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Acesso ao Portal</p>
                <div className="space-y-3">
                  {formCredentials.map((cred, i) => (
                    <div key={i} className="p-3 rounded-lg border border-primary/15 bg-primary/5">
                      <div className="flex gap-2">
                        <div className="flex-1 space-y-2">
                          {formCredentials.length > 1 && (
                            <Input
                              placeholder="Rótulo (ex: TV Sala, Celular...)"
                              value={cred.label}
                              onChange={(e) => {
                                const updated = [...formCredentials];
                                updated[i] = { ...updated[i], label: e.target.value };
                                setFormCredentials(updated);
                              }}
                              className="h-9 text-sm border-primary/20 focus:border-primary/50"
                            />
                          )}
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              placeholder="Usuário"
                              value={cred.username}
                              onChange={(e) => {
                                const updated = [...formCredentials];
                                updated[i] = { ...updated[i], username: e.target.value };
                                setFormCredentials(updated);
                              }}
                              required={i === 0}
                              className="h-9 text-sm border-primary/20 focus:border-primary/50"
                            />
                            <Input
                              placeholder="Senha"
                              value={cred.password}
                              onChange={(e) => {
                                const updated = [...formCredentials];
                                updated[i] = { ...updated[i], password: e.target.value };
                                setFormCredentials(updated);
                              }}
                              className="h-9 text-sm border-primary/20 focus:border-primary/50"
                            />
                          </div>
                        </div>
                        {formCredentials.length > 1 && (
                          <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 self-center" onClick={() => setFormCredentials(formCredentials.filter((_, idx) => idx !== i))}>
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => setFormCredentials([...formCredentials, { username: "", password: "", label: "" }])}>
                    <Plus className="w-3 h-3 mr-1" /> Adicionar Usuário
                  </Button>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Assinatura</p>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-sm">Servidor *</Label>
                    <Select name="server" defaultValue={editing?.server || ""}>
                      <SelectTrigger className="h-10 text-sm border-primary/20 focus:border-primary/50"><SelectValue placeholder="Selecione o servidor" /></SelectTrigger>
                      <SelectContent className="z-[9999]" position="popper" sideOffset={4}>
                        {servers.map(s => (
                          <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-sm text-primary font-semibold">Plano *</Label>
                      <Select value={formPlanId} onValueChange={(v) => {
                        console.log("[Plan Select] selected:", v);
                        try {
                          setFormPlanId(v);
                          const plan = plans.find(p => p.id === v);
                          if (plan) {
                            setFormAmount(String(plan.price ?? 0));
                            const days = plan.duration_days ?? 30;
                            const newDate = addDays(new Date(), days);
                            if (newDate && !isNaN(newDate.getTime())) {
                              setFormEndDate(newDate);
                            } else {
                              setFormEndDate(addDays(new Date(), 30));
                            }
                          }
                        } catch (err) {
                          console.error("[Plan Select] Error:", err);
                          setFormEndDate(addDays(new Date(), 30));
                        }
                      }}>
                        <SelectTrigger className="h-10 text-sm border-primary/30 focus:ring-primary/40"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent className="z-[9999]" position="popper" sideOffset={4}>
                          {plans.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm text-primary font-semibold">Valor (R$) *</Label>
                      <Input
                        value={formAmount}
                        onChange={(e) => setFormAmount(e.target.value)}
                        placeholder="30.00"
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        className="h-10 text-sm border-primary/30 focus:ring-primary/40"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm">Vencimento *</Label>
                    <SlotDatePicker date={formEndDate} onDateChange={setFormEndDate} placeholder="Data..." />
                  </div>
                </div>
              </div>
              <div>
                <p className="text-[11px] italic font-medium text-muted-foreground/70 uppercase tracking-wider mb-3">APP · MAC & KEY</p>
                <div className="space-y-3">
                  {formMacKeys.map((mk, i) => (
                    <div key={i} className="p-3 rounded-lg border border-primary/15 bg-primary/5">
                      <div className="flex gap-2">
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <Input
                            placeholder="Nome do App"
                            value={mk.app_name}
                            onChange={(e) => {
                              const updated = [...formMacKeys];
                              updated[i] = { ...updated[i], app_name: e.target.value };
                              setFormMacKeys(updated);
                            }}
                            className="h-9 text-sm border-primary/20 focus:border-primary/50"
                          />
                          <SlotDatePicker
                            date={mk.expires_at ? parseISO(mk.expires_at) : undefined}
                            onDateChange={(d) => {
                              const updated = [...formMacKeys];
                              updated[i] = { ...updated[i], expires_at: d ? format(d, "yyyy-MM-dd") : "" };
                              setFormMacKeys(updated);
                            }}
                            placeholder="Expiração..."
                          />
                          <Input
                            placeholder="MAC Address"
                            value={mk.mac}
                            onChange={(e) => {
                              const updated = [...formMacKeys];
                              updated[i] = { ...updated[i], mac: formatMac(e.target.value) };
                              setFormMacKeys(updated);
                            }}
                            className="h-9 text-sm border-primary/20 focus:border-primary/50"
                          />
                          <Input
                            placeholder="KEY"
                            value={mk.key}
                            onChange={(e) => {
                              const updated = [...formMacKeys];
                              updated[i] = { ...updated[i], key: e.target.value };
                              setFormMacKeys(updated);
                            }}
                            className="h-9 text-sm border-primary/20 focus:border-primary/50"
                          />
                        </div>
                        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 self-center" onClick={() => setFormMacKeys(formMacKeys.filter((_, idx) => idx !== i))}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => setFormMacKeys([...formMacKeys, { mac: "", key: "", app_name: "", expires_at: "" }])}>
                    <Plus className="w-3 h-3 mr-1" /> Adicionar MAC
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border border-primary/15 bg-primary/5">
                <div>
                  <Label className="text-sm font-medium">Ativar Follow-up Automático?</Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Se ativo, o cliente aparecerá na lista de acompanhamento 15 dias após o cadastro.</p>
                </div>
                <Switch checked={formFollowUpActive} onCheckedChange={setFormFollowUpActive} />
              </div>
              <Button type="submit" disabled={loading} className="w-full h-11 text-sm">{loading ? "Salvando..." : editing ? "Salvar" : "Cadastrar"}</Button>
            </form>
          </DialogContent>
      </Dialog>

      <div className="grid grid-cols-6 gap-2">
        {mainBlocks.map((block) => {
          const Icon = block.icon;
          const isActive = mainFilter === block.key;
          return (
            <button
              key={block.key}
              onClick={() => setMainFilter(block.key)}
              className={cn(
                "relative flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl border text-[11px] font-semibold transition-all duration-300",
                isActive
                  ? "bg-primary/15 border-primary/40 text-primary shadow-[0_0_12px_-3px_hsl(var(--primary)/0.4)]"
                  : "bg-card border-border/30 text-muted-foreground hover:bg-muted/50 hover:border-primary/20"
              )}
            >
              {block.count > 0 && (
                <span className={cn(
                  "absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-bold px-1 shadow-sm",
                  block.key === "log"
                    ? "bg-muted text-muted-foreground"
                    : "bg-primary text-primary-foreground"
                )}>
                  {block.count}
                </span>
              )}
              <Icon className="w-5 h-5" />
              <span className="truncate max-w-full">{block.label}</span>
            </button>
          );
        })}
      </div>

      {/* Status sub-filters (only visible when Status is selected) */}
      {mainFilter === "status" && (
        <div className="flex gap-2 flex-wrap sm:flex-nowrap sm:overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
          {statusSubFilters.map((sf) => {
            const isActive = statusSubFilter === sf.key;
            return (
              <button
                key={sf.key}
                onClick={() => setStatusSubFilter(sf.key)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border whitespace-nowrap transition-all duration-300 shrink-0",
                  isActive
                    ? sf.color + " ring-1 ring-current shadow-[0_0_10px_-3px_currentColor]"
                    : "bg-card text-muted-foreground border-border/30 hover:bg-muted/50"
                )}
              >
                {sf.label}
                {sf.count > 0 && (
                  <span className={cn(
                    "inline-flex items-center justify-center min-w-[16px] h-[16px] rounded-full text-[10px] font-bold px-1",
                    isActive ? "bg-current/20" : "bg-muted"
                  )}>
                    {sf.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Follow-up info text */}
      {mainFilter === "status" && statusSubFilter === "followup" && (
        <p className="text-xs text-muted-foreground bg-cyan-400/5 border border-cyan-400/20 rounded-lg px-3 py-2">
          📋 <span className="font-semibold text-cyan-400">Follow-up</span> — Exibe clientes ativos com 15 dias ou mais de cadastro. Ideal para acompanhamento e fidelização após o período inicial.
        </p>
      )}

      {/* Suporte info text */}
      {mainFilter === "status" && statusSubFilter === "suporte" && (
        <p className="text-xs text-muted-foreground bg-violet-400/5 border border-violet-400/20 rounded-lg px-3 py-2">
          🎧 <span className="font-semibold text-violet-400">Suporte</span> — Clientes encaminhados para check-up de satisfação. Aparecem aqui 48h após serem enviados ao suporte. Foque na experiência, não em vendas.
        </p>
      )}

      {/* Log view */}
      {mainFilter === "log" ? (
        <div className="space-y-2">
          {activityLogs.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">Nenhum registro de atividade</p>
          ) : (
            <ScrollArea className="h-[60vh]">
              <div className="space-y-2 pr-2">
                {activityLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/30 bg-card">
                    <History className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        <span className="text-primary">{log.client_name}</span>
                        {" — "}
                        <span className="text-muted-foreground">{log.action}</span>
                      </p>
                      {log.details && <p className="text-xs text-muted-foreground mt-0.5">{log.details}</p>}
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        {format(parseISO(log.created_at), "dd/MM/yyyy HH:mm")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">Nenhum cliente encontrado</p>
      ) : (
        <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleFiltered.map((client) => {
            const sub = subscriptions[client.id];
            const days = sub ? getDaysRemaining(sub.end_date) : null;
            const clientMacKeys = macKeys[client.id] || [];

            const neonColor = days === null
              ? "border-muted-foreground/20 shadow-[0_0_12px_-3px_hsl(var(--muted-foreground)/0.15)] hover:shadow-[0_0_20px_-3px_hsl(var(--muted-foreground)/0.3)]"
              : days < 0
                ? "border-destructive/30 shadow-[0_0_12px_-3px_hsl(var(--destructive)/0.3)] hover:shadow-[0_0_20px_-3px_hsl(var(--destructive)/0.5)]"
                : days === 0
                  ? "border-orange-500/30 shadow-[0_0_12px_-3px_rgb(249_115_22/0.3)] hover:shadow-[0_0_20px_-3px_rgb(249_115_22/0.5)]"
                  : days <= 7
                    ? "border-yellow-500/30 shadow-[0_0_12px_-3px_rgb(234_179_8/0.3)] hover:shadow-[0_0_20px_-3px_rgb(234_179_8/0.5)]"
                    : "border-emerald-500/30 shadow-[0_0_12px_-3px_rgb(16_185_129/0.3)] hover:shadow-[0_0_20px_-3px_rgb(16_185_129/0.5)]";

            return (
              <div
                key={client.id}
                className={`rounded-xl border bg-card relative overflow-hidden transition-all duration-300 ${neonColor}`}
              >
                {/* Header: Name + badge + menu */}
                <div className="px-3.5 pt-3.5 pb-2 sm:px-4 sm:pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-display font-bold text-foreground text-sm leading-tight truncate">{client.name}</h3>
                        {days !== null && getExpiryBadge(days)}
                      </div>
                      {client.iptv_user && (
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5">@{client.iptv_user}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      {clientMacKeys.length > 0 && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => setMacModalClientId(client.id)}>
                          <Eye className="w-[18px] h-[18px]" />
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"><MoreVertical className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openDialog(client)}><Pencil className="w-3.5 h-3.5 mr-2" /> Editar</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {client.status === "excluded" ? (
                            <>
                              <DropdownMenuItem onClick={() => handleRestore(client.id)}>
                                <RefreshCw className="w-3.5 h-3.5 mr-2 text-emerald-500" /> Restaurar
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => handlePermanentDelete(client.id)}>
                                <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir Permanentemente
                              </DropdownMenuItem>
                            </>
                          ) : (
                            <>
                              {mainFilter === "status" && statusSubFilter === "suporte" ? (
                                <DropdownMenuItem onClick={async () => {
                                  const { error } = await supabase.from("clients").update({ support_started_at: null } as any).eq("id", client.id);
                                  if (error) toast.error("Erro ao finalizar suporte");
                                  else {
                                    toast.success(`Suporte finalizado para ${client.name}`);
                                    await logActivity("suporte_finalizado", client.name, client.id, "Check-up de satisfação realizado");
                                    fetchClients(); fetchActivityLogs();
                                  }
                                }}><CheckCircle2 className="w-3.5 h-3.5 mr-2 text-green-500" /> Finalizar Suporte</DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={async () => {
                                  const { error } = await supabase.from("clients").update({ support_started_at: new Date().toISOString() } as any).eq("id", client.id);
                                  if (error) toast.error("Erro ao enviar para suporte");
                                  else {
                                    toast.success(`${client.name} enviado para Suporte`);
                                    await logActivity("suporte", client.name, client.id, "Cliente encaminhado para check-up de suporte");
                                    fetchClients(); fetchActivityLogs();
                                  }
                                }}><HeadsetIcon className="w-3.5 h-3.5 mr-2" /> Enviar para Suporte</DropdownMenuItem>
                              )}
                              <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(client.id)}><Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir</DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>

                {/* Details section */}
                <div className="px-3.5 pb-2 sm:px-4 space-y-2">
                  {/* Info chips row */}
                  <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                    {client.server && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground font-medium">
                        <Globe className="w-2.5 h-2.5" /> {client.server}
                      </span>
                    )}
                    {sub && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary font-semibold border border-primary/15">
                        <Package className="w-2.5 h-2.5" /> {sub.plan_name} · R$ {Number(sub.amount).toFixed(2).replace(".", ",")}
                      </span>
                    )}
                    {client.referred_by && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground font-medium">
                        <Handshake className="w-2.5 h-2.5" /> {client.referred_by}
                      </span>
                    )}
                  </div>

                  {/* App names */}
                  {clientMacKeys.some(mk => mk.app_name) && (
                    <div className="flex items-center gap-1 flex-wrap">
                      {clientMacKeys.map((mk, i) => mk.app_name && (
                        <Badge key={mk.id || i} variant="outline" className="text-[9px] h-5 bg-muted/30 text-muted-foreground border-border/40 font-medium px-1.5 gap-1">
                          <TvMinimal className="w-2.5 h-2.5" /> {mk.app_name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Progress bar + date */}
                {days !== null && sub && (
                  <div className="px-3.5 pb-2 sm:px-4">
                    <div className={cn("w-full h-1 rounded-full overflow-hidden", getBarTrackColor(days))}>
                      <div className={`h-full rounded-full transition-all ${getBarColor(days)}`} style={{ width: `${getBarPercent(days)}%` }} />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className={cn("text-[10px] font-medium", days < 0 ? "text-destructive" : days === 0 ? "text-orange-400" : days <= 7 ? "text-yellow-400" : "text-emerald-400")}>
                        {getDaysLabel(days)}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {format(parseISO(sub.end_date), "dd/MM/yyyy")}
                      </span>
                    </div>
                  </div>
                )}

                {/* Individual 48h countdown for support clients */}
                {mainFilter === "status" && statusSubFilter === "suporte" && (client as any).support_started_at && (
                  <SupportCardCountdown supportStartedAt={(client as any).support_started_at} />
                )}

                {/* Action button */}
                {client.whatsapp && (
                  <div className="border-t border-border/30">
                    {mainFilter === "status" && statusSubFilter === "suporte" && (client as any).support_started_at ? (
                      <div className="flex">
                        <a
                          href={getWhatsAppSendUrl(
                            client.whatsapp,
                            (() => {
                              let msg = messageTemplates["suporte"] || defaultMessageTemplates.suporte;
                              msg = msg
                                .replace(/{nome}/g, client.name || "")
                                .replace(/{plano}/g, sub?.plan_name || "")
                                .replace(/{valor}/g, sub ? Number(sub.amount).toFixed(2).replace(".", ",") : "")
                                .replace(/{vencimento}/g, sub ? format(parseISO(sub.end_date), "dd/MM/yyyy") : "")
                                .replace(/{usuario}/g, client.iptv_user || "")
                                .replace(/{senha}/g, client.iptv_password || "")
                                .replace(/{servidor}/g, client.server || "");
                              return msg;
                            })()
                          )}
                          target="_blank" rel="noopener noreferrer"
                          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 text-violet-400 hover:bg-violet-500/10 transition-all text-xs font-bold"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <HeadsetIcon className="w-3.5 h-3.5" />
                          Enviar Check-up
                        </a>
                        <button
                          className="px-4 py-2.5 text-xs text-emerald-400 hover:bg-emerald-500/10 transition-all font-bold border-l border-border/30 inline-flex items-center gap-1"
                          onClick={async (e) => {
                            e.stopPropagation();
                            const { error } = await supabase.from("clients").update({ support_started_at: null } as any).eq("id", client.id);
                            if (error) toast.error("Erro ao finalizar suporte");
                            else {
                              toast.success(`Suporte finalizado para ${client.name}`);
                              await logActivity("suporte_finalizado", client.name, client.id, "Check-up de satisfação realizado");
                              fetchClients(); fetchActivityLogs();
                            }
                          }}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Finalizar
                        </button>
                      </div>
                    ) : (
                      <div className="flex">
                        <button
                          className="w-1/2 inline-flex items-center justify-center gap-1.5 py-2.5 text-emerald-400 hover:bg-emerald-500/10 transition-all text-xs font-bold"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();

                            const phone = normalizeWhatsappPhone(client.whatsapp);
                            if (!phone) {
                              toast.error("WhatsApp inválido para este cliente.");
                              return;
                            }

                            const isMobileDevice = isMobileWhatsAppClient();

                            // Desktop: abre popup imediatamente para preservar gesto do usuário
                            const popup = !isMobileDevice
                              ? window.open("about:blank", "_blank")
                              : null;

                            // Evita acesso reverso ao opener sem perder referência do popup
                            if (popup) {
                              try {
                                popup.opener = null;
                              } catch {
                                // noop
                              }
                            }

                            const forcedCategory =
                              mainFilter === "vencidos"
                                ? "vencidos"
                                : mainFilter === "status" && ["vence_hoje", "vence_amanha", "a_vencer"].includes(statusSubFilter)
                                  ? (statusSubFilter as "vence_hoje" | "vence_amanha" | "a_vencer")
                                  : undefined;

                            (async () => {
                              try {
                                const freshTemplates = await fetchLatestMessageTemplates();
                                const currentDays = sub ? getDaysRemaining(sub.end_date) : null;
                                const msg = buildCobrancaMessage(client, sub, currentDays, freshTemplates, forcedCategory);
                                const url = getWhatsAppSendUrl(phone, msg);

                                if (isMobileDevice) {
                                  window.location.href = url;
                                  return;
                                }

                                if (popup && !popup.closed) {
                                  popup.location.replace(url);
                                } else {
                                  // fallback confiável caso o navegador não retorne referência do popup
                                  window.location.href = url;
                                }
                              } catch (error) {
                                console.error("Erro ao gerar cobrança manual:", error);
                                if (popup) popup.close();
                                toast.error("Não foi possível abrir o WhatsApp. Tente novamente.");
                              }
                            })();
                          }}
                        >
                          <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.944 11.944 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.386 0-4.586-.826-6.32-2.208l-.442-.362-3.263 1.093 1.093-3.263-.362-.442A9.956 9.956 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/></svg>
                          Cobrar
                        </button>
                        {sub && mainFilter === "pendentes" ? (
                          <button
                            className="w-1/2 py-2.5 text-xs text-primary hover:bg-primary/10 transition-all font-bold border-l border-border/30 inline-flex items-center justify-center gap-1.5"
                            onClick={async (e) => {
                              e.stopPropagation();
                              const { error } = await supabase
                                .from("client_subscriptions")
                                .update({ payment_status: "paid", updated_at: new Date().toISOString() })
                                .eq("id", sub.id);
                              if (error) toast.error(error.message);
                              else {
                                await logActivity("pagamento_confirmado", client.name, client.id, `Pagamento confirmado - R$ ${Number(sub.amount).toFixed(2)}`);
                                toast.success(`Pagamento de ${client.name} confirmado!`);
                                fetchSubscriptions();
                                fetchActivityLogs();
                              }
                            }}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Confirmar Pgto
                          </button>
                        ) : sub ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                className="w-1/2 py-2.5 text-xs text-primary hover:bg-primary/10 transition-all font-bold border-l border-border/30 inline-flex items-center justify-center gap-1.5"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                Renovar
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setRenewConfirm({ clientId: client.id, type: "same", label: "Renovar mesma data" })}><RefreshCw className="w-3.5 h-3.5 mr-2" /> Renovar mesma data</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setRenewConfirm({ clientId: client.id, type: "months", days: 1, label: "Renovar +1 mês" })}><RefreshCw className="w-3.5 h-3.5 mr-2" /> Renovar +1 mês</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setRenewConfirm({ clientId: client.id, type: "months", days: 2, label: "Renovar +2 meses" })}><RefreshCw className="w-3.5 h-3.5 mr-2" /> Renovar +2 meses</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setRenewConfirm({ clientId: client.id, type: "months", days: 3, label: "Renovar +3 meses" })}><RefreshCw className="w-3.5 h-3.5 mr-2" /> Renovar +3 meses</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Welcome Modal */}
      <Dialog open={welcomeModalOpen} onOpenChange={setWelcomeModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <MessageCircle className="h-5 w-5 text-primary" />
              Cliente Criado!
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Envie uma mensagem de boas-vindas via WhatsApp com os dados de acesso.
            </p>
          </DialogHeader>

          {welcomeData && (
            <div className="rounded-lg border bg-muted/50 p-4 space-y-1 text-sm">
              <p>Cliente: <strong>{welcomeData.name}</strong></p>
              <p>Plano: <strong>{welcomeData.planName}</strong></p>
              <p>Valor: <strong>R$ {welcomeData.amount}</strong></p>
              <p>Vencimento: <strong>{welcomeData.endDate}</strong></p>
              <p>Usuário: <strong>{welcomeData.user || "—"}</strong></p>
              <p>Senha: <strong>{welcomeData.password || "—"}</strong></p>
            </div>
          )}

          <div className="flex flex-col gap-2 mt-2">
            <Button
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={() => {
                if (welcomeData?.whatsapp) {
                  const msg = `Olá ${welcomeData.name}! 🎉\n\nSeus dados de acesso:\n\n📋 Plano: ${welcomeData.planName}\n💰 Valor: R$ ${welcomeData.amount}\n📅 Vencimento: ${welcomeData.endDate}\n👤 Usuário: ${welcomeData.user || "—"}\n🔑 Senha: ${welcomeData.password || "—"}\n\nBem-vindo!`;
                  
                  const url = getWhatsAppSendUrl(welcomeData.whatsapp, msg);
                  window.open(url, "_blank");
                } else {
                  toast.error("WhatsApp não informado para este cliente.");
                }
                setWelcomeModalOpen(false);
                setWelcomeData(null);
              }}
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Enviar Boas-vindas WhatsApp
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => { setWelcomeModalOpen(false); setWelcomeData(null); }}
            >
              Pular
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MAC/KEY Details Modal */}
      <Dialog open={!!macModalClientId} onOpenChange={(open) => { if (!open) setMacModalClientId(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Key className="h-5 w-5 text-primary" />
              Detalhes MAC & KEY
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {(() => {
              const mks = macModalClientId ? (macKeys[macModalClientId] || []) : [];
              return mks.map((mk, i) => {
                const macDays = mk.expires_at ? differenceInCalendarDays(parseISO(mk.expires_at), new Date()) : null;
                const isExpired = macDays !== null && macDays < 0;
                const isExpiring = macDays !== null && macDays >= 0 && macDays <= 7;
                return (
                  <div key={mk.id || i} className="rounded-lg border border-border/50 bg-muted/30 p-3 space-y-2">
                    {mk.app_name && (
                      <p className="text-sm font-bold text-primary">{mk.app_name}</p>
                    )}
                    <div className="grid grid-cols-1 gap-1.5 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs w-12">MAC:</span>
                        <span className="font-mono text-foreground">{mk.mac || "—"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs w-12">KEY:</span>
                        <span className="font-mono text-foreground">{mk.key || "—"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground text-xs w-12">Venc.:</span>
                        <span className={cn(
                          "font-semibold",
                          isExpired ? "text-destructive" : isExpiring ? "text-orange-400" : "text-foreground"
                        )}>
                          {mk.expires_at ? format(parseISO(mk.expires_at), "dd/MM/yyyy") : "—"}
                          {isExpired && ` (vencido há ${Math.abs(macDays!)} dias)`}
                          {isExpiring && macDays === 0 && " (vence hoje!)"}
                          {isExpiring && macDays! > 0 && ` (vence em ${macDays} dias)`}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Renewal Confirmation Dialog - with payment question */}
      <Dialog open={!!renewConfirm} onOpenChange={(open) => !open && setRenewConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              Confirmar Renovação
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground pt-2">
              {renewConfirm && (() => {
                const client = clients.find(c => c.id === renewConfirm.clientId);
                return (
                  <>
                    Deseja realmente <strong>{renewConfirm.label.toLowerCase()}</strong> para o cliente <strong>{client?.name}</strong>?
                  </>
                );
              })()}
            </DialogDescription>
          </DialogHeader>
          <div className="border border-border rounded-xl p-4 space-y-2 bg-muted/30">
            <p className="text-sm font-medium text-foreground">O pagamento foi realizado?</p>
            <p className="text-xs text-muted-foreground">Se não, o cliente ficará na aba "Pendentes" até você confirmar o recebimento.</p>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button className="w-full" onClick={async () => {
              if (!renewConfirm) return;
              if (renewConfirm.type === "same") {
                await handleRenewSameDate(renewConfirm.clientId, true);
              } else if (renewConfirm.type === "months") {
                await handleRenew(renewConfirm.clientId, renewConfirm.days!, true);
              }
              setRenewConfirm(null);
            }}>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Sim, pagamento recebido
            </Button>
            <Button variant="outline" className="w-full border-warning/50 text-warning hover:bg-warning/10" onClick={async () => {
              if (!renewConfirm) return;
              if (renewConfirm.type === "same") {
                await handleRenewSameDate(renewConfirm.clientId, false);
              } else if (renewConfirm.type === "months") {
                await handleRenew(renewConfirm.clientId, renewConfirm.days!, false);
              }
              setRenewConfirm(null);
            }}>
              <Clock className="w-4 h-4 mr-2" />
              Não, vai acertar depois
            </Button>
            <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => setRenewConfirm(null)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Duplicate WhatsApp confirmation */}
      {duplicateWarning && pendingSubmitEvent && (
        <Dialog open={!!pendingSubmitEvent} onOpenChange={(open) => { if (!open) { setPendingSubmitEvent(null); } }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                Contato duplicado
              </DialogTitle>
              <DialogDescription>
                O WhatsApp informado já está cadastrado no cliente <strong>{duplicateWarning.name}</strong>. Deseja continuar mesmo assim?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => { setPendingSubmitEvent(null); setDuplicateWarning(null); }}>Cancelar</Button>
              <Button variant="destructive" onClick={() => {
                setDuplicateConfirmed(true);
                setPendingSubmitEvent(null);
                // Re-submit the form
                const formEl = document.querySelector<HTMLFormElement>("#client-form");
                if (formEl) formEl.requestSubmit();
              }}>Continuar com duplicidade</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
