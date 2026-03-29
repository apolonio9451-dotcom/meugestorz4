import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_PER_RUN = 12;
const BATCH_PAUSE_EVERY = 20;
const BATCH_PAUSE_SECONDS = 300;
const MAX_CONSECUTIVE_ERRORS = 5;
const SESSION_EXPIRED_MESSAGE = "Sessão expirada, gere um novo token";
const FRIENDLY_CONNECTION_ERROR = "Erro de Conexão";

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

async function fetchLatestCampaignCredentials(
  supabase: ReturnType<typeof createClient>,
  companyId: string,
): Promise<{ apiUrl: string; apiToken: string }> {
  const { data } = await supabase
    .from("api_settings")
    .select("api_url, api_token, broadcast_api_url, broadcast_api_token")
    .eq("company_id", companyId)
    .maybeSingle();

  const row = (data || {}) as any;
  return {
    apiUrl: resolveApiUrl(row.broadcast_api_url || row.api_url),
    apiToken: resolveApiToken(row.broadcast_api_token || row.api_token),
  };
}

async function validateCampaignToken(apiUrl: string, apiToken: string): Promise<{ ok: boolean; status?: number }> {
  try {
    const res = await fetch(`${apiUrl.replace(/\/$/, "")}/instance`, {
      method: "GET",
      headers: { "Content-Type": "application/json", token: apiToken },
    });
    if (res.status === 401) {
      return { ok: false, status: 401 };
    }
    return { ok: true, status: res.status };
  } catch {
    return { ok: true };
  }
}

/** Simulate "composing" presence before sending */
async function simulateTyping(apiUrl: string, apiToken: string, phone: string) {
  const durationMs = Math.floor(Math.random() * 2001) + 3000; // 3-5 seconds
  try {
    await fetch(`${apiUrl.replace(/\/$/, "")}/operations/presence`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token: apiToken },
      body: JSON.stringify({ phone, presence: "composing" }),
    });
    await sleep(durationMs);
  } catch {
    // Non-critical: if presence fails, continue sending
    await sleep(durationMs);
  }
}

