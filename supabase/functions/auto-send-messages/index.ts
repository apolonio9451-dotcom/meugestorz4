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

function getDayOfWeekFor(date: Date): string {
  const dias = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
  return dias[date.getUTCDay()];
}

function getDayOfMonthFor(date: Date): string {
  return String(date.getUTCDate());
}

/** Returns the reference date for {dia_semana} and {dia} template variables.
 *  Uses the client's ACTUAL expiry date from the database when available,
 *  falling back to category-based calculation otherwise. */
function getTemplateDateForCategory(category: string, clientEndDate?: Date): Date {
  if (clientEndDate) return clientEndDate;
  const brasilia = getBrasiliaDate();
  if (category === "vence_amanha") {
    brasilia.setUTCDate(brasilia.getUTCDate() + 1);
  }
  return brasilia;
}

function replacePlaceholders(template: string, vars: Record<string, string>): string {
  let msg = template;
  for (const [key, value] of Object.entries(vars)) {
    msg = msg.replaceAll(`{${key}}`, value || "");
  }
  return msg;
}

const CONNECTION_ERROR_MESSAGE = "Erro de Conexão";
const SESSION_EXPIRED_MESSAGE = "Sessão expirada. Por favor, revalide seu token nas Configurações";

function getApiHeaders(apiToken: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    token: apiToken,
  };
}

/** Parse API response for known session/disconnection errors */
function isSessionError(responseText: string, httpStatus: number): boolean {
  if (httpStatus === 401) return true;
  try {
    const json = JSON.parse(responseText);
    const msg = String(json?.message || json?.error || "").toLowerCase();
    if (msg.includes("disconnected") || msg.includes("not connected") || msg.includes("qr code") || msg.includes("not logged")) {
      return true;
    }
  } catch { /* not JSON, ignore */ }
  return false;
}

async function sendMessage(
  apiUrl: string,
  apiToken: string,
  number: string,
  body: string,
): Promise<{ ok: boolean; error: string; status?: number; isSessionError?: boolean; errorBody?: string }> {
  const endpoint = `${apiUrl}/send/text`;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: getApiHeaders(apiToken),
      body: JSON.stringify({ number, text: body, linkPreview: true }),
    });
    const responseText = await res.text();

    // Check for success with embedded error (some APIs return 200 with error body)
    if (res.ok) {
      try {
        const json = JSON.parse(responseText);
        if (json?.error === true && json?.message) {
          const sessionErr = isSessionError(responseText, res.status);
          console.log(`[auto-send] API 2xx but error body | ${json.message} | sessionError=${sessionErr}`);
          return {
            ok: false,
            error: sessionErr ? SESSION_EXPIRED_MESSAGE : CONNECTION_ERROR_MESSAGE,
            status: res.status,
            isSessionError: sessionErr,
            errorBody: responseText,
          };
        }
      } catch { /* not JSON success response, that's fine */ }
      return { ok: true, error: "" };
    }

    console.log(`[auto-send] API non-2xx | status=${res.status} | body=${responseText.slice(0, 300)}`);

    const sessionErr = isSessionError(responseText, res.status);
    return {
      ok: false,
      error: sessionErr ? SESSION_EXPIRED_MESSAGE : CONNECTION_ERROR_MESSAGE,
      status: res.status,
      isSessionError: sessionErr,
      errorBody: responseText,
    };
  } catch (err) {
    console.log(`[auto-send] API fetch exception | endpoint=${endpoint} | error=${String(err)}`);
    return { ok: false, error: CONNECTION_ERROR_MESSAGE, errorBody: String(err) };
  }
}

function getFirstEnvValue(names: string[]): string {
  for (const name of names) {
    const value = Deno.env.get(name);
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }
  return "";
}

function resolveApiUrl(dbUrl: string | null | undefined): string {
  const fromDb = (dbUrl || "").trim().replace(/\/$/, "");
  if (fromDb.length > 0) return fromDb;
  return getFirstEnvValue(["WA_API_URL", "EVOLUTI_API_URL"]).replace(/\/$/, "");
}

/** Resolve API token: prefer db value, fallback to env secrets */
function resolveApiToken(dbToken: string | null | undefined): string {
  const fromDb = (dbToken || "").trim();
  if (fromDb.length > 5) return fromDb;
  const fallbackToken = getFirstEnvValue(["WA_ADMIN_TOKEN", "BOLINHA_API_TOKEN", "UAZAPI_ADMIN_TOKEN", "EVOLUTI_TOKEN"]);
  if (fallbackToken.length > 5 && !fallbackToken.includes("curl") && !fallbackToken.startsWith("http")) {
    return fallbackToken;
  }
  return "";
}

async function getCompanyInstanceToken(supabase: any, companyId: string): Promise<string> {
  const { data: memberships } = await supabase
    .from("company_memberships")
    .select("user_id")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true })
    .limit(20);

  const userIds = (memberships || []).map((m: any) => m.user_id).filter(Boolean);
  if (!userIds.length) return "";

  const { data: connectedInstance } = await supabase
    .from("whatsapp_instances")
    .select("instance_token")
    .in("user_id", userIds)
    .eq("is_connected", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const connectedToken = String((connectedInstance as any)?.instance_token || "").trim();
  if (connectedToken) return connectedToken;

  const { data: latestInstance } = await supabase
    .from("whatsapp_instances")
    .select("instance_token, status, updated_at")
    .in("user_id", userIds)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return String((latestInstance as any)?.instance_token || "").trim();
}

const AUTH_TOKEN_INVALID_MESSAGE = SESSION_EXPIRED_MESSAGE;

type LatestDispatchConfig = {
  apiUrl: string;
  apiToken: string;
  apiTokens: string[];
  pixKey: string;
  sendIntervalSeconds: number;
  overdueChargePauseEnabled: boolean;
  overdueChargePauseDays: number;
  overdueSendsPerCycle: number;
  overdueCycleCooldownDays: number;
  overdueMaxCycles: number;
  overdueInactiveAfterDays: number;
  winbackPaused: boolean;
  autoSendHour: number;
  autoSendMinute: number;
};

