import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, token",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
};

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function simulatePresence(
  apiUrl: string, apiToken: string, to: string,
  type: "composing" | "recording", durationMs: number
) {
  try {
    await fetch(`${apiUrl}/operations/presence`, {
      method: "POST",
      headers: getApiHeaders(apiToken),
      body: JSON.stringify({ phone: to, presence: type }),
    });
    await sleep(durationMs);
  } catch (e) {
    console.error("Presence simulation failed:", e);
  }
}

// Env var fallback for token resolution (same strategy as auto-send-messages)
function getFirstEnvValue(names: string[]): string {
  for (const name of names) {
    const value = Deno.env.get(name);
    if (value && value.trim().length > 0) return value.trim();
  }
  return "";
}

function resolveApiTokenFromEnv(): string {
  const fallback = getFirstEnvValue(["WA_ADMIN_TOKEN", "BOLINHA_API_TOKEN", "UAZAPI_ADMIN_TOKEN", "EVOLUTI_TOKEN"]);
  if (fallback.length > 5 && !fallback.includes("curl") && !fallback.startsWith("http")) return fallback;
  return "";
}

function resolveApiUrlFromEnv(): string {
  return getFirstEnvValue(["WA_API_URL", "EVOLUTI_API_URL"]).replace(/\/$/, "");
}

function getApiHeaders(apiToken: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    token: apiToken,
    Authorization: `Bearer ${apiToken}`,
  };
}

async function validateApiToken(apiUrl: string, token: string): Promise<boolean> {
  try {
    const resp = await fetch(`${apiUrl}/instance`, {
      method: "GET",
      headers: getApiHeaders(token),
    });
    const body = await resp.text();
    // 401 = invalid token; 404 = endpoint not found but token may be valid; 2xx = ok
    if (resp.status === 401) return false;
    if (resp.status === 404) return true; // match auto-send behavior
    if (resp.ok) return true;
    // Check for session errors in body
    if (isSessionErrorText(body)) return false;
    // Non-401, non-404 errors: assume token is ok (network issue, etc)
    return true;
  } catch {
    // Network error — don't reject the token, assume it's valid
    return true;
  }
}

async function sendText(apiUrl: string, apiToken: string, to: string, text: string): Promise<any> {
  console.log(`Enviando texto para ${to}: "${text.slice(0, 80)}..."`);
  const resp = await fetch(`${apiUrl}/send/text`, {
    method: "POST",
    headers: getApiHeaders(apiToken),
    body: JSON.stringify({ number: to, text: text, linkPreview: true }),
  });
  const body = await resp.text();
  if (!resp.ok) {
    if (resp.status === 401 || isSessionErrorText(body)) {
      console.error(`[chatbot-webhook] SESSION ERROR on send/text: ${resp.status} - ${body.slice(0, 300)}`);
      throw new SessionExpiredError(`Sessão expirada (${resp.status}). Reconecte a instância nas Configurações.`);
    }
    throw new Error(`UAZAPI send/text failed: ${resp.status} - ${body}`);
  }
  try { return JSON.parse(body); } catch { return { ok: true }; }
}

class SessionExpiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionExpiredError";
  }
}

function isSessionErrorText(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes("disconnected") || lower.includes("not connected") ||
    lower.includes("qr code") || lower.includes("not logged") ||
    lower.includes("session expired") || lower.includes("invalid token");
}

