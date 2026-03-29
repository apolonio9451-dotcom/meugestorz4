import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CREATE_INSTANCE_URL =
  "https://grlwciflaotripbumhve.supabase.co/functions/v1/create-instance-url";

function getFirstEnvValue(names: string[]): string {
  for (const name of names) {
    const value = Deno.env.get(name);
    if (value && value.trim().length > 0) return value.trim();
  }
  return "";
}

function normalizeToken(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    // --- Auth ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Token de autenticação ausente" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Token inválido ou expirado. Faça login novamente." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const userId = user.id;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { action, force_new } = await req.json();

    // =========================================================
    // ACTION: get-or-create
    // =========================================================
    if (action === "get-or-create") {
      // If force_new, delete existing first
      if (force_new) {
        const { data: old } = await adminClient
          .from("whatsapp_instances")
          .select("server_url, instance_token")
          .eq("user_id", userId)
          .maybeSingle();

        if (old) {
          // Try to delete from API (resilient)
          try {
            await fetch(`${old.server_url}/instance`, {
              method: "DELETE",
              headers: { token: old.instance_token },
            });
          } catch (_e) {
            console.error("[whatsapp-manage] delete old instance from API failed:", _e);
          }
          await adminClient.from("whatsapp_instances").delete().eq("user_id", userId);
        }
      }

      // Check existing
      const { data: existing } = await adminClient
        .from("whatsapp_instances")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({ instance: sanitizeInstance(existing), is_new: false }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // --- Resolve latest token (company config first, then backend secrets fallback) ---
      let manageToken = "";
      try {
        const { data: membership } = await adminClient
          .from("company_memberships")
          .select("company_id, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (membership?.company_id) {
          const { data: apiSettings } = await adminClient
            .from("api_settings")
            .select("api_token")
            .eq("company_id", membership.company_id)
            .maybeSingle();

          manageToken = normalizeToken((apiSettings as any)?.api_token);
        }
      } catch (tokenResolveErr: any) {
        console.error("[whatsapp-manage] token resolve failed:", tokenResolveErr?.message || String(tokenResolveErr));
      }

      if (!manageToken) {
        manageToken = getFirstEnvValue(["WA_ADMIN_TOKEN", "BOLINHA_API_TOKEN", "UAZAPI_ADMIN_TOKEN", "EVOLUTI_TOKEN"]);
      }

      if (!manageToken) {
        return new Response(
          JSON.stringify({ error: "Token da API não configurado. Salve o token no menu Instância." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const instanceName = `bolinha-crm-${userId.substring(0, 8)}`;
      const deviceName = "BolinhaCRM";

      const createPayload = {
        token: manageToken,
        name: instanceName,
        deviceName,
        systemName: "BolinhaCRM",
        system_name: "BolinhaCRM",
        system: "BolinhaCRM",
        profileName: "BolinhaCRM",
        browser: "chrome",
        fingerprintProfile: "chrome",
      };

      console.log("[whatsapp-manage] Creating instance:", instanceName);

      const createRes = await fetch(CREATE_INSTANCE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createPayload),
      });

      const createText = await createRes.text();
      console.log(`[whatsapp-manage] Create response ${createRes.status}: ${createText.substring(0, 500)}`);

      if (!createRes.ok) {
        let detail = createText;
        try { detail = JSON.parse(createText)?.error || createText; } catch {}
        return new Response(
          JSON.stringify({ error: "Falha ao criar instância na API", detail }),
          { status: createRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let createData: any;
      try { createData = JSON.parse(createText); } catch {
        return new Response(
          JSON.stringify({ error: "Resposta inválida da API de criação" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const serverUrl = createData.server_url;
      const instanceToken = createData["Instance Token"] || createData.instance_token;
      const tokenGeneral = createData.token || "";

      if (!serverUrl || !instanceToken) {
        return new Response(
          JSON.stringify({ error: "API não retornou server_url ou Instance Token", raw: createData }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Register webhook
      const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook?user_id=${userId}`;
      try {
        const whRes = await fetch(`${serverUrl}/webhook`, {
          method: "POST",
          headers: { "Content-Type": "application/json", token: instanceToken },
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
        console.log(`[whatsapp-manage] Webhook registered: ${whRes.status}`);
      } catch (whErr: any) {
        console.error("[whatsapp-manage] Webhook registration failed:", whErr.message);
      }

      // Save to DB
      const instanceRow = {
        user_id: userId,
        instance_name: instanceName,
        device_name: createData.instance?.device_name || deviceName,
        server_url: serverUrl,
        instance_token: instanceToken,
        token: tokenGeneral,
        webhook_url: webhookUrl,
        status: "created",
        is_connected: false,
      };

      const { data: inserted, error: insertErr } = await adminClient
        .from("whatsapp_instances")
        .insert(instanceRow)
        .select()
        .single();

      if (insertErr) {
        console.error("[whatsapp-manage] DB insert error:", insertErr.message);
        return new Response(
          JSON.stringify({ error: "Erro ao salvar instância no banco", detail: insertErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ instance: sanitizeInstance(inserted), is_new: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =========================================================
    // ACTION: qrcode
    // =========================================================
    if (action === "qrcode") {
      const { data: inst } = await adminClient
        .from("whatsapp_instances")
        .select("server_url, instance_token, is_connected")
        .eq("user_id", userId)
        .maybeSingle();

      if (!inst) {
        return new Response(
          JSON.stringify({ error: "Nenhuma instância encontrada" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (inst.is_connected) {
        return new Response(
          JSON.stringify({ connected: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const qrRes = await fetch(`${inst.server_url}/instance/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json", token: inst.instance_token },
        body: "{}",
      });

      const qrText = await qrRes.text();
      let qrJson: any;
      try { qrJson = JSON.parse(qrText); } catch {
        return new Response(
          JSON.stringify({ error: "Resposta inválida ao buscar QR Code" }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const connected = qrJson?.connected === true || qrJson?.instance?.status === "connected";
      if (connected) {
        await adminClient
          .from("whatsapp_instances")
          .update({ status: "connected", is_connected: true, last_connection_at: new Date().toISOString() })
          .eq("user_id", userId);

        return new Response(
          JSON.stringify({ connected: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const qrcode = qrJson?.instance?.qrcode || qrJson?.qrcode || "";
      return new Response(
        JSON.stringify({ qrcode, connected: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =========================================================
    // ACTION: disconnect
    // =========================================================
    if (action === "disconnect") {
      await adminClient
        .from("whatsapp_instances")
        .update({ status: "disconnected", is_connected: false })
        .eq("user_id", userId);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =========================================================
    // ACTION: delete
    // =========================================================
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
            headers: { token: inst.instance_token },
          });
        } catch (e: any) {
          console.error("[whatsapp-manage] API delete failed (continuing):", e.message);
        }
      }

      await adminClient.from("whatsapp_instances").delete().eq("user_id", userId);

      return new Response(
        JSON.stringify({ deleted: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =========================================================
    // ACTION: validate-connection
    // =========================================================
    if (action === "validate-connection") {
      const { data: inst } = await adminClient
        .from("whatsapp_instances")
        .select("server_url, instance_token, is_connected")
        .eq("user_id", userId)
        .maybeSingle();

      if (!inst || !inst.server_url || !inst.instance_token) {
        return new Response(
          JSON.stringify({ disconnected: true, status: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        const res = await fetch(`${inst.server_url}/instance`, {
          method: "GET",
          headers: { "Content-Type": "application/json", token: inst.instance_token },
        });

        if (res.status === 401) {
          // Token invalid — mark as disconnected in DB
          await adminClient
            .from("whatsapp_instances")
            .update({ is_connected: false, status: "disconnected" })
            .eq("user_id", userId);

          return new Response(
            JSON.stringify({ disconnected: true, status: 401 }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ disconnected: false, status: res.status }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch {
        return new Response(
          JSON.stringify({ disconnected: false, status: 0, error: "Falha de rede" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: `Ação desconhecida: ${action}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[whatsapp-manage] Unhandled error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/** Strip sensitive fields before returning to frontend */
function sanitizeInstance(inst: any) {
  return {
    id: inst.id,
    instance_name: inst.instance_name,
    device_name: inst.device_name,
    status: inst.status,
    is_connected: inst.is_connected,
    last_connection_at: inst.last_connection_at,
    created_at: inst.created_at,
  };
}