function buildTokenCandidates(...tokens: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const candidates: string[] = [];

  for (const token of tokens) {
    const clean = String(token || "").trim();
    if (!clean || clean.length <= 5 || clean.includes("curl") || clean.startsWith("http") || seen.has(clean)) {
      continue;
    }
    seen.add(clean);
    candidates.push(clean);
  }

  return candidates;
}

async function resolveWorkingApiToken(apiUrl: string, candidates: string[]) {
  for (const candidate of candidates) {
    const validation = await validateApiToken(apiUrl, candidate);
    if (validation.ok) {
      return { ok: true as const, token: candidate };
    }
  }

  const lastToken = candidates[candidates.length - 1] || "";
  const lastValidation = lastToken ? await validateApiToken(apiUrl, lastToken) : { ok: false, error: AUTH_TOKEN_INVALID_MESSAGE };
  return {
    ok: false as const,
    error: lastValidation.error || AUTH_TOKEN_INVALID_MESSAGE,
    errorBody: lastValidation.errorBody,
  };
}

function formatApiError(error: string, errorBody?: string) {
  const cleanBody = String(errorBody || "").trim().replace(/\s+/g, " ").slice(0, 500);
  if (!cleanBody) return error;
  return `${error} | API: ${cleanBody}`;
}

async function fetchLatestDispatchConfig(
  supabase: any,
  companyId: string,
): Promise<LatestDispatchConfig> {
  const { data } = await supabase
    .from("api_settings")
    .select("api_url, api_token, pix_key, send_interval_seconds, overdue_charge_pause_enabled, overdue_charge_pause_days, overdue_sends_per_cycle, overdue_cycle_cooldown_days, overdue_max_cycles, overdue_inactive_after_days, winback_paused, auto_send_hour, auto_send_minute")
    .eq("company_id", companyId)
    .maybeSingle();

  const row = (data || {}) as any;
  const dbToken = String(row.api_token || "").trim();

  // Get instance_token from whatsapp_instances (the actual uazapi token)
  const instanceToken = await getCompanyInstanceToken(supabase, companyId);

  // Priority: instance_token (uazapi native) > api_settings.api_token > env fallback
  let resolvedToken = "";
  if (instanceToken.length > 5) {
    resolvedToken = instanceToken;
  } else if (dbToken.length > 5) {
    resolvedToken = dbToken;
  } else {
    resolvedToken = resolveApiToken(row.api_token);
  }

  const tokenCandidates = buildTokenCandidates(
    instanceToken,
    dbToken,
    resolveApiToken(row.api_token),
  );

  // Also resolve API URL from instance server_url if not set in api_settings
  let resolvedUrl = resolveApiUrl(row.api_url);
  if (!resolvedUrl && instanceToken.length > 5) {
    // Try to get server_url from instance
    const { data: memberships } = await supabase
      .from("company_memberships")
      .select("user_id")
      .eq("company_id", companyId)
      .order("created_at", { ascending: true })
      .limit(20);
    const userIds = (memberships || []).map((m: any) => m.user_id).filter(Boolean);
    if (userIds.length) {
      const { data: inst } = await supabase
        .from("whatsapp_instances")
        .select("server_url")
        .in("user_id", userIds)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      resolvedUrl = String(inst?.server_url || "").trim().replace(/\/$/, "");
    }
  }

  console.log(`[auto-send] Token resolved: instanceToken=${instanceToken.length > 0 ? instanceToken.substring(0, 8) + '...' : 'none'}, dbToken=${dbToken.length > 0 ? dbToken.substring(0, 8) + '...' : 'none'}, using=${resolvedToken.substring(0, 8)}...`);

  return {
    apiUrl: resolvedUrl,
    apiToken: resolvedToken,
    apiTokens: tokenCandidates,
    pixKey: String(row.pix_key || ""),
    sendIntervalSeconds: Math.max(2, Number(row.send_interval_seconds ?? 60)),
    overdueChargePauseEnabled: Boolean(row.overdue_charge_pause_enabled ?? true),
    overdueChargePauseDays: Math.min(90, Math.max(1, Number(row.overdue_charge_pause_days ?? 10))),
    overdueSendsPerCycle: Math.min(7, Math.max(1, Number(row.overdue_sends_per_cycle ?? 2))),
    overdueCycleCooldownDays: Math.min(15, Math.max(1, Number(row.overdue_cycle_cooldown_days ?? 3))),
    overdueMaxCycles: Math.min(10, Math.max(1, Number(row.overdue_max_cycles ?? 2))),
    overdueInactiveAfterDays: Math.min(180, Math.max(7, Number(row.overdue_inactive_after_days ?? 30))),
    winbackPaused: Boolean(row.winback_paused ?? false),
    autoSendHour: Number(row.auto_send_hour ?? 8),
    autoSendMinute: Number(row.auto_send_minute ?? 0),
  };
}

async function logSessionExpired(
  supabase: any,
  companyId: string,
  phone = "",
  apiErrorBody = "",
) {
  await supabase.from("auto_send_logs").insert({
    company_id: companyId,
    client_name: `[Sistema]`,
    category: "erro_config",
    status: "error",
    error_message: `${SESSION_EXPIRED_MESSAGE}${apiErrorBody ? ` | API: ${apiErrorBody.slice(0, 500)}` : ""}`,
    phone,
    message_sent: "",
  });
}

async function getRequestUserId(req: Request, supabaseUrl: string): Promise<string | null> {
  const authorization = req.headers.get("Authorization");
  if (!authorization) return null;

  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (!anonKey) return null;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: { Authorization: authorization },
    },
  });

  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

