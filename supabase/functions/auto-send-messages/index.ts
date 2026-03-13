import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  // If already has country code (12+ digits starting with valid code), keep as-is
  if (digits.length >= 12) return digits;
  // Brazilian numbers (10-11 digits without country code)
  if (digits.length === 10 || digits.length === 11) return "55" + digits;
  return digits;
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
  if (daysUntilExpiry === 3) return "a_vencer";
  if (daysUntilExpiry < 0) return "vencidos";
  return null;
}

const defaultTemplates: Record<string, string> = {
  vence_hoje:
    "Olá, {primeiro_nome}, {saudacao}! ⏳\n\nSeu acesso vence hoje, {dia_semana} dia {dia}. Seu sinal pode cair a qualquer momento, confira os dados para renovação:\n\n📋 *Plano*: {plano}\n💰 *Valor*: R$ {valor}\n📅 *Vencimento*: {vencimento}\n\n💳 Pagamento Pix\nClique na chave para copiar:\n\n📌 Chave: {sua_chave_pix}\n👤 Nome: [Seu Nome]\n\n_Após o pagamento, envie o comprovante por aqui para liberação imediata._",
  vence_amanha:
    "Olá, {primeiro_nome}, {saudacao}! ⏳\n\nSeu acesso vence amanhã, {dia_semana} dia {dia}. Evite interrupções no sinal e confira os dados para renovação:\n\n📋 *Plano*: {plano}\n💰 *Valor*: R$ {valor}\n📅 *Vencimento*: {vencimento}\n\n💳 Pagamento Pix\nClique na chave para copiar:\n\n📌 *Chave*: {sua_chave_pix}\n👤 *Nome*: [Seu Nome]\n\n_Após o pagamento, envie o comprovante por aqui para liberação imediata_. 🤝",
  a_vencer:
    "*Olá, {primeiro_nome}, {saudacao}*! 👋\n\nPassando  para te manter informado sobre o status do seu acesso. Seu plano vence em {dias} dias! ⏳\n\nPreparamos tudo para que você continue aproveitando sua programação sem interrupções. Confira os detalhes:\n\n📋 Resumo da Assinatura:\n\n*Plano*: {plano}\n*Valor*: R$ {valor}\n*Vencimento*: {vencimento}\n\n🔑 *Dados do Seu Acesso*:\n\n👤 _Usuário: {usuario}_\n🖥️ _MAC: {mac}_\n🌐 _Servidor: {servidor}_\n\nQuer se antecipar e garantir sua renovação? 🚀\n\n📌 *Dados para Pagamento*:\n\n*Banco*: [Seu Banco]\n*Nome*: [Seu Nome]\n*Chave Pix*: {sua_chave_pix}\n\n_Qualquer dúvida ou se precisar de suporte, conte comigo_! 😊",
  vencidos:
    "Olá, *{primeiro_nome}* {saudacao}! 👋\n\nNotamos que o seu plano venceu a *{dias} dias* e o seu acesso pode estar interrompido. 🚫\nNão perca seus conteúdos favoritos! Vamos regularizar isso agora?\n\n📋 *Dados da Assinatura Vencida*:\n\n*Plano*: {plano}\n*Valor*: R$ {valor}\n*Vencimento*: {vencimento}\n\n📌 *Dados para Pagamento*:\n\n📌 *Chave*: {sua_chave_pix}\n👤 *Nome*: [Seu Nome]\n\n_Se já efetuou o pagamento desconsidere esse lembrete_",
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
      .select("company_id, api_url, api_token, auto_send_hour, auto_send_minute, pix_key, winback_paused");

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

      // Fetch category active settings
      const { data: categorySettings } = await supabase
        .from("auto_send_category_settings")
        .select("category, is_active")
        .eq("company_id", companyId);

      const disabledCategories = new Set<string>();
      categorySettings?.forEach((s: any) => {
        if (!s.is_active) disabledCategories.add(s.category);
      });

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
        if (!phone || phone.replace(/\D/g, "").length < 8) continue;

        const subs = (client as any).client_subscriptions;
        if (!subs || subs.length === 0) continue;

        const sub = subs[0];
        const plan = sub.subscription_plans;
        const endDate = new Date(sub.end_date + "T00:00:00");
        const todayDate = new Date(today + "T00:00:00");
        const diffDays = Math.round((endDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

        const category = getCategory(diffDays);
        if (!category) continue;

        // Skip if category is disabled
        if (disabledCategories.has(category)) continue;

        const template = templates[category];
        if (!template) continue;

        const valor = sub.custom_price > 0 ? sub.custom_price : plan?.price ?? sub.amount ?? 0;

        const messageBody = replacePlaceholders(template, {
          saudacao: getGreeting(),
          dia_semana: getDayOfWeek(),
          dia: getDayOfMonth(),
          primeiro_nome: (client.name || "").split(" ")[0],
          nome: client.name || "",
          plano: plan?.name || "",
          valor: Number(valor).toFixed(2),
          vencimento: endDate.toLocaleDateString("pt-BR"),
          dias: String(Math.abs(diffDays)),
          mac: "",
          usuario: client.iptv_user || "",
          senha: client.iptv_password || "",
          servidor: client.server || "",
          sua_chave_pix: config.pix_key || "",
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

    // --- Support check-up auto-send (runs for ALL companies, independent of auto_send_hour) ---
    for (const config of apiConfigs) {
      if (!config.api_url || !config.api_token) continue;
      const apiUrl = config.api_url.replace(/\/$/, "");
      const apiToken = config.api_token;
      const companyId = config.company_id;

      // Check if suporte category is disabled
      const { data: supportCatSetting } = await supabase
        .from("auto_send_category_settings")
        .select("is_active")
        .eq("company_id", companyId)
        .eq("category", "suporte")
        .maybeSingle();
      if (supportCatSetting && !supportCatSetting.is_active) continue;

      // Fetch support template
      const { data: supportTemplateRows } = await supabase
        .from("message_templates")
        .select("message")
        .eq("company_id", companyId)
        .eq("category", "suporte")
        .limit(1);

      const supportTemplate = supportTemplateRows?.[0]?.message ||
        "Olá, {nome}! 👋\n\nFaço questão de entrar em contato para saber como ficou o seu sinal após o nosso último suporte. Como está a sua experiência hoje? 🌟\n\nPassando apenas para confirmar se ficou tudo 100% resolvido, pois sua satisfação é nossa prioridade e queremos garantir que você esteja em boas mãos. 🤝";

      // Fetch clients with support_started_at set and >= 48h ago
      const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

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
        .lte("support_started_at", fortyEightHoursAgo.toISOString());

      if (!supportClients) continue;

      for (const client of supportClients) {
        // Don't re-send if already sent today
        if (client.ultimo_envio_auto === today) continue;

        const phone = client.whatsapp || client.phone || "";
        if (!phone || phone.replace(/\D/g, "").length < 8) continue;

        const subs = (client as any).client_subscriptions;
        const sub = subs?.[0];
        const plan = sub?.subscription_plans;
        const valor = sub ? (sub.custom_price > 0 ? sub.custom_price : plan?.price ?? sub.amount ?? 0) : 0;

        const messageBody = replacePlaceholders(supportTemplate, {
          saudacao: getGreeting(),
          primeiro_nome: (client.name || "").split(" ")[0],
          nome: client.name || "",
          plano: plan?.name || "",
          valor: Number(valor).toFixed(2),
          vencimento: sub ? new Date(sub.end_date + "T00:00:00").toLocaleDateString("pt-BR") : "",
          dias: "",
          mac: "",
          usuario: client.iptv_user || "",
          senha: client.iptv_password || "",
          servidor: client.server || "",
          sua_chave_pix: config.pix_key || "",
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

    // --- WinBack campaign auto-send ---
    const CAMPAIGN_STEPS = [
      { key: "winback_day1", day: 1, minGapDays: 0 },
      { key: "winback_day3", day: 3, minGapDays: 2 },
      { key: "winback_day6", day: 6, minGapDays: 3 },
      { key: "winback_day10", day: 10, minGapDays: 4 },
      { key: "winback_day15", day: 15, minGapDays: 5 },
    ];

    const defaultWinbackTemplates: Record<string, string> = {
      winback_day1: "Olá {nome}! 👋\n\nSentimos sua falta por aqui! Faz um tempinho que você não está com a gente.\n\nSeu último plano era o *{plano}* e queremos te ajudar a voltar.\n\nTem interesse? Responda essa mensagem! 😊",
      winback_day3: "Oi {nome}! 😊\n\nVocê sabia que nossos clientes estão aproveitando novidades incríveis?\n\nSeu plano *{plano}* por apenas *R$ {valor}* te dá acesso completo.\n\nQue tal voltar e conferir? 🚀",
      winback_day6: "Oi {nome}! 👋\n\nMuitos clientes que estavam na mesma situação já voltaram e estão curtindo nosso serviço!\n\nPlano *{plano}* • R$ {valor}\n\nVem fazer parte desse grupo também! 💪",
      winback_day10: "Fala {nome}! 🔥\n\nPreparei uma *condição especial* pra você voltar:\n\nPlano *{plano}* com um valor diferenciado!\n\nEssa oferta é por tempo limitado. Quer saber mais? Me chama! ⏳",
      winback_day15: "Olá {nome}! 👋\n\nEssa é minha última tentativa de contato.\n\nSei que imprevistos acontecem, mas quero que saiba que a porta está aberta.\n\nPlano *{plano}* • R$ {valor}\n\nSe mudar de ideia, é só me chamar! 🙏",
    };

    for (const config of eligibleConfigs) {
      if (!config.api_url || !config.api_token) continue;
      if (config.winback_paused) continue; // Skip if paused

      const apiUrl = config.api_url.replace(/\/$/, "");
      const apiToken = config.api_token;
      const companyId = config.company_id;

      // Fetch winback templates
      const { data: wbTemplateRows } = await supabase
        .from("message_templates")
        .select("category, message")
        .eq("company_id", companyId)
        .like("category", "winback_%");

      const wbTemplates: Record<string, string> = { ...defaultWinbackTemplates };
      wbTemplateRows?.forEach((t: { category: string; message: string }) => {
        wbTemplates[t.category] = t.message;
      });

      // Fetch winback-eligible clients (inactive or expired 45+ days)
      const { data: wbClients } = await supabase
        .from("clients")
        .select(`
          id, name, whatsapp, phone, server, iptv_user,
          client_subscriptions (
            end_date, amount, custom_price,
            subscription_plans ( name, price )
          )
        `)
        .eq("company_id", companyId)
        .in("status", ["active", "inactive"]);

      if (!wbClients) continue;

      // Fetch campaign progress
      const { data: progressRows } = await supabase
        .from("winback_campaign_progress")
        .select("client_id, current_step, last_sent_at")
        .eq("company_id", companyId);

      const progressMap: Record<string, { step: number; lastSentAt: string | null }> = {};
      progressRows?.forEach((p: any) => {
        progressMap[p.client_id] = { step: p.current_step, lastSentAt: p.last_sent_at };
      });

      for (const client of wbClients) {
        const subs = (client as any).client_subscriptions;
        if (!subs || subs.length === 0) continue;

        const sub = subs[0];
        const plan = sub.subscription_plans;
        const endDate = new Date(sub.end_date + "T00:00:00");
        const todayDate = new Date(today + "T00:00:00");
        const daysExpired = Math.round((todayDate.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysExpired < 45) continue; // Only 45+ days expired

        const prog = progressMap[client.id] || { step: 0, lastSentAt: null };
        if (prog.step >= CAMPAIGN_STEPS.length) continue; // Campaign finished

        const currentStepDef = CAMPAIGN_STEPS[prog.step];

        // Check minimum gap
        if (prog.step > 0 && prog.lastSentAt) {
          const daysSinceLast = Math.floor((Date.now() - new Date(prog.lastSentAt).getTime()) / (1000 * 60 * 60 * 24));
          if (daysSinceLast < currentStepDef.minGapDays) continue;
        }

        const phone = client.whatsapp || client.phone || "";
        if (!phone || phone.replace(/\D/g, "").length < 8) continue;

        const template = wbTemplates[currentStepDef.key];
        if (!template) continue;

        const valor = sub.custom_price > 0 ? sub.custom_price : plan?.price ?? sub.amount ?? 0;

        const messageBody = replacePlaceholders(template, {
          saudacao: getGreeting(),
          primeiro_nome: (client.name || "").split(" ")[0],
          nome: client.name || "",
          plano: plan?.name || "",
          valor: Number(valor).toFixed(2),
          vencimento: endDate.toLocaleDateString("pt-BR"),
          dias: String(Math.abs(daysExpired)),
          mac: "",
          usuario: client.iptv_user || "",
          senha: "",
          servidor: client.server || "",
          sua_chave_pix: config.pix_key || "",
        });

        const normalizedPhone = normalizePhone(phone);

        try {
          const sendResult = await sendMessage(apiUrl, apiToken, normalizedPhone, messageBody);

          await supabase.from("auto_send_logs").insert({
            company_id: companyId,
            client_id: client.id,
            client_name: client.name,
            category: `repescagem_${currentStepDef.key}`,
            status: sendResult.ok ? "success" : "error",
            error_message: sendResult.error || null,
            phone: normalizedPhone,
          });

          if (sendResult.ok) {
            const newStep = prog.step + 1;
            const nowISO = new Date().toISOString();
            await supabase
              .from("winback_campaign_progress")
              .upsert(
                { company_id: companyId, client_id: client.id, current_step: newStep, last_sent_at: nowISO },
                { onConflict: "company_id,client_id" }
              );
            totalSent++;
          } else {
            totalErrors++;
          }
        } catch (sendErr) {
          await supabase.from("auto_send_logs").insert({
            company_id: companyId,
            client_id: client.id,
            client_name: client.name,
            category: `repescagem_${currentStepDef.key}`,
            status: "error",
            error_message: String(sendErr),
            phone: normalizedPhone,
          });
          totalErrors++;
        }
      }
    }

    // --- Log errors for companies WITHOUT API configured ---
    const configuredCompanyIds = (apiConfigs || []).map((c: any) => c.company_id);
    
    // Find all companies that have active clients with subscriptions but no API
    const { data: allCompanies } = await supabase
      .from("companies")
      .select("id, name");

    if (allCompanies) {
      const unconfiguredCompanies = allCompanies.filter(
        (c: any) => !configuredCompanyIds.includes(c.id)
      );

      for (const company of unconfiguredCompanies) {
        // Check if this company has any clients that would need messages today
        const { data: pendingClients } = await supabase
          .from("clients")
          .select(`
            id, name,
            client_subscriptions ( end_date )
          `)
          .eq("company_id", company.id)
          .eq("status", "active")
          .neq("ultimo_envio_auto", today);

        if (!pendingClients || pendingClients.length === 0) continue;

        // Check if any client has a subscription expiring within the relevant window
        const hasEligible = pendingClients.some((client: any) => {
          const subs = client.client_subscriptions;
          if (!subs || subs.length === 0) return false;
          const endDate = new Date(subs[0].end_date + "T00:00:00");
          const todayDate = new Date(today + "T00:00:00");
          const diffDays = Math.round((endDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
          return getCategory(diffDays) !== null;
        });

        if (hasEligible) {
          // Log one error per company without API
          await supabase.from("auto_send_logs").insert({
            company_id: company.id,
            client_name: `[${company.name}]`,
            category: "erro_config",
            status: "error",
            error_message: "API não configurada pelo revendedor. Configure a URL e Token da UAZAPI nas Configurações.",
            phone: "",
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
