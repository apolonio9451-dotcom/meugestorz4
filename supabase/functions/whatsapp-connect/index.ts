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

    // Collect and validate API keys — filter out anything that isn't a clean token
    const rawKeys = [
      Deno.env.get("UAZAPI_ADMIN_TOKEN")?.trim(),
      Deno.env.get("EVOLUTI_TOKEN")?.trim(),
    ];

    const candidateApiKeys = Array.from(
      new Set(
        rawKeys.filter((key): key is string => {
          if (!key || key.length === 0) return false;
          // Reject values that look like curl commands or URLs
          if (key.toLowerCase().startsWith("curl ")) {
            console.warn("[whatsapp-connect] UAZAPI_ADMIN_TOKEN contém um comando curl em vez de um token. Ignorando.");
            return false;
          }
          if (key.startsWith("http://") || key.startsWith("https://")) {
            console.warn("[whatsapp-connect] Token parece ser uma URL. Ignorando.");
            return false;
          }
          return true;
        })
      )
    );

    if (candidateApiKeys.length === 0) {
      throw new Error("Nenhuma chave de API válida configurada. Verifique o UAZAPI_ADMIN_TOKEN nas configurações de secrets.");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Generate unique instance name using company_id suffix
    const uniqueSuffix = company_id ? company_id.substring(0, 8) : Date.now().toString(36);
    const instanceDisplayName = userName || "Minha Instância";
    const uniqueInstanceName = `inst_${uniqueSuffix}_${Date.now().toString(36)}`;

    // If company already has a token, clear it before creating a new instance
    if (company_id) {
      await supabaseAdmin
        .from("api_settings")
        .update({ [tokenColumn]: "", [`${isBroadcast ? "broadcast_" : ""}instance_name`]: "" })
        .eq("company_id", company_id);
    }

    // 1. Criar instância via UAZAPI (fallback entre chaves)
    let instanceToken: string | null = null;
    let instanceId: string | null = null;
    let lastCreateError = "Erro ao criar instância";

    console.log(`[whatsapp-connect] Tentando ${candidateApiKeys.length} chave(s). Scope: ${scope || "main"}. Nome único: ${uniqueInstanceName}`);

    for (let ki = 0; ki < candidateApiKeys.length; ki++) {
      const apiKey = candidateApiKeys[ki];
      const maskedKey = apiKey.length > 8 ? apiKey.substring(0, 8) + "..." : "***";
      console.log(`[whatsapp-connect] Tentativa ${ki + 1}/${candidateApiKeys.length} — chave: ${maskedKey}`);

      try {
        const createRes = await fetch(`${UAZAPI_URL}/instance/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "AdminToken": apiKey },
          body: JSON.stringify({
            name: uniqueInstanceName,
          }),
        });

        const rawText = await createRes.text();
        console.log(`[whatsapp-connect] HTTP ${createRes.status} — Body: ${rawText.substring(0, 500)}`);

        let payload: any;
        try {
          payload = JSON.parse(rawText);
        } catch {
          payload = { error: rawText };
        }

        if (createRes.ok && payload.token) {
          instanceToken = payload.token;
          instanceId = payload.instanceId || payload.id || null;
          break;
        }

        // Build human-readable error
        const apiError = payload?.error || payload?.message || `HTTP ${createRes.status}`;
        
        if (createRes.status === 401 || createRes.status === 403) {
          lastCreateError = `Token de Admin inválido ou sem permissão (HTTP ${createRes.status}). Verifique o UAZAPI_ADMIN_TOKEN.`;
        } else if (createRes.status === 404) {
          lastCreateError = `Endpoint não encontrado (HTTP 404). Verifique a URL da API.`;
        } else if (createRes.status === 409) {
          lastCreateError = `Instância com nome duplicado. Tente novamente.`;
        } else if (createRes.status >= 500) {
          lastCreateError = `Servidor UAZAPI fora do ar (HTTP ${createRes.status}). Tente novamente mais tarde.`;
        } else {
          lastCreateError = `Erro da API: ${apiError}`;
        }

        // Only try next key if it's an auth issue
        if (createRes.status !== 401 && createRes.status !== 403) {
          break;
        }
      } catch (fetchErr: any) {
        console.error(`[whatsapp-connect] Erro de rede na tentativa ${ki + 1}:`, fetchErr.message);
        lastCreateError = `Erro de conexão com o servidor UAZAPI: ${fetchErr.message}`;
      }
    }

    if (!instanceToken) {
      throw new Error(lastCreateError);
    }

    console.log(`[whatsapp-connect] Instância criada. Token: ${instanceToken.substring(0, 8)}...`);

    // Auto-save token to DB
    if (company_id) {
      const updateData: Record<string, string> = {
        [tokenColumn]: instanceToken,
        [`${isBroadcast ? "broadcast_" : ""}instance_name`]: uniqueInstanceName,
      };

      const { error: upsertError } = await supabaseAdmin
        .from("api_settings")
        .upsert({ company_id, ...updateData }, { onConflict: "company_id" });

      if (upsertError) {
        console.error("[whatsapp-connect] Erro ao salvar token no DB:", upsertError.message);
      } else {
        console.log("[whatsapp-connect] Token salvo automaticamente no banco de dados.");
      }
    }

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
