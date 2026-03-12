import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { token } = await req.json();
    const UAZAPI_URL = "https://ipazua.uazapi.com";

    const statusRes = await fetch(`${UAZAPI_URL}/instance/status`, {
      method: "GET",
      headers: { token },
    });

    const data = await statusRes.json();

    return new Response(
      JSON.stringify({
        connected: data?.status === "connected",
        status: data?.status || "disconnected",
        qrCode: data?.qrcode || null,
        phoneNumber: data?.phone || null,
        profileName: data?.name || null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
