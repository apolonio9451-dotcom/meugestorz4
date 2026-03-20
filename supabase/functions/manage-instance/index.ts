import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UAZAPI_BASE_URL = "https://ipazua.uazapi.com";

/** Returns the correct DB column names based on scope */
function scopeColumns(scope: string) {
  if (scope === "broadcast") {
    return { url: "broadcast_api_url", token: "broadcast_api_token", name: "broadcast_instance_name" };
  }
  return { url: "api_url", token: "api_token", name: "instance_name" };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const jwtToken = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } =
    await supabaseAuth.auth.getClaims(jwtToken);
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json();
    const { action, company_id, instance_token, scope: rawScope } = body;
    const scope = rawScope === "broadcast" ? "broadcast" : "main";
    const cols = scopeColumns(scope);

    if (!company_id) {
      return new Response(
        JSON.stringify({ error: "company_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==================== STATUS ====================
    if (action === "status") {
      const { data: apiSettings } = await supabaseAdmin
        .from("api_settings")
        .select(`${cols.token}, ${cols.name}`)
        .eq("company_id", company_id)
        .maybeSingle();

      const tkn = apiSettings?.[cols.token];
      if (!tkn) {
        return new Response(
          JSON.stringify({ success: true, has_instance: false, connected: false, qrcode: null }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const resp = await fetch(`${UAZAPI_BASE_URL}/instance/status`, {
        headers: { token: tkn },
      });

      if (!resp.ok) {
        const errText = await resp.text();
        console.error(`UAZAPI status failed: ${resp.status} - ${errText}`);
        return new Response(
          JSON.stringify({
            success: true, has_instance: true, connected: false, qrcode: null,
            error_detail: `Status check failed: ${resp.status}`,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await resp.json();
      const instance = data.instance || {};
      const status = data.status || {};
      const connected = status.connected === true || instance.status === "connected";
      const qrcode = instance.qrcode || null;

      return new Response(
        JSON.stringify({
          success: true, has_instance: true, connected,
          qrcode: qrcode || null,
          instance_name: instance.name || apiSettings[cols.name] || "",
          profile_name: instance.profileName || "",
          profile_pic: instance.profilePicUrl || "",
          owner: instance.owner || "",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==================== SAVE ====================
    if (action === "save") {
      if (!instance_token) {
        return new Response(
          JSON.stringify({ error: "instance_token is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const instanceName = body.instance_name || "";

      const { data: existing } = await supabaseAdmin
        .from("api_settings")
        .select("id")
        .eq("company_id", company_id)
        .maybeSingle();

      const payload: Record<string, string> = {
        company_id,
        [cols.url]: UAZAPI_BASE_URL,
        [cols.token]: instance_token,
        [cols.name]: instanceName,
      };
      // For main scope, also set uazapi_base_url
      if (scope === "main") {
        payload.uazapi_base_url = UAZAPI_BASE_URL;
      }

      if (existing) {
        await supabaseAdmin.from("api_settings").update(payload).eq("id", existing.id);
      } else {
        await supabaseAdmin.from("api_settings").insert(payload);
      }

      // Auto-configure webhook (only for main scope)
      let webhookUrl = "";
      if (scope === "main") {
        webhookUrl = `${supabaseUrl}/functions/v1/chatbot-webhook?company_id=${company_id}`;
        console.log(`Setting webhook: ${webhookUrl}`);
        try {
          const whResp = await fetch(`${UAZAPI_BASE_URL}/webhook`, {
            method: "POST",
            headers: { "Content-Type": "application/json", token: instance_token },
            body: JSON.stringify({ url: webhookUrl, enabled: true }),
          });
          if (!whResp.ok) {
            console.error("Webhook setup failed:", await whResp.text());
          } else {
            console.log("Webhook configured:", JSON.stringify(await whResp.json()));
          }
        } catch (whErr) {
          console.error("Webhook setup error:", whErr);
        }
      }

      let connected = false;
      let qrcode = null;
      let profileName = "";
      let profilePic = "";
      let owner = "";

      try {
        const statusResp = await fetch(`${UAZAPI_BASE_URL}/instance/status`, {
          headers: { token: instance_token },
        });
        if (statusResp.ok) {
          const statusData = await statusResp.json();
          const inst = statusData.instance || {};
          const st = statusData.status || {};
          connected = st.connected === true || inst.status === "connected";
          qrcode = inst.qrcode || null;
          profileName = inst.profileName || "";
          profilePic = inst.profilePicUrl || "";
          owner = inst.owner || "";
        }
      } catch (e) {
        console.error("Status check after save failed:", e);
      }

      return new Response(
        JSON.stringify({
          success: true, connected, qrcode,
          profile_name: profileName, profile_pic: profilePic, owner,
          webhook_url: webhookUrl,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==================== DISCONNECT ====================
    if (action === "disconnect") {
      const { data: apiSettings } = await supabaseAdmin
        .from("api_settings")
        .select(cols.token)
        .eq("company_id", company_id)
        .maybeSingle();

      const tkn = apiSettings?.[cols.token];
      if (tkn) {
        try {
          await fetch(`${UAZAPI_BASE_URL}/instance/logout`, {
            method: "DELETE",
            headers: { token: tkn },
          });
        } catch (e) {
          console.error("Logout failed:", e);
        }
      }

      return new Response(
        JSON.stringify({ success: true, message: "Disconnected" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ==================== DELETE (remove token from DB) ====================
    if (action === "delete") {
      const { data: apiSettings } = await supabaseAdmin
        .from("api_settings")
        .select("id")
        .eq("company_id", company_id)
        .maybeSingle();

      if (apiSettings) {
        await supabaseAdmin
          .from("api_settings")
          .update({ [cols.token]: "", [cols.name]: "" })
          .eq("id", apiSettings.id);
      }

      return new Response(
        JSON.stringify({ success: true, message: "Instance deleted" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use: status, save, disconnect, delete" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("manage-instance error:", err);
    return new Response(
      JSON.stringify({ error: err?.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
