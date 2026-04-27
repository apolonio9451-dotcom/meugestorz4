import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_PER_RUN = 12;
const BATCH_PAUSE_EVERY = 20;
const BATCH_PAUSE_SECONDS = 300;
const MAX_CONSECUTIVE_ERRORS = 5;
const SESSION_EXPIRED_MESSAGE = "Sessão expirada. Por favor, revalide seu token nas Configurações";
const FRIENDLY_CONNECTION_ERROR = "Erro de Conexão";

function getApiHeaders(apiToken: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    token: apiToken,
    Authorization: `Bearer ${apiToken}`,
  };
}

type CampaignRow = {
  id: string;
  name: string;
  status: string;
  offer_templates: string[] | null;
  message_delay_min_seconds: number | null;
  message_delay_max_seconds: number | null;
  total_recipients: number;
  processed_recipients: number;
  success_count: number;
  failure_count: number;
};

type RecipientRow = {
  id: string;
  campaign_id: string;
  company_id: string;
  phone: string;
  normalized_phone: string;
  offer_template: string;
  status: string;
  current_step: string;
  next_action_at: string;
};

function normalizePhone(phone: string): string {
  return String(phone || "").replace(/\D/g, "");
}

function clampDelayRange(minSeconds: number | null | undefined, maxSeconds: number | null | undefined) {
  const min = Math.min(300, Math.max(15, Number(minSeconds ?? 15)));
  const max = Math.min(300, Math.max(min, Number(maxSeconds ?? 45)));
  return { min, max };
}

function randomDelaySeconds(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getFirstEnvValue(names: string[]): string {
  for (const name of names) {
    const value = Deno.env.get(name);
    if (value && value.trim().length > 0) return value.trim();
  }
  return "";
}

function resolveApiUrl(dbUrl?: string | null): string {
  const fromDb = String(dbUrl || "").trim().replace(/\/$/, "");
  if (fromDb) return fromDb;
  return getFirstEnvValue(["WA_API_URL", "EVOLUTI_API_URL"]).replace(/\/$/, "");
}

function resolveApiToken(dbToken?: string | null): string {
  const fromDb = String(dbToken || "").trim();
  if (fromDb.length > 5) return fromDb;
  return getFirstEnvValue(["WA_ADMIN_TOKEN", "BOLINHA_API_TOKEN", "UAZAPI_ADMIN_TOKEN", "EVOLUTI_TOKEN"]);
}

async function getCompanyInstanceToken(
  supabase: any,
  companyId: string,
): Promise<{ token: string; serverUrl: string }> {
  const { data: memberships } = await supabase
    .from("company_memberships")
    .select("user_id")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true })
    .limit(20);

  const userIds = (memberships || []).map((m: any) => m.user_id).filter(Boolean);
  if (!userIds.length) return { token: "", serverUrl: "" };

  const { data: instance } = await supabase
    .from("whats_api")
    .select("instance_token, server_url")
    .in("user_id", userIds)
    .eq("is_connected", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return { 
    token: String((instance as any)?.instance_token || "").trim(),
    serverUrl: String((instance as any)?.server_url || "").trim()
  };
}

async function fetchLatestCampaignCredentials(
  supabase: any,
  companyId: string,
): Promise<{ apiUrl: string; apiToken: string }> {
  const { data } = await supabase
    .from("api_settings")
    .select("api_url, api_token, broadcast_api_url, broadcast_api_token")
    .eq("company_id", companyId)
    .maybeSingle();

  const row = (data || {}) as any;
  const instance = await getCompanyInstanceToken(supabase, companyId);
  return {
    apiUrl: instance.serverUrl || resolveApiUrl(row.broadcast_api_url || row.api_url),
    apiToken: instance.token || resolveApiToken(row.broadcast_api_token || row.api_token),
  };
}

function isSessionError(responseText: string, httpStatus: number): boolean {
  if (httpStatus === 401) return true;
  try {
    const json = JSON.parse(responseText);
    const msg = String(json?.message || json?.error || "").toLowerCase();
    if (msg.includes("disconnected") || msg.includes("not connected") || msg.includes("qr code") || msg.includes("not logged")) {
      return true;
    }
  } catch { /* not JSON */ }
  return false;
}

