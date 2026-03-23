import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UAZAPI_URL = "https://ipazua.uazapi.com";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { userName, webhookUrl, company_id, scope } = await req.json();
    const isBroadcast = scope === "broadcast";
    const tokenColumn = isBroadcast ? "broadcast_api_token" : "api_token";

    const candidateApiKeys = Array.from(
      new Set([
        Deno.env.get("UAZAPI_ADMIN_TOKEN")?.trim(),
        Deno.env.get("EVOLUTI_TOKEN")?.trim(),
      ].filter((key): key is string => Boolean(key && key.length > 0)))
    );

    if (candidateApiKeys.length === 0) {
      throw new Error("Nenhuma chave de API configurada para criar instância");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // If company already has a token, clear it before creating a new instance
    if (company_id) {
      await supabaseAdmin
        .from("api_settings")
        .update({ [tokenColumn]: "", [`${isBroadcast ? "broadcast_" : ""}instance_name`]: "" })
        .eq("company_id", company_id);
    }

    // 1. Criar instância diretamente via UAZAPI (fallback entre chaves)
    let instanceToken: string | null = null;
    let instanceId: string | null = null;
    let lastCreateError = "Erro ao criar instância";

    console.log(`[whatsapp-connect] Tentando ${candidateApiKeys.length} chave(s). Scope: ${scope || "main"}`);

    for (let ki = 0; ki < candidateApiKeys.length; ki++) {
      const apiKey = candidateApiKeys[ki];
      console.log(`[whatsapp-connect] Tentativa ${ki + 1}/${candidateApiKeys.length} — chave: ${apiKey.substring(0, 8)}...`);

      try {
        const createRes = await fetch(`${UAZAPI_URL}/instance/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "AdminToken": apiKey },
          body: JSON.stringify({
            name: userName || "Minha Instância",
          }),
        });

        const payload = await createRes.json();
        console.log(`[whatsapp-connect] Resposta ${createRes.status}:`, JSON.stringify(payload).substring(0, 300));

        if (createRes.ok && payload.token) {
          instanceToken = payload.token;
          instanceId = payload.instanceId || payload.id || null;
          break;
        }

        lastCreateError = payload?.error || payload?.message || `Erro HTTP ${createRes.status}`;
        if (!String(lastCreateError).toLowerCase().includes("invalid") &&
            !String(lastCreateError).toLowerCase().includes("unauthorized")) {
          break;
        }
      } catch (fetchErr: any) {
        console.error(`[whatsapp-connect] Erro na tentativa ${ki + 1}:`, fetchErr.message);
        lastCreateError = fetchErr.message || "Erro de conexão com a API";
      }
    }

    if (!instanceToken) {
      throw new Error(lastCreateError);
    }

    console.log(`[whatsapp-connect] Instância criada. Token: ${instanceToken.substring(0, 8)}...`);

    // Set webhook if provided
    if (webhookUrl) {
      try {
        const whRes = await fetch(`${UAZAPI_URL}/webhook`, {
          method: "POST",
          headers: { "Content-Type": "application/json", token: instanceToken },
          body: JSON.stringify({ url: webhookUrl, enabled: true }),
        });
        const whBody = await whRes.text();
        console.log(`[whatsapp-connect] Webhook config: ${whRes.status} - ${whBody.substring(0, 100)}`);
      } catch (whErr: any) {
        console.error("[whatsapp-connect] Webhook setup error:", whErr.message);
      }
    }

    // 2. Conectar para gerar QR Code
    const connectRes = await fetch(`${UAZAPI_URL}/instance/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token: instanceToken },
      body: JSON.stringify({}),
    });

    const connectData = await connectRes.json();
    console.log(`[whatsapp-connect] Connect response:`, JSON.stringify(connectData).substring(0, 200));

    // 3. Polling: tenta até 5x buscar o QR Code
    let qrCode = connectData?.qrcode || null;
    if (!qrCode) {
      for (let i = 0; i < 5; i++) {
        await new Promise((r) => setTimeout(r, 3000));
        const statusRes = await fetch(`${UAZAPI_URL}/instance/status`, {
          method: "GET",
          headers: { token: instanceToken },
        });
        const statusData = await statusRes.json();
        const inst = statusData?.instance || statusData;
        qrCode = inst?.qrcode || statusData?.qrcode || null;

        if (statusData?.status === "connected" || inst?.status === "connected") {
          return new Response(
            JSON.stringify({ success: true, instanceId, token: instanceToken, qrCode: null, status: "connected" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (qrCode) break;
      }
    }

    return new Response(
      JSON.stringify({
        success: true, instanceId, token: instanceToken, qrCode,
        status: qrCode ? "connecting" : "waiting_qr",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[whatsapp-connect] Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
