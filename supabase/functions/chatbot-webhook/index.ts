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
      headers: { "Content-Type": "application/json", token: apiToken },
      body: JSON.stringify({ phone: to, presence: type }),
    });
    await sleep(durationMs);
  } catch (e) {
    console.error("Presence simulation failed:", e);
  }
}

async function sendText(apiUrl: string, apiToken: string, to: string, text: string) {
  console.log(`Enviando texto para ${to}: "${text.slice(0, 80)}..."`);
  const resp = await fetch(`${apiUrl}/send/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json", token: apiToken },
    body: JSON.stringify({ number: to, text: text, linkPreview: true }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`UAZAPI send/text failed: ${resp.status} - ${body}`);
  }
  return resp.json();
}

async function sendMedia(
  apiUrl: string, apiToken: string, to: string,
  mediaUrl: string, type: "audio" | "video", caption?: string
) {
  const endpoint = type === "audio" ? "/send/audio" : "/send/video";
  const resp = await fetch(`${apiUrl}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", token: apiToken },
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
    headers: { "Content-Type": "application/json", token: apiToken },
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
    headers: { "Content-Type": "application/json", token: apiToken },
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
  const days: number[] = settings.business_days || [1, 2, 3, 4, 5];
  if (!days.includes(dayOfWeek)) return false;
  const currentMinutes = brasiliaTime.getHours() * 60 + brasiliaTime.getMinutes();
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
  if (!msgData && body?.key && body?.message) msgData = body;
  if (!msgData) return null;
  const key = msgData?.key || {};
  const message = msgData?.message || {};
  const fromMe = key?.fromMe === true || msgData?.fromMe === true;
  const remoteJid = key?.remoteJid || "";
  const messageText = 
    message?.conversation ||
    message?.extendedTextMessage?.text ||
    message?.buttonsResponseMessage?.selectedDisplayText ||
    message?.listResponseMessage?.title ||
    message?.templateButtonReplyMessage?.selectedDisplayText ||
    message?.editedMessage?.message?.protocolMessage?.editedMessage?.conversation ||
    msgData?.body || msgData?.text || "";
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
    body?.message?.content?.text,
    body?.message?.content?.selectedDisplayText,
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
    body?.text, body?.body,
    body?.data?.text, body?.data?.body,
    body?.data?.message?.text,
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
  let messageType = "text";
  if (msgType.includes("image") || msg.mediaType === "image") messageType = "image";
  else if (msgType.includes("audio") || msg.mediaType === "audio") messageType = "audio";
  else if (msgType.includes("video") || msg.mediaType === "video") messageType = "video";
  else if (msgType.includes("document") || msg.mediaType === "document") messageType = "document";
  else if (msgType.includes("sticker")) messageType = "sticker";
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

  const rawCompanyId = new URL(req.url).searchParams.get("company_id") || "";
  const uuidMatch = rawCompanyId.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  const companyIdParam = uuidMatch ? uuidMatch[1] : rawCompanyId || null;

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
    console.log("company_id:", companyIdParam);
    console.log("Corpo recebido:", JSON.stringify(body).slice(0, 3000));

    const { messageText, senderPhone, fromMe, messageType, eventType } = extractIncomingPayload(body);
    console.log("Dados extraídos:", JSON.stringify({ messageText: messageText.slice(0, 200), senderPhone, fromMe, messageType, eventType }));

    // Filter non-message events
    const ignoredEvents = ["chats", "status", "connection", "contacts", "groups", "call", "presence", "labels", "messages_update", "chat_labels", "receipt"];
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

    // Handle non-text messages
    if (!messageText && senderPhone && companyIdParam && messageType !== "text" && messageType !== "unknown") {
      await supabase.from("chatbot_logs").insert({
        company_id: companyIdParam, phone: normalizePhone(senderPhone),
        client_name: `Mídia (${messageType})`, message_received: `[${messageType.toUpperCase()}]`,
        message_sent: "", context_type: "media_received", status: "ignored",
        error_message: `Tipo de mensagem não processável: ${messageType}`,
      });
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
    console.log(`Processando mensagem de ${phone}: "${messageText.slice(0, 100)}"`);
    decisions.push(`📩 Mensagem recebida de ${phone}: "${messageText.slice(0, 60)}"`);

    // Fetch chatbot settings
    const { data: chatSettings } = await supabase
      .from("chatbot_settings").select("*").eq("company_id", companyIdParam).single();

    if (!chatSettings?.is_active) {
      return new Response(JSON.stringify({ status: "ok", reason: "bot_disabled" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // Fetch API credentials
    const { data: apiSettings } = await supabase
      .from("api_settings").select("api_url, api_token").eq("company_id", companyIdParam).single();
    if (!apiSettings?.api_url || !apiSettings?.api_token) {
      return new Response(JSON.stringify({ status: "ok", reason: "api_not_configured" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiUrl = apiSettings.api_url.replace(/\/$/, "");
    const apiToken = apiSettings.api_token;
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

    // Send interactive menu (only for non-menu-response messages)
    if (!isMenuResponse && menuEnabled && menuItems.length > 0 && menuItems.some((i: any) => i.title)) {
      decisions.push("📱 Enviando menu interativo como primeira resposta");
      const mType = chatSettings.interactive_menu_type || "buttons";
      const mTitle = chatSettings.interactive_menu_title || "";
      const mBody = chatSettings.interactive_menu_body || "Selecione uma opção:";
      const mFooter = chatSettings.interactive_menu_footer || "";
      const mButtonText = chatSettings.interactive_menu_button_text || "Ver Opções";
      const validItems = menuItems.filter((i: any) => i.title);
      try {
        await doPresence("composing", minDelay, maxDelay);
        if (mType === "buttons") {
          await sendButtons(apiUrl, apiToken, phone, mTitle, mBody, mFooter, validItems.slice(0, 3));
        } else {
          await sendList(apiUrl, apiToken, phone, mTitle, mBody, mFooter, mButtonText, validItems.slice(0, 10));
        }
        await supabase.from("chatbot_logs").insert({
          company_id: companyIdParam, phone, client_name: "Menu Interativo",
          message_received: messageText.slice(0, 500),
          message_sent: `[MENU ${mType.toUpperCase()}] ${validItems.map((i: any) => i.title).join(" | ")}`.slice(0, 500),
          context_type: "auto_reply", status: "success",
          error_message: aiDecisionLog ? decisions.join("\n") : null,
        });
        return new Response(JSON.stringify({ status: "ok", reason: "interactive_menu" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (menuErr: any) {
        decisions.push("⚠️ Falha no menu interativo → Continuando para IA");
        console.error("Falha ao enviar menu interativo:", menuErr);
      }
    }

    // ===== CHECK CLIENT CONTEXT =====
    const { data: clientData } = await supabase
      .from("clients").select("id, name, status, company_id")
      .eq("company_id", companyIdParam)
      .or(`phone.eq.${phone},whatsapp.eq.${phone}`)
      .limit(1).maybeSingle();

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
      decisions.push(`👤 Identificado como CLIENTE EXISTENTE: ${clientName} (${clientData.status})`);

      const { data: subData } = await supabase
        .from("client_subscriptions")
        .select("end_date, amount, plan_id, subscription_plans(name)")
        .eq("client_id", clientData.id)
        .order("end_date", { ascending: false })
        .limit(1).maybeSingle();

      if (subData) {
        const planName = (subData as any).subscription_plans?.name || "N/A";
        decisions.push(`📊 Dados: Plano=${planName}, Vencimento=${subData.end_date}, Valor=R$${subData.amount}`);
        clientContext = `
CONTEXTO DO CLIENTE:
- Nome: ${clientName}
- Status: ${clientData.status}
- Plano: ${planName}
- Vencimento: ${subData.end_date}
- Valor: R$ ${subData.amount}
Foque em suporte personalizado. Use o nome do cliente. Saúde-o pelo nome.`;
      } else {
        clientContext = `
CONTEXTO DO CLIENTE:
- Nome: ${clientName}
- Status: ${clientData.status}
- Sem assinatura ativa.
Ofereça ajuda e sugira planos disponíveis.`;
      }

      // Use custom client instructions if available
      if (clientInstr) {
        contextInstructions = `\n\nINSTRUÇÕES ESPECÍFICAS PARA CLIENTES:\n${clientInstr}`;
        decisions.push("📝 Usando instruções personalizadas para CLIENTE");
      }
    } else {
      decisions.push("🆕 Identificado como NOVO CONTATO → Não é cliente na base");

      const welcomeMsg = chatSettings.welcome_message?.trim();
      if (welcomeMsg) {
        const { data: previousLogs } = await supabase
          .from("chatbot_logs").select("id")
          .eq("company_id", companyIdParam).eq("phone", phone)
          .eq("context_type", "welcome").limit(1).maybeSingle();

        if (!previousLogs) {
          decisions.push("👋 Primeiro contato deste número → Enviando boas-vindas");
          await doPresence("composing", minDelay, maxDelay);
          await sendText(apiUrl, apiToken, phone, welcomeMsg);

          // Send welcome media if configured
          const welcomeMediaId = chatSettings.send_welcome_media_id;
          if (welcomeMediaId) {
            const { data: welcomeMedia } = await supabase
              .from("chatbot_media").select("file_url, file_type, file_name")
              .eq("id", welcomeMediaId).single();
            if (welcomeMedia) {
              decisions.push(`📎 Enviando mídia de boas-vindas: ${welcomeMedia.file_name}`);
              const presType = welcomeMedia.file_type === "audio" ? "recording" : "composing";
              await doPresence(presType as any, minDelay + 1, maxDelay + 2);
              await sendMedia(apiUrl, apiToken, phone, welcomeMedia.file_url, welcomeMedia.file_type);
            }
          }

          await supabase.from("chatbot_logs").insert({
            company_id: companyIdParam, phone, client_name: "Novo Contato",
            message_received: messageText.slice(0, 500), message_sent: welcomeMsg.slice(0, 500),
            context_type: "welcome", status: "success",
            error_message: aiDecisionLog ? decisions.join("\n") : null,
          });
          await sleep(1500);
        }
      }
      clientContext = `
CONTEXTO: Este é um NOVO CONTATO que não é cliente.
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

    // Call AI
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const aiModel = chatSettings.ai_model || "google/gemini-3-flash-preview";
    const aiTemperature = chatSettings.ai_temperature ?? 0.7;

    decisions.push(`🤖 Chamando IA (${aiModel}) com contexto: ${contextType}`);

    const systemPrompt = `${chatSettings.personality || "Você é um assistente virtual profissional."}
${contextInstructions}
${clientContext}
${mediaContext}
${commandTagsDoc}

REGRAS IMPORTANTES:
- Responda de forma natural e humanizada, como se fosse uma pessoa real digitando.
- Mantenha respostas curtas e diretas (máximo 3 parágrafos).
- Use emojis com moderação.
- NUNCA revele que é uma IA ou bot.
- Se não souber algo, diga que vai verificar e retornar.
- Quando o cliente pedir para ver planos/catálogo, use [ENVIAR_CATALOGO].
- Quando quiser dar opções ao cliente, use [ENVIAR_BOTOES:...] ou [ENVIAR_LISTA:...].`;

    // ===== CONVERSATION MEMORY =====
    // Fetch recent messages from this contact (last 24h, max 20 messages)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: conversationHistory } = await supabase
      .from("chatbot_conversation_messages")
      .select("role, content")
      .eq("company_id", companyIdParam)
      .eq("phone", phone)
      .gte("created_at", twentyFourHoursAgo)
      .order("created_at", { ascending: true })
      .limit(20);

    const historyMessages = (conversationHistory || []).map((msg: any) => ({
      role: msg.role as string,
      content: msg.content as string,
    }));

    if (historyMessages.length > 0) {
      decisions.push(`🧠 Memória: ${historyMessages.length} mensagens anteriores carregadas (últimas 24h)`);
    }

    // Save the incoming user message to conversation memory
    await supabase.from("chatbot_conversation_messages").insert({
      company_id: companyIdParam,
      phone,
      role: "user",
      content: messageText.slice(0, 2000),
    });

    // Cleanup old messages (older than 24h) for this contact
    await supabase
      .from("chatbot_conversation_messages")
      .delete()
      .eq("company_id", companyIdParam)
      .eq("phone", phone)
      .lt("created_at", twentyFourHoursAgo);

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
    const { cleanText, commands } = parseAiCommands(replyText);
    replyText = cleanText;

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
    console.error("Chatbot webhook error:", error?.message || error);
    try {
      if (companyIdParam) {
        const supabase2 = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        await supabase2.from("chatbot_logs").insert({
          company_id: companyIdParam, phone: "unknown", client_name: "Erro",
          message_received: "", message_sent: "",
          context_type: "error", status: "error",
          error_message: `${error?.message || "Unknown error"}\n\n--- Decisões ---\n${decisions.join("\n")}`,
        });
      }
    } catch (_) {}
    return new Response(JSON.stringify({ status: "ok", error: "internal" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
