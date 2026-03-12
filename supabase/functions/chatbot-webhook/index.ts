import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, token",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
};

function normalizePhone(phone: string): string {
  let clean = phone.replace(/\D/g, "");
  if (clean.length >= 10 && clean.length <= 11 && !clean.startsWith("55")) {
    clean = "55" + clean;
  }
  return clean;
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
// Handles multiple UAZAPI payload formats including messages.upsert

interface ExtractedPayload {
  messageText: string;
  senderPhone: string;
  fromMe: boolean;
  messageType: string;
  eventType: string;
}

function extractFromMessagesUpsert(body: any): ExtractedPayload | null {
  // messages.upsert format: body contains an array or object with message data
  // Common structure: { event: "messages.upsert", data: { key: { remoteJid, fromMe }, message: { conversation, ... } } }
  // Or: { event: "messages.upsert", data: [{ key: {...}, message: {...} }] }
  
  const event = (body?.event || body?.EventType || body?.action || "").toString();
  
  let msgData = body?.data;
  
  // If data is an array, take first element
  if (Array.isArray(msgData)) {
    msgData = msgData[0];
  }
  
  // Sometimes the message itself is the root
  if (!msgData && body?.key && body?.message) {
    msgData = body;
  }
  
  if (!msgData) return null;
  
  const key = msgData?.key || {};
  const message = msgData?.message || {};
  
  const fromMe = key?.fromMe === true || msgData?.fromMe === true;
  const remoteJid = key?.remoteJid || "";
  
  // Extract text from various WhatsApp message types
  const messageText = 
    message?.conversation ||
    message?.extendedTextMessage?.text ||
    message?.buttonsResponseMessage?.selectedDisplayText ||
    message?.listResponseMessage?.title ||
    message?.templateButtonReplyMessage?.selectedDisplayText ||
    message?.editedMessage?.message?.protocolMessage?.editedMessage?.conversation ||
    msgData?.body ||
    msgData?.text ||
    "";
  
  // Detect message type
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
  // Fallback: try all known field locations from UAZAPI V1/V2 and other formats
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
    body?.text,
    body?.body,
    body?.data?.text,
    body?.data?.body,
    body?.data?.message?.text,
    body?.data?.message?.conversation,
    body?.data?.message?.extendedTextMessage?.text,
  ];
  
  let messageText = "";
  for (const val of textCandidates) {
    if (typeof val === "string" && val.trim()) { messageText = val.trim(); break; }
  }

  const phoneCandidates = [
    body?.message?.chatid,
    body?.chat?.wa_chatid,
    body?.chat?.phone,
    body?.message?.sender,
    body?.message?.sender_pn,
    body?.message?.from,
    body?.from,
    body?.phone,
    body?.sender,
    body?.data?.from,
    body?.data?.phone,
    body?.data?.sender,
    body?.data?.key?.remoteJid,
    body?.key?.remoteJid,
  ];

  let senderRaw = "";
  for (const val of phoneCandidates) {
    if (typeof val === "string" && val.trim()) { senderRaw = val.trim(); break; }
  }

  // Detect type
  const msg = body?.message || {};
  let messageType = "text";
  if (msg.content?.URL) {
    const lastType = (body?.chat?.wa_lastMessageType || "").toLowerCase();
    if (lastType.includes("audio")) messageType = "audio";
    else if (lastType.includes("video")) messageType = "video";
    else if (lastType.includes("image")) messageType = "image";
    else messageType = "media";
  }
  if (!messageText && messageType === "text") messageType = "unknown";

  return {
    messageText,
    senderPhone: cleanJid(senderRaw),
    fromMe,
    messageType,
    eventType,
  };
}

function extractIncomingPayload(body: any): ExtractedPayload {
  // Try messages.upsert format first (most common from modern UAZAPI/Baileys)
  const upsert = extractFromMessagesUpsert(body);
  if (upsert && (upsert.senderPhone || upsert.messageText)) {
    return upsert;
  }
  // Fallback to generic extraction
  return extractGenericPayload(body);
}

// ===================== MAIN HANDLER =====================

