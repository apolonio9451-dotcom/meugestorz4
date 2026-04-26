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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const body = await req.json();
    const resolvedCompanyId = await resolveAuthorizedCompanyId(adminClient, user.id, body.company_id);
    if (!resolvedCompanyId) throw new Error("No company access");

    const { action, force_new } = body;

    // Load API settings (admintoken) for the company
    const { data: apiSettings } = await adminClient
      .from("api_settings")
      .select("api_url, api_token, instance_name")
      .eq("company_id", resolvedCompanyId)
      .maybeSingle();

    const baseUrl = (apiSettings?.api_url || "https://ipazua.uazapi.com").trim().replace(/\/$/, "");
    const adminTokenCandidates = uniqueTokenCandidates(
      Deno.env.get("UAZAPI_ADMIN_TOKEN"),
      Deno.env.get("WA_ADMIN_TOKEN"),
      Deno.env.get("BOLINHA_API_TOKEN"),
      Deno.env.get("EVOLUTI_TOKEN"),
      apiSettings?.api_token,
    );
    console.log(`[whatsapp-manage] Admin token candidates=${adminTokenCandidates.map((token) => `${token.substring(0, 5)}...(${token.length})`).join(", ") || "none"}`);
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
      console.log(`[whatsapp-manage] Initializing new instance "${finalInstanceName}"`);
      let lastError = "Unauthorized";

      for (const adminToken of adminTokenCandidates) {
        const res = await fetch(`${baseUrl}/instance/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "admintoken": adminToken },
          body: JSON.stringify({ name: finalInstanceName, systemName: "Meu Gestor" }),
        });
        const text = await res.text();
        let data: any = {};
        try { data = JSON.parse(text); } catch {}
        console.log(`[whatsapp-manage] /instance/create (${adminToken.substring(0, 5)}...) -> ${res.status}: ${text.substring(0, 300)}`);

        if (res.ok) {
          const newToken = data.token || data.instance?.token || data.data?.token || "";
          if (!newToken) throw new Error("Instância criada mas token não retornado pela API.");
          return newToken;
        }

        lastError = data.message || data.error || text || `HTTP ${res.status}`;
      }

      throw new Error(`Falha ao inicializar instância: ${lastError}. Confirme se o Token de Administrador pertence ao servidor ${baseUrl}.`);
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
