import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { userName, webhookUrl } = await req.json();
    const API_KEY = "10c3ab83-17ba-4921-ae88-c096ed1d0144";
    const SUPABASE_FUNCTIONS_URL = "https://xukeukdwhelyttifzveb.supabase.co/functions/v1";
    const UAZAPI_URL = "https://ipazua.uazapi.com";

    // 1. Criar instância com nome do usuário e webhook
    const createRes = await fetch(`${SUPABASE_FUNCTIONS_URL}/create-instance-external`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: API_KEY,
        name: userName || "Minha Instância",
        webhookUrl: webhookUrl || undefined,
        webhookName: webhookUrl ? "webhook-principal" : undefined,
        events: ["messages"],
      }),
    });

    const createData = await createRes.json();
    if (!createRes.ok) throw new Error(createData.error || "Erro ao criar instância");

    const { token, instanceId } = createData;

    // 2. Conectar para gerar QR Code
    const connectRes = await fetch(`${UAZAPI_URL}/instance/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token },
      body: JSON.stringify({}),
    });

    const connectData = await connectRes.json();

    // 3. Polling: tenta até 5x buscar o QR Code
    let qrCode = connectData?.qrcode || null;
    if (!qrCode) {
      for (let i = 0; i < 5; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const statusRes = await fetch(`${UAZAPI_URL}/instance/status`, {
          method: "GET",
          headers: { token },
        });
        const statusData = await statusRes.json();
        const inst = statusData?.instance || statusData;
        qrCode = inst?.qrcode || statusData?.qrcode || null;

        if (statusData?.status === "connected" || inst?.status === "connected") {
          return new Response(
            JSON.stringify({ success: true, instanceId, token, qrCode: null, status: "connected" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (qrCode) break;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        instanceId,
        token,
        qrCode,
        status: qrCode ? "connecting" : "waiting_qr",
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
