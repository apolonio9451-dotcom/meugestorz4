import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, admintoken, token",
};

const FIXED_SERVER_URL = "https://ipazua.uazapi.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const body = await req.json();
    const { action } = body;

    let { data: whatsApiInstance } = await adminClient
      .from("whats_api")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!whatsApiInstance && action !== "save-config") {
      throw new Error("Configuração do WhatsApp não encontrada. Configure primeiro nas configurações.");
    }

    if (action === "save-config") {
      const { name, instance_token } = body;
      const { data, error } = whatsApiInstance 
        ? await adminClient.from("whats_api").update({ name, instance_token, server_url: FIXED_SERVER_URL }).eq("id", whatsApiInstance.id).select().single()
        : await adminClient.from("whats_api").insert({ user_id: user.id, name, instance_token, server_url: FIXED_SERVER_URL }).select().single();
      
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, instance: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { server_url, instance_token } = whatsApiInstance;

    if (action === "qrcode" || action === "reconnect" || action === "get-or-create") {
      // Tentar primeiro com /instance/connect, se der 404, tentar sem o prefixo /instance
      let connectRes = await fetch(`${server_url}/instance/connect`, {
        method: "GET",
        headers: { "token": instance_token }
      });

      if (connectRes.status === 404) {
        connectRes = await fetch(`${server_url}/connect`, {
          method: "GET",
          headers: { "token": instance_token }
        });
      }

      if (!connectRes.ok) {
        const errorText = await connectRes.text();
        return new Response(JSON.stringify({ success: false, error: errorText }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const connectData = await connectRes.json();
      const isConnected = connectData.instance?.status === "connected" || connectData.connected === true || connectData.state === "CONNECTED";
      const qrcode = connectData.qrcode || connectData.base64 || connectData.instance?.qrcode;

      await adminClient
        .from("whats_api")
        .update({ is_connected: isConnected, status: isConnected ? "connected" : "disconnected" })
        .eq("id", whatsApiInstance.id);

      return new Response(JSON.stringify({
        success: true,
        qrcode,
        connected: isConnected,
        instance: { ...whatsApiInstance, is_connected: isConnected, status: isConnected ? "connected" : "disconnected" }
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "delete") {
      await adminClient.from("whats_api").delete().eq("user_id", user.id);
      return new Response(JSON.stringify({ success: true, deleted: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ success: true, instance: whatsApiInstance }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: error.message === "Unauthorized" ? 401 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
