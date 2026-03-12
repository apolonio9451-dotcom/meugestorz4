import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { company_id, message, conversation_history, simulate_as } = await req.json();

    if (!company_id || !message) {
      return new Response(JSON.stringify({ error: "company_id and message required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch chatbot settings
    const { data: chatSettings } = await supabase
      .from("chatbot_settings").select("*").eq("company_id", company_id).single();

    if (!chatSettings) {
      return new Response(JSON.stringify({ error: "Chatbot não configurado. Salve as configurações primeiro." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contextType = simulate_as || "new_contact";
    const decisions: string[] = [];
    decisions.push(`🧪 MODO SIMULAÇÃO — contexto: ${contextType}`);

    // Check auto-replies first
    const { data: autoReplies } = await supabase
      .from("chatbot_auto_replies").select("*").eq("company_id", company_id);

    if (autoReplies && autoReplies.length > 0) {
      const lowerMsg = message.toLowerCase().trim();
      const sorted = [...autoReplies].filter((r: any) => r.is_active).sort((a: any, b: any) => b.priority - a.priority);
      for (const reply of sorted) {
        const keyword = reply.trigger_keyword.toLowerCase().trim();
        let match = false;
        switch (reply.trigger_type) {
          case "exact": match = lowerMsg === keyword; break;
          case "starts_with": match = lowerMsg.startsWith(keyword); break;
          case "contains": default: match = lowerMsg.includes(keyword); break;
        }
        if (match) {
          decisions.push(`⚡ Gatilho automático: "${reply.trigger_keyword}"`);
          return new Response(JSON.stringify({
            reply: reply.response_text,
            context: "auto_reply",
            decisions,
            commands: [],
          }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
    }

    // Check transfer keyword
    const transferKw = (chatSettings.transfer_keyword || "").trim().toLowerCase();
    if (transferKw && message.toLowerCase().includes(transferKw)) {
      decisions.push(`🔄 Keyword de transferência "${transferKw}" detectada`);
      const transferMsg = chatSettings.transfer_message?.trim() || "Transferindo para um atendente...";
      return new Response(JSON.stringify({
        reply: transferMsg,
        context: "transfer",
        decisions,
        commands: [],
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Build context
    let clientContext = "";
    let contextInstructions = "";
    const newContactInstr = (chatSettings.new_contact_instructions || "").trim();
    const clientInstr = (chatSettings.client_instructions || "").trim();

    if (contextType === "client") {
      decisions.push("👤 Simulando como CLIENTE EXISTENTE");
      clientContext = `
CONTEXTO DO CLIENTE:
- Nome: João Silva (simulado)
- Status: ativo
- Plano: Plano Premium
- Vencimento: 2026-04-15
- Valor: R$ 49.90
Foque em suporte personalizado. Use o nome do cliente.`;
      if (clientInstr) {
        contextInstructions = `\n\nINSTRUÇÕES ESPECÍFICAS PARA CLIENTES:\n${clientInstr}`;
        decisions.push("📝 Usando instruções para CLIENTE");
      }
    } else {
      decisions.push("🆕 Simulando como NOVO CONTATO");
      clientContext = `
CONTEXTO: Este é um NOVO CONTATO que não é cliente.
Foque em vendas: apresente o serviço, benefícios e como contratar.`;
      if (newContactInstr) {
        contextInstructions = `\n\nINSTRUÇÕES ESPECÍFICAS PARA NOVOS CONTATOS:\n${newContactInstr}`;
        decisions.push("📝 Usando instruções para NOVO CONTATO");
      }
    }

    // Fetch media for context
    const { data: mediaFiles } = await supabase
      .from("chatbot_media").select("file_name, file_type").eq("company_id", company_id);

    let mediaContext = "";
    if (mediaFiles && mediaFiles.length > 0) {
      mediaContext = `\n\nMÍDIAS DISPONÍVEIS:\n${mediaFiles.map((m: any) => `- [${m.file_type.toUpperCase()}] ${m.file_name}`).join("\n")}
Para enviar mídia: [ENVIAR_MEDIA:nome_do_arquivo.extensão]`;
    }

    const commandTagsDoc = `

COMANDOS ESPECIAIS (Tags):
- [ENVIAR_MENU] → Envia menu interativo
- [ENVIAR_CATALOGO] → Envia lista de planos
- [ENVIAR_BOTOES:Op1|Op2|Op3] → Botões rápidos (máx 3)
- [ENVIAR_LISTA:Item1|Item2|...] → Menu de lista
- [ENVIAR_MEDIA:arquivo.mp3] → Mídia da biblioteca
- [AUDIO:nome] → Atalho para áudio`;

    const aiModel = chatSettings.ai_model || "google/gemini-3-flash-preview";
    const aiTemperature = chatSettings.ai_temperature ?? 0.7;

    decisions.push(`🤖 Chamando IA (${aiModel})`);

    const systemPrompt = `${chatSettings.personality || "Você é um assistente virtual profissional."}
${contextInstructions}
${clientContext}
${mediaContext}
${commandTagsDoc}

REGRAS IMPORTANTES:
- Responda de forma natural e humanizada.
- Mantenha respostas curtas e diretas (máximo 3 parágrafos).
- Use emojis com moderação.
- NUNCA revele que é uma IA ou bot.
- Quando o cliente pedir para ver planos/catálogo, use [ENVIAR_CATALOGO].
- Quando quiser dar opções, use [ENVIAR_BOTOES:...] ou [ENVIAR_LISTA:...].`;

    // Build messages with conversation history
    const messages: any[] = [{ role: "system", content: systemPrompt }];
    if (conversation_history && Array.isArray(conversation_history)) {
      for (const msg of conversation_history) {
        messages.push({ role: msg.role, content: msg.content });
      }
    }
    messages.push({ role: "user", content: message });

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${lovableApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: aiModel, temperature: aiTemperature, messages }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      throw new Error(`AI error: ${aiResponse.status} - ${errText}`);
    }

    const aiData = await aiResponse.json();
    let replyText = aiData.choices?.[0]?.message?.content || "Desculpe, não consegui processar.";

    // Parse commands from response
    const commands: string[] = [];
    const cmdMatches = replyText.matchAll(/\[(ENVIAR_MENU|ENVIAR_CATALOGO|ENVIAR_BOTOES:.+?|ENVIAR_LISTA:.+?|ENVIAR_MEDIA:.+?|AUDIO:.+?)\]/gi);
    for (const m of cmdMatches) {
      commands.push(`[${m[1]}]`);
    }

    // Clean tags for display
    let cleanReply = replyText
      .replace(/\[ENVIAR_MENU\]\s*/gi, "")
      .replace(/\[ENVIAR_CATALOGO\]\s*/gi, "")
      .replace(/\[ENVIAR_BOTOES:.+?\]\s*/gi, "")
      .replace(/\[ENVIAR_LISTA:.+?\]\s*/gi, "")
      .replace(/\[ENVIAR_MEDIA:.+?\]\s*/gi, "")
      .replace(/\[AUDIO:.+?\]\s*/gi, "")
      .trim();

    decisions.push(`💬 Resposta gerada (${cleanReply.length} chars)`);
    if (commands.length > 0) {
      decisions.push(`🎯 Comandos detectados: ${commands.join(", ")}`);
    }

    return new Response(JSON.stringify({
      reply: cleanReply,
      context: contextType,
      decisions,
      commands,
      raw_reply: replyText,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error: any) {
    console.error("Simulator error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
