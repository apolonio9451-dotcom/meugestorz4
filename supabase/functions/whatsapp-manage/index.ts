import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, admintoken, token",
};

const EXTERNAL_CREATE_INSTANCE_URL = "https://grlwciflaotripbumhve.supabase.co/functions/v1/create-instance-url";
const DEFAULT_API_TOKEN = "gDol2YGWrw81qVrNbjdXWl4DQuC3jhgWFyjP";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    const body = await req.json();
    const { action } = body;

    // 1. Verificar se já existe uma instância na tabela whats_api
    let { data: whatsApiInstance } = await adminClient
      .from("whats_api")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    // 2. Se não existir, criar usando o endpoint externo
    if (!whatsApiInstance) {
      console.log(`[whatsapp-manage] Criando nova instância para usuário ${user.id}`);
      const response = await fetch(EXTERNAL_CREATE_INSTANCE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: DEFAULT_API_TOKEN,
          name: `instancia-${user.id.substring(0, 8)}`,
          deviceName: "Meu Gestor"
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Falha ao criar instância no uazapi: ${errorText}`);
      }

      const result = await response.json();
      // Retorno esperado do uazapi: { server_url, "Instance Token", token, instance: { name, device_name } }
      
      const { data: newInstance, error: insertError } = await adminClient
        .from("whats_api")
        .insert({
          user_id: user.id,
          name: result.instance?.name || `instancia-${user.id.substring(0, 8)}`,
          device_name: result.instance?.device_name || "Meu Gestor",
          server_url: result.server_url,
          instance_token: result["Instance Token"],
          api_token: DEFAULT_API_TOKEN
        })
        .select()
        .single();

      if (insertError) throw insertError;
      whatsApiInstance = newInstance;
    }

    const { server_url, instance_token } = whatsApiInstance;

    // 3. Lógica de ações (QR Code, Status, etc.)
    if (action === "qrcode" || action === "reconnect") {
      console.log(`[whatsapp-manage] Obtendo QR Code para ${server_url}`);
      
      // Tentar conectar para obter QR Code
      const connectRes = await fetch(`${server_url}/instance/connect`, {
        method: "GET",
        headers: { "token": instance_token }
      });

      const connectData = await connectRes.json();
      const qrcode = connectData.instance?.qrcode || connectData.qrcode || connectData.base64;

      return new Response(JSON.stringify({
        success: true,
        qrcode: qrcode,
        connected: connectData.instance?.status === "connected" || connectData.connected === true,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "status") {
      const statusRes = await fetch(`${server_url}/instance/status`, {
        method: "GET",
        headers: { "token": instance_token }
      });
      const statusData = await statusRes.json();
      return new Response(JSON.stringify({ success: true, status: statusData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ success: true, instance: whatsApiInstance }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error(`[whatsapp-manage] Erro:`, error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: String(error.message).includes("Unauthorized") ? 401 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
