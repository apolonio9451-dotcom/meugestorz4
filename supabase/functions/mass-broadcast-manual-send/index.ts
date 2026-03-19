import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function simulatePresence(apiUrl: string, apiToken: string, phone: string, type: "composing" | "recording", durationMs: number) {
  await fetch(`${apiUrl}/operations/presence`, {
    method: "POST",
    headers: { "Content-Type": "application/json", token: apiToken },
    body: JSON.stringify({ phone, presence: type }),
  });
  await sleep(durationMs);
}

async function sendAudio(apiUrl: string, apiToken: string, phone: string, mediaUrl: string) {
  const response = await fetch(`${apiUrl}/send/audio`, {
    method: "POST",
    headers: { "Content-Type": "application/json", token: apiToken },
    body: JSON.stringify({ number: phone, url: mediaUrl, caption: "" }),
  });

  if (!response.ok) {
    throw new Error(`Falha ao enviar áudio: ${response.status} ${await response.text()}`);
  }
}

async function sendImage(apiUrl: string, apiToken: string, phone: string, mediaUrl: string, caption: string) {
  const response = await fetch(`${apiUrl}/send/image`, {
    method: "POST",
    headers: { "Content-Type": "application/json", token: apiToken },
    body: JSON.stringify({ number: phone, url: mediaUrl, caption }),
  });

  if (!response.ok) {
    throw new Error(`Falha ao enviar imagem: ${response.status} ${await response.text()}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const supabaseUser = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const { data: userData, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Sessão inválida." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const conversationId = String(body?.conversationId || "").trim();
    const mediaUrl = String(body?.mediaUrl || "").trim();
    const mediaType = body?.mediaType === "audio" ? "audio" : body?.mediaType === "image" ? "image" : null;
    const fileName = String(body?.fileName || "arquivo").trim();

    if (!conversationId || !mediaUrl || !mediaType) {
      return new Response(JSON.stringify({ error: "conversationId, mediaUrl e mediaType são obrigatórios." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: conversation, error: conversationError } = await supabaseAdmin
      .from("mass_broadcast_conversations")
      .select("id, company_id, campaign_id, recipient_id, phone")
      .eq("id", conversationId)
      .single();

    if (conversationError || !conversation) {
      throw new Error("Conversa não encontrada.");
    }

    const { data: membership } = await supabaseAdmin
      .from("company_memberships")
      .select("id")
      .eq("user_id", userData.user.id)
      .eq("company_id", conversation.company_id)
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Sem permissão para enviar nesta conversa." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: apiSettings, error: apiError } = await supabaseAdmin
      .from("api_settings")
      .select("api_url, api_token")
      .eq("company_id", conversation.company_id)
      .single();

    if (apiError || !apiSettings?.api_url || !apiSettings?.api_token) {
      throw new Error("Instância do WhatsApp não configurada.");
    }

    const apiUrl = apiSettings.api_url.replace(/\/$/, "");
    const apiToken = apiSettings.api_token;
    const phone = String(conversation.phone).replace(/\D/g, "");

    if (mediaType === "audio") {
      await simulatePresence(apiUrl, apiToken, phone, "recording", 5000);
      await sendAudio(apiUrl, apiToken, phone, mediaUrl);
    } else {
      await simulatePresence(apiUrl, apiToken, phone, "composing", 1500);
      await sendImage(apiUrl, apiToken, phone, mediaUrl, "");
    }

    const nowIso = new Date().toISOString();
    const logMessage = mediaType === "audio" ? `[ÁUDIO] ${fileName}` : `[IMAGEM] ${fileName}`;

    const { error: messageError } = await supabaseAdmin.from("mass_broadcast_conversation_messages").insert({
      company_id: conversation.company_id,
      campaign_id: conversation.campaign_id,
      conversation_id: conversation.id,
      recipient_id: conversation.recipient_id,
      phone,
      normalized_phone: phone,
      direction: "outbound",
      sender_type: "human",
      source: "manual_monitor",
      message_type: mediaType,
      message: logMessage,
      delivery_status: "sent",
      created_at: nowIso,
    });

    if (messageError) {
      throw messageError;
    }

    const { error: updateError } = await supabaseAdmin
      .from("mass_broadcast_conversations")
      .update({
        last_message_at: nowIso,
        last_outgoing_at: nowIso,
      })
      .eq("id", conversation.id);

    if (updateError) {
      throw updateError;
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});