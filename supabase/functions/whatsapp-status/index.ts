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

    // UAZAPI pode retornar status em formatos diferentes (string, booleans e objeto status)
    const instance = data?.instance || data;
    const statusObject =
      typeof data?.status === "object" && data?.status !== null
        ? data.status
        : typeof instance?.status === "object" && instance?.status !== null
          ? instance.status
          : null;

    const normalizedState = [data?.status, instance?.status, data?.state, instance?.state]
      .filter((value) => typeof value === "string")
      .map((value) => String(value).toLowerCase());

    const isConnected =
      normalizedState.some((value) => ["connected", "open", "online", "ready", "authenticated"].includes(value)) ||
      data?.connected === true ||
      instance?.connected === true ||
      statusObject?.connected === true ||
      statusObject?.loggedIn === true ||
      Boolean(statusObject?.jid);

    const qrCode = data?.qrcode || instance?.qrcode || data?.qr || instance?.qr || null;
    const rawPhone = data?.phone || instance?.phone || data?.owner || instance?.owner || statusObject?.jid || null;
    const phoneNumber = typeof rawPhone === "string" ? rawPhone.split(":")[0] : rawPhone;
    const profileName = data?.name || instance?.name || data?.pushname || instance?.pushname || data?.profileName || instance?.profileName || null;
    const profilePic =
      data?.profilePic ||
      instance?.profilePic ||
      data?.profilePictureUrl ||
      instance?.profilePictureUrl ||
      data?.profilePicUrl ||
      instance?.profilePicUrl ||
      null;
    const instanceId = data?.instanceId || instance?.id || data?.id || null;

    console.log("Parsed status:", { isConnected, hasQr: !!qrCode, phoneNumber, profileName, instanceId });

    return new Response(
      JSON.stringify({
        connected: isConnected,
        status: isConnected ? "connected" : (qrCode ? "connecting" : "disconnected"),
        qrCode,
        phoneNumber,
        profileName,
        profilePic,
        instanceId,
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