async function validateApiToken(apiUrl: string, apiToken: string): Promise<{ ok: boolean; status?: number; error?: string; errorBody?: string }> {
  try {
    const res = await fetch(`${apiUrl}/instance`, {
      method: "GET",
      headers: getApiHeaders(apiToken),
    });

    const body = await res.text();

    if (res.status === 401) {
      console.log(`[auto-send] preflight 401 | body=${body.slice(0, 300)}`);
      return { ok: false, status: 401, error: AUTH_TOKEN_INVALID_MESSAGE, errorBody: body };
    }

    if (res.status === 404) {
      console.log(`[auto-send] preflight endpoint não encontrado | status=404 | body=${body.slice(0, 300)}`);
      return { ok: true, status: 404 };
    }

    // Check for WhatsApp disconnected even on 2xx responses
    if (isSessionError(body, res.status)) {
      console.log(`[auto-send] preflight: sessão desconectada | status=${res.status}`);
      return { ok: false, status: res.status, error: SESSION_EXPIRED_MESSAGE, errorBody: body };
    }

    if (!res.ok) {
      console.log(`[auto-send] preflight non-2xx | status=${res.status} | body=${body.slice(0, 300)}`);
    }

    return { ok: true, status: res.status };
  } catch (error) {
    console.log(`[auto-send] preflight fetch exception | error=${String(error)}`);
    return { ok: true };
  }
}

async function readRequestJson(req: Request): Promise<any> {
  try {
    return await req.json();
  } catch {
    return {};
  }
}

// Minimum delay between sends to avoid API rate-limiting (2 seconds floor)
const MIN_DELAY_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getCategory(daysUntilExpiry: number): string | null {
  if (daysUntilExpiry === 0) return "vence_hoje";
  if (daysUntilExpiry === 1) return "vence_amanha";
  if (daysUntilExpiry === 3) return "a_vencer";
  if (daysUntilExpiry < 0) return "vencidos";
  return null;
}

