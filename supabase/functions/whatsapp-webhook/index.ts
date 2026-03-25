import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const userId = url.searchParams.get("user_id");

  if (!userId) {
    console.error("[whatsapp-webhook] Missing user_id in query string");
    return new Response(JSON.stringify({ error: "user_id is required" }), { status: 400 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    console.log(`[whatsapp-webhook] Received event for user ${userId}:`, JSON.stringify(body));

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Identifica status de conexão baseado nos campos da uazapi
    const isConnected = 
      body.event === "connection" || 
      body.status === "CONNECTED" || 
      body.connected === true ||
      body.instance?.status === "connected";

    const isDisconnected = 
      body.event === "disconnected" || 
      body.status === "DISCONNECTED" || 
      body.connected === false ||
      body.instance?.status === "disconnected";

    if (isConnected) {
      console.log(`[whatsapp-webhook] User ${userId} CONNECTED`);
      await adminClient.from("whatsapp_instances")
        .update({ 
          status: "connected", 
          is_connected: true, 
          last_connection_at: new Date().toISOString() 
        })
        .eq("user_id", userId);
    } else if (isDisconnected) {
      console.log(`[whatsapp-webhook] User ${userId} DISCONNECTED`);
      await adminClient.from("whatsapp_instances")
        .update({ 
          status: "disconnected", 
          is_connected: false 
        })
        .eq("user_id", userId);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[whatsapp-webhook] Error processing webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});