import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

function getBrasiliaDate(): Date {
  const nowUtc = new Date();
  return new Date(nowUtc.getTime() - 3 * 60 * 60 * 1000);
}

function getGreeting(): string {
  const h = getBrasiliaDate().getUTCHours();
  if (h >= 5 && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite";
}

function getDayOfWeek(): string {
  const dias = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
  return dias[getBrasiliaDate().getUTCDay()];
}

function getDayOfMonth(): string {
  return String(getBrasiliaDate().getUTCDate());
}

function replacePlaceholders(template: string, vars: Record<string, string>): string {
  let msg = template;
  for (const [key, value] of Object.entries(vars)) {
    msg = msg.replaceAll(`{${key}}`, value || "");
  }
  return msg;
}

function getFirstEnvValue(names: string[]): string {
  for (const name of names) {
    const value = Deno.env.get(name);
    if (value && value.trim().length > 0) return value.trim();
  }
  return "";
}

function getApiHeaders(apiToken: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    token: apiToken,
    Authorization: `Bearer ${apiToken}`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, category, company_id } = await req.json();
    console.log("[test-send] Recebido:", { phone, category, company_id });

    if (!phone || !category || !company_id) {
      return new Response(
        JSON.stringify({ error: "phone, category e company_id são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Fetch API credentials from api_settings table
    const { data: apiSettings, error: settingsError } = await supabase
      .from("api_settings")
      .select("api_url, api_token, instance_name, pix_key")
      .eq("company_id", company_id)
      .single();

    const dbApiUrl = (apiSettings?.api_url || "").trim();
    const dbApiToken = (apiSettings?.api_token || "").trim();

    const apiUrl = (dbApiUrl || getFirstEnvValue(["WA_API_URL", "EVOLUTI_API_URL"])).replace(/\/$/, "");
    const apiToken = dbApiToken || getFirstEnvValue(["WA_ADMIN_TOKEN", "BOLINHA_API_TOKEN", "UAZAPI_ADMIN_TOKEN", "EVOLUTI_TOKEN"]);

    console.log("[test-send] apiSettings:", apiSettings ? {
      api_url: apiSettings.api_url,
      instance: apiSettings.instance_name,
      hasToken: !!apiSettings.api_token,
      tokenLen: apiSettings.api_token?.length,
      usingEnvFallback: !dbApiToken || !dbApiUrl,
    } : "null", "error:", settingsError?.message);

    if (!apiUrl || !apiToken) {
      const reason = `Configuração ausente. Defina URL/Token no menu Instância ou nos secrets WA_API_URL + WA_ADMIN_TOKEN (fallback também aceita EVOLUTI_API_URL, BOLINHA_API_TOKEN, UAZAPI_ADMIN_TOKEN, EVOLUTI_TOKEN).`;
      return new Response(
        JSON.stringify({ error: reason }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get template
    const { data: templateRow } = await supabase
      .from("message_templates")
      .select("message")
      .eq("company_id", company_id)
      .eq("category", category)
      .single();

    const defaultTemplates: Record<string, string> = {
      vence_hoje: "Olá, {primeiro_nome}, {saudacao}! ⏳\n\nSeu acesso vence hoje, {dia_semana} dia {dia}. Seu sinal pode cair a qualquer momento, confira os dados para renovação:\n\n📋 *Plano*: {plano}\n💰 *Valor*: R$ {valor}\n📅 *Vencimento*: {vencimento}\n\n💳 Pagamento Pix\nClique na chave para copiar:\n\n📌 Chave: {sua_chave_pix}\n👤 Nome: [Seu Nome]\n\n_Após o pagamento, envie o comprovante por aqui para liberação imediata._",
      vence_amanha: "Olá, {primeiro_nome}, {saudacao}! ⏳\n\nSeu acesso vence amanhã, {dia_semana} dia {dia}. Evite interrupções no sinal e confira os dados para renovação:\n\n📋 *Plano*: {plano}\n💰 *Valor*: R$ {valor}\n📅 *Vencimento*: {vencimento}\n\n💳 Pagamento Pix\nClique na chave para copiar:\n\n📌 *Chave*: {sua_chave_pix}\n👤 *Nome*: [Seu Nome]\n\n_Após o pagamento, envie o comprovante por aqui para liberação imediata_. 🤝",
      a_vencer: "*Olá, {primeiro_nome}, {saudacao}*! 👋\n\nPassando  para te manter informado sobre o status do seu acesso. Seu plano vence em {dias} dias! ⏳\n\nPreparamos tudo para que você continue aproveitando sua programação sem interrupções. Confira os detalhes:\n\n📋 Resumo da Assinatura:\n\n*Plano*: {plano}\n*Valor*: R$ {valor}\n*Vencimento*: {vencimento}\n\n🔑 *Dados do Seu Acesso*:\n\n👤 _Usuário: {usuario}_\n🖥️ _MAC: {mac}_\n🌐 _Servidor: {servidor}_\n\nQuer se antecipar e garantir sua renovação? 🚀\n\n📌 *Dados para Pagamento*:\n\n*Banco*: [Seu Banco]\n*Nome*: [Seu Nome]\n*Chave Pix*: {sua_chave_pix}\n\n_Qualquer dúvida ou se precisar de suporte, conte comigo_! 😊",
      vencidos: "Olá, *{primeiro_nome}* {saudacao}! 👋\n\nNotamos que o seu plano venceu a *{dias} dias* e o seu acesso pode estar interrompido. 🚫\nNão perca seus conteúdos favoritos! Vamos regularizar isso agora?\n\n📋 *Dados da Assinatura Vencida*:\n\n*Plano*: {plano}\n*Valor*: R$ {valor}\n*Vencimento*: {vencimento}\n\n📌 *Dados para Pagamento*:\n\n📌 *Chave*: {sua_chave_pix}\n👤 *Nome*: [Seu Nome]\n\n_Se já efetuou o pagamento desconsidere esse lembrete_",
      followup: "Olá, {primeiro_nome}! 👋\n\nPassando hoje com um sentimento de gratidão por ter você conosco! Já se passaram {dias} dias desde o seu cadastro e é um privilégio fazer parte do seu entretenimento diário. 🌟\n\nNossa maior prioridade é garantir que você tenha a melhor experiência possível com nosso serviços. Por isso, gostaria de saber: como está sendo sua experiência até agora? Seu feedback é valioso para continuarmos evoluindo nosso serviço! 🚀\n\n📋 Resumo da Sua Assinatura:\n\nPlano: {plano}\nValor: R$ {valor}\nVencimento: {vencimento}\n\n🔑 Seus Dados:\n\n👤 Usuário: {usuario}\n🖥️ MAC: {mac}\n🌐 Servidor: {servidor}",
      suporte: "Olá, *{primeiro_nome}*, {saudacao}! 👋\n\nEstamos entrando em contato para saber como ficou o seu sinal após o nosso último suporte. Como está a sua experiência hoje? 🌟\n\nPassando apenas para confirmar se ficou tudo 100% resolvido, pois sua satisfação é nossa prioridade e queremos garantir que o serviço esteja funcional. 🤝\natt,\nTv max. suporte 24h!",
    };

    const template = templateRow?.message || defaultTemplates[category] || "Olá {nome}!";

    // Get a sample client
    const { data: sampleClient } = await supabase
      .from("clients")
      .select(`
        name, server, iptv_user, iptv_password,
        client_subscriptions (
          end_date, amount, custom_price,
          subscription_plans ( name, price )
        )
      `)
      .eq("company_id", company_id)
      .eq("status", "active")
      .limit(1)
      .single();

    const sub = sampleClient?.client_subscriptions?.[0];
    const plan = sub?.subscription_plans;
    const valor = sub?.custom_price && sub.custom_price > 0 ? sub.custom_price : plan?.price ?? sub?.amount ?? 0;
    const endDate = sub?.end_date ? new Date(sub.end_date + "T00:00:00") : new Date();
    const todayDate = new Date();
    const diffDays = Math.round((endDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

    const messageBody = replacePlaceholders(template, {
      saudacao: getGreeting(),
      dia_semana: getDayOfWeek(),
      dia: getDayOfMonth(),
      primeiro_nome: (sampleClient?.name || "Cliente Teste").split(" ")[0],
      nome: sampleClient?.name || "Cliente Teste",
      plano: plan?.name || "Plano Exemplo",
      valor: Number(valor).toFixed(2),
      vencimento: endDate.toLocaleDateString("pt-BR"),
      dias: String(Math.abs(diffDays)),
      mac: "",
      usuario: sampleClient?.iptv_user || "",
      senha: sampleClient?.iptv_password || "",
      servidor: sampleClient?.server || "",
      sua_chave_pix: apiSettings?.pix_key || "",
    });

    const normalizedPhone = normalizePhone(phone);
    const endpoint = `${apiUrl}/send/text`;
    console.log("[test-send] Enviando para:", { endpoint, phone: normalizedPhone, messageLength: messageBody.length });

    try {
      console.log("[test-send] Chamando API:", { endpoint, tokenLength: apiToken.length, tokenPrefix: apiToken.substring(0, 6) + "..." });

      const preflight = await fetch(`${apiUrl}/instance`, {
        method: "GET",
        headers: getApiHeaders(apiToken),
      });
      const preflightBody = await preflight.text();
      if (preflight.status === 401) {
        return new Response(
          JSON.stringify({ error: "Token inválido/expirado. Atualize o token da instância e reconecte o WhatsApp." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!preflight.ok) {
        console.log("[test-send] preflight warning:", { status: preflight.status, body: preflightBody?.slice(0, 300) });
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: getApiHeaders(apiToken),
        body: JSON.stringify({ number: normalizedPhone, text: messageBody, linkPreview: true }),
      });

      const responseText = await res.text();

      if (res.status === 401) {
        return new Response(
          JSON.stringify({ error: "⚠️ Token inválido/expirado. Vá em Configurações → Instância, atualize o Token e reconecte o WhatsApp." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!res.ok) {
        return new Response(
          JSON.stringify({ error: `Falha ao enviar mensagem (status ${res.status}). Detalhe: ${responseText}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, phone: normalizedPhone, message: messageBody }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (networkErr) {
      return new Response(
        JSON.stringify({ error: `Erro de rede ao conectar com a API: ${String(networkErr)}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
