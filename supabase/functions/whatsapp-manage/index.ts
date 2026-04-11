import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

      // --- Resolve tokens for create-instance (prefer backend admin token, retry with UI token if needed) ---
      const tokenCandidates: string[] = [];
      const adminToken = getFirstEnvValue(["BOLINHA_API_TOKEN", "UAZAPI_ADMIN_TOKEN", "WA_ADMIN_TOKEN", "EVOLUTI_TOKEN"]);
      if (adminToken) tokenCandidates.push(adminToken);

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

          const uiToken = normalizeToken((apiSettings as any)?.api_token);
          if (uiToken && !tokenCandidates.includes(uiToken)) tokenCandidates.push(uiToken);
        }
      } catch (tokenResolveErr: any) {
        console.error("[whatsapp-manage] token resolve failed:", tokenResolveErr?.message || String(tokenResolveErr));
      }

      if (tokenCandidates.length === 0) {
        return new Response(
          JSON.stringify({ error: "Token da API não configurado. Verifique o token no menu Instância." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const instanceName = `bolinha-crm-${userId.substring(0, 8)}`;
      const deviceName = "BolinhaCRM";
      console.log("[whatsapp-manage] Creating instance:", instanceName);

      let createRes: Response | null = null;
      let createText = "";

      for (const candidateToken of tokenCandidates) {
        const createPayload = {
          token: candidateToken,
          name: instanceName,
          deviceName,
          systemName: "BolinhaCRM",
          system_name: "BolinhaCRM",
          system: "BolinhaCRM",
          profileName: "BolinhaCRM",
          browser: "chrome",
          fingerprintProfile: "chrome",
        };

        createRes = await fetch(CREATE_INSTANCE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createPayload),
        });

        createText = await createRes.text();
        console.log(`[whatsapp-manage] Create response ${createRes.status}: ${createText.substring(0, 500)}`);

        if (createRes.ok || createRes.status !== 401) break;
      }

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

      // Resolve company_id for the webhook
      let webhookCompanyId = "";
      try {
        const { data: membershipRow } = await adminClient
          .from("company_memberships")
          .select("company_id")
          .eq("user_id", userId)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        webhookCompanyId = membershipRow?.company_id || "";
      } catch (_e) {
        console.error("[whatsapp-manage] Failed to resolve company_id for webhook:", _e);
      }

      // Register webhook → chatbot-webhook (handles messages + connection events)
      const webhookUrl = `${supabaseUrl}/functions/v1/chatbot-webhook?company_id=${webhookCompanyId}&user_id=${userId}`;
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

      // Always check real API status instead of trusting DB (DB may be stale after session errors)
      if (inst.is_connected) {
        // Verify with the actual API that it's still connected
        try {
          const statusRes = await fetch(`${inst.server_url}/instance/me`, {
            method: "GET",
            headers: { "Content-Type": "application/json", token: inst.instance_token },
          });
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            const reallyConnected = statusData?.connected === true || statusData?.instance?.status === "connected" || statusData?.status === "connected";
            if (reallyConnected) {
              // Re-register webhook just in case it was lost
              let whCompanyId = "";
              try {
                const { data: mRow } = await adminClient
                  .from("company_memberships").select("company_id")
                  .eq("user_id", userId).order("created_at", { ascending: true }).limit(1).maybeSingle();
                whCompanyId = mRow?.company_id || "";
              } catch (_e) {}
              const refreshWebhookUrl = `${supabaseUrl}/functions/v1/chatbot-webhook?company_id=${whCompanyId}&user_id=${userId}`;
              try {
                await fetch(`${inst.server_url}/webhook`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json", token: inst.instance_token },
                  body: JSON.stringify({ url: refreshWebhookUrl, enabled: true, active: true, byApi: true, addUrlEvents: true, addUrlTypesMessages: true, excludeMessages: ["wasSentByApi", "isGroupYes"], events: ["connection", "messages", "messages_update", "presence"] }),
                });
                console.log("[whatsapp-manage] qrcode: webhook refreshed for already-connected instance");
              } catch (_e) {}
              // Update webhook URL in DB
              await adminClient.from("whatsapp_instances").update({ webhook_url: refreshWebhookUrl, last_connection_at: new Date().toISOString() }).eq("user_id", userId);
              return new Response(JSON.stringify({ connected: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
            // If API says NOT connected, update DB and proceed to QR code flow
            console.log("[whatsapp-manage] qrcode: DB says connected but API says disconnected, proceeding to reconnect");
            await adminClient.from("whatsapp_instances").update({ status: "disconnected", is_connected: false }).eq("user_id", userId);
          }
        } catch (_e) {
          console.error("[whatsapp-manage] qrcode: failed to verify instance status:", _e);
        }
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
        // Resolve company_id for webhook
        let whCompanyId = "";
        try {
          const { data: mRow } = await adminClient
            .from("company_memberships")
            .select("company_id")
            .eq("user_id", userId)
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();
          whCompanyId = mRow?.company_id || "";
        } catch (_e) {}

        const newWebhookUrl = `${supabaseUrl}/functions/v1/chatbot-webhook?company_id=${whCompanyId}&user_id=${userId}`;

        await adminClient
          .from("whatsapp_instances")
          .update({ status: "connected", is_connected: true, last_connection_at: new Date().toISOString(), webhook_url: newWebhookUrl })
          .eq("user_id", userId);

        // Re-register webhook on the WhatsApp API
        try {
          await fetch(`${inst.server_url}/webhook`, {
            method: "POST",
            headers: { "Content-Type": "application/json", token: inst.instance_token },
            body: JSON.stringify({
              url: newWebhookUrl,
              enabled: true,
              active: true,
              byApi: true,
              addUrlEvents: true,
              addUrlTypesMessages: true,
              excludeMessages: ["wasSentByApi", "isGroupYes"],
              events: ["connection", "messages", "messages_update", "presence", "call", "contacts", "groups", "labels", "chats", "chat_labels", "blocks", "leads", "history", "sender"],
            }),
          });
          console.log("[whatsapp-manage] Webhook re-registered on connect");
        } catch (_whErr: any) {
          console.error("[whatsapp-manage] Webhook re-register failed:", _whErr?.message);
        }

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
    // ACTION: profile-picture
    // =========================================================
    if (action === "profile-picture") {
      const { data: inst } = await adminClient
        .from("whatsapp_instances")
        .select("server_url, instance_token, is_connected")
        .eq("user_id", userId)
        .maybeSingle();

      if (!inst || !inst.is_connected) {
        return new Response(
          JSON.stringify({ profile_picture: null }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let pic: string | null = null;
      let name: string | null = null;
      let phone: string | null = null;

      try {
        // Try fetching profile info from /instance endpoint
        const res = await fetch(`${inst.server_url}/instance`, {
          method: "GET",
          headers: { "Content-Type": "application/json", token: inst.instance_token },
        });
        if (res.ok) {
          const info = await res.json();
          console.log("[whatsapp-manage] profile-picture /instance response keys:", JSON.stringify(Object.keys(info || {})));
          if (info?.instance) {
            console.log("[whatsapp-manage] instance sub-keys:", JSON.stringify(Object.keys(info.instance)));
          }
          pic = info?.instance?.profilePicUrl || info?.profilePicUrl || info?.instance?.imgUrl || info?.imgUrl || info?.instance?.profilePictureUrl || info?.profilePictureUrl || null;
          name = info?.instance?.profileName || info?.profileName || info?.instance?.pushname || info?.pushname || info?.instance?.name || null;
          phone = info?.instance?.owner || info?.owner || info?.instance?.wuid || info?.wuid || info?.instance?.me?.id || null;
        }
      } catch (e: any) {
        console.error("[whatsapp-manage] profile-picture /instance error:", e.message);
      }

      // Try /instance/me or /me endpoint as fallback
      if (!pic) {
        try {
          const meRes = await fetch(`${inst.server_url}/instance/me`, {
            method: "GET",
            headers: { "Content-Type": "application/json", token: inst.instance_token },
          });
          if (meRes.ok) {
            const meInfo = await meRes.json();
            console.log("[whatsapp-manage] profile-picture /instance/me response:", JSON.stringify(meInfo).substring(0, 500));
            pic = meInfo?.profilePicUrl || meInfo?.profilePictureUrl || meInfo?.imgUrl || meInfo?.picture || meInfo?.image || null;
            if (!name) name = meInfo?.pushname || meInfo?.profileName || meInfo?.name || null;
            if (!phone) phone = meInfo?.id || meInfo?.wuid || meInfo?.owner || null;
          }
        } catch (_e) {
          // silent fallback
        }
      }

      // Try /profilePicture endpoint as another fallback
      if (!pic && phone) {
        try {
          const cleanPhone = phone.replace(/@.*/, "");
          const ppRes = await fetch(`${inst.server_url}/profilePicture/${cleanPhone}`, {
            method: "GET",
            headers: { "Content-Type": "application/json", token: inst.instance_token },
          });
          if (ppRes.ok) {
            const ppInfo = await ppRes.json();
            console.log("[whatsapp-manage] profile-picture /profilePicture response:", JSON.stringify(ppInfo).substring(0, 500));
            pic = ppInfo?.profilePictureUrl || ppInfo?.profilePicUrl || ppInfo?.imgUrl || ppInfo?.url || ppInfo?.picture || null;
          }
        } catch (_e) {
          // silent fallback
        }
      }

      return new Response(
        JSON.stringify({ profile_picture: pic, profile_name: name, phone }),
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

    // =========================================================
    // ACTION: resync-webhook
    // =========================================================
    if (action === "resync-webhook") {
      const { data: inst } = await adminClient
        .from("whatsapp_instances")
        .select("server_url, instance_token, is_connected, webhook_url")
        .eq("user_id", userId)
        .maybeSingle();

      if (!inst) {
        return new Response(
          JSON.stringify({ error: "Nenhuma instância encontrada" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Step 1: Validate actual connection status via API
      let realConnected = false;
      let apiStatusRaw = "";
      try {
        const statusRes = await fetch(`${inst.server_url}/instance`, {
          method: "GET",
          headers: { "Content-Type": "application/json", token: inst.instance_token },
        });
        if (statusRes.ok) {
          const statusInfo = await statusRes.json();
          apiStatusRaw = JSON.stringify(statusInfo).substring(0, 500);
          realConnected = statusInfo?.instance?.status === "connected" ||
            statusInfo?.connected === true ||
            statusInfo?.instance?.state === "open";
          console.log("[whatsapp-manage] resync: real connection status =", realConnected, apiStatusRaw);
        } else if (statusRes.status === 401) {
          console.log("[whatsapp-manage] resync: token invalid (401)");
          apiStatusRaw = `401 from ${inst.server_url}/instance`;
        } else {
          const errText = await statusRes.text();
          apiStatusRaw = `${statusRes.status}: ${errText.substring(0, 200)}`;
          console.log("[whatsapp-manage] resync: unexpected status:", apiStatusRaw);
        }
      } catch (e: any) {
        console.error("[whatsapp-manage] resync: status check failed:", e.message);
        apiStatusRaw = `Error: ${e.message}`;
      }

      // Step 2: Update DB with real status
      await adminClient
        .from("whatsapp_instances")
        .update({
          is_connected: realConnected,
          status: realConnected ? "connected" : "disconnected",
          ...(realConnected ? { last_connection_at: new Date().toISOString() } : {}),
        })
        .eq("user_id", userId);

      // Step 3: Re-register webhook
      let webhookRegistered = false;
      let webhookResponse = "";
      let currentWebhookOnApi = "";
      if (realConnected) {
        let whCompanyId = "";
        try {
          const { data: mRow } = await adminClient
            .from("company_memberships")
            .select("company_id")
            .eq("user_id", userId)
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();
          whCompanyId = mRow?.company_id || "";
        } catch (_e) {}

        const webhookUrl = `${supabaseUrl}/functions/v1/chatbot-webhook?company_id=${whCompanyId}&user_id=${userId}`;

        try {
          // Step 3a: Check current webhook config on the API
          try {
            const getWhRes = await fetch(`${inst.server_url}/webhook`, {
              method: "GET",
              headers: { "Content-Type": "application/json", token: inst.instance_token },
            });
            if (getWhRes.ok) {
              const whConfig = await getWhRes.json();
              currentWebhookOnApi = JSON.stringify(whConfig).substring(0, 500);
              console.log("[whatsapp-manage] resync: current webhook config on API:", currentWebhookOnApi);
            }
          } catch (_checkErr) {
            console.log("[whatsapp-manage] resync: could not check current webhook config");
          }

          // Step 3b: Register webhook
          const whRes = await fetch(`${inst.server_url}/webhook`, {
            method: "POST",
            headers: { "Content-Type": "application/json", token: inst.instance_token },
            body: JSON.stringify({
              url: webhookUrl,
              enabled: true,
              active: true,
              byApi: true,
              addUrlEvents: true,
              addUrlTypesMessages: true,
              excludeMessages: ["wasSentByApi", "isGroupYes"],
              events: ["connection", "messages", "messages_update", "presence", "call", "contacts", "groups", "labels", "chats", "chat_labels", "blocks", "leads", "history", "sender"],
            }),
          });
          webhookResponse = await whRes.text();
          webhookRegistered = whRes.ok;
          console.log(`[whatsapp-manage] resync: webhook re-registered: ${whRes.status} body=${webhookResponse.substring(0, 300)}`);

          // Step 3c: Verify webhook was saved by checking again
          try {
            const verifyRes = await fetch(`${inst.server_url}/webhook`, {
              method: "GET",
              headers: { "Content-Type": "application/json", token: inst.instance_token },
            });
            if (verifyRes.ok) {
              const verifyConfig = await verifyRes.json();
              const savedUrl = verifyConfig?.url || verifyConfig?.webhook?.url || "";
              const isEnabled = verifyConfig?.enabled !== false && verifyConfig?.webhook?.enabled !== false;
              console.log(`[whatsapp-manage] resync: webhook verify - url="${savedUrl}" enabled=${isEnabled}`);
              if (savedUrl && !savedUrl.includes("chatbot-webhook")) {
                console.error("[whatsapp-manage] resync: WARNING - webhook URL on API does NOT point to our chatbot-webhook!");
                webhookRegistered = false;
              }
            }
          } catch (_verifyErr) {
            console.log("[whatsapp-manage] resync: could not verify webhook after registration");
          }

          // Update webhook URL in DB
          await adminClient
            .from("whatsapp_instances")
            .update({ webhook_url: webhookUrl })
            .eq("user_id", userId);
        } catch (whErr: any) {
          console.error("[whatsapp-manage] resync: webhook registration failed:", whErr.message);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          connected: realConnected,
          webhook_registered: webhookRegistered,
          webhook_url: realConnected ? `${supabaseUrl}/functions/v1/chatbot-webhook?company_id=...&user_id=${userId}` : null,
          api_status: apiStatusRaw.substring(0, 200),
          debug: {
            current_webhook_on_api: currentWebhookOnApi.substring(0, 200),
            registration_response: webhookResponse.substring(0, 200),
          },
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
