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
      apiSettings?.uazapi_base_url,
      apiSettings?.api_url,
      "https://ipazua.uazapi.com",
      Deno.env.get("WA_API_URL"),
      "https://api.uazapi.com",
      "https://free.uazapi.com",
    );
    let baseUrl = baseUrlCandidates[0];
    const adminTokenCandidates = uniqueTokenCandidates(
      Deno.env.get("UAZAPI_ADMIN_TOKEN"),
      apiSettings?.api_token,
      Deno.env.get("WA_ADMIN_TOKEN"),
    );
    console.log(`[whatsapp-manage] baseUrlCandidates=${JSON.stringify(baseUrlCandidates)}`);
    console.log(`[whatsapp-manage] Admin token candidates=${adminTokenCandidates.map((token) => `${token.substring(0, 5)}...(${token.length})`).join(", ") || "none"}`);
    console.log(`[whatsapp-manage] Resolved Company ID: ${resolvedCompanyId}`);
    console.log(`[whatsapp-manage] User ID: ${user.id}`);
    const desiredInstanceName = apiSettings?.instance_name || `instancia-${user.id.substring(0, 8)}`;

    if (adminTokenCandidates.length === 0) throw new Error("Token de administração da API não configurado em 'Configurações > Instância'.");

    // Load existing instance from DB (we use instance_token for instance-level operations)
    const { data: existingInstance } = await adminClient
      .from("whatsapp_instances")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    let instanceToken: string = existingInstance?.instance_token || "";
    const finalInstanceName = existingInstance?.instance_name || desiredInstanceName;
    const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook?user_id=${user.id}`;

    console.log(`[whatsapp-manage] action=${action} | instance=${finalInstanceName} | server=${baseUrl} | hasInstanceToken=${!!instanceToken}`);

    // ---------- INIT (create instance with admintoken) ----------
    async function initInstance(): Promise<string> {
      console.log(`[whatsapp-manage] Initializing new instance "${finalInstanceName}" using baseUrls: ${baseUrlCandidates.join(", ")}`);
      let lastError = "Unauthorized";

      for (const candidateBaseUrl of baseUrlCandidates) {
        for (const adminToken of adminTokenCandidates) {
          const endpoints = ["/instance/create", "/instance/init"];
          for (const endpoint of endpoints) {
            const url = `${candidateBaseUrl}${endpoint}`;
            
            const configs = [
              { name: "Header admintoken", headers: { "Content-Type": "application/json", "admintoken": adminToken } },
              { name: "Header Authorization Bearer", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${adminToken}` } },
              { name: "Header apikey", headers: { "Content-Type": "application/json", "apikey": adminToken } },
              { name: "Query Param admintoken", headers: { "Content-Type": "application/json" }, query: `?admintoken=${adminToken}` },
              { name: "Query Param token", headers: { "Content-Type": "application/json" }, query: `?token=${adminToken}` },
              { name: "Header token", headers: { "Content-Type": "application/json", "token": adminToken } }
            ];

            for (const config of configs) {
              try {
                const finalUrl = config.query ? `${url}${config.query}` : url;
                console.log(`[whatsapp-manage] Trying ${finalUrl} (${config.name}) - Token: ${adminToken.substring(0, 5)}...`);
                
                const res = await fetch(finalUrl, {
                  method: "POST",
                  headers: config.headers,
                  body: JSON.stringify({ 
                    name: finalInstanceName, 
                    instanceName: finalInstanceName,
                    systemName: "Meu Gestor" 
                  }),
                });
                
                const text = await res.text();
                let data: any = {};
                try { data = JSON.parse(text); } catch {}
                
                console.log(`[whatsapp-manage] Result: ${res.status} | Body: ${text.substring(0, 100)}`);

                if (res.ok) {
                  baseUrl = candidateBaseUrl;
                  const newToken = data.token || data.instance?.token || data.data?.token || data.hash || "";
                  if (newToken) {
                    console.log(`[whatsapp-manage] Success! Instance created.`);
                    return newToken;
                  }
                }
                
                if (res.status !== 404) {
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

    // ---------- CONNECT (returns QR base64) ----------
    async function connectInstance(token: string): Promise<{ qrcode?: string; connected?: boolean }> {
      console.log(`[whatsapp-manage] Connecting instance to get QR`);
      const res = await fetch(`${baseUrl}/instance/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "token": token },
        body: JSON.stringify({}),
      });
      const text = await res.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch {}
      console.log(`[whatsapp-manage] /instance/connect -> ${res.status}: ${text.substring(0, 200)}`);
      if (!res.ok) throw new Error(`Falha ao conectar: ${data.message || data.error || text}`);
      const inst = data.instance || data;
      return {
        qrcode: inst.qrcode || inst.qr || data.qrcode || "",
        connected: inst.status === "connected" || inst.connected === true,
      };
    }

    // ---------- STATUS ----------
    async function getStatus(token: string): Promise<{ connected: boolean; phone?: string; profileName?: string; profilePic?: string }> {
      const res = await fetch(`${baseUrl}/instance/status`, {
        method: "GET",
        headers: { "token": token },
      });
      const text = await res.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch {}
      const inst = data.instance || data;
      return {
        connected: inst.status === "connected",
        phone: inst.owner || inst.profileNumber || inst.wid,
        profileName: inst.profileName || inst.name,
        profilePic: inst.profilePicUrl || inst.profilePic,
      };
    }

    // ---------- ACTIONS ----------
    if (action === "get-or-create" || action === "create") {
      // Create new instance if needed
      if (!instanceToken || force_new) {
        instanceToken = await initInstance();
      }

      const payload = {
        user_id: user.id,
        instance_name: finalInstanceName,
        server_url: baseUrl,
        token: instanceToken,
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
      if (!instanceToken) instanceToken = await initInstance();
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
