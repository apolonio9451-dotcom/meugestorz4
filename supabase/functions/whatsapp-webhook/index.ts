import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const userId = url.searchParams.get("user_id");

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "user_id ausente na query string" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    console.log(`[whatsapp-webhook] user_id=${userId} body=${JSON.stringify(body).substring(0, 300)}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Detect connection
    const isConnected =
      body.event === "connection" ||
      body.status === "CONNECTED" ||
      body.connected === true;

    // Detect disconnection
    const isDisconnected =
      body.event === "disconnected" ||
      body.status === "DISCONNECTED" ||
      body.connected === false;

    if (isConnected) {
      await adminClient
        .from("whats_api")
        .update({
          status: "connected",
          is_connected: true,
          last_connection_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
      console.log(`[whatsapp-webhook] User ${userId} → connected`);
    } else if (isDisconnected) {
      await adminClient
        .from("whats_api")
        .update({ status: "disconnected", is_connected: false })
        .eq("user_id", userId);
      console.log(`[whatsapp-webhook] User ${userId} → disconnected`);
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[whatsapp-webhook] Error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
