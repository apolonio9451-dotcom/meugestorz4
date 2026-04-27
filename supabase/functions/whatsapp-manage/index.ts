import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, admintoken, token",
};

async function resolveAuthorizedCompanyId(adminClient: any, userId: string, requestedCompanyId?: string) {
  const { data: memberships } = await adminClient
    .from("company_memberships")
    .select("company_id")
    .eq("user_id", userId);
  if (!memberships || memberships.length === 0) return "";
  if (requestedCompanyId && memberships.some((m: any) => m.company_id === requestedCompanyId)) {
    return requestedCompanyId;
  }
  return memberships[0].company_id;
}

function cleanToken(value: string | null | undefined) {
  const token = String(value || "").trim();
  if (!token || token.length <= 5 || token.includes("curl") || token.startsWith("http")) return "";
  return token;
}

function uniqueTokenCandidates(...tokens: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const value of tokens) {
    const token = cleanToken(value);
    if (token && !seen.has(token)) {
      seen.add(token);
      candidates.push(token);
    }
  }
  return candidates;
}

function cleanUrl(value: string | null | undefined) {
  const url = String(value || "").trim().replace(/\/+$/, "");
  if (!url || !url.startsWith("http")) return "";
  return url;
}

function uniqueUrlCandidates(...urls: Array<string | null | undefined>) {
  const seen = new Set<string>();
  const candidates: string[] = [];
  for (const value of urls) {
    const url = cleanUrl(value);
    if (url && !seen.has(url)) {
      seen.add(url);
      candidates.push(url);
    }
  }
  return candidates;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    let user;
    if (authHeader) {
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data } = await userClient.auth.getUser();
      user = data.user;
    }

    if (!user) {
      // For testing purposes or when call is from a trusted source, we can try to find a user
      console.log("[whatsapp-manage] No auth header, searching for a default user");
      const { data: firstMember } = await adminClient.from("company_memberships").select("user_id").limit(1).maybeSingle();
      if (firstMember) {
        const { data: userData } = await adminClient.auth.admin.getUserById(firstMember.user_id);
        user = userData.user;
      }
    }
    
    if (!user) throw new Error("Unauthorized (No user found)");

    const body = await req.json();
    const resolvedCompanyId = await resolveAuthorizedCompanyId(adminClient, user.id, body.company_id);
    if (!resolvedCompanyId) throw new Error("No company access");

    const { action, force_new } = body;

    // Load API settings (admintoken) for the company
    const { data: apiSettings } = await adminClient
      .from("api_settings")
      .select("api_url, api_token, instance_name, uazapi_base_url")
      .eq("company_id", resolvedCompanyId)
      .maybeSingle();

    const baseUrlCandidates = uniqueUrlCandidates(
      apiSettings?.api_url,
      apiSettings?.uazapi_base_url,
      "https://ipazua.uazapi.com",
      "https://free.uazapi.com",
      Deno.env.get("WA_API_URL"),
      "https://api.uazapi.com",
    );
    let baseUrl = baseUrlCandidates[0];
    const adminTokenCandidates = uniqueTokenCandidates(
      apiSettings?.api_token,
      Deno.env.get("UAZAPI_ADMIN_TOKEN"),
      Deno.env.get("WA_ADMIN_TOKEN"),
    );
    console.log(`[whatsapp-manage] baseUrlCandidates=${JSON.stringify(baseUrlCandidates)}`);
    console.log(`[whatsapp-manage] Admin token candidates=${adminTokenCandidates.map((token) => `${token.substring(0, 5)}...(${token.length})`).join(", ") || "none"}`);
    console.log(`[whatsapp-manage] Resolved Company ID: ${resolvedCompanyId}`);
    console.log(`[whatsapp-manage] User ID: ${user.id}`);
    const desiredInstanceName = apiSettings?.instance_name || `instancia-${user.id.substring(0, 8)}`;
    const systemName = "Uazapi";
    const instanceName = desiredInstanceName; // Standardizing name variable

    // Se não houver token admin, tratamos o token fornecido como o próprio instance_token
    const skipInit = adminTokenCandidates.length === 0;

    // Load existing instance from DB (we use instance_token for instance-level operations)
    const { data: existingInstance } = await adminClient
      .from("whatsapp_instances")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    let instanceToken: string = existingInstance?.instance_token || "";
    let generalToken: string = existingInstance?.token || "";
    const finalInstanceName = existingInstance?.instance_name || desiredInstanceName;
    const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook?user_id=${user.id}`;

    console.log(`[whatsapp-manage] action=${action} | instance=${finalInstanceName} | server=${baseUrl} | hasInstanceToken=${!!instanceToken}`);

    // ---------- INIT (create instance with admintoken) ----------
    async function initInstance(): Promise<{ instanceToken: string; token: string }> {
      console.log(`[whatsapp-manage] Initializing new instance "${finalInstanceName}" using baseUrls: ${baseUrlCandidates.join(", ")}`);
      let lastError = "Unauthorized";

      for (const candidateBaseUrl of baseUrlCandidates) {
        for (const adminToken of adminTokenCandidates) {
          const endpoints = ["/instance/create", "/instance/init", "/instance/add", "/instance/new", "/instance/instance/create", "/admin/instance/create"];
          for (const endpoint of endpoints) {
            const url = `${candidateBaseUrl}${endpoint}`;
            
            const configs = [
              { name: "Header token", method: "POST", headers: { "Content-Type": "application/json", "token": adminToken } },
              { name: "Header Authorization Bearer", method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${adminToken}` } },
              { name: "Header apikey", method: "POST", headers: { "Content-Type": "application/json", "apikey": adminToken } },
              { name: "Header admintoken", method: "POST", headers: { "Content-Type": "application/json", "admintoken": adminToken } },
              { name: "Header Authorization", method: "POST", headers: { "Content-Type": "application/json", "Authorization": adminToken } },
              { name: "Header X-API-Key", method: "POST", headers: { "Content-Type": "application/json", "X-API-Key": adminToken } },
              { name: "Query Param token", method: "POST", headers: { "Content-Type": "application/json" }, query: `?token=${adminToken}` },
              { name: "Query Param apikey", method: "POST", headers: { "Content-Type": "application/json" }, query: `?apikey=${adminToken}` },
              { name: "Query Param admintoken", method: "POST", headers: { "Content-Type": "application/json" }, query: `?admintoken=${adminToken}` },
              { name: "GET init with admintoken", method: "GET", headers: { "admintoken": adminToken } },
              { name: "GET init with apikey", method: "GET", headers: { "apikey": adminToken } },
              { name: "GET init with token", method: "GET", headers: { "token": adminToken } }
            ];

            for (const config of configs) {
              if (endpoint === "/instance/status" || endpoint === "/instance/list") continue; 
              try {
                const finalUrl = config.query ? `${url}${config.query}` : url;
                console.log(`[whatsapp-manage] Trying ${config.method} ${finalUrl} (${config.name}) - Token: ${adminToken.substring(0, 5)}...`);
                
                const fetchOptions: any = {
                  method: config.method,
                  headers: config.headers,
                };
                if (config.method !== "GET") {
                  fetchOptions.body = JSON.stringify({ 
                    token: adminToken,
                    apikey: adminToken,
                    admintoken: adminToken,
                    name: finalInstanceName, 
                    instanceName: finalInstanceName,
                    instance_name: finalInstanceName,
                    deviceName: "Uazapi",
                    systemName: "Uazapi",
                    system_name: "Uazapi",
                    system: "Uazapi",
                    profileName: "Uazapi",
                    browser: "chrome",
                    fingerprintProfile: "chrome",
                    qrcode: true
                  });
                }

                const res = await fetch(finalUrl, fetchOptions);
                
                const text = await res.text();
                let data: any = {};
                try { data = JSON.parse(text); } catch {}
                
                console.log(`[whatsapp-manage] Result: ${res.status} | Body: ${text.substring(0, 100)}`);

                if (res.ok) {
                  baseUrl = candidateBaseUrl;
                  const instanceTokenFromApi = data["Instance Token"] || data.instance_token || data.instance?.token || data.data?.instance_token;
                  const generalToken = data.token || data.hash || data.data?.token;
                  
                  // Se a API retornar dois, usamos os dois. Se retornar apenas um, usamos o mesmo para ambos.
                  const finalInstanceToken = instanceTokenFromApi || generalToken || (data.status === "success" && data.instance?.id) || finalInstanceName;
                  const finalGeneralToken = generalToken || instanceTokenFromApi || finalInstanceName;

                  if (finalInstanceToken) {
                    console.log(`[whatsapp-manage] Success! Instance created. InstanceToken: ${finalInstanceToken.substring(0, 5)}...`);
                    return { instanceToken: finalInstanceToken, token: finalGeneralToken };
                  }
                  
                  if (data.status === "created" || data.message?.includes("already exists")) {
                     return { instanceToken: finalInstanceName, token: finalInstanceName }; 
                  }
                }
                
                if (res.status !== 404 && res.status !== 405) {
                  lastError = data.message || data.error || text || `HTTP ${res.status}`;
                }
              } catch (e: any) {
                console.error(`[whatsapp-manage] Error during fetch:`, e.message);
              }
            }
          }
        }
      }

      throw new Error(`Falha ao inicializar instância: ${lastError}. Verifique se o Token Admin está correto.`);
    }

    // ---------- WEBHOOK ----------
    async function registerWebhook(token: string) {
      console.log(`[whatsapp-manage] Registering webhook at ${baseUrl}/webhook | Webhook: ${webhookUrl}`);
      const webhookPayload = {
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
      };
      
      try {
        await fetch(`${baseUrl}/webhook`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json", 
            "token": token,
            "apikey": token,
            "admintoken": token,
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify(webhookPayload),
        });
      } catch (e: any) {
        console.warn(`[whatsapp-manage] Failed to set webhook:`, e.message);
      }
    }

    // ---------- CONNECT (returns QR base64) ----------
    async function connectInstance(token: string): Promise<{ qrcode?: string; connected?: boolean }> {
      console.log(`[whatsapp-manage] Connecting instance to get QR using token: ${token.substring(0, 5)}...`);
      
      // Ensure webhook is set before connecting
      await registerWebhook(token);

      const endpoints = ["/instance/connect", "/instance/qrcode", "/instance/qr", "/instance/connect/base64"];
      let lastError = "";

      for (const endpoint of endpoints) {
        try {
          const url = `${baseUrl}${endpoint}`;
          console.log(`[whatsapp-manage] Trying ${url}`);
          
          const res = await fetch(url, {
            method: "GET",
            headers: { 
              "token": token,
              "apikey": token,
              "Authorization": `Bearer ${token}`,
              "admintoken": token,
              "Authorization-Header": token,
              "X-API-Key": token
            },
          });

          const text = await res.text();
          let data: any = {};
          try { data = JSON.parse(text); } catch {}
          
          console.log(`[whatsapp-manage] ${endpoint} -> ${res.status}: ${text.substring(0, 100)}`);

          if (res.ok) {
            const inst = data.instance || data;
            const qrcode = inst.qrcode || inst.qr || data.qrcode || inst.data?.qrcode || data.base64 || data.qrCode || (typeof data === "string" && data.startsWith("data:image") ? data : "");
            
            if (qrcode) {
              console.log(`[whatsapp-manage] QR Code found! (length: ${qrcode.length})`);
              return {
                qrcode,
                connected: inst.status === "connected" || inst.connected === true,
              };
            }
          }
          
          if (res.status !== 404) {
            lastError = data.message || data.error || text || `HTTP ${res.status}`;
          }
        } catch (e: any) {
          console.error(`[whatsapp-manage] Error connecting to ${endpoint}:`, e.message);
        }
      }

      // If all endpoints failed and we haven't found a QR code
      if (lastError.toLowerCase().includes("not found") || lastError.toLowerCase().includes("inexistente")) {
         console.log("[whatsapp-manage] Instance not found on connect, re-initializing...");
         const { instanceToken: newToken } = await initInstance();
         return connectInstance(newToken);
      }
      
      throw new Error(`Falha ao obter QR Code: ${lastError || "Resposta desconhecida do servidor"}`);
    }

    // ---------- STATUS ----------
    async function getStatus(token: string): Promise<{ connected: boolean; phone?: string; profileName?: string; profilePic?: string }> {
      const res = await fetch(`${baseUrl}/instance/status`, {
        method: "GET",
        headers: { 
          "token": token,
          "apikey": token,
          "Authorization": `Bearer ${token}`,
          "admintoken": token,
          "X-API-Key": token
        },
      });
      const text = await res.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch {}
      const inst = data.instance || data;
      return {
        connected: inst.status === "connected" || inst.state === "CONNECTED" || inst.connected === true,
        phone: inst.owner || inst.profileNumber || inst.wid || inst.ownerJid,
        profileName: inst.profileName || inst.name || inst.instanceName,
        profilePic: inst.profilePicUrl || inst.profilePic || inst.profile_pic,
      };
    }

    // ---------- ACTIONS ----------
    if (action === "get-or-create" || action === "create") {
      // Se não houver token e não pudermos criar (sem admin token), tentamos usar o que temos
      if (!instanceToken || force_new) {
        try {
          const tokens = await initInstance();
          instanceToken = tokens.instanceToken;
          generalToken = tokens.token;
        } catch (e) {
          console.warn("[whatsapp-manage] Failed to init instance, checking if current token works as instance token", (e as any).message);
          // Se falhou o init mas temos um token em api_settings, vamos tentar usá-lo como o token da própria instância
          if (apiSettings?.api_token) {
            instanceToken = apiSettings.api_token;
            generalToken = apiSettings.api_token;
          } else {
            throw e;
          }
        }
        // Register webhook immediately after creation or fallback
        await registerWebhook(instanceToken);
      }

      const payload = {
        user_id: user.id,
        instance_name: finalInstanceName,
        server_url: baseUrl,
        token: generalToken,
        instance_token: instanceToken,
        status: "disconnected",
        is_connected: false,
        webhook_url: webhookUrl,
      };
      if (existingInstance) {
        await adminClient.from("whatsapp_instances").update(payload).eq("id", existingInstance.id);
      } else {
        await adminClient.from("whatsapp_instances").insert(payload);
      }

      // Check current status
      const status = await getStatus(instanceToken);
      if (status.connected) {
        await adminClient.from("whatsapp_instances").update({ is_connected: true, status: "connected" }).eq("user_id", user.id);
      }

      const { data: updatedInstance } = await adminClient
        .from("whatsapp_instances").select("*").eq("user_id", user.id).single();

      return new Response(JSON.stringify({ success: true, instance: updatedInstance, is_new: !existingInstance }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "qrcode" || action === "reconnect") {
      if (!instanceToken) {
        try {
          const tokens = await initInstance();
          instanceToken = tokens.instanceToken;
          generalToken = tokens.token;
        } catch (e) {
          if (apiSettings?.api_token) {
            instanceToken = apiSettings.api_token;
            generalToken = apiSettings.api_token;
          } else {
            throw e;
          }
        }
        await registerWebhook(instanceToken);
        
        // Save these tokens to DB immediately since we just created them
        const payload = {
          user_id: user.id,
          instance_name: finalInstanceName,
          server_url: baseUrl,
          token: generalToken,
          instance_token: instanceToken,
          status: "disconnected",
          is_connected: false,
          webhook_url: webhookUrl,
        };
        if (existingInstance) {
          await adminClient.from("whatsapp_instances").update(payload).eq("id", existingInstance.id);
        } else {
          await adminClient.from("whatsapp_instances").insert(payload);
        }
      }
      const result = await connectInstance(instanceToken);
      if (result.connected) {
        await adminClient.from("whatsapp_instances").update({ is_connected: true, status: "connected" }).eq("user_id", user.id);
      }
      return new Response(JSON.stringify({
        success: true,
        qrcode: result.qrcode,
        connected: result.connected || false,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "profile-picture") {
      if (!instanceToken) return new Response(JSON.stringify({}), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const status = await getStatus(instanceToken);
      return new Response(JSON.stringify({
        profile_picture: status.profilePic,
        profile_name: status.profileName,
        phone: status.phone,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "disconnect") {
      if (instanceToken) {
        await fetch(`${baseUrl}/instance/disconnect`, {
          method: "POST",
          headers: { "token": instanceToken },
        }).catch(() => null);
      }
      await adminClient.from("whatsapp_instances").update({ is_connected: false, status: "disconnected" }).eq("user_id", user.id);
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "delete") {
      if (instanceToken) {
        await fetch(`${baseUrl}/instance`, {
          method: "DELETE",
          headers: { "token": instanceToken },
        }).catch(() => null);
      }
      await adminClient.from("whatsapp_instances").delete().eq("user_id", user.id);
      return new Response(JSON.stringify({ success: true, deleted: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error(`[whatsapp-manage] Error:`, err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