async function validateCampaignToken(apiUrl: string, apiToken: string): Promise<{ ok: boolean; status?: number }> {
  try {
    const res = await fetch(`${apiUrl.replace(/\/$/, "")}/instance`, {
      method: "GET",
      headers: getApiHeaders(apiToken),
    });
    if (res.status === 401) {
      return { ok: false, status: 401 };
    }
    const body = await res.text();
    if (isSessionError(body, res.status)) {
      return { ok: false, status: res.status };
    }
    return { ok: true, status: res.status };
  } catch {
    return { ok: true };
  }
}

async function simulateTyping(apiUrl: string, apiToken: string, phone: string) {
  const durationMs = Math.floor(Math.random() * 2001) + 3000;
  try {
    await fetch(`${apiUrl.replace(/\/$/, "")}/operations/presence`, {
      method: "POST",
      headers: getApiHeaders(apiToken),
      body: JSON.stringify({ phone, presence: "composing" }),
    });
    await sleep(durationMs);
  } catch {
    await sleep(durationMs);
  }
}

async function fetchInstanceContacts(apiUrl: string, apiToken: string): Promise<Set<string>> {
  const contacts = new Set<string>();
  const endpoints = ["/contacts/all", "/contacts"];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(`${apiUrl.replace(/\/$/, "")}${endpoint}`, {
        method: "GET",
        headers: getApiHeaders(apiToken),
      });

      if (!res.ok) continue;

      const body = await res.json();
      const list: any[] = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];

      for (const contact of list) {
        const raw = String(contact?.id || contact?.phone || contact?.number || contact?.jid || "")
          .replace("@s.whatsapp.net", "")
          .replace("@c.us", "")
          .replace(/\D/g, "");

        if (raw.length >= 8) {
          contacts.add(raw);
        }
      }

      if (contacts.size > 0) {
        return contacts;
      }
    } catch { /* ignore error */ }
  }
  return contacts;
}

async function sendTextMessage(apiUrl: string, apiToken: string, number: string, text: string): Promise<{ ok: boolean; status: number }> {
  const response = await fetch(`${apiUrl.replace(/\/$/, "")}/send/text`, {
    method: "POST",
    headers: getApiHeaders(apiToken),
    body: JSON.stringify({ number, text, linkPreview: true }),
  });
  const body = await response.text();

  if (isSessionError(body, response.status)) {
    const error = new Error(SESSION_EXPIRED_MESSAGE);
    (error as any).httpStatus = 401;
    throw error;
  }

  if (!response.ok) {
    const error = new Error(FRIENDLY_CONNECTION_ERROR);
    (error as any).httpStatus = response.status;
    throw error;
  }
  return { ok: true, status: response.status };
}

async function insertLog(supabase: any, payload: Record<string, unknown>) {
  await (supabase.from("mass_broadcast_logs") as any).insert(payload);
}

async function updateCampaignCounters(
  supabase: any,
  campaignId: string,
  updater: (campaign: CampaignRow) => Partial<CampaignRow>,
) {
  const { data: campaign } = await supabase
    .from("mass_broadcast_campaigns")
    .select("id, name, status, offer_templates, message_delay_min_seconds, message_delay_max_seconds, total_recipients, processed_recipients, success_count, failure_count")
    .eq("id", campaignId)
    .single();

  if (!campaign) return null;

  const patch = updater(campaign as CampaignRow);
  const nextProcessed = patch.processed_recipients ?? campaign.processed_recipients;
  const total = patch.total_recipients ?? campaign.total_recipients;
  const shouldComplete = total > 0 && nextProcessed >= total;

  await (supabase
    .from("mass_broadcast_campaigns") as any)
    .update({
      ...patch,
      status: shouldComplete ? "completed" : (patch.status ?? campaign.status),
      completed_at: shouldComplete ? new Date().toISOString() : null,
      started_at: (campaign as any).started_at ?? new Date().toISOString(),
    })
    .eq("id", campaignId);

  return campaign;
}

