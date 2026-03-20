import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_PER_RUN = 12;

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
  const min = Math.min(300, Math.max(30, Number(minSeconds ?? 60)));
  const max = Math.min(300, Math.max(min, Number(maxSeconds ?? 120)));
  return { min, max };
}

function randomDelaySeconds(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function sendText(apiUrl: string, apiToken: string, number: string, text: string) {
  const response = await fetch(`${apiUrl.replace(/\/$/, "")}/send/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json", token: apiToken },
    body: JSON.stringify({ number, text, linkPreview: true }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Falha HTTP ${response.status}`);
  }
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

    for (const settings of apiSettings) {
      if (processed >= MAX_PER_RUN) break;
      // Use broadcast credentials if available, fallback to main
      const broadcastUrl = settings.broadcast_api_url?.trim();
      const broadcastToken = settings.broadcast_api_token?.trim();
      const effectiveUrl = broadcastUrl || settings.api_url;
      const effectiveToken = broadcastToken || settings.api_token;
      if (!effectiveUrl || !effectiveToken) continue;

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
          failed += 1;
          processed += 1;
          continue;
        }

        try {
          // ═══ SIMPLE DIRECT DISPATCH: Send the message assigned to this recipient ═══
          const message = String(recipient.offer_template || "").trim();
          if (!message) throw new Error("Mensagem vazia para este contato.");

          const sentAt = new Date().toISOString();
          await sendText(effectiveUrl, effectiveToken, phone, message);

          // Calculate delay for the NEXT recipient in queue
          const delay = clampDelayRange(campaign.message_delay_min_seconds, campaign.message_delay_max_seconds);
          const nextDelay = randomDelaySeconds(delay.min, delay.max);

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

          success += 1;
          processed += 1;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);

          await supabase
            .from("mass_broadcast_recipients")
            .update({ status: "failed", error_message: errorMessage, last_attempt_at: new Date().toISOString() })
            .eq("id", recipient.id);

          await insertLog(supabase, {
            campaign_id: campaign.id, recipient_id: recipient.id,
            company_id: recipient.company_id, phone, step: "offer",
            status: "error", message: recipient.offer_template || "",
            error_message: errorMessage,
          });

          await updateCampaignCounters(supabase, campaign.id, (c) => ({
            processed_recipients: c.processed_recipients + 1,
            failure_count: c.failure_count + 1,
          }));

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