function getLatestSubscription(subscriptions: any[] | null | undefined) {
  if (!Array.isArray(subscriptions) || subscriptions.length === 0) return null;

  return [...subscriptions].sort((a: any, b: any) => {
    const aTime = new Date(`${a?.end_date || "1970-01-01"}T00:00:00`).getTime();
    const bTime = new Date(`${b?.end_date || "1970-01-01"}T00:00:00`).getTime();
    return bTime - aTime;
  })[0] ?? null;
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

// Max execution time safety: 50 seconds
const MAX_EXEC_MS = 50_000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const execStart = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const requestBody = await readRequestJson(req);

    const nowUtc = new Date();
    const brasiliaTime = new Date(nowUtc.getTime() - 3 * 60 * 60 * 1000);
    const today = brasiliaTime.toISOString().split("T")[0];
    const brasiliaHour = brasiliaTime.getUTCHours();
    const brasiliaMinute = brasiliaTime.getUTCMinutes();

    if (requestBody?.action === "reset-error-queue") {
      const userId = await getRequestUserId(req, supabaseUrl);
      if (!userId) {
        return new Response(JSON.stringify({ error: "Não autenticado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const companyId = String(requestBody?.companyId || "").trim();
      if (!companyId) {
        return new Response(JSON.stringify({ error: "companyId é obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: canManage } = await supabase.rpc("is_company_admin_or_owner", {
        _user_id: userId,
        _company_id: companyId,
      });

      if (!canManage) {
        return new Response(JSON.stringify({ error: "Sem permissão para resetar a fila" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: rowsToReset } = await supabase
        .from("auto_send_logs")
        .select("id")
        .eq("company_id", companyId)
        .eq("status", "failed");

      const resetCount = rowsToReset?.length || 0;

      if (resetCount > 0) {
        await supabase
          .from("auto_send_logs")
          .update({ status: "pending", error_message: null })
          .eq("company_id", companyId)
          .eq("status", "failed");
      }

      return new Response(JSON.stringify({ ok: true, resetCount }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[auto-send] Brasília: ${today} ${brasiliaHour}:${String(brasiliaMinute).padStart(2, "0")}`);

    const { data: apiConfigs } = await supabase
      .from("api_settings")
      .select("company_id, api_url, api_token, auto_send_hour, auto_send_minute, pix_key, winback_paused, send_interval_seconds, overdue_charge_pause_enabled, overdue_charge_pause_days, overdue_sends_per_cycle, overdue_cycle_cooldown_days, overdue_max_cycles, overdue_inactive_after_days");

    if (!apiConfigs || apiConfigs.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhuma empresa com API configurada" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const eligibleConfigs = apiConfigs.filter((c: any) => {
      const configuredHour = c.auto_send_hour ?? 8;
      const configuredMinute = c.auto_send_minute ?? 0;
      if (brasiliaHour > configuredHour) return true;
      if (brasiliaHour === configuredHour && brasiliaMinute >= configuredMinute) return true;
      return false;
    });

    let totalSent = 0;
    let totalErrors = 0;

    for (const config of eligibleConfigs) {
      const companyId = config.company_id;
      const latestConfig = await fetchLatestDispatchConfig(supabase, companyId);
      let apiUrl = latestConfig.apiUrl;
      let apiToken = latestConfig.apiToken;

      if (!apiUrl || latestConfig.apiTokens.length === 0) {
        console.log(`[auto-send] Empresa ${companyId} sem URL ou Token configurado, pulando`);
        continue;
      }
      if (Date.now() - execStart > MAX_EXEC_MS) {
        console.log(`[auto-send] ⏱️ Tempo limite atingido, continuando no próximo ciclo`);
        break;
      }

      const intervalMs = latestConfig.sendIntervalSeconds * 1000;
      const overdueChargePauseEnabled = latestConfig.overdueChargePauseEnabled;
      const overdueChargePauseDays = latestConfig.overdueChargePauseDays;
      const overdueSendsPerCycle = latestConfig.overdueSendsPerCycle;
      const overdueCycleCooldownDays = latestConfig.overdueCycleCooldownDays;
      const overdueMaxCycles = latestConfig.overdueMaxCycles;
      const overdueInactiveAfterDays = latestConfig.overdueInactiveAfterDays;

      console.log(
        `[auto-send] Processando empresa ${companyId}, intervalo=${intervalMs}ms, pausa=${overdueChargePauseEnabled ? `on>${overdueChargePauseDays}d` : "off"}, regra-vencidos=${overdueSendsPerCycle}x/${overdueCycleCooldownDays}d, ciclos=${overdueMaxCycles}, inativar=${overdueInactiveAfterDays}d`
      );

      const workingToken = await resolveWorkingApiToken(apiUrl, latestConfig.apiTokens);
      if (!workingToken.ok) {
        console.log(`[auto-send] ❌ Preflight falhou para empresa ${companyId}`);
        await logSessionExpired(supabase, companyId, "", workingToken.errorBody || "");
        totalErrors++;
        continue;
      }
      apiToken = workingToken.token;

      const { data: failedTodayRows } = await supabase
        .from("auto_send_logs")
        .select("client_id, category")
        .eq("company_id", companyId)
        .eq("status", "failed")
        .gte("created_at", `${today}T00:00:00`)
        .lte("created_at", `${today}T23:59:59`)
        .in("category", ["vence_hoje", "vence_amanha", "a_vencer", "vencidos"]);

      const failedClientIdsToday = new Set<string>(
        (failedTodayRows || [])
          .map((row: any) => row.client_id)
          .filter((id: string | null) => Boolean(id)) as string[]
      );

      const { data: categorySettings } = await supabase
        .from("auto_send_category_settings")
        .select("category, is_active")
        .eq("company_id", companyId);

      const disabledCategories = new Set<string>();
      categorySettings?.forEach((s: any) => {
        if (!s.is_active) disabledCategories.add(s.category);
      });

      console.log(`[auto-send] Categorias desabilitadas: ${[...disabledCategories].join(", ") || "nenhuma"}`);

      const { data: templateRows } = await supabase
        .from("message_templates")
        .select("category, message")
        .eq("company_id", companyId);

      const templates: Record<string, string> = { ...defaultTemplates };
      templateRows?.forEach((t: { category: string; message: string }) => {
        templates[t.category] = t.message;
      });

      const { data: clients } = await supabase
        .from("clients")
        .select(`
          id, name, whatsapp, phone, server, iptv_user, iptv_password, ultimo_envio_auto, charge_pause_until, charge_pause_note, overdue_charge_streak, overdue_charge_resume_date, overdue_charge_cycles,
          client_subscriptions (
            end_date, amount, custom_price,
            subscription_plans ( name, price )
          )
        `)
        .eq("company_id", companyId)
        .eq("status", "active")
        .or(`ultimo_envio_auto.is.null,ultimo_envio_auto.neq.${today}`)
        .limit(5000);

      if (!clients) continue;

      const sendQueue: Array<{ client: any; category: string; sub: any; plan: any; diffDays: number }> = [];
      let pausedOverdueClients = 0;
      let manuallyPausedClients = 0;
      let antiSpamPausedClients = 0;
      let cycleLimitReachedClients = 0;
      const inactivatedClientIds: string[] = [];
      const todayDate = new Date(today + "T00:00:00");

      // Anti-spam vencidos: 2 envios seguidos, pausa 3 dias, máximo 2 ciclos
      const OVERDUE_MAX_STREAK = 2;
      const OVERDUE_COOLDOWN_DAYS = 3;
      const OVERDUE_MAX_CYCLES = 2;
      const INACTIVE_AFTER_DAYS = 30;

      for (const client of clients) {
        if (failedClientIdsToday.has(client.id)) continue;

        const phone = client.whatsapp || client.phone || "";
        if (!phone || phone.replace(/\D/g, "").length < 8) continue;

        const manualPauseUntil = (client as any).charge_pause_until as string | null;
        const chargePauseNote = String((client as any).charge_pause_note || "").trim();
        const hasResumeOverride = chargePauseNote.startsWith("resumed");
        if (manualPauseUntil) {
          const manualPauseDate = new Date(manualPauseUntil + "T00:00:00");
          const remainingPauseDays = Math.round((manualPauseDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
          if (remainingPauseDays >= 0) {
            manuallyPausedClients++;
            continue;
          }
        }

        const subs = (client as any).client_subscriptions;
        if (!subs || subs.length === 0) continue;

        const sub = getLatestSubscription(subs);
        if (!sub) continue;
        const plan = sub.subscription_plans;
        const endDate = new Date(sub.end_date + "T00:00:00");
        const diffDays = Math.round((endDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

        const category = getCategory(diffDays);
        if (!category) continue;
        if (disabledCategories.has(category)) continue;

        // Inativar automaticamente após 30 dias vencido
        if (category === "vencidos" && Math.abs(diffDays) >= INACTIVE_AFTER_DAYS) {
          inactivatedClientIds.push(client.id);
          continue;
        }

        if (category === "vencidos" && overdueChargePauseEnabled && Math.abs(diffDays) > overdueChargePauseDays && !hasResumeOverride) {
          pausedOverdueClients++;
          continue;
        }

        // Limite de 2 ciclos completos de cobrança de vencido
        if (category === "vencidos" && !hasResumeOverride) {
          const cycles = Number((client as any).overdue_charge_cycles ?? 0);
          if (cycles >= OVERDUE_MAX_CYCLES) {
            cycleLimitReachedClients++;
            continue;
          }
        }

        // Anti-spam vencidos: respeita cooldown de 3 dias após 2 envios consecutivos
        if (category === "vencidos" && !hasResumeOverride) {
          const resumeDateRaw = (client as any).overdue_charge_resume_date as string | null;
          if (resumeDateRaw) {
            const resumeDate = new Date(resumeDateRaw + "T00:00:00");
            if (todayDate.getTime() < resumeDate.getTime()) {
              antiSpamPausedClients++;
              continue;
            }
          }
        }

        const template = templates[category];
        if (!template) continue;

        sendQueue.push({ client, category, sub, plan, diffDays });
      }

      // Marca clientes vencidos há 30+ dias como inativos
      if (inactivatedClientIds.length > 0) {
        await supabase
          .from("clients")
          .update({ status: "inactive" })
          .in("id", inactivatedClientIds);
        console.log(`[auto-send] 🚷 ${inactivatedClientIds.length} cliente(s) marcado(s) como inativo(s) (30+ dias vencidos)`);
      }

      console.log(`[auto-send] Fila de envio: ${sendQueue.length} clientes. Pausados manualmente: ${manuallyPausedClients}. Pausados por limite: ${pausedOverdueClients}. Pausados anti-spam: ${antiSpamPausedClients}. Limite de ciclos atingido: ${cycleLimitReachedClients}. Inativados: ${inactivatedClientIds.length}. Categorias: ${JSON.stringify(
        sendQueue.reduce((acc: Record<string, number>, item) => { acc[item.category] = (acc[item.category] || 0) + 1; return acc; }, {})
      )}`);

      // Calculate how many we can process this tick
      // If interval is 60s, we can do ~1 per tick. If 10s, ~5 per tick.
      const maxBatchSize = Math.max(1, Math.floor(MAX_EXEC_MS / Math.max(intervalMs, 1000)));
      const batchToProcess = sendQueue.slice(0, maxBatchSize);

      console.log(`[auto-send] Processando lote: ${batchToProcess.length} de ${sendQueue.length} (max batch: ${maxBatchSize})`);

      const effectiveDelay = Math.max(intervalMs, MIN_DELAY_MS);

      for (let i = 0; i < batchToProcess.length; i++) {
        if (Date.now() - execStart > MAX_EXEC_MS) {
          console.log(`[auto-send] ⏱️ Tempo limite no lote, ${sendQueue.length - i} restantes para próximo ciclo`);
          break;
        }

        const { client, category, sub, plan, diffDays } = batchToProcess[i];
        const latestBeforeSend = await fetchLatestDispatchConfig(supabase, companyId);
        const currentApiUrl = latestBeforeSend.apiUrl;
        const currentWorkingToken = currentApiUrl
          ? await resolveWorkingApiToken(currentApiUrl, latestBeforeSend.apiTokens)
          : { ok: false as const, error: CONNECTION_ERROR_MESSAGE };

        if (!currentApiUrl || !currentWorkingToken.ok) {
          await supabase.from("auto_send_logs").insert({
            company_id: companyId,
            client_id: client.id,
            client_name: client.name,
            category,
            status: "failed",
            error_message: formatApiError(
              currentWorkingToken.ok ? CONNECTION_ERROR_MESSAGE : currentWorkingToken.error,
              currentWorkingToken.ok ? undefined : currentWorkingToken.errorBody,
            ),
            phone: normalizePhone(client.whatsapp || client.phone || ""),
            message_sent: "",
          });
          totalErrors++;
          continue;
        }

        const currentApiToken = currentWorkingToken.token;

        if (currentApiUrl !== apiUrl || currentApiToken !== apiToken) {
          apiUrl = currentApiUrl;
          apiToken = currentApiToken;
        }

        const endDate = new Date(sub.end_date + "T00:00:00");
        const valor = sub.custom_price > 0 ? sub.custom_price : plan?.price ?? sub.amount ?? 0;

        const refDate = getTemplateDateForCategory(category, endDate);
        const messageBody = replacePlaceholders(templates[category], {
          saudacao: getGreeting(),
          dia_semana: getDayOfWeekFor(refDate),
          dia: getDayOfMonthFor(refDate),
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
          sua_chave_pix: latestBeforeSend.pixKey || "",
        });

        const normalizedPhone = normalizePhone(client.whatsapp || client.phone || "");

        // Delay between sends — always respect minimum 2s delay
        if (i > 0) {
          await sleep(effectiveDelay);
        }

        try {
          const sendResult = await sendMessage(apiUrl, apiToken, normalizedPhone, messageBody);

          await supabase.from("auto_send_logs").insert({
            company_id: companyId,
            client_id: client.id,
            client_name: client.name,
            category,
            status: sendResult.ok ? "success" : "failed",
            error_message: sendResult.ok ? null : formatApiError(sendResult.error, sendResult.errorBody),
            phone: normalizedPhone,
            message_sent: messageBody,
          });

          if (sendResult.ok) {
            const updatePayload: Record<string, any> = { ultimo_envio_auto: today };

            // Anti-spam vencidos: incrementa streak; ao completar, agenda cooldown e fecha o ciclo
            if (category === "vencidos") {
              const currentStreak = Number((client as any).overdue_charge_streak ?? 0);
              const currentCycles = Number((client as any).overdue_charge_cycles ?? 0);
              const newStreak = currentStreak + 1;
              if (newStreak >= OVERDUE_MAX_STREAK) {
                const resume = new Date(todayDate);
                resume.setDate(resume.getDate() + OVERDUE_COOLDOWN_DAYS);
                updatePayload.overdue_charge_streak = 0;
                updatePayload.overdue_charge_resume_date = resume.toISOString().slice(0, 10);
                updatePayload.overdue_charge_cycles = currentCycles + 1;
              } else {
                updatePayload.overdue_charge_streak = newStreak;
                updatePayload.overdue_charge_resume_date = null;
              }
            } else {
              // Outras categorias resetam o ciclo anti-spam de vencidos
              if (
                (client as any).overdue_charge_streak ||
                (client as any).overdue_charge_resume_date ||
                (client as any).overdue_charge_cycles
              ) {
                updatePayload.overdue_charge_streak = 0;
                updatePayload.overdue_charge_resume_date = null;
                updatePayload.overdue_charge_cycles = 0;
              }
            }

            await supabase.from("clients").update(updatePayload).eq("id", client.id);
            totalSent++;
            console.log(`[auto-send] ✅ ${client.name} (${category}) enviado`);
          } else {
            totalErrors++;
            if (sendResult.isSessionError || sendResult.status === 401) {
              console.log(`[auto-send] ⛔ ${client.name} (${category}) sessão expirada/desconectado, parando empresa`);
              await logSessionExpired(supabase, companyId, normalizedPhone, sendResult.errorBody || "");
              break; // Stop processing this company entirely
            } else {
              console.log(`[auto-send] ❌ ${client.name} (${category}) erro: ${sendResult.error}`);
            }
            // Continue to next client for non-session errors
          }
        } catch (sendErr) {
          await supabase.from("auto_send_logs").insert({
            company_id: companyId,
            client_id: client.id,
            client_name: client.name,
            category,
            status: "failed",
            error_message: String(sendErr),
            phone: normalizedPhone,
            message_sent: messageBody,
          });
          totalErrors++;
          console.log(`[auto-send] ❌ ${client.name} (${category}) exception: ${sendErr}`);
          await sleep(MIN_DELAY_MS);
        }
      }
    }

    // --- Support check-up auto-send (runs for ALL companies, independent of auto_send_hour) ---
    for (const config of apiConfigs) {
      if (Date.now() - execStart > MAX_EXEC_MS) break;
      const companyId = config.company_id;
      const supportConfig = await fetchLatestDispatchConfig(supabase, companyId);
      let apiUrl = supportConfig.apiUrl;
      let apiToken = supportConfig.apiToken;
      if (!apiUrl || !apiToken) continue;
      const supportIntervalMs = supportConfig.sendIntervalSeconds * 1000;

      const supportValidation = await validateApiToken(apiUrl, apiToken);
      if (!supportValidation.ok) {
        await logSessionExpired(supabase, companyId);
        totalErrors++;
        continue;
      }

      const { data: supportCatSetting } = await supabase
        .from("auto_send_category_settings")
        .select("is_active")
        .eq("company_id", companyId)
        .eq("category", "suporte")
        .maybeSingle();
      if (supportCatSetting && !supportCatSetting.is_active) continue;

      const { data: supportTemplateRows } = await supabase
        .from("message_templates")
        .select("message")
        .eq("company_id", companyId)
        .eq("category", "suporte")
        .limit(1);

      const supportTemplate = supportTemplateRows?.[0]?.message ||
        "Olá, *{primeiro_nome}*, {saudacao}! 👋\n\nEstamos entrando em contato para saber como ficou o seu sinal após o nosso último suporte. Como está a sua experiência hoje? 🌟\n\nPassando apenas para confirmar se ficou tudo 100% resolvido, pois sua satisfação é nossa prioridade e queremos garantir que o serviço esteja funcional. 🤝\natt, suporte 24h!";

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
        if (Date.now() - execStart > MAX_EXEC_MS) break;
        if (client.ultimo_envio_auto === today) continue;

        const latestBeforeSupportSend = await fetchLatestDispatchConfig(supabase, companyId);
        const currentApiUrl = latestBeforeSupportSend.apiUrl;
        const currentApiToken = latestBeforeSupportSend.apiToken;

        if (!currentApiUrl || !currentApiToken) {
          totalErrors++;
          continue;
        }

        if (currentApiUrl !== apiUrl || currentApiToken !== apiToken) {
          const latestValidation = await validateApiToken(currentApiUrl, currentApiToken);
          if (!latestValidation.ok) {
            await logSessionExpired(supabase, companyId);
            totalErrors++;
            break;
          }
          apiUrl = currentApiUrl;
          apiToken = currentApiToken;
        }

        const phone = client.whatsapp || client.phone || "";
        if (!phone || phone.replace(/\D/g, "").length < 8) continue;

        const subs = (client as any).client_subscriptions;
        const sub = getLatestSubscription(subs);
        const plan = sub?.subscription_plans;
        const valor = sub ? (sub.custom_price > 0 ? sub.custom_price : plan?.price ?? sub.amount ?? 0) : 0;

        const refDateSupport = getTemplateDateForCategory("suporte", sub ? new Date(sub.end_date + "T00:00:00") : undefined);
        const messageBody = replacePlaceholders(supportTemplate, {
          saudacao: getGreeting(),
          dia_semana: getDayOfWeekFor(refDateSupport),
          dia: getDayOfMonthFor(refDateSupport),
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
            sua_chave_pix: latestBeforeSupportSend.pixKey || "",
        });

        const normalizedPhone = normalizePhone(phone);

        try {
          await sleep(Math.max(supportIntervalMs, MIN_DELAY_MS));
          const sendResult = await sendMessage(apiUrl, apiToken, normalizedPhone, messageBody);

          await supabase.from("auto_send_logs").insert({
            company_id: companyId,
            client_id: client.id,
            client_name: client.name,
            category: "suporte",
            status: sendResult.ok ? "success" : "failed",
            error_message: sendResult.error || null,
            phone: normalizedPhone,
            message_sent: messageBody,
          });

          if (sendResult.ok) {
            await supabase.from("clients").update({ ultimo_envio_auto: today, support_started_at: null }).eq("id", client.id);
            totalSent++;
          } else {
            totalErrors++;
            if (sendResult.isSessionError || sendResult.status === 401) {
              await logSessionExpired(supabase, companyId, normalizedPhone);
              break;
            }
          }
        } catch (sendErr) {
          await supabase.from("auto_send_logs").insert({
            company_id: companyId,
            client_id: client.id,
            client_name: client.name,
            category: "suporte",
            status: "failed",
            error_message: CONNECTION_ERROR_MESSAGE,
            phone: normalizedPhone,
            message_sent: messageBody,
          });
          totalErrors++;
        }
      }
    }

    // --- Follow-up auto-send ---
    for (const config of eligibleConfigs) {
      if (Date.now() - execStart > MAX_EXEC_MS) break;
      const companyId = config.company_id;
      const followupConfig = await fetchLatestDispatchConfig(supabase, companyId);
      let apiUrl = followupConfig.apiUrl;
      let apiToken = followupConfig.apiToken;
      if (!apiUrl || !apiToken) continue;

      const followupValidation = await validateApiToken(apiUrl, apiToken);
      if (!followupValidation.ok) {
        await logSessionExpired(supabase, companyId);
        totalErrors++;
        continue;
      }

      // Check if followup category is disabled
      const { data: followupCatSetting } = await supabase
        .from("auto_send_category_settings")
        .select("is_active")
        .eq("company_id", companyId)
        .eq("category", "followup")
        .maybeSingle();
      if (followupCatSetting && !followupCatSetting.is_active) continue;

      const { data: followupTemplateRows } = await supabase
        .from("message_templates")
        .select("message")
        .eq("company_id", companyId)
        .eq("category", "followup")
        .limit(1);

      const followupTemplate = followupTemplateRows?.[0]?.message ||
        "Olá {primeiro_nome}, {saudacao}! 👋\n\nPassando para saber se está tudo bem com o seu serviço. Como está sua experiência? 😊";

      // Only consider clients registered at least 15 days ago (follow-up window starts on day 15)
      const fifteenDaysAgoISO = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();

      const { data: followupClients } = await supabase
        .from("clients")
        .select(`
          id, name, whatsapp, phone, server, iptv_user, iptv_password, ultimo_envio_auto, follow_up_active, created_at,
          client_subscriptions (
            end_date, amount, custom_price,
            subscription_plans ( name, price )
          )
        `)
        .eq("company_id", companyId)
        .eq("status", "active")
        .eq("follow_up_active", true)
        .lte("created_at", fifteenDaysAgoISO)
        .or(`ultimo_envio_auto.is.null,ultimo_envio_auto.neq.${today}`);

      if (!followupClients || followupClients.length === 0) continue;

      // Idempotency: fetch all follow-up logs already sent today for this company
      const todayStart = today + "T00:00:00.000Z";
      const { data: existingFollowupLogs } = await supabase
        .from("auto_send_logs")
        .select("client_id")
        .eq("company_id", companyId)
        .eq("category", "followup")
        .eq("status", "success")
        .gte("created_at", todayStart);

      const alreadySentFollowupIds = new Set(
        (existingFollowupLogs || []).map((l: any) => l.client_id).filter(Boolean)
      );

      for (const client of followupClients) {
        if (Date.now() - execStart > MAX_EXEC_MS) break;

        // Skip if a follow-up was already successfully sent today (prevents duplicates)
        if (alreadySentFollowupIds.has(client.id)) {
          console.log(`[auto-send] ⏭️ Follow-up já enviado hoje para ${client.name}, pulando`);
          continue;
        }

        const latestBeforeFollowupSend = await fetchLatestDispatchConfig(supabase, companyId);
        const currentApiUrl = latestBeforeFollowupSend.apiUrl;
        const currentApiToken = latestBeforeFollowupSend.apiToken;

        if (!currentApiUrl || !currentApiToken) {
          totalErrors++;
          continue;
        }

        if (currentApiUrl !== apiUrl || currentApiToken !== apiToken) {
          const latestValidation = await validateApiToken(currentApiUrl, currentApiToken);
          if (!latestValidation.ok) {
            await logSessionExpired(supabase, companyId);
            totalErrors++;
            break;
          }
          apiUrl = currentApiUrl;
          apiToken = currentApiToken;
        }

        const phone = client.whatsapp || client.phone || "";
        if (!phone || phone.replace(/\D/g, "").length < 8) continue;

        const subs = (client as any).client_subscriptions;
        const sub = getLatestSubscription(subs);
        const plan = sub?.subscription_plans;

        // Only follow-up clients whose subscription is active and not near expiry
        if (sub) {
          const endDate = new Date(sub.end_date + "T00:00:00");
          const todayDate = new Date(today + "T00:00:00");
          const diffDays = Math.round((endDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
          // Skip if already in a billing category
          if (getCategory(diffDays) !== null) continue;
          // Only follow up clients with 7+ days left
          if (diffDays < 7) continue;
        }

        const valor = sub ? (sub.custom_price > 0 ? sub.custom_price : plan?.price ?? sub.amount ?? 0) : 0;

        const followupEndDate = sub ? new Date(sub.end_date + "T00:00:00") : undefined;
        const refDateFollowup = getTemplateDateForCategory("followup", followupEndDate);
        const messageBody = replacePlaceholders(followupTemplate, {
          saudacao: getGreeting(),
          dia_semana: getDayOfWeekFor(refDateFollowup),
          dia: getDayOfMonthFor(refDateFollowup),
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
          sua_chave_pix: latestBeforeFollowupSend.pixKey || "",
        });

        const normalizedPhone = normalizePhone(phone);

        try {
          await sleep(Math.max(((config as any).send_interval_seconds ?? 60) * 1000, MIN_DELAY_MS));
          const sendResult = await sendMessage(apiUrl, apiToken, normalizedPhone, messageBody);

          await supabase.from("auto_send_logs").insert({
            company_id: companyId,
            client_id: client.id,
            client_name: client.name,
            category: "followup",
            status: sendResult.ok ? "success" : "failed",
            error_message: sendResult.error || null,
            phone: normalizedPhone,
            message_sent: messageBody,
          });

          if (sendResult.ok) {
            // Deactivate follow_up_active so this client never receives another automatic follow-up
            // (prevents duplicate messages on subsequent days/runs)
            await supabase
              .from("clients")
              .update({ ultimo_envio_auto: today, follow_up_active: false })
              .eq("id", client.id);
            alreadySentFollowupIds.add(client.id);
            totalSent++;
          } else {
            totalErrors++;
            if (sendResult.status === 401) {
              await logSessionExpired(supabase, companyId, normalizedPhone);
              break;
            }
          }
        } catch (sendErr) {
          await supabase.from("auto_send_logs").insert({
            company_id: companyId,
            client_id: client.id,
            client_name: client.name,
            category: "followup",
            status: "failed",
            error_message: CONNECTION_ERROR_MESSAGE,
            phone: normalizedPhone,
            message_sent: messageBody,
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
      if (Date.now() - execStart > MAX_EXEC_MS) break;
      const companyId = config.company_id;
      const winbackConfig = await fetchLatestDispatchConfig(supabase, companyId);
      let apiUrl = winbackConfig.apiUrl;
      let apiToken = winbackConfig.apiToken;
      if (!apiUrl || !apiToken) continue;
      if (winbackConfig.winbackPaused) continue;

      const winbackValidation = await validateApiToken(apiUrl, apiToken);
      if (!winbackValidation.ok) {
        await logSessionExpired(supabase, companyId);
        totalErrors++;
        continue;
      }

      const { data: wbTemplateRows } = await supabase
        .from("message_templates")
        .select("category, message")
        .eq("company_id", companyId)
        .like("category", "winback_%");

      const wbTemplates: Record<string, string> = { ...defaultWinbackTemplates };
      wbTemplateRows?.forEach((t: { category: string; message: string }) => {
        wbTemplates[t.category] = t.message;
      });

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

      const { data: progressRows } = await supabase
        .from("winback_campaign_progress")
        .select("client_id, current_step, last_sent_at")
        .eq("company_id", companyId);

      const progressMap: Record<string, { step: number; lastSentAt: string | null }> = {};
      progressRows?.forEach((p: any) => {
        progressMap[p.client_id] = { step: p.current_step, lastSentAt: p.last_sent_at };
      });

      for (const client of wbClients) {
        if (Date.now() - execStart > MAX_EXEC_MS) break;

        const latestBeforeWinbackSend = await fetchLatestDispatchConfig(supabase, companyId);
        const currentApiUrl = latestBeforeWinbackSend.apiUrl;
        const currentApiToken = latestBeforeWinbackSend.apiToken;

        if (!currentApiUrl || !currentApiToken) {
          totalErrors++;
          continue;
        }

        if (currentApiUrl !== apiUrl || currentApiToken !== apiToken) {
          const latestValidation = await validateApiToken(currentApiUrl, currentApiToken);
          if (!latestValidation.ok) {
            await logSessionExpired(supabase, companyId);
            totalErrors++;
            break;
          }
          apiUrl = currentApiUrl;
          apiToken = currentApiToken;
        }

        const subs = (client as any).client_subscriptions;
        if (!subs || subs.length === 0) continue;

        const sub = getLatestSubscription(subs);
        if (!sub) continue;
        const plan = sub.subscription_plans;
        const endDate = new Date(sub.end_date + "T00:00:00");
        const todayDate = new Date(today + "T00:00:00");
        const daysExpired = Math.round((todayDate.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysExpired < 45) continue;

        const prog = progressMap[client.id] || { step: 0, lastSentAt: null };
        if (prog.step >= CAMPAIGN_STEPS.length) continue;

        const currentStepDef = CAMPAIGN_STEPS[prog.step];

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
          sua_chave_pix: latestBeforeWinbackSend.pixKey || "",
        });

        const normalizedPhone = normalizePhone(phone);

        try {
          await sleep(Math.max(((config as any).send_interval_seconds ?? 60) * 1000, MIN_DELAY_MS));
          const sendResult = await sendMessage(apiUrl, apiToken, normalizedPhone, messageBody);

          await supabase.from("auto_send_logs").insert({
            company_id: companyId,
            client_id: client.id,
            client_name: client.name,
            category: `repescagem_${currentStepDef.key}`,
            status: sendResult.ok ? "success" : "failed",
            error_message: sendResult.error || null,
            phone: normalizedPhone,
            message_sent: messageBody,
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
            if (sendResult.status === 401) {
              await logSessionExpired(supabase, companyId, normalizedPhone);
              break;
            }
          }
        } catch (sendErr) {
          await supabase.from("auto_send_logs").insert({
            company_id: companyId,
            client_id: client.id,
            client_name: client.name,
            category: `repescagem_${currentStepDef.key}`,
            status: "failed",
            error_message: CONNECTION_ERROR_MESSAGE,
            phone: normalizedPhone,
            message_sent: messageBody,
          });
          totalErrors++;
        }
      }
    }

    // --- Log errors for companies WITHOUT API configured ---
    const configuredCompanyIds = (apiConfigs || []).map((c: any) => c.company_id);
    
    const { data: allCompanies } = await supabase
      .from("companies")
      .select("id, name");

    if (allCompanies) {
      const unconfiguredCompanies = allCompanies.filter(
        (c: any) => !configuredCompanyIds.includes(c.id)
      );

      for (const company of unconfiguredCompanies) {
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

        const hasEligible = pendingClients.some((client: any) => {
          const subs = client.client_subscriptions;
          if (!subs || subs.length === 0) return false;
          const endDate = new Date(subs[0].end_date + "T00:00:00");
          const todayDate = new Date(today + "T00:00:00");
          const diffDays = Math.round((endDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));
          return getCategory(diffDays) !== null;
        });

        if (hasEligible) {
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
      JSON.stringify({ sent: totalSent, errors: totalErrors, elapsed_ms: Date.now() - execStart }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