Deno.serve(async (req: Request) => {
  // Always allow CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  // Accept GET for health checks
  if (req.method === "GET") {
    return new Response(JSON.stringify({ status: "ok", message: "Chatbot webhook is running" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  // UAZAPI appends event type to URL path, which can pollute the company_id param
  // e.g. "8979f2af-d095-41d0-9de3-7a5797a8fdc1/messages/text" — extract just the UUID
  const rawCompanyId = new URL(req.url).searchParams.get("company_id") || "";
  const uuidMatch = rawCompanyId.match(/^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  const companyIdParam = uuidMatch ? uuidMatch[1] : rawCompanyId || null;

  try {
    // ===== STEP 1: Parse body =====
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

    // ===== STEP 2: Extract payload =====
    const { messageText, senderPhone, fromMe, messageType, eventType } = extractIncomingPayload(body);

    console.log("Dados extraídos:", JSON.stringify({ messageText: messageText.slice(0, 200), senderPhone, fromMe, messageType, eventType }));

    // ===== STEP 3: Filter non-message events =====
    const ignoredEvents = ["chats", "status", "connection", "contacts", "groups", "call", "presence", "labels", "messages_update", "chat_labels", "receipt"];
    const eventLower = eventType.toLowerCase();
    if (eventLower && ignoredEvents.some(e => eventLower.includes(e))) {
      console.log("Evento ignorado:", eventType);
      return new Response(JSON.stringify({ status: "ok", ignored_event: eventType }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== STEP 4: Ignore own messages =====
    if (fromMe) {
      console.log("Mensagem própria ignorada (fromMe)");
      return new Response(JSON.stringify({ status: "ok", reason: "from_me" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== STEP 5: Handle non-text messages =====
    if (!messageText && senderPhone && companyIdParam && messageType !== "text" && messageType !== "unknown") {
      console.log(`Mídia recebida (${messageType}), ignorando processamento IA`);
      await supabase.from("chatbot_logs").insert({
        company_id: companyIdParam,
        phone: normalizePhone(senderPhone),
        client_name: `Mídia (${messageType})`,
        message_received: `[${messageType.toUpperCase()}]`,
        message_sent: "",
        context_type: "media_received",
        status: "ignored",
        error_message: `Tipo de mensagem não processável: ${messageType}`,
      });
      return new Response(JSON.stringify({ status: "ok", reason: "non_text", type: messageType }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== STEP 6: Validate required fields =====
    if (!messageText || !senderPhone || !companyIdParam) {
      const bodyKeys = body && typeof body === "object" ? Object.keys(body).slice(0, 20) : [];
      const debugDetails = `Missing: text=${!!messageText} phone=${!!senderPhone} company=${!!companyIdParam} type=${messageType} event=${eventType} keys=[${bodyKeys.join(",")}]`;
      console.error("Payload inválido:", debugDetails);

      if (companyIdParam) {
        await supabase.from("chatbot_logs").insert({
          company_id: companyIdParam,
          phone: normalizePhone(senderPhone || ""),
          client_name: "Payload inválido",
          message_received: (messageText || "").slice(0, 500),
          message_sent: "",
          context_type: "invalid_payload",
          status: "error",
          error_message: `${debugDetails} | preview: ${JSON.stringify(body).slice(0, 300)}`,
        });
      }

      // Return 200 to prevent UAZAPI retries
      return new Response(JSON.stringify({ status: "ok", info: "missing_fields", details: debugDetails }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phone = normalizePhone(senderPhone);
    console.log(`Processando mensagem de ${phone}: "${messageText.slice(0, 100)}"`);

    // ===== STEP 7: Fetch chatbot settings =====
    console.log(`Buscando configurações do chatbot para empresa: ${companyIdParam}`);
    const { data: chatSettings } = await supabase
      .from("chatbot_settings").select("*").eq("company_id", companyIdParam).single();

    if (!chatSettings?.is_active) {
      console.log("Chatbot desativado para esta empresa");
      return new Response(JSON.stringify({ status: "ok", reason: "bot_disabled" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("Chatbot ativo, personalidade:", (chatSettings.personality || "").slice(0, 80));

    // ===== STEP 8: Check blocked contacts =====
    const { data: blocked } = await supabase
      .from("chatbot_blocked_contacts").select("id").eq("company_id", companyIdParam).eq("phone", phone).maybeSingle();

    if (blocked) {
      console.log(`Contato bloqueado: ${phone}`);
      return new Response(JSON.stringify({ status: "ok", reason: "blocked" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== STEP 9: Fetch API credentials =====
    console.log("Buscando credenciais da API UAZAPI...");
    const { data: apiSettings } = await supabase
      .from("api_settings").select("api_url, api_token").eq("company_id", companyIdParam).single();

    if (!apiSettings?.api_url || !apiSettings?.api_token) {
      console.error("API não configurada para esta empresa");
      return new Response(JSON.stringify({ status: "ok", reason: "api_not_configured" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiUrl = apiSettings.api_url.replace(/\/$/, "");
    const apiToken = apiSettings.api_token;
    const minDelay = chatSettings.min_delay_seconds ?? 3;
    const maxDelay = chatSettings.max_delay_seconds ?? 6;
    console.log(`API URL: ${apiUrl}, delay: ${minDelay}-${maxDelay}s`);

    // ===== STEP 10: Check business hours =====
    if (!isWithinBusinessHours(chatSettings)) {
      console.log("Fora do horário comercial");
      const awayMsg = chatSettings.away_message?.trim();
      if (awayMsg) {
        await simulatePresence(apiUrl, apiToken, phone, "composing", getRandomDelay(minDelay, maxDelay));
        await sendText(apiUrl, apiToken, phone, awayMsg);
        await supabase.from("chatbot_logs").insert({
          company_id: companyIdParam, phone, client_name: "Fora do horário",
          message_received: messageText.slice(0, 500), message_sent: awayMsg.slice(0, 500),
          context_type: "away", status: "success",
        });
      }
      return new Response(JSON.stringify({ status: "ok", reason: "outside_hours" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== STEP 11: Check transfer keyword =====
    const transferKw = (chatSettings.transfer_keyword || "").trim().toLowerCase();
    if (transferKw && messageText.toLowerCase().trim().includes(transferKw)) {
      console.log("Keyword de transferência detectada");
      const transferMsg = chatSettings.transfer_message?.trim() || "Transferindo para um atendente...";
      await simulatePresence(apiUrl, apiToken, phone, "composing", getRandomDelay(minDelay, maxDelay));
      await sendText(apiUrl, apiToken, phone, transferMsg);
      await supabase.from("chatbot_logs").insert({
        company_id: companyIdParam, phone, client_name: "Transferência",
        message_received: messageText.slice(0, 500), message_sent: transferMsg.slice(0, 500),
        context_type: "transfer", status: "success",
      });
      return new Response(JSON.stringify({ status: "ok", reason: "transferred" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== STEP 12: Check auto-replies =====
    const { data: autoReplies } = await supabase
      .from("chatbot_auto_replies").select("*").eq("company_id", companyIdParam);

    if (autoReplies && autoReplies.length > 0) {
      const matchedReply = checkAutoReply(messageText, autoReplies);
      if (matchedReply) {
        console.log("Auto-reply encontrada:", matchedReply.trigger_keyword);
        await simulatePresence(apiUrl, apiToken, phone, "composing", getRandomDelay(minDelay, maxDelay));
        await sendText(apiUrl, apiToken, phone, matchedReply.response_text);
        if (matchedReply.response_media_id) {
          const { data: media } = await supabase
            .from("chatbot_media").select("*").eq("id", matchedReply.response_media_id).single();
          if (media) {
            const presType = media.file_type === "audio" ? "recording" : "composing";
            await simulatePresence(apiUrl, apiToken, phone, presType as any, getRandomDelay(minDelay + 2, maxDelay + 3));
            await sendMedia(apiUrl, apiToken, phone, media.file_url, media.file_type);
          }
        }
        await supabase.from("chatbot_logs").insert({
          company_id: companyIdParam, phone, client_name: "Auto-Reply",
          message_received: messageText.slice(0, 500), message_sent: matchedReply.response_text.slice(0, 500),
          context_type: "auto_reply", status: "success",
        });
        return new Response(JSON.stringify({ status: "ok", reason: "auto_reply" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ===== STEP 12.5: Interactive menu =====
    const menuEnabled = chatSettings.interactive_menu_enabled;
    const menuItems: any[] = chatSettings.interactive_menu_items || [];
    if (menuEnabled && menuItems.length > 0 && menuItems.some((i: any) => i.title)) {
      const menuType = chatSettings.interactive_menu_type || "buttons";
      const menuTitle = chatSettings.interactive_menu_title || "";
      const menuBody = chatSettings.interactive_menu_body || "Selecione uma opção:";
      const menuFooter = chatSettings.interactive_menu_footer || "";
      const menuButtonText = chatSettings.interactive_menu_button_text || "Ver Opções";
      const validItems = menuItems.filter((i: any) => i.title);

      try {
        await simulatePresence(apiUrl, apiToken, phone, "composing", getRandomDelay(minDelay, maxDelay));
        if (menuType === "buttons") {
          await sendButtons(apiUrl, apiToken, phone, menuTitle, menuBody, menuFooter, validItems.slice(0, 3));
        } else {
          await sendList(apiUrl, apiToken, phone, menuTitle, menuBody, menuFooter, menuButtonText, validItems.slice(0, 10));
        }
        await supabase.from("chatbot_logs").insert({
          company_id: companyIdParam, phone, client_name: "Menu Interativo",
          message_received: messageText.slice(0, 500),
          message_sent: `[MENU ${menuType.toUpperCase()}] ${validItems.map((i: any) => i.title).join(" | ")}`.slice(0, 500),
          context_type: "auto_reply", status: "success",
        });
        return new Response(JSON.stringify({ status: "ok", reason: "interactive_menu" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (menuErr: any) {
        console.error("Falha ao enviar menu interativo, continuando para IA:", menuErr);
      }
    }

    // ===== STEP 13: Check client context =====
    console.log(`Buscando dados do cliente com telefone: ${phone}`);
    const { data: clientData } = await supabase
      .from("clients").select("id, name, status, company_id")
      .eq("company_id", companyIdParam)
      .or(`phone.eq.${phone},whatsapp.eq.${phone}`)
      .limit(1).maybeSingle();

    let clientContext = "";
    let contextType = "new_contact";
    let clientName = "Desconhecido";

    if (clientData) {
      contextType = "client";
      clientName = clientData.name;
      console.log(`Cliente encontrado: ${clientName} (${clientData.status})`);

      const { data: subData } = await supabase
        .from("client_subscriptions")
        .select("end_date, amount, plan_id, subscription_plans(name)")
        .eq("client_id", clientData.id)
        .order("end_date", { ascending: false })
        .limit(1).maybeSingle();

      if (subData) {
        const planName = (subData as any).subscription_plans?.name || "N/A";
        clientContext = `
CONTEXTO DO CLIENTE:
- Nome: ${clientName}
- Status: ${clientData.status}
- Plano: ${planName}
- Vencimento: ${subData.end_date}
- Valor: R$ ${subData.amount}
Foque em suporte personalizado. Use o nome do cliente.`;
      } else {
        clientContext = `
CONTEXTO DO CLIENTE:
- Nome: ${clientName}
- Status: ${clientData.status}
- Sem assinatura ativa.
Ofereça ajuda e sugira planos disponíveis.`;
      }
    } else {
      console.log("Novo contato - não encontrado na base");
      const welcomeMsg = chatSettings.welcome_message?.trim();
      if (welcomeMsg) {
        const { data: previousLogs } = await supabase
          .from("chatbot_logs").select("id")
          .eq("company_id", companyIdParam).eq("phone", phone)
          .eq("context_type", "welcome").limit(1).maybeSingle();

        if (!previousLogs) {
          console.log("Enviando mensagem de boas-vindas");
          await simulatePresence(apiUrl, apiToken, phone, "composing", getRandomDelay(minDelay, maxDelay));
          await sendText(apiUrl, apiToken, phone, welcomeMsg);
          await supabase.from("chatbot_logs").insert({
            company_id: companyIdParam, phone, client_name: "Novo Contato",
            message_received: messageText.slice(0, 500), message_sent: welcomeMsg.slice(0, 500),
            context_type: "welcome", status: "success",
          });
          await sleep(1500);
        }
      }
      clientContext = `
CONTEXTO: Este é um NOVO CONTATO que não é cliente.
Foque em vendas: apresente o serviço, benefícios e como contratar.
Seja persuasivo mas educado.`;
    }

    // ===== STEP 14: Fetch media =====
    const { data: mediaFiles } = await supabase
      .from("chatbot_media").select("file_name, file_url, file_type").eq("company_id", companyIdParam);

    let mediaContext = "";
    if (mediaFiles && mediaFiles.length > 0) {
      mediaContext = `\n\nMÍDIAS DISPONÍVEIS (use o nome do arquivo quando quiser enviar):
${mediaFiles.map((m: any) => `- [${m.file_type.toUpperCase()}] ${m.file_name}`).join("\n")}

Para enviar mídia, responda EXATAMENTE neste formato na primeira linha:
[ENVIAR_MEDIA:nome_do_arquivo.extensão]
Seguido da mensagem de texto que acompanha o envio.`;
    }

    // ===== STEP 15: Call AI =====
    if (!lovableApiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const aiModel = chatSettings.ai_model || "google/gemini-3-flash-preview";
    const aiTemperature = chatSettings.ai_temperature ?? 0.7;

    const systemPrompt = `${chatSettings.personality || "Você é um assistente virtual profissional."}

${clientContext}
${mediaContext}

REGRAS IMPORTANTES:
- Responda de forma natural e humanizada, como se fosse uma pessoa real digitando.
- Mantenha respostas curtas e diretas (máximo 3 parágrafos).
- Use emojis com moderação.
- NUNCA revele que é uma IA ou bot.
- Se não souber algo, diga que vai verificar e retornar.`;

    console.log(`Chamando IA (${aiModel}) para gerar resposta...`);
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: aiModel,
        temperature: aiTemperature,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: messageText },
        ],
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

    // ===== STEP 16: Check media in AI response =====
    let mediaToSend: any = null;
    const mediaMatch = replyText.match(/^\[ENVIAR_MEDIA:(.+?)\]/);
    if (mediaMatch && mediaFiles) {
      const requestedFile = mediaMatch[1].trim();
      mediaToSend = mediaFiles.find(
        (m: any) => m.file_name.toLowerCase() === requestedFile.toLowerCase()
      );
      replyText = replyText.replace(/^\[ENVIAR_MEDIA:.+?\]\s*/i, "").trim();
    }

    // ===== STEP 17: Send response =====
    console.log("Tentando enviar via UAZAPI...");
    if (mediaToSend) {
      const presenceType = mediaToSend.file_type === "audio" ? "recording" : "composing";
      if (replyText) {
        await simulatePresence(apiUrl, apiToken, phone, "composing", getRandomDelay(minDelay, maxDelay));
        await sendText(apiUrl, apiToken, phone, replyText);
      }
      await simulatePresence(apiUrl, apiToken, phone, presenceType as any, getRandomDelay(minDelay + 2, maxDelay + 3));
      await sendMedia(apiUrl, apiToken, phone, mediaToSend.file_url, mediaToSend.file_type);
    } else {
      await simulatePresence(apiUrl, apiToken, phone, "composing", getRandomDelay(minDelay, maxDelay));
      await sendText(apiUrl, apiToken, phone, replyText);
    }

    console.log("Mensagem enviada com sucesso!");

    // ===== STEP 18: Log =====
    await supabase.from("chatbot_logs").insert({
      company_id: companyIdParam, phone, client_name: clientName,
      message_received: messageText.slice(0, 500), message_sent: replyText.slice(0, 500),
      context_type: contextType, status: "success",
    });

    return new Response(JSON.stringify({ status: "ok", context: contextType }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Chatbot webhook error:", error?.message || error);
    try {
      if (companyIdParam) {
        await supabase.from("chatbot_logs").insert({
          company_id: companyIdParam, phone: "unknown", client_name: "Erro",
          message_received: "", message_sent: "",
          context_type: "error", status: "error",
          error_message: (error?.message || "Unknown error").slice(0, 500),
        });
      }
    } catch (_) {}

    // ALWAYS return 200 to prevent UAZAPI retries
    return new Response(JSON.stringify({ status: "ok", error: error?.message || "Internal error" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
