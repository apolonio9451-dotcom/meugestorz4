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

/** Get the instance_token from whatsapp_instances for a company's users */
async function getCompanyInstanceData(supabase: any, companyId: string): Promise<{ token: string; serverUrl: string; isConnected: boolean }> {
  const { data: memberships } = await supabase
    .from("company_memberships")
    .select("user_id")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true })
    .limit(20);

  const userIds = (memberships || []).map((m: any) => m.user_id).filter(Boolean);
  if (!userIds.length) return { token: "", serverUrl: "", isConnected: false };

  // Try connected instance first
  const { data: connectedInstance } = await supabase
    .from("whatsapp_instances")
    .select("instance_token, server_url, is_connected")
    .in("user_id", userIds)
    .eq("is_connected", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (connectedInstance?.instance_token) {
    return {
      token: String(connectedInstance.instance_token).trim(),
      serverUrl: String(connectedInstance.server_url || "").trim(),
      isConnected: true,
    };
  }

  // Fallback to latest instance
  const { data: latestInstance } = await supabase
    .from("whatsapp_instances")
    .select("instance_token, server_url, is_connected, status")
    .in("user_id", userIds)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    token: String(latestInstance?.instance_token || "").trim(),
    serverUrl: String(latestInstance?.server_url || "").trim(),
    isConnected: Boolean(latestInstance?.is_connected),
  };
}

function getApiHeaders(apiToken: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    token: apiToken,
  };
}

/** Try sending with a given token, return result */
async function trySend(apiUrl: string, apiToken: string, phone: string, messageBody: string): Promise<{ ok: boolean; status: number; body: string }> {
  const endpoint = `${apiUrl}/send/text`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: getApiHeaders(apiToken),
    body: JSON.stringify({ number: phone, text: messageBody, linkPreview: true }),
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
}

async function trySendCampaignMessage(apiUrl: string, apiToken: string, phone: string, messageBody: string, imageUrl?: string | null): Promise<{ ok: boolean; status: number; body: string }> {
  const endpoint = imageUrl ? `${apiUrl}/send/media` : `${apiUrl}/send/text`;
  const payload = imageUrl
    ? { number: phone, type: "image", file: imageUrl, text: messageBody }
    : { number: phone, text: messageBody, linkPreview: true };
  const res = await fetch(endpoint, {
    method: "POST",
    headers: getApiHeaders(apiToken),
    body: JSON.stringify(payload),
  });
  const body = await res.text();
  return { ok: res.ok, status: res.status, body };
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

    // Get instance data (token + connection status)
    const instanceData = await getCompanyInstanceData(supabase, company_id);

    const dbApiUrl = (apiSettings?.api_url || "").trim();
    const dbApiToken = (apiSettings?.api_token || "").trim();
    const instanceToken = instanceData.token;

    // Resolve API URL: api_settings > instance server_url > env fallback
    const apiUrl = (dbApiUrl || instanceData.serverUrl || getFirstEnvValue(["WA_API_URL", "EVOLUTI_API_URL"])).replace(/\/$/, "");

    // Build list of tokens to try (in order): instance_token first (uazapi native), then api_settings, then env
    const tokensToTry: { label: string; token: string }[] = [];
    if (instanceToken.length > 5) tokensToTry.push({ label: "instance_token", token: instanceToken });
    if (dbApiToken.length > 5 && dbApiToken !== instanceToken) tokensToTry.push({ label: "api_settings", token: dbApiToken });
    const envToken = getFirstEnvValue(["WA_ADMIN_TOKEN", "BOLINHA_API_TOKEN", "UAZAPI_ADMIN_TOKEN", "EVOLUTI_TOKEN"]);
    if (envToken.length > 5 && !tokensToTry.some(t => t.token === envToken)) tokensToTry.push({ label: "env_fallback", token: envToken });

    console.log("[test-send] Token candidates:", tokensToTry.map(t => ({ label: t.label, len: t.token.length, prefix: t.token.substring(0, 8) + "..." })));
    console.log("[test-send] Instance connected:", instanceData.isConnected, "| apiUrl:", apiUrl);

    if (!apiUrl || tokensToTry.length === 0) {
      return new Response(
        JSON.stringify({ error: "Configuração ausente. Defina URL/Token no menu Instância ou conecte o WhatsApp nas configurações." }),
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

    const sub = sampleClient?.client_subscriptions?.[0] as any;
    const plan: any = Array.isArray(sub?.subscription_plans)
      ? sub.subscription_plans[0]
      : sub?.subscription_plans;
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

    // Try each token until one succeeds
    let lastError = "";
    let lastStatus = 0;
    for (const candidate of tokensToTry) {
      console.log(`[test-send] Tentando token ${candidate.label} (${candidate.token.substring(0, 8)}...)`);
      try {
        const result = await trySend(apiUrl, candidate.token, normalizedPhone, messageBody);
        console.log(`[test-send] Resultado com ${candidate.label}: status=${result.status} ok=${result.ok} body=${result.body.slice(0, 200)}`);

        if (result.ok) {
          return new Response(
            JSON.stringify({ success: true, phone: normalizedPhone, message: messageBody, tokenUsed: candidate.label }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        lastStatus = result.status;
        lastError = result.body;

        // If it's not a 401, don't try other tokens (it's a different error)
        if (result.status !== 401) {
          return new Response(
            JSON.stringify({ error: `Falha ao enviar (status ${result.status}). Detalhe: ${result.body.slice(0, 500)}` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        // 401 = try next token
      } catch (err) {
        console.log(`[test-send] Erro de rede com ${candidate.label}: ${String(err)}`);
        lastError = String(err);
      }
    }

    // All tokens failed
    const errorMsg = lastStatus === 401
      ? "⚠️ Nenhum token válido encontrado. Vá em Configurações → Instância, reconecte o WhatsApp e verifique se o token está atualizado."
      : `Falha ao enviar mensagem. Último erro: ${lastError.slice(0, 500)}`;

    return new Response(
      JSON.stringify({ error: errorMsg }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[test-send] Erro geral:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
