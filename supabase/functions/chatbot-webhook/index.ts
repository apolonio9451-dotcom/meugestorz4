import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
  const resp = await fetch(`${apiUrl}/send/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiToken}` },
    body: JSON.stringify({ phone: to, message: text }),
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
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiToken}` },
    body: JSON.stringify({ phone: to, url: mediaUrl, caption: caption || "" }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`UAZAPI ${endpoint} failed: ${resp.status} - ${body}`);
  }
  return resp.json();
}

function isWithinBusinessHours(settings: any): boolean {
  if (!settings.business_hours_enabled) return true;
  
  const now = new Date();
  // Convert to Brasilia time (UTC-3)
  const brasiliaOffset = -3 * 60;
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const brasiliaTime = new Date(utcMs + brasiliaOffset * 60000);
  
  const dayOfWeek = brasiliaTime.getDay();
  const days: number[] = settings.business_days || [1, 2, 3, 4, 5];
  if (!days.includes(dayOfWeek)) return false;
  
  const currentMinutes = brasiliaTime.getHours() * 60 + brasiliaTime.getMinutes();
  const [startH, startM] = (settings.business_hours_start || "08:00").split(":").map(Number);
  const [endH, endM] = (settings.business_hours_end || "18:00").split(":").map(Number);
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  
  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

function getRandomDelay(min: number, max: number): number {
  return (min + Math.random() * (max - min)) * 1000;
}

function checkAutoReply(message: string, autoReplies: any[]): any | null {
  const lowerMsg = message.toLowerCase().trim();
  // Sort by priority descending
  const sorted = [...autoReplies].filter((r) => r.is_active).sort((a, b) => b.priority - a.priority);
  
  for (const reply of sorted) {
    const keyword = reply.trigger_keyword.toLowerCase().trim();
    let match = false;
    
    switch (reply.trigger_type) {
      case "exact":
        match = lowerMsg === keyword;
        break;
      case "starts_with":
        match = lowerMsg.startsWith(keyword);
        break;
      case "contains":
      default:
        match = lowerMsg.includes(keyword);
        break;
    }
    
    if (match) return reply;
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json();
    const messageText = body?.message?.text || body?.text || body?.body || "";
    const senderPhone = body?.message?.from || body?.from || body?.phone || "";
    const companyIdParam = new URL(req.url).searchParams.get("company_id");

    if (!messageText || !senderPhone || !companyIdParam) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phone = normalizePhone(senderPhone);

    // 1. Fetch chatbot settings
    const { data: chatSettings } = await supabase
      .from("chatbot_settings").select("*").eq("company_id", companyIdParam).single();

    if (!chatSettings?.is_active) {
      return new Response(JSON.stringify({ status: "bot_disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Check blocked contacts
    const { data: blocked } = await supabase
      .from("chatbot_blocked_contacts").select("id").eq("company_id", companyIdParam).eq("phone", phone).maybeSingle();

    if (blocked) {
      return new Response(JSON.stringify({ status: "blocked" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Fetch API credentials
    const { data: apiSettings } = await supabase
      .from("api_settings").select("api_url, api_token").eq("company_id", companyIdParam).single();

    if (!apiSettings?.api_url || !apiSettings?.api_token) {
      return new Response(JSON.stringify({ error: "API not configured" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiUrl = apiSettings.api_url.replace(/\/$/, "");
    const apiToken = apiSettings.api_token;
    const minDelay = chatSettings.min_delay_seconds ?? 3;
    const maxDelay = chatSettings.max_delay_seconds ?? 6;

    // 4. Check business hours
    if (!isWithinBusinessHours(chatSettings)) {
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
      return new Response(JSON.stringify({ status: "outside_hours" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Check transfer keyword
    const transferKw = (chatSettings.transfer_keyword || "").trim().toLowerCase();
    if (transferKw && messageText.toLowerCase().trim().includes(transferKw)) {
      const transferMsg = chatSettings.transfer_message?.trim() || "Transferindo para um atendente...";
      await simulatePresence(apiUrl, apiToken, phone, "composing", getRandomDelay(minDelay, maxDelay));
      await sendText(apiUrl, apiToken, phone, transferMsg);
      
      await supabase.from("chatbot_logs").insert({
        company_id: companyIdParam, phone, client_name: "Transferência",
        message_received: messageText.slice(0, 500), message_sent: transferMsg.slice(0, 500),
        context_type: "transfer", status: "success",
      });
      
      return new Response(JSON.stringify({ status: "transferred" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 6. Check auto-replies (keyword triggers)
    const { data: autoReplies } = await supabase
      .from("chatbot_auto_replies").select("*").eq("company_id", companyIdParam);

    if (autoReplies && autoReplies.length > 0) {
      const matchedReply = checkAutoReply(messageText, autoReplies);
      if (matchedReply) {
        await simulatePresence(apiUrl, apiToken, phone, "composing", getRandomDelay(minDelay, maxDelay));
        await sendText(apiUrl, apiToken, phone, matchedReply.response_text);
        
        // If reply has media, send it too
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
        
        return new Response(JSON.stringify({ status: "auto_reply" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 7. Check if sender is a known client
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
      // Check for welcome message for new contacts
      const welcomeMsg = chatSettings.welcome_message?.trim();
      if (welcomeMsg) {
        // Check if we've already sent a welcome (avoid repeating)
        const { data: previousLogs } = await supabase
          .from("chatbot_logs").select("id")
          .eq("company_id", companyIdParam).eq("phone", phone)
          .eq("context_type", "welcome").limit(1).maybeSingle();
        
        if (!previousLogs) {
          await simulatePresence(apiUrl, apiToken, phone, "composing", getRandomDelay(minDelay, maxDelay));
          await sendText(apiUrl, apiToken, phone, welcomeMsg);
          
          await supabase.from("chatbot_logs").insert({
            company_id: companyIdParam, phone, client_name: "Novo Contato",
            message_received: messageText.slice(0, 500), message_sent: welcomeMsg.slice(0, 500),
            context_type: "welcome", status: "success",
          });
          // Small delay before AI response
          await sleep(1500);
        }
      }
      
      clientContext = `