async function sendMedia(
  apiUrl: string, apiToken: string, to: string,
  mediaUrl: string, type: "audio" | "video", caption?: string
) {
  const endpoint = type === "audio" ? "/send/audio" : "/send/video";
  const resp = await fetch(`${apiUrl}${endpoint}`, {
    method: "POST",
    headers: getApiHeaders(apiToken),
    body: JSON.stringify({ number: to, url: mediaUrl, caption: caption || "" }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`UAZAPI ${endpoint} failed: ${resp.status} - ${body}`);
  }
  return resp.json();
}

async function sendButtons(
  apiUrl: string, apiToken: string, to: string,
  title: string, body: string, footer: string,
  buttons: { id: string; title: string }[]
) {
  const choices = buttons.map((b) => `${b.title}|${b.id}`);
  const resp = await fetch(`${apiUrl}/send/menu`, {
    method: "POST",
    headers: getApiHeaders(apiToken),
    body: JSON.stringify({
      number: to,
      type: "button",
      text: body || title || "Selecione uma opção:",
      choices,
      footerText: footer || undefined,
    }),
  });
  if (!resp.ok) {
    const respBody = await resp.text();
    throw new Error(`UAZAPI send/menu (button) failed: ${resp.status} - ${respBody}`);
  }
  return resp.json();
}

async function sendList(
  apiUrl: string, apiToken: string, to: string,
  title: string, body: string, footer: string,
  buttonText: string, items: { id: string; title: string; description?: string }[]
) {
  const choices: string[] = [];
  if (title) choices.push(`[${title}]`);
  for (const item of items) {
    const parts = [item.title, item.id];
    if (item.description) parts.push(item.description);
    choices.push(parts.join("|"));
  }
  const resp = await fetch(`${apiUrl}/send/menu`, {
    method: "POST",
    headers: getApiHeaders(apiToken),
    body: JSON.stringify({
      number: to,
      type: "list",
      text: body || "Selecione uma opção:",
      choices,
      listButton: buttonText || "Ver Opções",
      footerText: footer || undefined,
    }),
  });
  if (!resp.ok) {
    const respBody = await resp.text();
    throw new Error(`UAZAPI send/menu (list) failed: ${resp.status} - ${respBody}`);
  }
  return resp.json();
}

function isWithinBusinessHours(settings: any): boolean {
  if (!settings.business_hours_enabled) return true;
  const now = new Date();
  const brasiliaOffset = -3 * 60;
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const brasiliaTime = new Date(utcMs + brasiliaOffset * 60000);
  const dayOfWeek = brasiliaTime.getDay();
  const currentMinutes = brasiliaTime.getHours() * 60 + brasiliaTime.getMinutes();

  // Check per-day schedule first (new system)
  const dailySchedule: any[] = settings.daily_schedule || [];
  if (dailySchedule.length > 0) {
    const todaySchedule = dailySchedule.find((d: any) => d.day === dayOfWeek);
    if (!todaySchedule || !todaySchedule.active) return false;
    const [startH, startM] = (todaySchedule.start || "08:00").split(":").map(Number);
    const [endH, endM] = (todaySchedule.end || "18:00").split(":").map(Number);
    return currentMinutes >= startH * 60 + startM && currentMinutes <= endH * 60 + endM;
  }

  // Fallback: legacy single-range schedule
  const days: number[] = settings.business_days || [1, 2, 3, 4, 5];
  if (!days.includes(dayOfWeek)) return false;
  const [startH, startM] = (settings.business_hours_start || "08:00").split(":").map(Number);
  const [endH, endM] = (settings.business_hours_end || "18:00").split(":").map(Number);
  return currentMinutes >= startH * 60 + startM && currentMinutes <= endH * 60 + endM;
}

function getRandomDelay(min: number, max: number): number {
  return (min + Math.random() * (max - min)) * 1000;
}

function cleanJid(value: string): string {
  const trimmed = value.trim();
  return trimmed.includes("@") ? trimmed.split("@")[0] : trimmed;
}

function checkAutoReply(message: string, autoReplies: any[]): any | null {
  const lowerMsg = message.toLowerCase().trim();
  const sorted = [...autoReplies].filter((r) => r.is_active).sort((a, b) => b.priority - a.priority);
  for (const reply of sorted) {
    const keyword = reply.trigger_keyword.toLowerCase().trim();
    let match = false;
    switch (reply.trigger_type) {
      case "exact": match = lowerMsg === keyword; break;
      case "starts_with": match = lowerMsg.startsWith(keyword); break;
      case "contains": default: match = lowerMsg.includes(keyword); break;
    }
    if (match) return reply;
  }
  return null;
}

// ===================== UAZAPI PAYLOAD EXTRACTION =====================

interface ExtractedPayload {
  messageText: string;
  senderPhone: string;
  fromMe: boolean;
  messageType: string;
  eventType: string;
}

function extractFromMessagesUpsert(body: any): ExtractedPayload | null {
  const event = (body?.event || body?.EventType || body?.action || "").toString();
  let msgData = body?.data;
  if (Array.isArray(msgData)) msgData = msgData[0];
  if (!msgData && Array.isArray(body?.messages)) msgData = body.messages[0];
  if (!msgData && body?.key && body?.message) msgData = body;
  if (!msgData) return null;
  const key = msgData?.key || {};
  const message = msgData?.message || {};
  const fromMe = key?.fromMe === true || msgData?.fromMe === true;
  const remoteJid = key?.remoteJid || msgData?.chatId || msgData?.from || "";
  const messageText = 
    message?.conversation ||
    message?.extendedTextMessage?.text ||
    message?.buttonsResponseMessage?.selectedDisplayText ||
    message?.listResponseMessage?.title ||
    message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
    message?.templateButtonReplyMessage?.selectedDisplayText ||
    message?.editedMessage?.message?.protocolMessage?.editedMessage?.conversation ||
    message?.imageMessage?.caption ||
    message?.videoMessage?.caption ||
    message?.documentMessage?.caption ||
    message?.audioMessage?.caption ||
    msgData?.body || msgData?.text || msgData?.caption || "";
  let messageType = "text";
  if (message?.imageMessage) messageType = "image";
  else if (message?.videoMessage) messageType = "video";
  else if (message?.audioMessage) messageType = "audio";
  else if (message?.documentMessage) messageType = "document";
  else if (message?.stickerMessage) messageType = "sticker";
  else if (message?.contactMessage) messageType = "contact";
  else if (message?.locationMessage) messageType = "location";
  else if (!messageText) messageType = "unknown";
  return {
    messageText: typeof messageText === "string" ? messageText.trim() : "",
    senderPhone: cleanJid(remoteJid),
    fromMe,
    messageType,
    eventType: event,
  };
}

function extractGenericPayload(body: any): ExtractedPayload {
  const eventType = (body?.EventType || body?.event || body?.action || "").toString().toLowerCase();
  const fromMe = body?.message?.fromMe === true || body?.fromMe === true;
  const textCandidates = [
    body?.message?.text,
      body?.message?.caption,
    body?.message?.content?.text,
      body?.message?.content?.caption,
    body?.message?.content?.selectedDisplayText,
    // UAZAPI ButtonsResponseMessage — selectedDisplayText nested inside Response
    body?.message?.content?.Response?.SelectedDisplayText,
    body?.message?.content?.Response?.selectedDisplayText,
    // UAZAPI list response within content
    body?.message?.content?.singleSelectReply?.selectedRowId,
    body?.message?.content?.listResponse?.title,
    body?.message?.content?.listResponse?.singleSelectReply?.selectedRowId,
    body?.message?.content?.conversation,
    body?.message?.content?.extendedTextMessage?.text,
    body?.message?.convertOptions,
    body?.message?.body,
    body?.message?.conversation,
    body?.message?.extendedTextMessage?.text,
    body?.message?.buttonReply?.selectedDisplayText,
    body?.message?.buttonResponseMessage?.selectedDisplayText,
    body?.message?.listReply?.title,
    body?.message?.listResponseMessage?.title,
    body?.message?.templateButtonReplyMessage?.selectedDisplayText,
    // UAZAPI chat-level fallback for last message text
    body?.chat?.wa_lastMessageTextVote,
    body?.text, body?.body,
    body?.data?.text, body?.data?.body,
    body?.data?.message?.text,
      body?.data?.message?.caption,
    body?.data?.message?.conversation,
    body?.data?.message?.extendedTextMessage?.text,
  ];
  let messageText = "";
  for (const val of textCandidates) {
    if (typeof val === "string" && val.trim()) { messageText = val.trim(); break; }
  }
  const phoneCandidates = [
    body?.message?.chatid, body?.chat?.wa_chatid, body?.chat?.phone,
    body?.message?.sender, body?.message?.sender_pn, body?.message?.from,
    body?.from, body?.phone, body?.sender,
    body?.data?.from, body?.data?.phone, body?.data?.sender,
    body?.data?.key?.remoteJid, body?.key?.remoteJid,
  ];
  let senderRaw = "";
  for (const val of phoneCandidates) {
    if (typeof val === "string" && val.trim()) { senderRaw = val.trim(); break; }
  }
  const msg = body?.message || {};
  const msgType = (msg.messageType || msg.type || "").toLowerCase();
  // Detect UAZAPI button/list responses via wa_lastMessageType
  const uazapiMsgType = (body?.chat?.wa_lastMessageType || "").toLowerCase();
  let messageType = "text";
  if (msgType.includes("image") || msg.mediaType === "image") messageType = "image";
  else if (msgType.includes("audio") || msg.mediaType === "audio") messageType = "audio";
  else if (msgType.includes("video") || msg.mediaType === "video") messageType = "video";
  else if (msgType.includes("document") || msg.mediaType === "document") messageType = "document";
  else if (msgType.includes("sticker")) messageType = "sticker";
  else if (uazapiMsgType.includes("buttonsresponse") || uazapiMsgType.includes("listresponse")) messageType = "text";
  else if (msg.content?.URL && !messageText) {
    const lastType = (body?.chat?.wa_lastMessageType || "").toLowerCase();
    if (lastType.includes("audio")) messageType = "audio";
    else if (lastType.includes("video")) messageType = "video";
    else if (lastType.includes("image")) messageType = "image";
    else messageType = "media";
  }
  if (!messageText && messageType === "text") messageType = "unknown";
  return { messageText, senderPhone: cleanJid(senderRaw), fromMe, messageType, eventType };
}

function extractIncomingPayload(body: any): ExtractedPayload {
  const upsert = extractFromMessagesUpsert(body);
  if (upsert && (upsert.senderPhone || upsert.messageText)) return upsert;
  return extractGenericPayload(body);
}

// ===================== AI COMMAND TAG PROCESSOR =====================

interface AiCommandResult {
  cleanText: string;
  commands: { type: string; data?: any }[];
}

function parseAiCommands(text: string): AiCommandResult {
  const commands: { type: string; data?: any }[] = [];
  let cleanText = text;

  // [ENVIAR_MENU] - send the configured interactive menu
  if (cleanText.includes("[ENVIAR_MENU]")) {
    commands.push({ type: "send_menu" });
    cleanText = cleanText.replace(/\[ENVIAR_MENU\]\s*/gi, "").trim();
  }

  // [ENVIAR_CATALOGO] - send subscription plans as list
  if (cleanText.includes("[ENVIAR_CATALOGO]")) {
    commands.push({ type: "send_catalog" });
    cleanText = cleanText.replace(/\[ENVIAR_CATALOGO\]\s*/gi, "").trim();
  }

  // [ENVIAR_BOTOES:titulo1|titulo2|titulo3] - send quick buttons
  const btnMatch = cleanText.match(/\[ENVIAR_BOTOES:(.+?)\]/i);
  if (btnMatch) {
    const titles = btnMatch[1].split("|").map(t => t.trim()).filter(Boolean).slice(0, 3);
    commands.push({ type: "send_buttons", data: titles });
    cleanText = cleanText.replace(/\[ENVIAR_BOTOES:.+?\]\s*/gi, "").trim();
  }

  // [ENVIAR_LISTA:titulo1|titulo2|...] - send list menu with items
  const listMatch = cleanText.match(/\[ENVIAR_LISTA:(.+?)\]/i);
  if (listMatch) {
    const titles = listMatch[1].split("|").map(t => t.trim()).filter(Boolean).slice(0, 10);
    commands.push({ type: "send_list", data: titles });
    cleanText = cleanText.replace(/\[ENVIAR_LISTA:.+?\]\s*/gi, "").trim();
  }

  // [ENVIAR_MEDIA:filename] - existing media tag
  const mediaMatch = cleanText.match(/\[ENVIAR_MEDIA:(.+?)\]/i);
  if (mediaMatch) {
    commands.push({ type: "send_media", data: mediaMatch[1].trim() });
    cleanText = cleanText.replace(/\[ENVIAR_MEDIA:.+?\]\s*/gi, "").trim();
  }

  // [AUDIO:name] - shorthand trigger for audio files
  const audioMatches = cleanText.matchAll(/\[AUDIO:(.+?)\]/gi);
  for (const match of audioMatches) {
    commands.push({ type: "send_audio", data: match[1].trim() });
  }
  cleanText = cleanText.replace(/\[AUDIO:.+?\]\s*/gi, "").trim();

  return { cleanText, commands };
}

async function detectNegativeIntent(message: string): Promise<boolean> {
  const negativePatterns = [
    /\bn[aã]o\s+(quero|preciso|obrigad|interess)/i,
    /\bpar[ea]m?\b/i,
    /\bpare\s+de\b/i,
    /\bparem\s+de\b/i,
    /\bn[aã]o\s+me\s+(mandem?|envie|mande)/i,
    /\bbloque/i,
    /\bdesinscreve/i,
    /\bsair\s+da\s+lista/i,
    /\bremov[ea]/i,
    /\bn[aã]o\s+tenho\s+interesse/i,
    /\bchato/i,
    /\bspam/i,
    /\bincomod/i,
  ];
  const lower = message.toLowerCase().trim();
  return negativePatterns.some((p) => p.test(lower));
}

const ACTIVE_MASS_BROADCAST_STATUSES = ["queued", "running"];
const ELIGIBLE_MASS_BROADCAST_STATUSES = ["queued", "running", "completed", "paused"];
const DEFAULT_MASS_BROADCAST_SELLER_INSTRUCTIONS = "Vendedor Max da TV Max, simpático e focado em oferecer teste grátis";
const MASS_BROADCAST_CLOSING_MESSAGE = "Gostaria de fazer um teste totalmente grátis agora mesmo para ver a qualidade?";

function nonEmptyList(values: string[] | null | undefined, fallback: string[] = []): string[] {
  const parsed = Array.isArray(values)
    ? values.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  return parsed.length > 0 ? parsed : fallback;
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function toTimestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function campaignStatusPriority(status: string): number {
  if (ACTIVE_MASS_BROADCAST_STATUSES.includes(status)) return 0;
  if (status === "completed") return 1;
  if (status === "paused") return 2;
  return 3;
}

function recipientStepPriority(step: string): number {
  if (step === "awaiting_reply") return 0;
  if (step === "greeting") return 1;
  if (step === "conversing") return 2;
  if (step === "done") return 3;
  return 4;
}

async function callAISeller(
  sellerInstructions: string,
  clientMessage: string,
  offerText: string,
  conversationHistory: string,
): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return offerText;

  const safeInstructions = sellerInstructions?.trim() || DEFAULT_MASS_BROADCAST_SELLER_INSTRUCTIONS;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `Você é um vendedor via WhatsApp. ${safeInstructions}\n\nRegras:\n- O cliente acabou de responder à sua saudação.\n- Responda em no máximo 1 frase curta, natural e humana.\n- Depois dessa frase, cole a OFERTA exatamente como recebida, sem alterar nenhuma palavra.\n- Não use emojis em excesso.\n- Responda APENAS com o texto final.\n\nHistórico:\n${conversationHistory}\n\nOFERTA (copiar literalmente no final):\n${offerText}`,
          },
          {
            role: "user",
            content: `Cliente respondeu: "${clientMessage}". Gere uma resposta curta + oferta literal.`,
          },
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

async function callAIFollowUp(
  sellerInstructions: string,
  clientMessage: string,
  conversationHistory: string,
): Promise<string | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return null;

  const safeInstructions = sellerInstructions?.trim() || DEFAULT_MASS_BROADCAST_SELLER_INSTRUCTIONS;

  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: `Você é um vendedor via WhatsApp. ${safeInstructions}\n\nRegras:\n- O cliente já recebeu a oferta e pode estar tirando dúvidas.\n- Responda de forma breve e objetiva (máximo 2 linhas).\n- Reforce de forma sutil o teste grátis quando fizer sentido.\n- Não repita textão completo da oferta.\n- Responda APENAS com a mensagem final.\n\nHistórico:\n${conversationHistory}`,
          },
          { role: "user", content: clientMessage },
        ],
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data?.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

