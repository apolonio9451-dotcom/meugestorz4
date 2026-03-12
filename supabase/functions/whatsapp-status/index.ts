import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { token } = await req.json();
    const UAZAPI_URL = "https://ipazua.uazapi.com";

    console.log("Checking status with token:", token?.substring(0, 8) + "...");

    const statusRes = await fetch(`${UAZAPI_URL}/instance/status`, {
      method: "GET",
      headers: { token },
    });

    const rawText = await statusRes.text();
    console.log("UAZAPI raw response:", rawText);

    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      console.error("Failed to parse UAZAPI response");
      data = {};
    }

    // UAZAPI pode retornar o status em diferentes formatos
    const instance = data?.instance || data;
    const isConnected = 
      data?.status === "connected" || 
      instance?.status === "connected" ||
      data?.state === "open" ||
      instance?.state === "open";

    const qrCode = data?.qrcode || instance?.qrcode || data?.qr || instance?.qr || null;
    const phoneNumber = data?.phone || instance?.phone || data?.owner || instance?.owner || null;
    const profileName = data?.name || instance?.name || data?.pushname || instance?.pushname || null;
    const profilePic = data?.profilePic || instance?.profilePic || data?.profilePictureUrl || instance?.profilePictureUrl || null;

    console.log("Parsed status:", { isConnected, hasQr: !!qrCode, phoneNumber, profileName });

    return new Response(
      JSON.stringify({
        connected: isConnected,
        status: isConnected ? "connected" : (qrCode ? "connecting" : "disconnected"),
        qrCode,
        phoneNumber,
        profileName,
        profilePic,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Status check error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
