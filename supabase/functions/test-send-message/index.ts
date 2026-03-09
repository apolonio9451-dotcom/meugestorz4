import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  if (digits.length === 11 || digits.length === 10) return "55" + digits;
  return digits;
}

function replacePlaceholders(template: string, vars: Record<string, string>): string {
  let msg = template;
  for (const [key, value] of Object.entries(vars)) {
    msg = msg.replaceAll(`{${key}}`, value || "");
  }
  return msg;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, category, company_id } = await req.json();

    if (!phone || !category || !company_id) {
      return new Response(
        JSON.stringify({ error: "phone, category e company_id são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiToken = (Deno.env.get("EVOLUTI_TOKEN") || "").trim();
    const apiUrl = (Deno.env.get("EVOLUTI_API_URL") || "https://ipazua.uazapi.com").trim().replace(/\/$/, "");

    if (!apiToken) {
      return new Response(
        JSON.stringify({ error: "EVOLUTI_TOKEN não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get template
    const { data: templateRow } = await supabase
      .from("message_templates")
      .select("message")
      .eq("company_id", company_id)
      .eq("category", category)
      .single();

    const defaultTemplates: Record<string, string> = {
      vence_hoje: "Olá {nome}! 👋\n\nSeu plano vence *hoje*.\n\n📋 Plano: {plano}\n💰 Valor: R$ {valor}\n📅 Vencimento: {vencimento}",
      vence_amanha: "Olá {nome}! 👋\n\nSeu plano vence *amanhã*.\n\n📋 Plano: {plano}\n💰 Valor: R$ {valor}\n📅 Vencimento: {vencimento}",
      a_vencer: "Olá {nome}! 👋\n\nSeu plano vence em *{dias} dias*.\n\n📋 Plano: {plano}\n💰 Valor: R$ {valor}\n📅 Vencimento: {vencimento}",
      vencidos: "Olá {nome}! 👋\n\nSeu plano está *vencido há {dias} dias*.\n\n📋 Plano: {plano}\n💰 Valor: R$ {valor}\n📅 Venceu em: {vencimento}",
      followup: "Olá {nome}! 👋\n\nEstamos entrando em contato para saber se tem interesse em renovar.\n\n📋 Plano: {plano}\n💰 Valor: R$ {valor}",
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
      nome: sampleClient?.name || "Cliente Teste",
      plano: plan?.name || "Plano Exemplo",
      valor: Number(valor).toFixed(2),
      vencimento: endDate.toLocaleDateString("pt-BR"),
      dias: String(Math.abs(diffDays)),
      mac: "",
      usuario: sampleClient?.iptv_user || "",
      senha: sampleClient?.iptv_password || "",
      servidor: sampleClient?.server || "",
    });

    const normalizedPhone = normalizePhone(phone);

    // Send via UAZAPI: POST /send/text
    const endpoint = `${apiUrl}/send/text`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "token": apiToken,
        },
        body: JSON.stringify({ number: normalizedPhone, text: messageBody }),
      });

      const responseText = await res.text();

      if (!res.ok) {
        return new Response(
          JSON.stringify({
            error: `Falha ao enviar mensagem (status ${res.status}). Detalhe: ${responseText}`,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, phone: normalizedPhone, message: messageBody }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (networkErr) {
      return new Response(
        JSON.stringify({
          error: `Erro de rede ao conectar com a API Evoluti: ${String(networkErr)}`,
        }),
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
