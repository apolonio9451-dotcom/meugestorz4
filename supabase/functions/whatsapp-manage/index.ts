import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CREATE_INSTANCE_URL = "https://grlwciflaotripbumhve.supabase.co/functions/v1/create-instance-url";

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
    sanitizeAdminToken(Deno.env.get("UAZAPI_ADMIN_TOKEN"), "UAZAPI_ADMIN_TOKEN"),
    sanitizeAdminToken(Deno.env.get("BOLINHA_API_TOKEN"), "BOLINHA_API_TOKEN"),
    sanitizeAdminToken(Deno.env.get("EVOLUTI_TOKEN"), "EVOLUTI_TOKEN"),
  ].filter((token): token is string => Boolean(token));

  return Array.from(new Set(candidates));
}

function maskToken(token: string) {
  if (token.length <= 8) return "***";
  return `${token.substring(0, 4)}...${token.substring(token.length - 4)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const userId = user.id;
    const body = await req.json();
    const { action } = body;
    const candidateAdminTokens = getCandidateAdminTokens();

    console.log(`[whatsapp-manage] Action: ${action} for user: ${userId}`);

    // ==================== GET-OR-CREATE ====================
    if (action === "get-or-create") {
      const { data: existing } = await adminClient
        .from("whatsapp_instances")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) {
        return new Response(JSON.stringify({ instance: existing, is_new: false }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create new instance
      const instanceName = `crm-${userId.substring(0, 8)}`;
      const deviceName = "MeuCRM";
      
      console.log(`[whatsapp-manage] Creating instance: ${instanceName}`);

      if (candidateAdminTokens.length === 0) {
        return new Response(JSON.stringify({
          error: "Nenhum token de admin válido configurado",
          detail: "Configure UAZAPI_ADMIN_TOKEN ou EVOLUTI_TOKEN com o valor puro do token (sem curl/URL).",
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

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
          createRes = await fetch(CREATE_INSTANCE_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(createPayload),
          });
        } catch (fetchError: any) {
          console.error("[whatsapp-manage] Failed to reach create-instance endpoint:", fetchError?.message);
          createErrorStatus = 502;
          createErrorDetail = `Falha de rede ao chamar create-instance-url: ${fetchError?.message || "erro desconhecido"}`;
          continue;
        }

        const responseText = await createRes.text();
        let parsedData: any = null;
        try {
          parsedData = responseText ? JSON.parse(responseText) : {};
        } catch {
          parsedData = { raw: responseText };
        }

        if (createRes.ok) {
          apiData = parsedData;
          break;
        }

        createErrorStatus = createRes.status;
        createErrorDetail = responseText || "Sem detalhes retornados";
        console.error(`[whatsapp-manage] API creation failed with token ${maskToken(adminToken)}: ${createRes.status}`, responseText);

        if (createRes.status !== 401 && createRes.status !== 403) {
          break;
        }
      }

      if (!apiData) {
        return new Response(JSON.stringify({
          error: "Falha ao criar instância na API",
          detail: createErrorDetail,
        }), {
          status: createErrorStatus,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const serverUrl = apiData.server_url;
      const instanceToken = apiData["Instance Token"] || apiData.instance_token || apiData.instanceToken;
      const generalToken = apiData.token;

      if (!serverUrl || !instanceToken) {
        console.error("[whatsapp-manage] API returned incomplete data", apiData);
        return new Response(JSON.stringify({ error: "API retornou dados incompletos" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Register Webhook
      const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook?user_id=${userId}`;
      console.log(`[whatsapp-manage] Registering webhook: ${webhookUrl}`);

      try {
        const webhookRes = await fetch(`${serverUrl}/webhook`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "token": instanceToken,
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
          console.warn("[whatsapp-manage] Webhook registration failed:", await webhookRes.text());
        }
      } catch (whErr) {
        console.error("[whatsapp-manage] Webhook registration error:", whErr);
      }

      // Save to DB
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
        .select()
        .single();

      if (dbError) {
        console.error("[whatsapp-manage] DB insertion error:", dbError);
        return new Response(JSON.stringify({ error: "Erro ao salvar instância no banco" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ instance: newInstance, is_new: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==================== QRCODE ====================
    if (action === "qrcode") {
      const { data: inst } = await adminClient
        .from("whatsapp_instances")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (!inst) {
        return new Response(JSON.stringify({ error: "Instância não encontrada" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const qrRes = await fetch(`${inst.server_url}/instance/connect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "token": inst.instance_token,
        },
        body: "{}",
      });

      if (!qrRes.ok) {
        const errorText = await qrRes.text();
        console.error(`[whatsapp-manage] QR Code generation failed: ${qrRes.status}`, errorText);
        return new Response(JSON.stringify({ error: "Falha ao gerar QR Code", detail: errorText }), {
          status: qrRes.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const qrJson = await qrRes.json();
      const qrcode = qrJson?.instance?.qrcode || qrJson?.qrcode || "";
      const connected = qrJson?.connected === true || qrJson?.instance?.status === "connected";

      if (connected) {
        await adminClient
          .from("whatsapp_instances")
          .update({ status: "connected", is_connected: true, last_connection_at: new Date().toISOString() })
          .eq("user_id", userId);
        
        return new Response(JSON.stringify({ connected: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ qrcode }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==================== DISCONNECT ====================
    if (action === "disconnect") {
      const { error } = await adminClient
        .from("whatsapp_instances")
        .update({ status: "disconnected", is_connected: false })
        .eq("user_id", userId);

      if (error) {
        return new Response(JSON.stringify({ error: "Erro ao desconectar no banco" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ==================== DELETE ====================
    if (action === "delete") {
      const { data: inst } = await adminClient
        .from("whatsapp_instances")
        .select("server_url, instance_token")
        .eq("user_id", userId)
        .maybeSingle();

      if (inst) {
        try {
          await fetch(`${inst.server_url}/instance`, {
            method: "DELETE",
            headers: { "token": inst.instance_token },
          });
        } catch (e) {
          console.error("[whatsapp-manage] API delete failed (continuing):", e.message);
        }
      }

      await adminClient
        .from("whatsapp_instances")
        .delete()
        .eq("user_id", userId);

      return new Response(JSON.stringify({ deleted: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), { 
      status: 400, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });

  } catch (err) {
    console.error("[whatsapp-manage] Critical error:", err);
    return new Response(JSON.stringify({ error: "Erro interno no servidor", detail: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});