async function sendText(apiUrl: string, apiToken: string, number: string, text: string): Promise<{ ok: boolean; status: number }> {
  const response = await fetch(`${apiUrl.replace(/\/$/, "")}/send/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json", token: apiToken },
    body: JSON.stringify({ number, text, linkPreview: true }),
  });
  if (!response.ok) {
    const body = await response.text();
    const error = new Error(
      response.status === 401
        ? SESSION_EXPIRED_MESSAGE
        : body || `Falha HTTP ${response.status}`
    );
    (error as any).httpStatus = response.status;
    throw error;
  }
  return { ok: true, status: response.status };
}

async function insertLog(supabase: ReturnType<typeof createClient>, payload: Record<string, unknown>) {
  await supabase.from("mass_broadcast_logs").insert(payload);
}

async function updateCampaignCounters(
  supabase: ReturnType<typeof createClient>,
  campaignId: string,
  updater: (campaign: CampaignRow) => Partial<CampaignRow>,
) {
  const { data: campaign } = await supabase
    .from("mass_broadcast_campaigns")
    .select("id, name, status, offer_templates, message_delay_min_seconds, message_delay_max_seconds, total_recipients, processed_recipients, success_count, failure_count")
    .eq("id", campaignId)
    .single<CampaignRow>();

  if (!campaign) return null;

  const patch = updater(campaign);
  const nextProcessed = patch.processed_recipients ?? campaign.processed_recipients;
  const total = patch.total_recipients ?? campaign.total_recipients;
  const shouldComplete = total > 0 && nextProcessed >= total;

  await supabase
    .from("mass_broadcast_campaigns")
    .update({
      ...patch,
      status: shouldComplete ? "completed" : (patch.status ?? campaign.status),
      completed_at: shouldComplete ? new Date().toISOString() : null,
      started_at: (campaign as any).started_at ?? new Date().toISOString(),
    })
    .eq("id", campaignId);

  return campaign;
}

/** Check if batch pause is needed (every BATCH_PAUSE_EVERY messages) */
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

    // Only process companies with bulk_send_enabled
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

    // ═══ SKIP-ON-ERROR: Track consecutive errors per campaign ═══
    const consecutiveErrors: Record<string, number> = {};

    for (const settings of apiSettings) {
      if (processed >= MAX_PER_RUN) break;
      const companyId = settings.company_id;
      let credentials = await fetchLatestCampaignCredentials(supabase, companyId);
      if (!credentials.apiUrl || !credentials.apiToken) continue;

      const preflight = await validateCampaignToken(credentials.apiUrl, credentials.apiToken);
      if (!preflight.ok && preflight.status === 401) {
        const { data: activeCampaigns } = await supabase
          .from("mass_broadcast_campaigns")
          .select("id")
          .eq("company_id", companyId)
          .in("status", ["queued", "running"]);

        for (const campaignRow of (activeCampaigns || [])) {
          await supabase.from("mass_broadcast_campaigns").update({ status: "paused" }).eq("id", (campaignRow as any).id);
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

      for (const recipient of (recipients as RecipientRow[] | null) || []) {
        if (processed >= MAX_PER_RUN) break;

        const { data: campaign } = await supabase
          .from("mass_broadcast_campaigns")
          .select("id, name, status, offer_templates, message_delay_min_seconds, message_delay_max_seconds, total_recipients, processed_recipients, success_count, failure_count")
          .eq("id", recipient.campaign_id)
          .single<CampaignRow>();

        if (!campaign || campaign.status === "completed" || campaign.status === "paused") continue;

        // ═══ AUTO-PAUSE: If 5 consecutive errors, pause campaign ═══
        if ((consecutiveErrors[campaign.id] || 0) >= MAX_CONSECUTIVE_ERRORS) {
          await supabase
            .from("mass_broadcast_campaigns")
            .update({ status: "paused" })
            .eq("id", campaign.id);
          // Push remaining pending recipients to far future
          await supabase
            .from("mass_broadcast_recipients")
            .update({ next_action_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString() })
            .eq("campaign_id", campaign.id)
            .eq("status", "pending");
          await insertLog(supabase, {
            campaign_id: campaign.id, recipient_id: recipient.id,
            company_id: recipient.company_id, phone: "", step: "auto_pause",
            status: "error",
            message: `⛔ Disparo pausado: ${MAX_CONSECUTIVE_ERRORS} erros seguidos. Verifique sua conexão ou instância.`,
            error_message: null,
          });
          continue;
        }

        // Mark campaign as running if queued
        if (campaign.status === "queued") {
          await supabase
            .from("mass_broadcast_campaigns")
            .update({ status: "running", started_at: new Date().toISOString() })
            .eq("id", campaign.id);
        }

        const phone = normalizePhone(recipient.normalized_phone || recipient.phone);
        if (phone.length < 10) {
          const errorMessage = "Telefone inválido após sanitização.";
          await supabase
            .from("mass_broadcast_recipients")
            .update({ status: "failed", error_message: errorMessage, last_attempt_at: new Date().toISOString() })
            .eq("id", recipient.id);
          await insertLog(supabase, {
            campaign_id: campaign.id, recipient_id: recipient.id,
            company_id: recipient.company_id, phone, step: "offer",
            status: "error", message: "", error_message: errorMessage,
          });
          await updateCampaignCounters(supabase, campaign.id, (c) => ({
            processed_recipients: c.processed_recipients + 1,
            failure_count: c.failure_count + 1,
          }));
          consecutiveErrors[campaign.id] = (consecutiveErrors[campaign.id] || 0) + 1;
          failed += 1;
          processed += 1;
          continue;
        }

        try {
          const latestCredentials = await fetchLatestCampaignCredentials(supabase, recipient.company_id);
          if (latestCredentials.apiUrl && latestCredentials.apiToken) {
            credentials = latestCredentials;
          }

          const latestValidation = await validateCampaignToken(credentials.apiUrl, credentials.apiToken);
          if (!latestValidation.ok && latestValidation.status === 401) {
            await supabase
              .from("mass_broadcast_campaigns")
              .update({ status: "paused" })
              .eq("id", campaign.id);

            await insertLog(supabase, {
              campaign_id: campaign.id,
              recipient_id: recipient.id,
              company_id: recipient.company_id,
              phone,
              step: "auth_error",
              status: "error",
              message: SESSION_EXPIRED_MESSAGE,
              error_message: "401 - Token inválido",
            });

            await supabase
              .from("mass_broadcast_recipients")
              .update({ status: "failed", error_message: FRIENDLY_CONNECTION_ERROR, last_attempt_at: new Date().toISOString() })
              .eq("id", recipient.id);

            await updateCampaignCounters(supabase, campaign.id, (c) => ({
              processed_recipients: c.processed_recipients + 1,
              failure_count: c.failure_count + 1,
            }));

            consecutiveErrors[campaign.id] = MAX_CONSECUTIVE_ERRORS;
            failed += 1;
            processed += 1;
            continue;
          }

          // ═══ ANTI-BAN: Simulate typing before sending ═══
          const message = String(recipient.offer_template || "").trim();
          if (!message) throw new Error("Mensagem vazia para este contato.");

          await simulateTyping(credentials.apiUrl, credentials.apiToken, phone);

          const sentAt = new Date().toISOString();
          await sendText(credentials.apiUrl, credentials.apiToken, phone, message);

          // Calculate delay for the NEXT recipient in queue
          const delay = clampDelayRange(campaign.message_delay_min_seconds, campaign.message_delay_max_seconds);
          let nextDelay = randomDelaySeconds(delay.min, delay.max);

          // ═══ ANTI-BAN: Batch pause every N messages ═══
          const newProcessed = campaign.processed_recipients + 1;
          if (shouldBatchPause(newProcessed)) {
            nextDelay = BATCH_PAUSE_SECONDS;
            await insertLog(supabase, {
              campaign_id: campaign.id, recipient_id: recipient.id,
              company_id: recipient.company_id, phone, step: "batch_pause",
              status: "success", message: `☕ Pausa de segurança: ${BATCH_PAUSE_SECONDS}s após ${newProcessed} mensagens`,
              error_message: null,
            });
          }

          await supabase
            .from("mass_broadcast_recipients")
            .update({
              status: "sent",
              current_step: "done",
              sent_offer_at: sentAt,
              last_attempt_at: sentAt,
              error_message: null,
            })
            .eq("id", recipient.id);

          // Set delay on the next pending recipient
          const { data: nextRecipients } = await supabase
            .from("mass_broadcast_recipients")
            .select("id")
            .eq("campaign_id", campaign.id)
            .eq("status", "pending")
            .order("next_action_at", { ascending: true })
            .limit(1);

          if (nextRecipients?.length) {
            await supabase
              .from("mass_broadcast_recipients")
              .update({ next_action_at: new Date(Date.now() + nextDelay * 1000).toISOString() })
              .eq("id", (nextRecipients[0] as any).id);
          }

          await insertLog(supabase, {
            campaign_id: campaign.id, recipient_id: recipient.id,
            company_id: recipient.company_id, phone, step: "offer",
            status: "success", message: message.substring(0, 200), error_message: null,
          });

          await updateCampaignCounters(supabase, campaign.id, (c) => ({
            processed_recipients: c.processed_recipients + 1,
            success_count: c.success_count + 1,
          }));

          // ═══ Reset consecutive error counter on success ═══
          consecutiveErrors[campaign.id] = 0;
          success += 1;
          processed += 1;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          const httpStatus = (error as any)?.httpStatus;

          // ═══ 401 DETECTION: Immediately pause campaign on auth failure ═══
          if (httpStatus === 401) {
            await supabase
              .from("mass_broadcast_recipients")
              .update({ status: "failed", error_message: "Erro de Conexão", last_attempt_at: new Date().toISOString() })
              .eq("id", recipient.id);

            await supabase
              .from("mass_broadcast_campaigns")
              .update({ status: "paused" })
              .eq("id", campaign.id);

            await insertLog(supabase, {
              campaign_id: campaign.id, recipient_id: recipient.id,
              company_id: recipient.company_id, phone, step: "auth_error",
              status: "error",
              message: SESSION_EXPIRED_MESSAGE,
              error_message: "401 - Token inválido",
            });

            await updateCampaignCounters(supabase, campaign.id, (c) => ({
              processed_recipients: c.processed_recipients + 1,
              failure_count: c.failure_count + 1,
            }));

            // Skip all remaining recipients for this company
            consecutiveErrors[campaign.id] = MAX_CONSECUTIVE_ERRORS;
            failed += 1;
            processed += 1;
            continue;
          }

          // ═══ SINGLE ATTEMPT: Mark as failed permanently, skip immediately ═══
          await supabase
            .from("mass_broadcast_recipients")
            .update({ status: "failed", error_message: FRIENDLY_CONNECTION_ERROR, last_attempt_at: new Date().toISOString() })
            .eq("id", recipient.id);

          await insertLog(supabase, {
            campaign_id: campaign.id, recipient_id: recipient.id,
            company_id: recipient.company_id, phone, step: "offer",
            status: "error", message: recipient.offer_template || "",
            error_message: FRIENDLY_CONNECTION_ERROR,
          });

          await updateCampaignCounters(supabase, campaign.id, (c) => ({
            processed_recipients: c.processed_recipients + 1,
            failure_count: c.failure_count + 1,
          }));

          // ═══ Track consecutive errors ═══
          consecutiveErrors[campaign.id] = (consecutiveErrors[campaign.id] || 0) + 1;
          failed += 1;
          processed += 1;
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
