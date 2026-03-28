import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const DEFAULT_CREATE_INSTANCE_URL = "https://grlwciflaotripbumhve.supabase.co/functions/v1/create-instance-url";
const INSTANCE_PUBLIC_COLUMNS = "id,instance_name,device_name,status,is_connected,last_connection_at,created_at,updated_at";
const DEFAULT_TIMEOUT_MS = Number(Deno.env.get("WA_REQUEST_TIMEOUT_MS") ?? "30000");

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sanitizeAdminToken(rawValue: string | undefined, secretName: string): string | null {
  const value = rawValue?.trim();
  if (!value) return null;

  if (value.toLowerCase().startsWith("curl ")) {
    console.warn(`[whatsapp-manage] ${secretName} parece conter comando curl, ignorando.`);
    return null;
  }

  if (value.startsWith("http://") || value.startsWith("https://")) {
    console.warn(`[whatsapp-manage] ${secretName} parece conter URL, ignorando.`);
    return null;
  }

  return value;
}

function getCandidateAdminTokens(): string[] {
  const candidates = [
    sanitizeAdminToken(Deno.env.get("WA_ADMIN_TOKEN"), "WA_ADMIN_TOKEN"),
    sanitizeAdminToken(Deno.env.get("UAZAPI_ADMIN_TOKEN"), "UAZAPI_ADMIN_TOKEN"),
    sanitizeAdminToken(Deno.env.get("EVOLUTI_TOKEN"), "EVOLUTI_TOKEN"),
    sanitizeAdminToken(Deno.env.get("BOLINHA_API_TOKEN"), "BOLINHA_API_TOKEN"),
  ].filter((token): token is string => Boolean(token));

  return Array.from(new Set(candidates));
}

function getCreateInstanceEndpoint() {
  return (
    Deno.env.get("WA_API_URL")?.trim() ||
    Deno.env.get("EVOLUTI_API_URL")?.trim() ||
    DEFAULT_CREATE_INSTANCE_URL
  );
}