async function ensureCampaignConversation(
  supabase: ReturnType<typeof createClient>,
  payload: { companyId: string; campaignId: string; recipientId: string; normalizedPhone: string; timestamp: string },
): Promise<{ id: string; conversation_status: string }> {
  const { data: existingConversation } = await supabase
    .from("mass_broadcast_conversations")
    .select("id, conversation_status")
    .eq("company_id", payload.companyId)
    .eq("campaign_id", payload.campaignId)
    .eq("normalized_phone", payload.normalizedPhone)
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; conversation_status: string }>();

  if (existingConversation?.id) {
    return existingConversation;
  }

  const { data: createdConversation } = await supabase
    .from("mass_broadcast_conversations")
    .insert({
      company_id: payload.companyId,
      campaign_id: payload.campaignId,
      recipient_id: payload.recipientId,
      phone: payload.normalizedPhone,
      normalized_phone: payload.normalizedPhone,
      contact_name: payload.normalizedPhone,
      conversation_status: "bot_active",
      has_reply: false,
      last_message_at: payload.timestamp,
      last_outgoing_at: payload.timestamp,
    })
    .select("id, conversation_status")
    .single<{ id: string; conversation_status: string }>();

  return createdConversation as { id: string; conversation_status: string };
}

async function resolveMassBroadcastContext(
  supabase: ReturnType<typeof createClient>,
  payload: { companyId: string; normalizedPhone: string },
): Promise<{ recipient: any; campaign: any } | null> {
  const { data: recipientRows } = await supabase
    .from("mass_broadcast_recipients")
    .select("id, campaign_id, company_id, phone, normalized_phone, offer_template, status, current_step, updated_at")
    .eq("company_id", payload.companyId)
    .eq("normalized_phone", payload.normalizedPhone)
    .order("updated_at", { ascending: false })
    .limit(60);

  if (!recipientRows?.length) return null;

  const eligibleRecipients = recipientRows.filter((row: any) => String(row.current_step || "") !== "not_interested");
  if (!eligibleRecipients.length) return null;

  const campaignIds = [...new Set(eligibleRecipients.map((row: any) => row.campaign_id).filter(Boolean))];
  if (!campaignIds.length) return null;

  const { data: campaigns } = await supabase
    .from("mass_broadcast_campaigns")
    .select("id, status, seller_instructions, offer_templates, updated_at")
    .eq("company_id", payload.companyId)
    .in("id", campaignIds)
    .limit(campaignIds.length);

  if (!campaigns?.length) return null;

  const campaignById = new Map(
    campaigns
      .filter((campaign: any) => ELIGIBLE_MASS_BROADCAST_STATUSES.includes(String(campaign.status || "")))
      .map((campaign: any) => [campaign.id, campaign]),
  );

  const candidatePairs = eligibleRecipients
    .map((recipient: any) => ({ recipient, campaign: campaignById.get(recipient.campaign_id) }))
    .filter((pair: any) => Boolean(pair.campaign));

  if (!candidatePairs.length) return null;

  candidatePairs.sort((a: any, b: any) => {
    const statusDiff = campaignStatusPriority(String(a.campaign.status || "")) - campaignStatusPriority(String(b.campaign.status || ""));
    if (statusDiff !== 0) return statusDiff;

    const stepDiff = recipientStepPriority(String(a.recipient.current_step || "")) - recipientStepPriority(String(b.recipient.current_step || ""));
    if (stepDiff !== 0) return stepDiff;

    return toTimestamp(String(b.recipient.updated_at || "")) - toTimestamp(String(a.recipient.updated_at || ""));
  });

  return candidatePairs[0] || null;
}

async function recordMassBroadcastIncoming(
  supabase: ReturnType<typeof createClient>,
  apiUrl: string | null,
  apiToken: string | null,
  payload: {
    companyId: string;
    phone: string;
    message: string;
    messageType: string;
  },
): Promise<{ conversation_status: string; ai_handled: boolean } | null> {
  const normalizedPhone = normalizePhone(payload.phone);
  if (!payload.companyId || !normalizedPhone) return null;

  const nowIso = new Date().toISOString();
  const context = await resolveMassBroadcastContext(supabase, {
    companyId: payload.companyId,
    normalizedPhone,
  });

  if (!context) return null;

  const { recipient, campaign } = context;

  const conversation = await ensureCampaignConversation(supabase, {
    companyId: payload.companyId,
    campaignId: recipient.campaign_id,
    recipientId: recipient.id,
    normalizedPhone,
    timestamp: nowIso,
  });

  const isHumanTakeover = conversation.conversation_status === "human_takeover";
  const nextStatus = isHumanTakeover ? "human_takeover" : "awaiting_human";

  await supabase.from("mass_broadcast_conversation_messages").insert({
    company_id: payload.companyId,
    campaign_id: recipient.campaign_id,
    conversation_id: conversation.id,
    recipient_id: recipient.id,
    phone: normalizedPhone,
    normalized_phone: normalizedPhone,
    direction: "inbound",
    sender_type: "client",
    source: "whatsapp_webhook",
    message_type: payload.messageType || "text",
    message: payload.message,
    delivery_status: "received",
    created_at: nowIso,
  });

  await supabase
    .from("mass_broadcast_conversations")
    .update({
      conversation_status: nextStatus,
      has_reply: true,
      last_message_at: nowIso,
      last_incoming_at: nowIso,
      recipient_id: recipient.id,
    })
    .eq("id", conversation.id);

  await supabase.from("mass_broadcast_logs").insert({
    campaign_id: recipient.campaign_id,
    recipient_id: recipient.id,
    company_id: payload.companyId,
    phone: normalizedPhone,
    step: "incoming_message",
    status: "success",
    message: `[LOG] Mensagem recebida de ${normalizedPhone}`,
    error_message: null,
  });

  if (isHumanTakeover || !apiUrl || !apiToken || payload.messageType !== "text" || !payload.message.trim()) {
    return { conversation_status: nextStatus, ai_handled: false };
  }

  let aiHandled = false;

  try {
    await supabase.from("mass_broadcast_logs").insert({
      campaign_id: recipient.campaign_id,
      recipient_id: recipient.id,
      company_id: payload.companyId,
      phone: normalizedPhone,
      step: "ai_processing",
      status: "processing",
      message: "[LOG] Processando resposta via IA...",
      error_message: null,
    });

    const isNegative = await detectNegativeIntent(payload.message);
    if (isNegative) {
      const apologyMsg = "Peço desculpas pelo incômodo! Não vou mais enviar mensagens. Tenha um ótimo dia! 🙏";
      await sendText(apiUrl, apiToken, normalizedPhone, apologyMsg);

      const sentAt = new Date().toISOString();
      await supabase.from("mass_broadcast_conversation_messages").insert({
        company_id: payload.companyId,
        campaign_id: recipient.campaign_id,
        conversation_id: conversation.id,
        recipient_id: recipient.id,
        phone: normalizedPhone,
        normalized_phone: normalizedPhone,
        direction: "outbound",
        sender_type: "bot",
        source: "ai_seller",
        message_type: "text",
        message: apologyMsg,
        delivery_status: "sent",
        created_at: sentAt,
      });

      await supabase
        .from("mass_broadcast_recipients")
        .update({ status: "failed", current_step: "not_interested", error_message: "Cliente não interessado", last_attempt_at: sentAt })
        .eq("id", recipient.id);

      await supabase
        .from("mass_broadcast_conversations")
        .update({ conversation_status: "not_interested", last_outgoing_at: sentAt, last_message_at: sentAt })
        .eq("id", conversation.id);

      await supabase.from("mass_broadcast_logs").insert({
        campaign_id: recipient.campaign_id,
        recipient_id: recipient.id,
        company_id: payload.companyId,
        phone: normalizedPhone,
        step: "not_interested",
        status: "success",
        message: apologyMsg,
        error_message: "Cliente sinalizou desinteresse",
      });

      return { conversation_status: "not_interested", ai_handled: true };
    }

    const sellerInstructions = String(campaign.seller_instructions || "").trim() || DEFAULT_MASS_BROADCAST_SELLER_INSTRUCTIONS;

    const { data: history } = await supabase
      .from("mass_broadcast_conversation_messages")
      .select("direction, message")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true })
      .limit(30);

    const historyText = (history || [])
      .map((item: any) => `${item.direction === "outbound" ? "Vendedor" : "Cliente"}: ${item.message}`)
      .join("\n");

    const { data: offerFlowAlreadyExecuted } = await supabase
      .from("mass_broadcast_logs")
      .select("id")
      .eq("recipient_id", recipient.id)
      .in("step", ["ai_offer_cta_sent", "ai_offer_reply"])
      .eq("status", "success")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const mustTriggerOfferFlow = !offerFlowAlreadyExecuted;

    if (mustTriggerOfferFlow) {
      const offerCandidates = nonEmptyList(campaign.offer_templates, [recipient.offer_template]);
      const selectedOffer = offerCandidates.length > 0 ? pickRandom(offerCandidates) : String(recipient.offer_template || "").trim();
      if (!selectedOffer) throw new Error("Nenhum textão de oferta disponível para este contato.");

      const immediateReply = await callAISeller(sellerInstructions, payload.message, selectedOffer, historyText);
      await sendText(apiUrl, apiToken, normalizedPhone, immediateReply);

      const offerSentAt = new Date().toISOString();
      await supabase.from("mass_broadcast_conversation_messages").insert({
        company_id: payload.companyId,
        campaign_id: recipient.campaign_id,
        conversation_id: conversation.id,
        recipient_id: recipient.id,
        phone: normalizedPhone,
        normalized_phone: normalizedPhone,
        direction: "outbound",
        sender_type: "bot",
        source: "ai_seller",
        message_type: "text",
        message: immediateReply,
        delivery_status: "sent",
        created_at: offerSentAt,
      });

      await sleep(5000);
      await sendText(apiUrl, apiToken, normalizedPhone, MASS_BROADCAST_CLOSING_MESSAGE);

      const ctaSentAt = new Date().toISOString();
      await supabase.from("mass_broadcast_conversation_messages").insert({
        company_id: payload.companyId,
        campaign_id: recipient.campaign_id,
        conversation_id: conversation.id,
        recipient_id: recipient.id,
        phone: normalizedPhone,
        normalized_phone: normalizedPhone,
        direction: "outbound",
        sender_type: "bot",
        source: "ai_seller",
        message_type: "text",
        message: MASS_BROADCAST_CLOSING_MESSAGE,
        delivery_status: "sent",
        created_at: ctaSentAt,
      });

      const nextActionAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      await supabase
        .from("mass_broadcast_recipients")
        .update({
          status: "processing",
          current_step: "conversing",
          sent_offer_at: offerSentAt,
          last_attempt_at: ctaSentAt,
          next_action_at: nextActionAt,
          error_message: null,
        })
        .eq("id", recipient.id);

      await supabase
        .from("mass_broadcast_conversations")
        .update({
          conversation_status: "bot_active",
          has_reply: true,
          last_outgoing_at: ctaSentAt,
          last_message_at: ctaSentAt,
        })
        .eq("id", conversation.id);

      await supabase.from("mass_broadcast_logs").insert({
        campaign_id: recipient.campaign_id,
        recipient_id: recipient.id,
        company_id: payload.companyId,
        phone: normalizedPhone,
        step: "ai_offer_cta_sent",
        status: "success",
        message: "[LOG] Oferta e CTA de Teste Grátis enviados.",
        error_message: null,
      });

      aiHandled = true;
    } else {
      const aiReply = await callAIFollowUp(sellerInstructions, payload.message, historyText);
      const followUpReply = aiReply?.trim();

      if (followUpReply) {
        await sendText(apiUrl, apiToken, normalizedPhone, followUpReply);

        const sentAt = new Date().toISOString();
        await supabase.from("mass_broadcast_conversation_messages").insert({
          company_id: payload.companyId,
          campaign_id: recipient.campaign_id,
          conversation_id: conversation.id,
          recipient_id: recipient.id,
          phone: normalizedPhone,
          normalized_phone: normalizedPhone,
          direction: "outbound",
          sender_type: "bot",
          source: "ai_seller",
          message_type: "text",
          message: followUpReply,
          delivery_status: "sent",
          created_at: sentAt,
        });

        const nextActionAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        await supabase
          .from("mass_broadcast_recipients")
          .update({
            status: "processing",
            current_step: "conversing",
            last_attempt_at: sentAt,
            next_action_at: nextActionAt,
            error_message: null,
          })
          .eq("id", recipient.id);

        await supabase
          .from("mass_broadcast_conversations")
          .update({
            conversation_status: "bot_active",
            has_reply: true,
            last_outgoing_at: sentAt,
            last_message_at: sentAt,
          })
          .eq("id", conversation.id);

        await supabase.from("mass_broadcast_logs").insert({
          campaign_id: recipient.campaign_id,
          recipient_id: recipient.id,
          company_id: payload.companyId,
          phone: normalizedPhone,
          step: "ai_offer_reply",
          status: "success",
          message: `✅ Resposta enviada com sucesso para ${normalizedPhone} via IA.`,
          error_message: null,
        });

        aiHandled = true;
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await supabase.from("mass_broadcast_logs").insert({
      campaign_id: recipient.campaign_id,
      recipient_id: recipient.id,
      company_id: payload.companyId,
      phone: normalizedPhone,
      step: "ai_error",
      status: "error",
      message: `[LOG] Erro na IA para ${normalizedPhone}`,
      error_message: errorMessage,
    });
    console.error("AI seller error:", error);
  }

  return {
    conversation_status: aiHandled ? "bot_active" : nextStatus,
    ai_handled: aiHandled,
  };
}

