import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { userName, webhookUrl, company_id, scope } = await req.json();
    const isBroadcast = scope === "broadcast";
    const tokenColumn = isBroadcast ? "broadcast_api_token" : "api_token";

    const API_KEY = Deno.env.get("UAZAPI_ADMIN_TOKEN") || "10c3ab83-17ba-4921-ae88-c096ed1d0144";
    const SUPABASE_FUNCTIONS_URL = "https://xukeukdwhelyttifzveb.supabase.co/functions/v1";
    const UAZAPI_URL = "https://ipazua.uazapi.com";

    // Backend protection: check if company already has an instance for this scope
    if (company_id) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

      const { data: existing } = await supabaseAdmin
        .from("api_settings")
        .select(tokenColumn)
        .eq("company_id", company_id)
        .maybeSingle();

      if (existing?.[tokenColumn] && existing[tokenColumn].trim() !== "") {
        return new Response(
          JSON.stringify({ error: "Você já possui uma instância ativa. Remova a anterior antes de criar uma nova." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 1. Criar instância
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
        success: true, instanceId, token, qrCode,
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
