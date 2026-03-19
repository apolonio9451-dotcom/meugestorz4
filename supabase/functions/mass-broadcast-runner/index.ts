import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_GREETINGS = ["Olá!", "Tudo bem?", "Bom dia, como vai?"];
const MAX_PER_RUN = 12;

type CampaignRow = {
  id: string;
  name: string;
  status: string;
  greeting_templates: string[] | null;
  message_delay_min_seconds: number | null;
  message_delay_max_seconds: number | null;
  total_recipients: number;
  processed_recipients: number;
  success_count: number;
  failure_count: number;
  seller_instructions: string | null;
  offer_timeout_minutes: number | null;
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

type ConversationRow = {
  id: string;
  conversation_status: string;
  has_reply: boolean;
  contact_name: string;
};

function normalizePhone(phone: string): string {
  return String(phone || "").replace(/\D/g, "");
}

function nonEmptyList(values: string[] | null | undefined, fallback: string[] = []): string[] {
  const items = Array.isArray(values) ? values.map((value) => String(value || "").trim()).filter(Boolean) : [];
  return items.length > 0 ? items : fallback;
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function clampDelayRange(minSeconds: number | null | undefined, maxSeconds: number | null | undefined) {
  const min = Math.min(90, Math.max(30, Number(minSeconds ?? 30)));
  const max = Math.min(90, Math.max(min, Number(maxSeconds ?? 90)));
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

async function ensureConversation(
  supabase: ReturnType<typeof createClient>,
  payload: { companyId: string; campaignId: string; recipientId: string | null; phone: string; timestamp: string },
) {
  const normalizedPhone = normalizePhone(payload.phone);
  const { data: existing } = await supabase
    .from("mass_broadcast_conversations")
    .select("id, conversation_status, has_reply, contact_name")
    .eq("campaign_id", payload.campaignId)
    .eq("normalized_phone", normalizedPhone)
    .maybeSingle<ConversationRow>();

  if (existing?.id) {
    await supabase
      .from("mass_broadcast_conversations")
      .update({
        recipient_id: payload.recipientId,
        phone: payload.phone,
        normalized_phone: normalizedPhone,
        contact_name: existing.contact_name || payload.phone,
        conversation_status: existing.has_reply ? "awaiting_human" : existing.conversation_status || "bot_active",
        has_reply: existing.has_reply,
        last_message_at: payload.timestamp,
        last_outgoing_at: payload.timestamp,
      })
      .eq("id", existing.id);
    return existing.id;
  }

  const { data: created } = await supabase
    .from("mass_broadcast_conversations")
    .insert({
      company_id: payload.companyId,
      campaign_id: payload.campaignId,
      recipient_id: payload.recipientId,
      phone: payload.phone,
      normalized_phone: normalizedPhone,
      contact_name: payload.phone,
      conversation_status: "bot_active",
      has_reply: false,
      last_message_at: payload.timestamp,
      last_outgoing_at: payload.timestamp,
    })
    .select("id")
    .single<{ id: string }>();

  return created?.id ?? null;
}

async function insertConversationMessage(
  supabase: ReturnType<typeof createClient>,
  payload: {
    companyId: string; campaignId: string; conversationId: string | null;
    recipientId: string | null; phone: string; message: string;
    messageType?: string; deliveryStatus?: string; createdAt: string;
  },
) {
  if (!payload.conversationId) return;
  await supabase.from("mass_broadcast_conversation_messages").insert({
    company_id: payload.companyId,
    campaign_id: payload.campaignId,
    conversation_id: payload.conversationId,
    recipient_id: payload.recipientId,
    phone: payload.phone,
    normalized_phone: normalizePhone(payload.phone),
    direction: "outbound",
    sender_type: "bot",
    source: "mass_broadcast",
    message_type: payload.messageType ?? "text",
    message: payload.message,
    delivery_status: payload.deliveryStatus ?? "sent",
    created_at: payload.createdAt,
  });
}

async function updateCampaignCounters(
  supabase: ReturnType<typeof createClient>,
  campaignId: string,
  updater: (campaign: CampaignRow) => Partial<CampaignRow>,
) {
  const { data: campaign } = await supabase
    .from("mass_broadcast_campaigns")
    .select("id, name, status, greeting_templates, message_delay_min_seconds, message_delay_max_seconds, total_recipients, processed_recipients, success_count, failure_count, seller_instructions, offer_timeout_minutes")
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

/* ─── AI helper: generate a transition/timeout message ─── */
async function generateAITransition(sellerInstructions: string, offerText: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return offerText; // fallback to raw offer

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `Você é um vendedor via WhatsApp. ${sellerInstructions || "Seja simpático e natural."}\n\nRegras:\n- Escreva uma frase curta de transição natural (1-2 linhas) antes de apresentar a oferta.\n- Exemplos: "Passei aqui pra te contar de uma promoção especial...", "Vi que você ainda não respondeu, mas queria te avisar de algo bacana..."\n- Depois da frase de transição, inclua a oferta abaixo.\n- NÃO use emojis excessivos. Seja humano e direto.\n- Responda APENAS com a mensagem final (transição + oferta). Nada mais.`,
          },
          { role: "user", content: `Gere a mensagem de transição + oferta. Oferta:\n${offerText}` },
        ],
      }),
    });
    if (!resp.ok) return offerText;
    const data = await resp.json();
    const content = data?.choices?.[0]?.message?.content?.trim();
    return content || offerText;
  } catch {
    return offerText;
  }
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
      .select("company_id, api_url, api_token, bulk_send_enabled")
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
      if (!settings.api_url || !settings.api_token) continue;

      const nowIso = new Date().toISOString();
      const { data: recipients } = await supabase
        .from("mass_broadcast_recipients")
        .select("id, campaign_id, company_id, phone, normalized_phone, offer_template, status, current_step, next_action_at")
        .eq("company_id", settings.company_id)
        .lte("next_action_at", nowIso)
        .in("status", ["pending", "processing"])
        .order("next_action_at", { ascending: true })
        .limit(MAX_PER_RUN - processed);

      for (const recipient of (recipients as RecipientRow[] | null) || []) {
        if (processed >= MAX_PER_RUN) break;

        const { data: campaign } = await supabase
          .from("mass_broadcast_campaigns")
          .select("id, name, status, greeting_templates, message_delay_min_seconds, message_delay_max_seconds, total_recipients, processed_recipients, success_count, failure_count, seller_instructions, offer_timeout_minutes")
          .eq("id", recipient.campaign_id)
          .single<CampaignRow>();

        if (!campaign || campaign.status === "completed") continue;

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
            company_id: recipient.company_id, phone, step: recipient.current_step,
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
          /* ═══ STEP: GREETING (Quebra-Gelo) ═══ */
          if (recipient.current_step === "greeting") {
            const greetingSentAt = new Date().toISOString();
            const greetings = nonEmptyList(campaign.greeting_templates, DEFAULT_GREETINGS);
            const greeting = pickRandom(greetings);
            await sendText(settings.api_url, settings.api_token, phone, greeting);

            // After greeting, move to "awaiting_reply" step
            const timeoutMinutes = campaign.offer_timeout_minutes ?? 5;
            const nextActionAt = new Date(Date.now() + timeoutMinutes * 60 * 1000).toISOString();

            await supabase
              .from("mass_broadcast_recipients")
              .update({
                status: "processing",
                current_step: "awaiting_reply",
                sent_greeting_at: greetingSentAt,
                last_attempt_at: greetingSentAt,
                next_action_at: nextActionAt,
                error_message: null,
              })
              .eq("id", recipient.id);

            const conversationId = await ensureConversation(supabase, {
              companyId: recipient.company_id, campaignId: campaign.id,
              recipientId: recipient.id, phone, timestamp: greetingSentAt,
            });

            await insertConversationMessage(supabase, {
              companyId: recipient.company_id, campaignId: campaign.id,
              conversationId, recipientId: recipient.id, phone,
              message: greeting, createdAt: greetingSentAt,
            });

            await insertLog(supabase, {
              campaign_id: campaign.id, recipient_id: recipient.id,
              company_id: recipient.company_id, phone, step: "greeting",
              status: "success", message: greeting, error_message: null,
            });

            processed += 1;
            continue;
          }

          /* ═══ STEP: AWAITING_REPLY (Timeout → send offer with transition) ═══ */
          if (recipient.current_step === "awaiting_reply") {
            // Check if the client replied
            const { data: conversation } = await supabase
              .from("mass_broadcast_conversations")
              .select("id, has_reply, conversation_status")
              .eq("campaign_id", campaign.id)
              .eq("normalized_phone", phone)
              .maybeSingle();

            if (conversation?.has_reply && conversation?.conversation_status !== "human_takeover") {
              // Client replied → AI already handled in webhook, mark as conversing
              await supabase
                .from("mass_broadcast_recipients")
                .update({ current_step: "conversing", status: "processing", error_message: null })
                .eq("id", recipient.id);
              processed += 1;
              continue;
            }

            if (conversation?.conversation_status === "human_takeover") {
              // Human took over, skip
              processed += 1;
              continue;
            }

            // No reply → timeout reached, send offer with AI transition
            const offerMessage = String(recipient.offer_template || "").trim();
            if (!offerMessage) throw new Error("Template da oferta vazio.");

            const sellerInstructions = campaign.seller_instructions || "";
            const finalMessage = sellerInstructions
              ? await generateAITransition(sellerInstructions, offerMessage)
              : offerMessage;

            const offerSentAt = new Date().toISOString();
            await sendText(settings.api_url, settings.api_token, phone, finalMessage);

            await supabase
              .from("mass_broadcast_recipients")
              .update({
                status: "sent",
                current_step: "done",
                sent_offer_at: offerSentAt,
                last_attempt_at: offerSentAt,
                error_message: null,
              })
              .eq("id", recipient.id);

            const conversationId = await ensureConversation(supabase, {
              companyId: recipient.company_id, campaignId: campaign.id,
              recipientId: recipient.id, phone, timestamp: offerSentAt,
            });

            await insertConversationMessage(supabase, {
              companyId: recipient.company_id, campaignId: campaign.id,
              conversationId, recipientId: recipient.id, phone,
              message: finalMessage, createdAt: offerSentAt,
            });

            await insertLog(supabase, {
              campaign_id: campaign.id, recipient_id: recipient.id,
              company_id: recipient.company_id, phone, step: "offer_timeout",
              status: "success", message: finalMessage, error_message: null,
            });

            await updateCampaignCounters(supabase, campaign.id, (c) => ({
              processed_recipients: c.processed_recipients + 1,
              success_count: c.success_count + 1,
            }));

            success += 1;
            processed += 1;
            continue;
          }

          /* ═══ STEP: OFFER (legacy / direct offer) ═══ */
          if (recipient.current_step === "offer" || recipient.current_step === "conversing") {
            const offerMessage = String(recipient.offer_template || "").trim();
            if (!offerMessage) throw new Error("Template da oferta vazio.");

            const offerSentAt = new Date().toISOString();
            await sendText(settings.api_url, settings.api_token, phone, offerMessage);

            await supabase
              .from("mass_broadcast_recipients")
              .update({
                status: "sent",
                current_step: "done",
                sent_offer_at: offerSentAt,
                last_attempt_at: offerSentAt,
                error_message: null,
              })
              .eq("id", recipient.id);

            const conversationId = await ensureConversation(supabase, {
              companyId: recipient.company_id, campaignId: campaign.id,
              recipientId: recipient.id, phone, timestamp: offerSentAt,
            });

            await insertConversationMessage(supabase, {
              companyId: recipient.company_id, campaignId: campaign.id,
              conversationId, recipientId: recipient.id, phone,
              message: offerMessage, createdAt: offerSentAt,
            });

            await insertLog(supabase, {
              campaign_id: campaign.id, recipient_id: recipient.id,
              company_id: recipient.company_id, phone, step: "offer",
              status: "success", message: offerMessage, error_message: null,
            });

            await updateCampaignCounters(supabase, campaign.id, (c) => ({
              processed_recipients: c.processed_recipients + 1,
              success_count: c.success_count + 1,
            }));

            success += 1;
            processed += 1;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);

          await supabase
            .from("mass_broadcast_recipients")
            .update({ status: "failed", error_message: errorMessage, last_attempt_at: new Date().toISOString() })
            .eq("id", recipient.id);

          await insertLog(supabase, {
            campaign_id: campaign.id, recipient_id: recipient.id,
            company_id: recipient.company_id, phone, step: recipient.current_step,
            status: "error", message: recipient.current_step === "offer" ? recipient.offer_template : "",
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