function shouldBatchPause(processedCount: number): boolean {
  return processedCount > 0 && processedCount % BATCH_PAUSE_EVERY === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: apiSettings } = await supabase
      .from("api_settings")
      .select("company_id, api_url, api_token, broadcast_api_url, broadcast_api_token, bulk_send_enabled")
      .eq("bulk_send_enabled", true);

    if (!apiSettings?.length) {
      return new Response(JSON.stringify({ processed: 0, message: "Fila global desativada" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;
    let success = 0;
    let failed = 0;

    const consecutiveErrors: Record<string, number> = {};
    const instanceContactsCache: Record<string, Set<string>> = {};

    for (const settings of apiSettings) {
      if (processed >= MAX_PER_RUN) break;
      const companyId = settings.company_id;
      let credentials = await fetchLatestCampaignCredentials(supabase, companyId);
      if (!credentials.apiUrl || !credentials.apiToken) continue;

      if (!instanceContactsCache[companyId]) {
        instanceContactsCache[companyId] = await fetchInstanceContacts(credentials.apiUrl, credentials.apiToken);
      }
      const savedContacts = instanceContactsCache[companyId];

      const preflight = await validateCampaignToken(credentials.apiUrl, credentials.apiToken);
      if (!preflight.ok && preflight.status === 401) {
        const { data: activeCampaigns } = await supabase
          .from("mass_broadcast_campaigns")
          .select("id")
          .eq("company_id", companyId)
          .in("status", ["queued", "running"]);

        for (const campaignRow of (activeCampaigns || [])) {
          await (supabase.from("mass_broadcast_campaigns") as any).update({ status: "paused" }).eq("id", (campaignRow as any).id);
          await insertLog(supabase, {
            campaign_id: (campaignRow as any).id,
            recipient_id: null,
            company_id: companyId,
            phone: "",
            step: "auth_error",
            status: "error",
            message: SESSION_EXPIRED_MESSAGE,
            error_message: "401 - Token inválido",
          });
        }
        continue;
      }

      const nowIso = new Date().toISOString();
      const { data: recipients } = await supabase
        .from("mass_broadcast_recipients")
        .select("id, campaign_id, company_id, phone, normalized_phone, offer_template, status, current_step, next_action_at")
        .eq("company_id", settings.company_id)
        .lte("next_action_at", nowIso)
        .in("status", ["pending"])
        .order("next_action_at", { ascending: true })
        .limit(MAX_PER_RUN - processed);

      for (const recipient of (recipients || []) as RecipientRow[]) {
        if (processed >= MAX_PER_RUN) break;

        const { data: campaignData } = await supabase
          .from("mass_broadcast_campaigns")
          .select("id, name, status, offer_templates, message_delay_min_seconds, message_delay_max_seconds, total_recipients, processed_recipients, success_count, failure_count")
          .eq("id", recipient.campaign_id)
          .single();

        const campaign = campaignData as CampaignRow | null;
        if (!campaign || campaign.status === "completed" || campaign.status === "paused") continue;

        if ((consecutiveErrors[campaign.id] || 0) >= MAX_CONSECUTIVE_ERRORS) {
          await (supabase.from("mass_broadcast_campaigns") as any).update({ status: "paused" }).eq("id", campaign.id);
          continue;
        }

        const phone = normalizePhone(recipient.normalized_phone || recipient.phone);
        
        try {
          if (savedContacts.has(phone)) {
             await (supabase.from("mass_broadcast_recipients") as any).update({ status: "skipped" }).eq("id", recipient.id);
             processed++;
             continue;
          }

          await simulateTyping(credentials.apiUrl, credentials.apiToken, phone);
          await sendTextMessage(credentials.apiUrl, credentials.apiToken, phone, recipient.offer_template);

          await (supabase.from("mass_broadcast_recipients") as any).update({ status: "sent" }).eq("id", recipient.id);
          await updateCampaignCounters(supabase, campaign.id, (c) => ({ processed_recipients: c.processed_recipients + 1, success_count: c.success_count + 1 }));
          
          success++;
          processed++;
          consecutiveErrors[campaign.id] = 0;
        } catch (err) {
          await (supabase.from("mass_broadcast_recipients") as any).update({ status: "failed" }).eq("id", recipient.id);
          await updateCampaignCounters(supabase, campaign.id, (c) => ({ processed_recipients: c.processed_recipients + 1, failure_count: c.failure_count + 1 }));
          
          failed++;
          processed++;
          consecutiveErrors[campaign.id] = (consecutiveErrors[campaign.id] || 0) + 1;
        }
      }
    }

    return new Response(JSON.stringify({ processed, success, failed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