CONTEXTO: Este é um NOVO CONTATO que não é cliente.
Foque em vendas: apresente o serviço, benefícios e como contratar.
Seja persuasivo mas educado.`;
    }

    // 8. Fetch available media
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

    // 9. Call AI
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

    // 10. Check if AI wants to send media
    let mediaToSend: any = null;
    const mediaMatch = replyText.match(/^\[ENVIAR_MEDIA:(.+?)\]/);
    if (mediaMatch && mediaFiles) {
      const requestedFile = mediaMatch[1].trim();
      mediaToSend = mediaFiles.find(
        (m: any) => m.file_name.toLowerCase() === requestedFile.toLowerCase()
      );
      replyText = replyText.replace(/^\[ENVIAR_MEDIA:.+?\]\s*/i, "").trim();
    }

    // 11. Simulate presence and send
    if (mediaToSend) {
      const presenceType = mediaToSend.file_type === "audio" ? "recording" : "composing";
      const presenceDuration = getRandomDelay(minDelay + 2, maxDelay + 3);

      if (replyText) {
        await simulatePresence(apiUrl, apiToken, phone, "composing", getRandomDelay(minDelay, maxDelay));
        await sendText(apiUrl, apiToken, phone, replyText);
      }
      await simulatePresence(apiUrl, apiToken, phone, presenceType as any, presenceDuration);
      await sendMedia(apiUrl, apiToken, phone, mediaToSend.file_url, mediaToSend.file_type);
    } else {
      await simulatePresence(apiUrl, apiToken, phone, "composing", getRandomDelay(minDelay, maxDelay));
      await sendText(apiUrl, apiToken, phone, replyText);
    }

    // 12. Log interaction
    await supabase.from("chatbot_logs").insert({
      company_id: companyIdParam, phone, client_name: clientName,
      message_received: messageText.slice(0, 500), message_sent: replyText.slice(0, 500),
      context_type: contextType, status: "success",
    });

    return new Response(JSON.stringify({ status: "ok", context: contextType }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Chatbot webhook error:", error);
    try {
      const companyId = new URL(req.url).searchParams.get("company_id");
      if (companyId) {
        await supabase.from("chatbot_logs").insert({
          company_id: companyId, phone: "unknown", client_name: "Erro",
          message_received: "", message_sent: "",
          context_type: "error", status: "error",
          error_message: error?.message?.slice(0, 500) || "Unknown error",
        });
      }
    } catch (_) {}

    return new Response(JSON.stringify({ error: error?.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