// ===================== MAIN HANDLER =====================

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  if (req.method === "GET") {
    return new Response(JSON.stringify({ status: "ok", message: "Chatbot webhook is running" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const reqUrl = new URL(req.url);
  const rawCompanyId = reqUrl.searchParams.get("company_id") || "";
  const uuidMatch = rawCompanyId.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  const companyIdParam = uuidMatch ? uuidMatch[1] : rawCompanyId || null;
  // UAZAPI appends event paths like /messages/text to webhook URL, corrupting the last query param
  const rawUserId = reqUrl.searchParams.get("user_id") || "";
  const userIdMatch = rawUserId.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  const userIdParam = userIdMatch ? userIdMatch[1] : "";

  // Decision log accumulator
  const decisions: string[] = [];

  try {
    let body: any;
    try {
      body = await req.json();
    } catch (parseErr) {
      console.error("Falha ao parsear JSON do body:", parseErr);
      return new Response(JSON.stringify({ status: "ok", info: "invalid_json" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("===== WEBHOOK RECEBIDO =====");
    console.log("company_id:", companyIdParam, "user_id:", userIdParam);
    console.log("CONTEÚDO DO WEBHOOK:", JSON.stringify(body, null, 2).slice(0, 5000));

    // ── Handle connection/disconnection events (UAZAPI format: EventType + instance.status) ──
    if (userIdParam) {
      const eventTypeRaw = (body.EventType || body.event || body.eventType || "").toString().toLowerCase();
      const instanceStatus = (body.instance?.status || body.status || "").toString().toLowerCase();
      
      const isConnected =
        (eventTypeRaw === "connection" && instanceStatus === "connected") ||
        body.status === "CONNECTED" ||
        body.connected === true;
      const isDisconnected =
        (eventTypeRaw === "connection" && instanceStatus === "disconnected") ||
        eventTypeRaw === "disconnected" ||
        body.status === "DISCONNECTED" ||
        body.connected === false;

      if (isConnected) {
        await supabase
          .from("whatsapp_instances")
          .update({
            status: "connected",
            is_connected: true,
            last_connection_at: new Date().toISOString(),
          })
          .eq("user_id", userIdParam);
        console.log(`[chatbot-webhook] User ${userIdParam} → connected (EventType=${eventTypeRaw}, instance.status=${instanceStatus})`);
      } else if (isDisconnected) {
        await supabase
          .from("whatsapp_instances")
          .update({ status: "disconnected", is_connected: false })
          .eq("user_id", userIdParam);
        console.log(`[chatbot-webhook] User ${userIdParam} → disconnected (EventType=${eventTypeRaw}, instance.status=${instanceStatus})`);
      }
    }

    const { messageText, senderPhone, fromMe, messageType, eventType } = extractIncomingPayload(body);
    console.log("Dados extraídos:", JSON.stringify({ messageText: messageText.slice(0, 200), senderPhone, fromMe, messageType, eventType }));

    // Filter non-message events
    const ignoredEvents = ["chats", "status", "connection", "contacts", "groups", "call", "presence", "labels", "messages_update", "chat_labels", "receipt", "history"];
    const eventLower = eventType.toLowerCase();
    if (eventLower && ignoredEvents.some(e => eventLower.includes(e))) {
      console.log("Evento ignorado:", eventType);
      return new Response(JSON.stringify({ status: "ok", ignored_event: eventType }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }


    // Ignore group messages - check all possible indicators
    const rawJid = body?.data?.key?.remoteJid || body?.key?.remoteJid || 
      body?.message?.chatid || body?.chat?.wa_chatid || body?.from || "";
    const isGroup = 
      rawJid.includes("@g.us") || 
      rawJid.includes("@broadcast") ||
      body?.message?.isGroup === true || 
      body?.chat?.wa_isGroup === true || 
      body?.data?.isGroup === true ||
      (body?.data?.key?.remoteJid || "").endsWith("@g.us") ||
      (senderPhone && senderPhone.includes("120363"));
    if (isGroup) {
      console.log("Mensagem de grupo ignorada:", senderPhone, "JID:", rawJid);
      return new Response(JSON.stringify({ status: "ok", reason: "group_message" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Ignore own messages
    if (fromMe) {
      return new Response(JSON.stringify({ status: "ok", reason: "from_me" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Credential resolution (unified with auto-send-messages strategy) ──
    // Build candidate list, validate each, use first working one
    let companyApiUrl: string | null = null;
    let companyApiToken: string | null = null;

    // Extract token and URL from UAZAPI payload (highest priority — fresh from the source)
    const payloadToken = String(body?.token || "").trim();
    const payloadBaseUrl = (body?.BaseUrl || "").toString().trim().replace(/\/$/, "");
    const payloadInstanceName = String(body?.instanceName || body?.instance?.instanceName || "").trim();

    if (companyIdParam) {
      // Collect all possible URLs and tokens from DB
      const { data: apiSettings } = await supabase
        .from("api_settings").select("api_url, api_token").eq("company_id", companyIdParam).maybeSingle();
      const dbToken = String(apiSettings?.api_token || "").trim();
      const dbUrl = String(apiSettings?.api_url || "").trim().replace(/\/$/, "");

      let instToken = "";
      let instUrl = "";
      if (userIdParam) {
        const { data: inst } = await supabase
          .from("whatsapp_instances").select("server_url, instance_token, is_connected")
          .eq("user_id", userIdParam).maybeSingle();
        instToken = String(inst?.instance_token || "").trim();
        instUrl = String(inst?.server_url || "").trim().replace(/\/$/, "");
      }

      const envToken = resolveApiTokenFromEnv();
      const envUrl = resolveApiUrlFromEnv();

      // Resolve URL (first available)
      companyApiUrl = dbUrl || instUrl || envUrl || payloadBaseUrl || null;

      // Build token candidates — payload token FIRST (it comes directly from UAZAPI)
      const tokenCandidates: string[] = [];
      const seen = new Set<string>();
      for (const t of [payloadToken, instToken, dbToken, envToken]) {
        const clean = t.trim();
        if (clean.length > 5 && !clean.includes("curl") && !clean.startsWith("http") && !seen.has(clean)) {
          seen.add(clean);
          tokenCandidates.push(clean);
        }
      }

      console.log(`[chatbot-webhook] Credential resolution: URL=${companyApiUrl || 'none'}, candidates=${tokenCandidates.length} [${tokenCandidates.map(t => t.substring(0, 8) + '...').join(', ')}]`);

      if (companyApiUrl && tokenCandidates.length > 0) {
        // Validate tokens against API (try each until one works)
        for (const candidate of tokenCandidates) {
          const valid = await validateApiToken(companyApiUrl, candidate);
          if (valid) {
            companyApiToken = candidate;
            console.log(`[chatbot-webhook] Token VALIDATED: ${candidate.substring(0, 8)}...`);

            // Auto-sync validated token back to DB if it differs
            if (candidate !== dbToken && companyIdParam) {
              supabase.from("api_settings")
                .update({ api_token: candidate, updated_at: new Date().toISOString() })
                .eq("company_id", companyIdParam)
                .then(() => console.log("[chatbot-webhook] DB token auto-synced with validated token"));
            }
            if (candidate !== instToken && userIdParam) {
              supabase.from("whatsapp_instances")
                .update({ instance_token: candidate, status: "connected", is_connected: true, updated_at: new Date().toISOString() })
                .eq("user_id", userIdParam)
                .then(() => console.log("[chatbot-webhook] Instance token auto-synced"));
            }
            break;
          }
          console.warn(`[chatbot-webhook] Token INVALID: ${candidate.substring(0, 8)}... (skipping)`);
        }

        // If no candidate validated, use first one anyway (error will be caught later)
        if (!companyApiToken) {
          companyApiToken = tokenCandidates[0];
          console.warn(`[chatbot-webhook] No token validated, using first candidate: ${companyApiToken.substring(0, 8)}...`);
        }
      } else if (tokenCandidates.length > 0) {
        companyApiToken = tokenCandidates[0];
        console.log(`[chatbot-webhook] No URL to validate, using first token: ${companyApiToken.substring(0, 8)}...`);
      }
    }

    // Use BaseUrl from payload ONLY for URL if still missing
    if (!companyApiUrl) {
      if (payloadBaseUrl) companyApiUrl = payloadBaseUrl;
    }

    // Handle non-text messages
    if (!messageText && senderPhone && companyIdParam && messageType !== "text" && messageType !== "unknown") {
      const massBroadcastConversation = await recordMassBroadcastIncoming(supabase, companyApiUrl, companyApiToken, {
        companyId: companyIdParam,
        phone: senderPhone,
        message: `[${messageType.toUpperCase()}]`,
        messageType,
      });

      await supabase.from("chatbot_logs").insert({
        company_id: companyIdParam, phone: normalizePhone(senderPhone),
        client_name: `Mídia (${messageType})`, message_received: `[${messageType.toUpperCase()}]`,
        message_sent: "", context_type: "media_received", status: "ignored",
        error_message: `Tipo de mensagem não processável: ${messageType}`,
      });

      if ((massBroadcastConversation as any)?.conversation_status === "human_takeover") {
        return new Response(JSON.stringify({ status: "ok", reason: "human_takeover_media" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ status: "ok", reason: "non_text", type: messageType }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate required fields
    if (!messageText || !senderPhone || !companyIdParam) {
      const bodyKeys = body && typeof body === "object" ? Object.keys(body).slice(0, 20) : [];
      const debugDetails = `Missing: text=${!!messageText} phone=${!!senderPhone} company=${!!companyIdParam} type=${messageType} event=${eventType} keys=[${bodyKeys.join(",")}]`;
      if (companyIdParam) {
        await supabase.from("chatbot_logs").insert({
          company_id: companyIdParam, phone: normalizePhone(senderPhone || ""),
          client_name: "Payload inválido", message_received: (messageText || "").slice(0, 500),
          message_sent: "", context_type: "invalid_payload", status: "error",
          error_message: `${debugDetails} | preview: ${JSON.stringify(body).slice(0, 300)}`,
        });
      }
      return new Response(JSON.stringify({ status: "ok", info: "missing_fields", details: debugDetails }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phone = normalizePhone(senderPhone);

    // === EARLY is_active CHECK — must happen BEFORE any AI processing ===
    const { data: chatSettingsEarly } = await supabase
      .from("chatbot_settings").select("is_active").eq("company_id", companyIdParam).maybeSingle();

    const botIsActive = chatSettingsEarly?.is_active === true;

    const massBroadcastConversation = await recordMassBroadcastIncoming(supabase, companyApiUrl, companyApiToken, {
      companyId: companyIdParam,
      phone,
      message: messageText.slice(0, 4000),
      messageType: messageType || "text",
    });
    if ((massBroadcastConversation as any)?.conversation_status === "human_takeover") {
      return new Response(JSON.stringify({ status: "ok", reason: "human_takeover" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // If AI seller already handled this message, don't let the regular chatbot also reply
    if ((massBroadcastConversation as any)?.ai_handled === true) {
      console.log(`AI seller handled message from ${phone}, skipping chatbot.`);
      return new Response(JSON.stringify({ status: "ok", reason: "ai_seller_handled" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If bot is disabled, stop here (after recording broadcast but before chatbot replies)
    if (!botIsActive) {
      console.log(`Bot desativado para empresa ${companyIdParam}, ignorando mensagem.`);
      return new Response(JSON.stringify({ status: "ok", reason: "bot_disabled" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Processando mensagem de ${phone}: "${messageText.slice(0, 100)}"`);
    decisions.push(`📩 Mensagem recebida de ${phone}: "${messageText.slice(0, 60)}"`);

    // Fetch full chatbot settings (we already confirmed is_active=true)
    const { data: chatSettings } = await supabase
      .from("chatbot_settings").select("*").eq("company_id", companyIdParam).single();

    const presenceEnabled = chatSettings.presence_enabled !== false;
    const aiDecisionLog = chatSettings.ai_decision_log !== false;

    // Check blocked contacts
    const { data: blocked } = await supabase
      .from("chatbot_blocked_contacts").select("id").eq("company_id", companyIdParam).eq("phone", phone).maybeSingle();
    if (blocked) {
      decisions.push("🚫 Contato bloqueado → Ignorando");
      return new Response(JSON.stringify({ status: "ok", reason: "blocked" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use already-resolved credentials (no duplicate fetch needed)
    let apiUrl = companyApiUrl || "";
    let apiToken = companyApiToken || "";
    if (!apiUrl || !apiToken) {
      return new Response(JSON.stringify({ status: "ok", reason: "api_not_configured" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    apiUrl = apiUrl.replace(/\/$/, "");
    const minDelay = chatSettings.min_delay_seconds ?? 3;
    const maxDelay = chatSettings.max_delay_seconds ?? 6;

    // Helper: simulate presence only if enabled
    async function doPresence(type: "composing" | "recording", min: number, max: number) {
      if (presenceEnabled) {
        await simulatePresence(apiUrl, apiToken, phone, type, getRandomDelay(min, max));
      }
    }

    // Check max messages per contact limit
    const maxMsgsLimit = chatSettings.max_messages_per_contact || 0;
    if (maxMsgsLimit > 0) {
      const twentyFourHoursAgoCheck = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count: msgCount } = await supabase
        .from("chatbot_logs")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyIdParam)
        .eq("phone", phone)
        .eq("status", "success")
        .gte("created_at", twentyFourHoursAgoCheck);

      if (msgCount !== null && msgCount >= maxMsgsLimit) {
        decisions.push(`🛑 Limite de ${maxMsgsLimit} mensagens/24h atingido (${msgCount} enviadas)`);
        const closingMsg = chatSettings.closing_message?.trim();
        if (closingMsg) {
          const { data: alreadySentClosing } = await supabase
            .from("chatbot_logs")
            .select("id")
            .eq("company_id", companyIdParam)
            .eq("phone", phone)
            .eq("context_type", "closing")
            .gte("created_at", twentyFourHoursAgoCheck)
            .limit(1)
            .maybeSingle();

          if (!alreadySentClosing) {
            decisions.push("📩 Enviando mensagem de encerramento");
            await doPresence("composing", minDelay, maxDelay);
            await sendText(apiUrl, apiToken, phone, closingMsg);
            await supabase.from("chatbot_logs").insert({
              company_id: companyIdParam, phone, client_name: "Limite atingido",
              message_received: messageText.slice(0, 500), message_sent: closingMsg.slice(0, 500),
              context_type: "closing", status: "success",
              error_message: aiDecisionLog ? decisions.join("\n") : null,
            });
          }
        }
        return new Response(JSON.stringify({ status: "ok", reason: "max_messages_reached" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      decisions.push(`📊 Mensagens enviadas: ${msgCount || 0}/${maxMsgsLimit} (24h)`);
    }

    // Check business hours
    if (!isWithinBusinessHours(chatSettings)) {
      decisions.push("🕐 Fora do horário comercial → Enviando mensagem de ausência");
      const awayMsg = chatSettings.away_message?.trim();
      if (awayMsg) {
        await doPresence("composing", minDelay, maxDelay);
        await sendText(apiUrl, apiToken, phone, awayMsg);
        await supabase.from("chatbot_logs").insert({
          company_id: companyIdParam, phone, client_name: "Fora do horário",
          message_received: messageText.slice(0, 500), message_sent: awayMsg.slice(0, 500),
          context_type: "away", status: "success",
          error_message: aiDecisionLog ? decisions.join("\n") : null,
        });
      }
      return new Response(JSON.stringify({ status: "ok", reason: "outside_hours" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check transfer keyword
    const transferKw = (chatSettings.transfer_keyword || "").trim().toLowerCase();
    if (transferKw && messageText.toLowerCase().trim().includes(transferKw)) {
      decisions.push(`🔄 Keyword de transferência "${transferKw}" detectada → Transferindo`);
      const transferMsg = chatSettings.transfer_message?.trim() || "Transferindo para um atendente...";
      await doPresence("composing", minDelay, maxDelay);
      await sendText(apiUrl, apiToken, phone, transferMsg);
      await supabase.from("chatbot_logs").insert({
        company_id: companyIdParam, phone, client_name: "Transferência",
        message_received: messageText.slice(0, 500), message_sent: transferMsg.slice(0, 500),
        context_type: "transfer", status: "success",
        error_message: aiDecisionLog ? decisions.join("\n") : null,
      });
      return new Response(JSON.stringify({ status: "ok", reason: "transferred" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check auto-replies
    const { data: autoReplies } = await supabase
      .from("chatbot_auto_replies").select("*").eq("company_id", companyIdParam);
    if (autoReplies && autoReplies.length > 0) {
      const matchedReply = checkAutoReply(messageText, autoReplies);
      if (matchedReply) {
        decisions.push(`⚡ Gatilho automático ativado: "${matchedReply.trigger_keyword}" → Resposta direta`);
        await doPresence("composing", minDelay, maxDelay);
        await sendText(apiUrl, apiToken, phone, matchedReply.response_text);
        if (matchedReply.response_media_id) {
          const { data: media } = await supabase
            .from("chatbot_media").select("*").eq("id", matchedReply.response_media_id).single();
          if (media) {
            const presType = media.file_type === "audio" ? "recording" : "composing";
            await doPresence(presType as any, minDelay + 2, maxDelay + 3);
            await sendMedia(apiUrl, apiToken, phone, media.file_url, media.file_type);
          }
        }
        await supabase.from("chatbot_logs").insert({
          company_id: companyIdParam, phone, client_name: "Auto-Reply",
          message_received: messageText.slice(0, 500), message_sent: matchedReply.response_text.slice(0, 500),
          context_type: "auto_reply", status: "success",
          error_message: aiDecisionLog ? decisions.join("\n") : null,
        });
        return new Response(JSON.stringify({ status: "ok", reason: "auto_reply" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Handle menu item responses
    const menuEnabled = chatSettings.interactive_menu_enabled;
    const menuItems: any[] = chatSettings.interactive_menu_items || [];
    const lowerText = messageText.toLowerCase().trim();
    const explicitMenuRequest = /(^|\b)(op[cç](?:õ|o)es?|menu(?: principal)?)(\b|$)/i.test(lowerText);
    const explicitCatalogRequest = /(^|\b)(planos?|cat[aá]logo|ver planos?|ver cat[aá]logo)(\b|$)/i.test(lowerText);
    
    const isMenuResponse = menuEnabled && menuItems.length > 0 && menuItems.some((item: any) => {
      const itemTitle = (item.title || "").toLowerCase().trim();
      const itemId = (item.id || "").toLowerCase().trim();
      return itemTitle && (lowerText === itemTitle || lowerText === itemId || lowerText.includes(itemTitle));
    });

    if (isMenuResponse) {
      // Handle "ver catalogo"
      if (lowerText.includes("ver catalogo") || lowerText.includes("ver catálogo") || lowerText.includes("catalogo") || lowerText.includes("catálogo")) {
        decisions.push("📋 Resposta de menu: 'Ver Catálogo' → Buscando planos ativos");
        const { data: plans } = await supabase
          .from("subscription_plans")
          .select("id, name, price, duration_days, description")
          .eq("company_id", companyIdParam)
          .eq("is_active", true)
          .order("price", { ascending: true })
          .limit(10);

        if (plans && plans.length > 0) {
          const catalogItems = plans.map((plan: any) => ({
            id: `plan_${plan.id}`,
            title: plan.name,
            description: `R$ ${Number(plan.price).toFixed(2)} - ${plan.duration_days} dias`,
          }));
          decisions.push(`✅ ${plans.length} planos encontrados → Enviando lista interativa`);
          try {
            await doPresence("composing", minDelay, maxDelay);
            await sendList(apiUrl, apiToken, phone, "📋 Nosso Catálogo", "Confira nossos planos disponíveis! Selecione um para mais informações:", "Preços atualizados", "Ver Planos", catalogItems);
            await supabase.from("chatbot_logs").insert({
              company_id: companyIdParam, phone, client_name: "Catálogo",
              message_received: messageText.slice(0, 500),
              message_sent: `[CATÁLOGO] ${plans.map((p: any) => p.name).join(" | ")}`.slice(0, 500),
              context_type: "auto_reply", status: "success",
              error_message: aiDecisionLog ? decisions.join("\n") : null,
            });
            return new Response(JSON.stringify({ status: "ok", reason: "catalog_sent" }), {
              status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          } catch (catErr: any) {
            decisions.push(`⚠️ Falha na lista interativa → Enviando como texto`);
            const textCatalog = plans.map((p: any) => 
              `📦 *${p.name}*\n💰 R$ ${Number(p.price).toFixed(2)}\n⏱️ ${p.duration_days} dias${p.description ? `\n📝 ${p.description}` : ""}`
            ).join("\n\n");
            await sendText(apiUrl, apiToken, phone, `📋 *Nosso Catálogo de Planos:*\n\n${textCatalog}\n\nPara contratar, fale com nosso atendente! 😊`);
            await supabase.from("chatbot_logs").insert({
              company_id: companyIdParam, phone, client_name: "Catálogo (texto)",
              message_received: messageText.slice(0, 500), message_sent: textCatalog.slice(0, 500),
              context_type: "auto_reply", status: "success",
              error_message: aiDecisionLog ? decisions.join("\n") : null,
            });
            return new Response(JSON.stringify({ status: "ok", reason: "catalog_text_fallback" }), {
              status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        } else {
          decisions.push("⚠️ Nenhum plano ativo → Enviando mensagem padrão");
          await doPresence("composing", minDelay, maxDelay);
          await sendText(apiUrl, apiToken, phone, "No momento não temos planos cadastrados no catálogo. Entre em contato com nosso atendente para mais informações! 😊");
          return new Response(JSON.stringify({ status: "ok", reason: "no_plans" }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
      
      decisions.push(`🔘 Resposta de menu "${lowerText}" não mapeada → Passando para IA`);
    }
    decisions.push("🧭 Menu automático inicial desativado → fluxo segue para conversa natural com IA");

    // ===== CLIENT LOOKUP — multi-format phone matching =====
    // Build phone variations for robust matching
    const phoneVariations: string[] = [phone];
    // Without country code (strip leading 55 for Brazil)
    if (phone.startsWith("55") && phone.length >= 12) {
      phoneVariations.push(phone.slice(2));
    }
    // With country code if missing
    if (!phone.startsWith("55") && phone.length >= 10) {
      phoneVariations.push("55" + phone);
    }
    // Last 8-9 digits (local number without area code)
    if (phone.length >= 10) {
      phoneVariations.push(phone.slice(-9));
      phoneVariations.push(phone.slice(-8));
    }
    const uniqueVariations = [...new Set(phoneVariations)];

    // Try exact matches first, then partial (endsWith) as fallback
    let clientData: any = null;

    // 1) Exact match on all variations
    const orConditions = uniqueVariations
      .flatMap(v => [`phone.eq.${v}`, `whatsapp.eq.${v}`])
      .join(",");
    const { data: exactMatch } = await supabase
      .from("clients").select("id, name, status, company_id, phone, whatsapp")
      .eq("company_id", companyIdParam)
      .or(orConditions)
      .limit(1).maybeSingle();

    if (exactMatch) {
      clientData = exactMatch;
    } else {
      // 2) Partial match — phone ends with the last 9 digits
      const last9 = phone.slice(-9);
      if (last9.length === 9) {
        const { data: partialMatch } = await supabase
          .from("clients").select("id, name, status, company_id, phone, whatsapp")
          .eq("company_id", companyIdParam)
          .or(`phone.like.%${last9},whatsapp.like.%${last9}`)
          .limit(1).maybeSingle();
        if (partialMatch) {
          clientData = partialMatch;
          decisions.push(`🔍 Match parcial (últimos 9 dígitos): ${last9}`);
        }
      }
    }

    let clientContext = "";
    let contextType = "new_contact";
    let clientName = "Desconhecido";
    let contextInstructions = "";

    // Get the custom instructions for new contact vs client
    const newContactInstr = (chatSettings.new_contact_instructions || "").trim();
    const clientInstr = (chatSettings.client_instructions || "").trim();

    if (clientData) {
      contextType = "client";
      clientName = clientData.name;
      decisions.push(`👤 CLIENTE IDENTIFICADO: ${clientName} (status: ${clientData.status}, phone_db: ${clientData.phone || clientData.whatsapp})`);

      const { data: subData } = await supabase
        .from("client_subscriptions")
        .select("end_date, amount, plan_id, subscription_plans(name)")
        .eq("client_id", clientData.id)
        .order("end_date", { ascending: false })
        .limit(1).maybeSingle();

      if (subData) {
        const planName = (subData as any).subscription_plans?.name || "N/A";
        decisions.push(`📊 Plano=${planName}, Vencimento=${subData.end_date}, Valor=R$${subData.amount}`);
        clientContext = `
CONTEXTO DO CLIENTE (DADOS REAIS DO SISTEMA — USE OBRIGATORIAMENTE):
- Nome do cliente: ${clientName}
- Status da conta: ${clientData.status}
- Plano contratado: ${planName}
- Data de vencimento: ${subData.end_date}
- Valor do plano: R$ ${subData.amount}

REGRAS OBRIGATÓRIAS PARA CLIENTE IDENTIFICADO:
1. Você JÁ SABE o nome do cliente: "${clientName}". Use o primeiro nome "${clientName.split(" ")[0]}" para cumprimentar.
2. NUNCA pergunte "qual seu nome?", "com quem falo?", "como posso te chamar?" ou qualquer variação. O nome já está no sistema.
3. NUNCA pergunte dados que já estão acima (nome, plano, vencimento). Use-os diretamente.
4. Foque em suporte personalizado, renovação e resolução de problemas.
5. NÃO apresente a empresa como se fosse a primeira vez — ele já é cliente.
Exemplo de abertura: "Opa, fala ${clientName.split(" ")[0]}! Tudo certo? Como posso te ajudar?"
`;
      } else {
        clientContext = `
CONTEXTO DO CLIENTE (DADOS REAIS DO SISTEMA — USE OBRIGATORIAMENTE):
- Nome do cliente: ${clientName}
- Status da conta: ${clientData.status}
- Sem assinatura ativa no momento.

REGRAS OBRIGATÓRIAS PARA CLIENTE IDENTIFICADO:
1. Você JÁ SABE o nome: "${clientName}". Use "${clientName.split(" ")[0]}" para cumprimentar.
2. NUNCA pergunte "qual seu nome?", "com quem falo?" ou variações. O nome já está no sistema.
3. Ofereça ajuda e sugira renovação ou novos planos.`;
      }

      // Use custom client instructions if available
      if (clientInstr) {
        contextInstructions = `\n\nINSTRUÇÕES ESPECÍFICAS PARA CLIENTES:\n${clientInstr}`;
        decisions.push("📝 Usando instruções personalizadas para CLIENTE");
      }
    } else {
      decisions.push("🆕 NOVO CONTATO → Número não encontrado na base de clientes");
      decisions.push(`🔍 Variações testadas: ${uniqueVariations.join(", ")}`);

      const welcomeMsg = chatSettings.welcome_message?.trim();
      if (welcomeMsg) {
        contextInstructions += `\n\nREFERÊNCIA DE TOM INICIAL (não envie automaticamente, adapte ao contexto real da mensagem):\n${welcomeMsg}`;
        decisions.push("👋 Welcome message convertida em referência de tom, sem disparo automático");
      }
      clientContext = `
CONTEXTO: Este é um NOVO CONTATO que NÃO é cliente.
Foque em vendas: apresente o serviço, benefícios e como contratar.
Seja persuasivo mas educado.`;

      // Use custom new contact instructions if available
      if (newContactInstr) {
        contextInstructions = `\n\nINSTRUÇÕES ESPECÍFICAS PARA NOVOS CONTATOS (Script de Vendas):\n${newContactInstr}`;
        decisions.push("📝 Usando instruções personalizadas para NOVO CONTATO (script de vendas)");
      }
    }

    // Fetch media
    const { data: mediaFiles } = await supabase
      .from("chatbot_media").select("file_name, file_url, file_type").eq("company_id", companyIdParam);

    let mediaContext = "";
    if (mediaFiles && mediaFiles.length > 0) {
      mediaContext = `\n\nMÍDIAS DISPONÍVEIS:
${mediaFiles.map((m: any) => `- [${m.file_type.toUpperCase()}] ${m.file_name}`).join("\n")}
Para enviar mídia: [ENVIAR_MEDIA:nome_do_arquivo.extensão]`;
    }

    // Build AI command tags documentation
    const commandTagsDoc = `

COMANDOS ESPECIAIS (Tags que você pode usar na resposta para executar ações):
- [ENVIAR_MENU] → Envia o menu interativo configurado
- [ENVIAR_CATALOGO] → Envia a lista de planos/preços como menu interativo
- [ENVIAR_BOTOES:Opção 1|Opção 2|Opção 3] → Envia botões rápidos (máx 3)
- [ENVIAR_LISTA:Item 1|Item 2|Item 3] → Envia um menu de lista expansível
- [ENVIAR_MEDIA:arquivo.mp3] → Envia mídia da biblioteca
- [AUDIO:nome] → Atalho para enviar áudio da biblioteca (busca por nome, com ou sem extensão)
Use esses comandos quando achar relevante. O sistema processará automaticamente.`;

    // ===== CHECK TRAINING RULES BEFORE AI =====
    const { data: trainingRules } = await supabase
      .from("bot_training_rules")
      .select("*")
      .eq("company_id", companyIdParam)
      .eq("is_active", true);

    if (trainingRules && trainingRules.length > 0) {
      const lowerQuestion = messageText.toLowerCase().trim();
      const matchedRule = trainingRules.find((rule: any) => {
        const trigger = (rule.trigger_question || "").toLowerCase().trim();
        if (!trigger) return false;
        // Check similarity: exact match, contains, or significant overlap
        return lowerQuestion === trigger || 
               lowerQuestion.includes(trigger) || 
               trigger.includes(lowerQuestion) ||
               trigger.split(" ").filter((w: string) => w.length > 3 && lowerQuestion.includes(w)).length >= 2;
      });

      if (matchedRule) {
        decisions.push(`📚 Regra de treinamento encontrada: "${matchedRule.trigger_question.slice(0, 50)}"`);

        // Check if this is a split-messages rule (pre-defined message parts)
        const ruleConfig = matchedRule.action_config || {};
        if (ruleConfig.split_messages && Array.isArray(ruleConfig.message_parts) && ruleConfig.message_parts.length >= 2) {
          decisions.push(`📨 Modo múltiplas mensagens: ${ruleConfig.message_parts.length} partes`);
          
          // Send each message part separately with presence simulation
          for (let i = 0; i < ruleConfig.message_parts.length; i++) {
            const part = ruleConfig.message_parts[i].trim();
            if (!part) continue;
            await doPresence("composing", minDelay, maxDelay);
            await sendText(apiUrl, apiToken, phone, part);
            decisions.push(`💬 Parte ${i + 1}/${ruleConfig.message_parts.length} enviada`);
          }

          // Handle attached action (media, buttons, list) after all text parts
          if (matchedRule.action_type === "media" && matchedRule.media_id) {
            const { data: ruleMedia } = await supabase
              .from("chatbot_media").select("*").eq("id", matchedRule.media_id).single();
            if (ruleMedia) {
              const presType = ruleMedia.file_type === "audio" ? "recording" : "composing";
              await doPresence(presType as any, minDelay + 2, maxDelay + 3);
              await sendMedia(apiUrl, apiToken, phone, ruleMedia.file_url, ruleMedia.file_type);
              decisions.push(`📎 Mídia anexada enviada: ${ruleMedia.file_name}`);
            }
          } else if (matchedRule.action_type === "buttons" && ruleConfig.buttons) {
            const btnTitles = ruleConfig.buttons.split("|").map((t: string) => t.trim()).filter(Boolean).slice(0, 3);
            if (btnTitles.length > 0) {
              const btns = btnTitles.map((t: string, i: number) => ({ id: `rule_btn_${i}`, title: t.slice(0, 20) }));
              try { await sendButtons(apiUrl, apiToken, phone, "", "Escolha uma opção:", "", btns); } catch (e) { console.error("Falha botões:", e); }
            }
          } else if (matchedRule.action_type === "list" && ruleConfig.items) {
            const listItems = ruleConfig.items.split("|").map((t: string) => t.trim()).filter(Boolean);
            if (listItems.length > 0) {
              const items = listItems.map((t: string, i: number) => ({ id: `rule_list_${i}`, title: t.slice(0, 24) }));
              try { await sendList(apiUrl, apiToken, phone, "Opções", "Selecione:", "", "Ver Opções", items); } catch (e) { console.error("Falha lista:", e); }
            }
          }

          // Save conversation memory
          await supabase.from("chatbot_conversation_messages").insert({
            company_id: companyIdParam, phone, role: "user", content: messageText.slice(0, 2000),
          });
          const allParts = ruleConfig.message_parts.filter((p: string) => p.trim()).join(" | ");
          await supabase.from("chatbot_conversation_messages").insert({
            company_id: companyIdParam, phone, role: "assistant", content: allParts.slice(0, 2000),
          });

          // Log
          await supabase.from("chatbot_logs").insert({
            company_id: companyIdParam, phone, client_name: clientName,
            message_received: messageText.slice(0, 500),
            message_sent: `[MULTI-MSG ${ruleConfig.message_parts.length}x] ${allParts}`.slice(0, 500),
            context_type: "training_rule", status: "success",
            error_message: aiDecisionLog ? decisions.join("\n") : null,
          });

          return new Response(JSON.stringify({ status: "ok", reason: "training_rule_split" }), {
            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Standard single-message training rule: inject into AI context
        contextInstructions += `\n\nINSTRUÇÃO ESPECÍFICA DE TREINAMENTO (PRIORIDADE MÁXIMA):
${matchedRule.instruction}`;
        decisions.push("📝 Instrução de treinamento aplicada ao contexto da IA");

        // Handle action types
        if (matchedRule.action_type === "buttons" && ruleConfig.buttons) {
          const btnTitles = ruleConfig.buttons.split("|").map((t: string) => t.trim()).filter(Boolean).slice(0, 3);
          if (btnTitles.length > 0) {
            contextInstructions += `\nIMPORTANTE: Inclua [ENVIAR_BOTOES:${btnTitles.join("|")}] na sua resposta.`;
            decisions.push(`🔘 Ação configurada: enviar botões [${btnTitles.join(", ")}]`);
          }
        } else if (matchedRule.action_type === "list" && ruleConfig.items) {
          const listItems = ruleConfig.items.split("|").map((t: string) => t.trim()).filter(Boolean);
          if (listItems.length > 0) {
            contextInstructions += `\nIMPORTANTE: Inclua [ENVIAR_LISTA:${listItems.join("|")}] na sua resposta.`;
            decisions.push(`📋 Ação configurada: enviar lista [${listItems.join(", ")}]`);
          }
        } else if (matchedRule.action_type === "media" && matchedRule.media_id) {
          const { data: ruleMedia } = await supabase
            .from("chatbot_media").select("file_name").eq("id", matchedRule.media_id).single();
          if (ruleMedia) {
            contextInstructions += `\nIMPORTANTE: Inclua [ENVIAR_MEDIA:${ruleMedia.file_name}] na sua resposta.`;
            decisions.push(`📎 Ação configurada: enviar mídia [${ruleMedia.file_name}]`);
          }
        }
      }
    }

    if (explicitCatalogRequest) {
      contextInstructions += "\n\nPEDIDO EXPLÍCITO DO CLIENTE: ele quer ver planos ou catálogo. Responda naturalmente e inclua [ENVIAR_CATALOGO] apenas se houver opções configuradas.";
      decisions.push("📋 Cliente pediu planos/catálogo explicitamente");
    }

    if (explicitMenuRequest && menuEnabled && menuItems.length > 0) {
      contextInstructions += "\n\nPEDIDO EXPLÍCITO DO CLIENTE: ele pediu opções/menu. Responda naturalmente e inclua [ENVIAR_MENU] ao final da resposta.";
      decisions.push("🧭 Cliente pediu opções/menu explicitamente");
    }

    // Call AI
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const aiModel = chatSettings.ai_model || "google/gemini-3-flash-preview";
    const aiTemperature = chatSettings.ai_temperature ?? 0.7;
    const trainingRequestedInteractive =
      contextInstructions.includes("[ENVIAR_MENU]") ||
      contextInstructions.includes("[ENVIAR_CATALOGO]") ||
      contextInstructions.includes("[ENVIAR_BOTOES") ||
      contextInstructions.includes("[ENVIAR_LISTA");

    decisions.push(`🤖 Chamando IA (${aiModel}) com contexto: ${contextType}`);

    // Determine if training rules explicitly requested buttons/list
    const hasTrainingButtonAction = trainingRequestedInteractive;

    const systemPrompt = `${chatSettings.personality || "Você é um assistente virtual profissional."}
${contextInstructions}
${clientContext}
${mediaContext}
${hasTrainingButtonAction ? commandTagsDoc : ""}

REGRAS DE COMPORTAMENTO (OBRIGATÓRIAS):
- Você é um HUMANO real, um consultor de suporte que digita no WhatsApp. NUNCA diga que é IA, bot ou assistente virtual.
- NUNCA pergunte o nome do cliente se ele já foi identificado no CONTEXTO DO CLIENTE acima. Você já sabe quem é — use o nome diretamente.
- Responda de forma DIRETA, informal e prestativa. Como um amigo técnico que resolve rápido.
- A personalidade é MAX TV: suporte rápido, regional, humano, com foco em qualidade HD/4K e solução prática (inclusive sugerir tirar da tomada quando fizer sentido técnico).
- Frases CURTAS. Máximo 2-3 linhas por mensagem. Nada de textão.
- Use emojis com moderação (máximo 1-2 por mensagem).
- Se não souber algo, diga "vou verificar aqui e já te retorno".
- NÃO envie botões, listas ou menus interativos a menos que uma instrução de treinamento ESPECÍFICA peça isso explicitamente.
- Quando o cliente pedir planos/catálogo, use [ENVIAR_CATALOGO] APENAS se não houver instrução de treinamento cobrindo isso.
- Responda APENAS com texto natural. Sem formatação excessiva, sem bullets, sem listas numeradas.
- Se for a primeira resposta da conversa, abra de forma amigável e humana, em linha com MAX TV, por exemplo: "Opa, tudo bem? Como posso te ajudar com sua TV hoje?".
- Trate cada conversa como se fosse um atendimento humano real, rápido e resolutivo.`;

    // ===== CONVERSATION MEMORY =====
    // Fetch recent messages from this contact (last 48h, max 10 messages for better continuity)
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data: conversationHistory } = await supabase
      .from("chatbot_conversation_messages")
      .select("role, content")
      .eq("company_id", companyIdParam)
      .eq("phone", phone)
      .gte("created_at", fortyEightHoursAgo)
      .order("created_at", { ascending: false })
      .limit(10);

    const historyMessages = [...(conversationHistory || [])].reverse().map((msg: any) => ({
      role: msg.role as string,
      content: msg.content as string,
    }));

    if (historyMessages.length > 0) {
      decisions.push(`🧠 Memória: ${historyMessages.length} mensagens anteriores carregadas (últimas 48h)`);
    }

    // Save the incoming user message to conversation memory
    await supabase.from("chatbot_conversation_messages").insert({
      company_id: companyIdParam,
      phone,
      role: "user",
      content: messageText.slice(0, 2000),
    });

    // Cleanup old messages (older than 48h) for this contact
    await supabase
      .from("chatbot_conversation_messages")
      .delete()
      .eq("company_id", companyIdParam)
      .eq("phone", phone)
      .lt("created_at", fortyEightHoursAgo);

    // Build AI messages with conversation history
    const aiMessages: { role: string; content: string }[] = [
      { role: "system", content: systemPrompt },
      ...historyMessages,
      { role: "user", content: messageText },
    ];

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: aiModel,
        temperature: aiTemperature,
        messages: aiMessages,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      throw new Error(`AI gateway error: ${aiResponse.status} - ${errText}`);
    }

    const aiData = await aiResponse.json();
    let replyText = aiData.choices?.[0]?.message?.content ||
      (chatSettings.unknown_message?.trim() || "Desculpe, não consegui processar sua mensagem.");

    console.log("Resposta da IA gerada:", replyText.slice(0, 200));

    // Parse AI command tags
    const parsedAiReply = parseAiCommands(replyText);
    replyText = parsedAiReply.cleanText;
    let commands = parsedAiReply.commands;

    const allowInteractiveCommands =
      trainingRequestedInteractive ||
      explicitMenuRequest ||
      explicitCatalogRequest;

    if (!allowInteractiveCommands) {
      const filteredCommands = commands.filter((cmd) => !["send_menu", "send_catalog", "send_buttons", "send_list"].includes(cmd.type));
      if (filteredCommands.length !== commands.length) {
        decisions.push("🛑 Comandos interativos removidos para evitar botões fantasmas/menus automáticos");
      }
      commands = filteredCommands;
    }

    // Execute AI commands
    for (const cmd of commands) {
      switch (cmd.type) {
        case "send_menu": {
          decisions.push("🎯 IA solicitou [ENVIAR_MENU] → Enviando menu interativo");
          if (menuEnabled && menuItems.length > 0) {
            const mType = chatSettings.interactive_menu_type || "buttons";
            const validItems = menuItems.filter((i: any) => i.title);
            try {
              if (mType === "buttons") {
                await sendButtons(apiUrl, apiToken, phone, chatSettings.interactive_menu_title || "", chatSettings.interactive_menu_body || "Selecione:", chatSettings.interactive_menu_footer || "", validItems.slice(0, 3));
              } else {
                await sendList(apiUrl, apiToken, phone, chatSettings.interactive_menu_title || "", chatSettings.interactive_menu_body || "Selecione:", chatSettings.interactive_menu_footer || "", chatSettings.interactive_menu_button_text || "Ver Opções", validItems.slice(0, 10));
              }
            } catch (e) { console.error("Falha ao enviar menu via tag:", e); }
          }
          break;
        }
        case "send_catalog": {
          decisions.push("🎯 IA solicitou [ENVIAR_CATALOGO] → Buscando planos");
          const { data: plans } = await supabase
            .from("subscription_plans")
            .select("id, name, price, duration_days, description")
            .eq("company_id", companyIdParam)
            .eq("is_active", true)
            .order("price", { ascending: true })
            .limit(10);
          if (plans && plans.length > 0) {
            const catalogItems = plans.map((p: any) => ({
              id: `plan_${p.id}`, title: p.name,
              description: `R$ ${Number(p.price).toFixed(2)} - ${p.duration_days} dias`,
            }));
            try {
              await sendList(apiUrl, apiToken, phone, "📋 Catálogo", "Confira nossos planos:", "Preços atualizados", "Ver Planos", catalogItems);
            } catch (e) {
              const textCat = plans.map((p: any) => `📦 *${p.name}* - R$ ${Number(p.price).toFixed(2)} (${p.duration_days}d)`).join("\n");
              await sendText(apiUrl, apiToken, phone, `📋 *Nossos Planos:*\n\n${textCat}`);
            }
          }
          break;
        }
        case "send_buttons": {
          const titles: string[] = cmd.data || [];
          decisions.push(`🎯 IA solicitou [ENVIAR_BOTOES] → ${titles.join(", ")}`);
          if (titles.length > 0) {
            const btns = titles.map((t, i) => ({ id: `ai_btn_${i}`, title: t.slice(0, 20) }));
            try {
              await sendButtons(apiUrl, apiToken, phone, "", "Escolha uma opção:", "", btns);
            } catch (e) { console.error("Falha ao enviar botões via tag:", e); }
          }
          break;
        }
        case "send_list": {
          const titles: string[] = cmd.data || [];
          decisions.push(`🎯 IA solicitou [ENVIAR_LISTA] → ${titles.length} itens`);
          if (titles.length > 0) {
            const items = titles.map((t, i) => ({ id: `ai_list_${i}`, title: t.slice(0, 24) }));
            try {
              await sendList(apiUrl, apiToken, phone, "Opções", "Selecione uma opção:", "", "Ver Opções", items);
            } catch (e) { console.error("Falha ao enviar lista via tag:", e); }
          }
          break;
        }
        case "send_media": {
          const requestedFile = cmd.data;
          decisions.push(`🎯 IA solicitou [ENVIAR_MEDIA:${requestedFile}]`);
          if (mediaFiles) {
            const mediaToSend = mediaFiles.find(
              (m: any) => m.file_name.toLowerCase() === requestedFile.toLowerCase()
            );
            if (mediaToSend) {
              const presType = mediaToSend.file_type === "audio" ? "recording" : "composing";
              await doPresence(presType as any, minDelay + 2, maxDelay + 3);
              await sendMedia(apiUrl, apiToken, phone, mediaToSend.file_url, mediaToSend.file_type);
            }
          }
          break;
        }
        case "send_audio": {
          const audioName = cmd.data;
          decisions.push(`🎯 IA solicitou [AUDIO:${audioName}] → Buscando áudio`);
          if (mediaFiles) {
            // Match by name (with or without extension)
            const audioToSend = mediaFiles.find((m: any) => {
              const fn = m.file_name.toLowerCase();
              const search = audioName.toLowerCase();
              return fn === search || fn.startsWith(search + ".") || fn.replace(/\.[^.]+$/, "") === search;
            });
            if (audioToSend) {
              decisions.push(`✅ Áudio encontrado: ${audioToSend.file_name}`);
              await doPresence("recording", minDelay + 2, maxDelay + 4);
              await sendMedia(apiUrl, apiToken, phone, audioToSend.file_url, "audio");
            } else {
              decisions.push(`⚠️ Áudio "${audioName}" não encontrado na biblioteca`);
            }
          }
          break;
        }
      }
    }

    // Send text response (if any remaining after command extraction)
    if (replyText.trim()) {
      decisions.push(`💬 Enviando resposta de texto (${replyText.length} chars)`);
      await doPresence("composing", minDelay, maxDelay);
      // Humanizing delay — simulate reading + thinking before replying
      const humanDelay = 800 + Math.random() * 1200; // 0.8-2s extra
      await sleep(humanDelay);
      await sendText(apiUrl, apiToken, phone, replyText);
    }

    console.log("Mensagem enviada com sucesso!");

    // Save assistant reply to conversation memory
    if (replyText.trim()) {
      await supabase.from("chatbot_conversation_messages").insert({
        company_id: companyIdParam,
        phone,
        role: "assistant",
        content: replyText.slice(0, 2000),
      });
    }

    // Log with decision trail
    await supabase.from("chatbot_logs").insert({
      company_id: companyIdParam, phone, client_name: clientName,
      message_received: messageText.slice(0, 500), message_sent: replyText.slice(0, 500),
      context_type: contextType, status: "success",
      error_message: aiDecisionLog ? decisions.join("\n") : null,
    });

    return new Response(JSON.stringify({ status: "ok", context: contextType }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    const isSessionErr = error instanceof SessionExpiredError || error?.name === "SessionExpiredError";
    console.error("Chatbot webhook error:", error?.message || error, isSessionErr ? "[SESSION_EXPIRED]" : "");
    try {
      if (companyIdParam) {
        const supabase2 = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        
        const contextType = isSessionErr ? "session_expired" : "error";
        const clientName = isSessionErr ? "⚠️ Sessão Expirada" : "Erro";
        const errorMsg = isSessionErr
          ? `🔴 TOKEN INVÁLIDO: ${error.message}\n\n➡️ Verifique o token nas Configurações de Envio.\n\n--- Decisões ---\n${decisions.join("\n")}`
          : `${error?.message || "Unknown error"}\n\n--- Decisões ---\n${decisions.join("\n")}`;

        await supabase2.from("chatbot_logs").insert({
          company_id: companyIdParam, phone: "unknown", client_name: clientName,
          message_received: "", message_sent: "",
          context_type: contextType, status: "error",
          error_message: errorMsg,
        });

        // NOTE: Do NOT mark instance as disconnected on 401 — the instance may still be
        // connected but using a stale/wrong token. Disconnecting here causes UI desync
        // and prevents the user from fixing it easily.
      }
    } catch (_) {}
    return new Response(JSON.stringify({ status: "ok", error: isSessionErr ? "session_expired" : "internal" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