function maskToken(token: string) {
  if (token.length <= 8) return "***";
  return `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function parseResponse(response: Response) {
  const raw = await response.text();
  let json: any = null;

  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    json = null;
  }

  return { raw, json };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({
        error: "Configuração inválida no servidor",
        detail: "SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente",
      }, 500);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Missing or invalid authorization header" }, 401);
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const {
      data: { user },
      error: authError,
    } = await adminClient.auth.getUser(token);

    if (authError || !user) {
      return jsonResponse({ error: "Invalid token" }, 401);
    }

    const userId = user.id;
    const body = await req.json().catch(() => ({}));
    const action = typeof body?.action === "string" ? body.action : "";
    const forceNew = body?.force_new === true;
    const candidateAdminTokens = getCandidateAdminTokens();
    const createInstanceEndpoint = getCreateInstanceEndpoint();

    console.log(`[whatsapp-manage] Action: ${action} for user: ${userId}`);
    console.log(`[whatsapp-manage] create-instance endpoint: ${createInstanceEndpoint}`);

    if (action === "get-or-create") {
      const { data: existingInternal } = await adminClient
        .from("whatsapp_instances")
        .select("id, user_id, instance_name, server_url, instance_token")
        .eq("user_id", userId)
        .maybeSingle();

      if (existingInternal && !forceNew) {
        const { data: existingPublic } = await adminClient
          .from("whatsapp_instances")
          .select(INSTANCE_PUBLIC_COLUMNS)
          .eq("id", existingInternal.id)
          .maybeSingle();

        return jsonResponse({ instance: existingPublic, is_new: false });
      }

      if (existingInternal && forceNew) {
        console.log(`[whatsapp-manage] Force new instance requested. Removing previous instance ${existingInternal.instance_name}`);

        try {
          const deleteRes = await fetchWithTimeout(`${existingInternal.server_url}/instance`, {
            method: "DELETE",
            headers: { token: existingInternal.instance_token },
          });

          if (!deleteRes.ok) {
            const deleteParsed = await parseResponse(deleteRes);
            console.warn(`[whatsapp-manage] Remote delete failed (${deleteRes.status})`, deleteParsed.raw);
          }
        } catch (deleteError: any) {
          console.warn("[whatsapp-manage] Remote delete failed (continuing):", deleteError?.message);
        }

        await adminClient
          .from("whatsapp_instances")
          .delete()
          .eq("id", existingInternal.id);
      }

      if (candidateAdminTokens.length === 0) {
        return jsonResponse({
          error: "Nenhum token de admin válido configurado",
          detail: "Configure WA_ADMIN_TOKEN, UAZAPI_ADMIN_TOKEN ou EVOLUTI_TOKEN com o valor puro do token (sem curl/URL).",
        }, 500);
      }

      const instanceName = `crm-${userId.substring(0, 8)}-${Date.now().toString(36)}`;
      const deviceName = "MeuCRM";
      console.log(`[whatsapp-manage] Creating instance: ${instanceName}`);

      let apiData: any = null;
      let createErrorStatus = 500;
      let createErrorDetail = "Falha ao criar instância na API";

      for (let i = 0; i < candidateAdminTokens.length; i++) {
        const adminToken = candidateAdminTokens[i];
        const createPayload = {
          token: adminToken,
          name: instanceName,
          deviceName,
          systemName: "MeuCRM",
          system_name: "MeuCRM",
          system: "MeuCRM",
          profileName: "MeuCRM",
          browser: "chrome",
          fingerprintProfile: "chrome",
        };

        console.log(`[whatsapp-manage] Trying admin token ${i + 1}/${candidateAdminTokens.length}: ${maskToken(adminToken)}`);

        let createRes: Response;
        try {
          createRes = await fetchWithTimeout(createInstanceEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(createPayload),
          });
        } catch (fetchError: any) {
          console.error("[whatsapp-manage] Failed to reach create-instance endpoint:", fetchError?.message);
          createErrorStatus = fetchError?.name === "AbortError" ? 504 : 502;
          createErrorDetail = `Falha de rede ao chamar create-instance-url: ${fetchError?.message || "erro desconhecido"}`;
          continue;
        }

        const parsed = await parseResponse(createRes);

        if (createRes.ok) {
          apiData = parsed.json ?? { raw: parsed.raw };
          break;
        }

        createErrorStatus = createRes.status;
        createErrorDetail = parsed.raw || "Sem detalhes retornados";

        console.error(
          `[whatsapp-manage] API creation failed with token ${maskToken(adminToken)}: ${createRes.status}`,
          parsed.raw,
        );

        if (createRes.status !== 401 && createRes.status !== 403) {
          break;
        }
      }

      if (!apiData) {
        return jsonResponse({
          error: "Falha ao criar instância na API",
          detail: createErrorDetail,
          api_status: createErrorStatus,
          endpoint: createInstanceEndpoint,
        }, createErrorStatus);
      }

      const serverUrl = apiData.server_url || apiData.serverUrl || apiData?.instance?.server_url;
      const instanceToken =
        apiData["Instance Token"] ||
        apiData.instance_token ||
        apiData.instanceToken ||
        apiData?.instance?.instance_token;
      const generalToken = apiData.token || apiData?.instance?.token || "";

      if (!serverUrl || !instanceToken) {
        console.error("[whatsapp-manage] API returned incomplete data", apiData);
        return jsonResponse({
          error: "API retornou dados incompletos",
          detail: apiData,
        }, 500);
      }

      const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook?user_id=${userId}`;
      console.log(`[whatsapp-manage] Registering webhook: ${webhookUrl}`);

      try {
        const webhookRes = await fetchWithTimeout(`${serverUrl}/webhook`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            token: instanceToken,
          },
          body: JSON.stringify({
            url: webhookUrl,
            enabled: true,
            active: true,
            byApi: true,
            addUrlEvents: true,
            addUrlTypesMessages: true,
            excludeMessages: ["wasSentByApi", "isGroupYes"],
            events: [
              "connection", "messages", "messages_update", "presence",
              "call", "contacts", "groups", "labels", "chats",
              "chat_labels", "blocks", "leads", "history", "sender",
            ],
          }),
        });

        if (!webhookRes.ok) {
          const webhookPayload = await parseResponse(webhookRes);
          console.warn(`[whatsapp-manage] Webhook registration failed (${webhookRes.status}):`, webhookPayload.raw);
        }
      } catch (whErr: any) {
        console.error("[whatsapp-manage] Webhook registration error:", whErr?.message || whErr);
      }

      const { data: newInstance, error: dbError } = await adminClient
        .from("whatsapp_instances")
        .insert({
          user_id: userId,
          instance_name: instanceName,
          device_name: deviceName,
          server_url: serverUrl,
          instance_token: instanceToken,
          token: generalToken,
          webhook_url: webhookUrl,
          status: "created",
          is_connected: false,
        })
        .select(INSTANCE_PUBLIC_COLUMNS)
        .single();

      if (dbError) {
        console.error("[whatsapp-manage] DB insertion error:", dbError);
        return jsonResponse({
          error: "Erro ao salvar instância no banco",
          detail: dbError.message,
        }, 500);
      }

      return jsonResponse({ instance: newInstance, is_new: true });
    }

    if (action === "qrcode") {
      const { data: inst } = await adminClient
        .from("whatsapp_instances")
        .select("id, user_id, server_url, instance_token")
        .eq("user_id", userId)
        .maybeSingle();

      if (!inst) {
        return jsonResponse({ error: "Instância não encontrada" }, 404);
      }

      const qrRes = await fetchWithTimeout(`${inst.server_url}/instance/connect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          token: inst.instance_token,
        },
        body: "{}",
      });

      const qrPayload = await parseResponse(qrRes);

      if (!qrRes.ok) {
        console.error(`[whatsapp-manage] QR Code generation failed: ${qrRes.status}`, qrPayload.raw);
        return jsonResponse({
          error: "Falha ao gerar QR Code",
          detail: qrPayload.raw,
          api_status: qrRes.status,
        }, qrRes.status);
      }

      const qrJson = qrPayload.json || {};
      const qrcode = qrJson?.instance?.qrcode || qrJson?.qrcode || "";
      const connected = qrJson?.connected === true || qrJson?.instance?.status === "connected";

      if (connected) {
        await adminClient
          .from("whatsapp_instances")
          .update({ status: "connected", is_connected: true, last_connection_at: new Date().toISOString() })
          .eq("user_id", userId);

        return jsonResponse({ connected: true });
      }

      if (!qrcode) {
        return jsonResponse({
          error: "QR Code não retornado pela API",
          detail: qrPayload.raw,
        }, 502);
      }

      return jsonResponse({ qrcode });
    }

    if (action === "disconnect") {
      const { error } = await adminClient
        .from("whatsapp_instances")
        .update({ status: "disconnected", is_connected: false })
        .eq("user_id", userId);

      if (error) {
        return jsonResponse({ error: "Erro ao desconectar no banco", detail: error.message }, 500);
      }

      return jsonResponse({ success: true });
    }

    if (action === "delete") {
      const { data: inst } = await adminClient
        .from("whatsapp_instances")
        .select("id, server_url, instance_token")
        .eq("user_id", userId)
        .maybeSingle();

      if (inst) {
        try {
          const remoteDeleteRes = await fetchWithTimeout(`${inst.server_url}/instance`, {
            method: "DELETE",
            headers: { token: inst.instance_token },
          });

          if (!remoteDeleteRes.ok) {
            const remoteDeletePayload = await parseResponse(remoteDeleteRes);
            console.warn(`[whatsapp-manage] API delete failed (${remoteDeleteRes.status})`, remoteDeletePayload.raw);
          }
        } catch (e: any) {
          console.error("[whatsapp-manage] API delete failed (continuing):", e?.message || e);
        }
      }

      await adminClient
        .from("whatsapp_instances")
        .delete()
        .eq("user_id", userId);

      return jsonResponse({ deleted: true });
    }

    return jsonResponse({ error: "Ação inválida" }, 400);
  } catch (err: any) {
    console.error("[whatsapp-manage] Critical error:", err);
    return jsonResponse({
      error: "Erro interno no servidor",
      detail: err?.message || "Erro desconhecido",
    }, 500);
  }
});
