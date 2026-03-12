import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const payload = await req.json();

    const message = payload?.message || payload?.data?.message;
    const from = message?.from || payload?.from || "unknown";
    const text = message?.body || message?.text || message?.conversation || "";
    const messageType = message?.type || "unknown";
    const pushName = message?.pushName || payload?.pushName || "";

    console.log("📩 Mensagem recebida:", { from, text, messageType, pushName });

    return new Response(
      JSON.stringify({ success: true, received: { from, text, messageType, pushName } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
