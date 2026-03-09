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

async function sendMessage(apiUrl: string, apiToken: string, number: string, body: string): Promise<{ ok: boolean; error: string }> {
  const endpoint = `${apiUrl}/send/text`;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "token": apiToken },
      body: JSON.stringify({ number, text: body, linkPreview: true }),
    });
    const responseText = await res.text();
    if (res.ok) return { ok: true, error: "" };
    return { ok: false, error: responseText };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

function getCategory(daysUntilExpiry: number): string | null {
  if (daysUntilExpiry === 0) return "vence_hoje";
  if (daysUntilExpiry === 1) return "vence_amanha";
  if (daysUntilExpiry >= 2 && daysUntilExpiry <= 7) return "a_vencer";
  if (daysUntilExpiry < 0) return "vencidos";
  return null;
}

const defaultTemplates: Record<string, string> = {
  vence_hoje: "Olá {nome}! 👋\n\nSeu plano vence *hoje*.\n\n📋 Plano: {plano}\n💰 Valor: R$ {valor}\n📅 Vencimento: {vencimento}\n\nPara renovar, entre em contato conosco! 🙏",
  vence_amanha: "Olá {nome}! 👋\n\nSeu plano vence *amanhã*.\n\n📋 Plano: {plano}\n💰 Valor: R$ {valor}\n📅 Vencimento: {vencimento}\n\nRenove agora para não perder o acesso! 🙏",
  a_vencer: "Olá {nome}! 👋\n\nSeu plano vence em *{dias} dias*.\n\n📋 Plano: {plano}\n💰 Valor: R$ {valor}\n📅 Vencimento: {vencimento}\n\nAproveite para renovar com antecedência! 🙏",
  vencidos: "Olá {nome}! 👋\n\nSeu plano está *vencido há {dias} dias*.\n\n📋 Plano: {plano}\n💰 Valor: R$ {valor}\n📅 Venceu em: {vencimento}\n\nRenove agora para voltar a ter acesso! 🙏",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const today = new Date().toISOString().split("T")[0];

    // Current hour in Brasília (UTC-3)
    const nowUtc = new Date();
    const brasiliaHour = (nowUtc.getUTCHours() - 3 + 24) % 24;
    const brasiliaMinute = nowUtc.getUTCMinutes();

    // Get all companies that have API configured
    const { data: apiConfigs } = await supabase
      .from("api_settings")
      .select("company_id, api_url, api_token, auto_send_hour, auto_send_minute");

    if (!apiConfigs || apiConfigs.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhuma empresa com API configurada" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter only companies whose auto_send_hour matches current Brasília hour
    const eligibleConfigs = apiConfigs.filter((c: any) => {
      const configuredHour = c.auto_send_hour ?? 8;
      const configuredMinute = c.auto_send_minute ?? 0;
      return configuredHour === brasiliaHour && configuredMinute === brasiliaMinute;
    });

    if (eligibleConfigs.length === 0) {
      return new Response(
        JSON.stringify({ message: `Nenhuma empresa configurada para disparo às ${brasiliaHour}:${String(brasiliaMinute).padStart(2,"0")}. Hora atual (Brasília): ${brasiliaHour}:${String(brasiliaMinute).padStart(2,"0")}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalSent = 0;
    let totalErrors = 0;

    for (const config of eligibleConfigs) {
      if (!config.api_url || !config.api_token) continue;

      const apiUrl = config.api_url.replace(/\/$/, "");
      const apiToken = config.api_token;
      const companyId = config.company_id;

      // Fetch templates
      const { data: templateRows } = await supabase
        .from("message_templates")
        .select("category, message")
        .eq("company_id", companyId);

      const templates: Record<string, string> = { ...defaultTemplates };
      templateRows?.forEach((t: { category: string; message: string }) => {
        templates[t.category] = t.message;
      });

      // Fetch active clients with subscriptions
      const { data: clients } = await supabase
        .from("clients")
        .select(`
          id, name, whatsapp, phone, server, iptv_user, iptv_password, ultimo_envio_auto,
          client_subscriptions (
            end_date, amount, custom_price,
            subscription_plans ( name, price )
          )
        `)
        .eq("company_id", companyId)
        .eq("status", "active");

      if (!clients) continue;

      for (const client of clients) {
        if (client.ultimo_envio_auto === today) continue;

        const phone = client.whatsapp || client.phone || "";
        if (!phone || phone.replace(/\D/g, "").length < 10) continue;

        const subs = (client as any).client_subscriptions;
        if (!subs || subs.length === 0) continue;

        const sub = subs[0];
        const plan = sub.subscription_plans;
        const endDate = new Date(sub.end_date + "T00:00:00");
        const todayDate = new Date(today + "T00:00:00");
        const diffDays = Math.round((endDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

        const category = getCategory(diffDays);
        if (!category) continue;

        const template = templates[category];
        if (!template) continue;

        const valor = sub.custom_price > 0 ? sub.custom_price : plan?.price ?? sub.amount ?? 0;

        const messageBody = replacePlaceholders(template, {
          nome: client.name || "",
          plano: plan?.name || "",
          valor: Number(valor).toFixed(2),
          vencimento: endDate.toLocaleDateString("pt-BR"),
          dias: String(Math.abs(diffDays)),
          mac: "",
          usuario: client.iptv_user || "",
          senha: client.iptv_password || "",
          servidor: client.server || "",
        });

        const normalizedPhone = normalizePhone(phone);

        try {
          const sendResult = await sendMessage(apiUrl, apiToken, normalizedPhone, messageBody);

          await supabase.from("auto_send_logs").insert({
            company_id: companyId,
            client_id: client.id,
            client_name: client.name,
            category,
            status: sendResult.ok ? "success" : "error",
            error_message: sendResult.error || null,
            phone: normalizedPhone,
          });

          if (sendResult.ok) {
            await supabase.from("clients").update({ ultimo_envio_auto: today }).eq("id", client.id);
            totalSent++;
          } else {
            totalErrors++;
          }
        } catch (sendErr) {
          await supabase.from("auto_send_logs").insert({
            company_id: companyId,
            client_id: client.id,
            client_name: client.name,
            category,
            status: "error",
            error_message: String(sendErr),
            phone: normalizedPhone,
          });
          totalErrors++;
        }
      }
    }

    // --- Support check-up auto-send ---
    for (const config of eligibleConfigs) {
      if (!config.api_url || !config.api_token) continue;
      const apiUrl = config.api_url.replace(/\/$/, "");
      const apiToken = config.api_token;
      const companyId = config.company_id;

      // Fetch support template
      const { data: supportTemplateRows } = await supabase
        .from("message_templates")
        .select("message")
        .eq("company_id", companyId)
        .eq("category", "suporte")
        .limit(1);

      const supportTemplate = supportTemplateRows?.[0]?.message ||
        "Olá, {nome}! 👋\n\nFaço questão de entrar em contato para saber como ficou o seu sinal após o nosso último suporte. Como está a sua experiência hoje? 🌟\n\nPassando apenas para confirmar se ficou tudo 100% resolvido, pois sua satisfação é nossa prioridade e queremos garantir que você esteja em boas mãos. 🤝";

      // Fetch clients with support_started_at set and >= 2 days ago
      const twoDaysAgo = new Date();
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      const { data: supportClients } = await supabase
        .from("clients")
        .select(`
          id, name, whatsapp, phone, server, iptv_user, iptv_password, ultimo_envio_auto, support_started_at,
          client_subscriptions (
            end_date, amount, custom_price,
            subscription_plans ( name, price )
          )
        `)
        .eq("company_id", companyId)
        .eq("status", "active")
        .not("support_started_at", "is", null)
        .lte("support_started_at", twoDaysAgo.toISOString());

      if (!supportClients) continue;

      for (const client of supportClients) {
        // Don't re-send if already sent today
        if (client.ultimo_envio_auto === today) continue;

        const phone = client.whatsapp || client.phone || "";
        if (!phone || phone.replace(/\D/g, "").length < 10) continue;

        const subs = (client as any).client_subscriptions;
        const sub = subs?.[0];
        const plan = sub?.subscription_plans;
        const valor = sub ? (sub.custom_price > 0 ? sub.custom_price : plan?.price ?? sub.amount ?? 0) : 0;

        const messageBody = replacePlaceholders(supportTemplate, {
          nome: client.name || "",
          plano: plan?.name || "",
          valor: Number(valor).toFixed(2),
          vencimento: sub ? new Date(sub.end_date + "T00:00:00").toLocaleDateString("pt-BR") : "",
          dias: "",
          mac: "",
          usuario: client.iptv_user || "",
          senha: client.iptv_password || "",
          servidor: client.server || "",
        });

        const normalizedPhone = normalizePhone(phone);

        try {
          const sendResult = await sendMessage(apiUrl, apiToken, normalizedPhone, messageBody);

          await supabase.from("auto_send_logs").insert({
            company_id: companyId,
            client_id: client.id,
            client_name: client.name,
            category: "suporte",
            status: sendResult.ok ? "success" : "error",
            error_message: sendResult.error || null,
            phone: normalizedPhone,
          });

          if (sendResult.ok) {
            // Clear support_started_at after successful auto-send
            await supabase.from("clients").update({ ultimo_envio_auto: today, support_started_at: null }).eq("id", client.id);
            totalSent++;
          } else {
            totalErrors++;
          }
        } catch (sendErr) {
          await supabase.from("auto_send_logs").insert({
            company_id: companyId,
            client_id: client.id,
            client_name: client.name,
            category: "suporte",
            status: "error",
            error_message: String(sendErr),
            phone: normalizedPhone,
          });
          totalErrors++;
        }
      }
    }

    return new Response(
      JSON.stringify({ sent: totalSent, errors: totalErrors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
