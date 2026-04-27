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
      const instanceName = `instancia-${user.id.substring(0, 8)}`;
      const deviceName = "Meu Gestor";

      const createPayload = {
        token: DEFAULT_API_TOKEN,
        name: instanceName,
        deviceName: deviceName,
        systemName: deviceName,
        system_name: deviceName,
        system: deviceName,
        profileName: deviceName,
        browser: "chrome",
        fingerprintProfile: "chrome",
      };

      const response = await fetch(EXTERNAL_CREATE_INSTANCE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createPayload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Falha ao criar instância no WhatsApi: ${errorText}`);
      }

      const result = await response.json();
      const serverUrl = result.server_url;
      const instanceToken = result["Instance Token"];
      
      // 2.1 Registrar Webhook automaticamente
      const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook?user_id=${user.id}`;
      console.log(`[whatsapp-manage] Registrando webhook: ${webhookUrl}`);
      
      try {
        await fetch(`${serverUrl}/webhook`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "token": instanceToken,
          },
          body: JSON.stringify({
            url: webhookUrl,
            enabled: true,
            active: true,
            byApi: true,
            addUrlEvents: true,
            addUrlTypesMessages: true,
            excludeMessages: ["wasSentByApi", "isGroupYes"],
            events: [
              "connection", "messages", "messages_update", "presence",
              "call", "contacts", "groups", "labels", "chats",
              "chat_labels", "blocks", "leads", "history", "sender",
            ],
          }),
        });
      } catch (e: any) {
        console.warn(`[whatsapp-manage] Falha ao registrar webhook:`, e.message);
      }
      
      const { data: newInstance, error: insertError } = await adminClient
        .from("whats_api")
        .insert({
          user_id: user.id,
          name: result.instance?.name || instanceName,
          device_name: result.instance?.device_name || deviceName,
          server_url: serverUrl,
          instance_token: instanceToken,
          api_token: DEFAULT_API_TOKEN,
          status: 'created',
          is_connected: false
        })
        .select()
        .single();

      if (insertError) throw insertError;
      whatsApiInstance = newInstance;
    }

    const { server_url, instance_token } = whatsApiInstance;

    // 3. Lógica de ações (QR Code, Status, etc.)
    if (action === "qrcode" || action === "reconnect" || action === "get-or-create") {
      console.log(`[whatsapp-manage] Verificando status/QR Code para ${server_url}`);
      
      const connectRes = await fetch(`${server_url}/instance/connect`, {
        method: "GET",
        headers: { "token": instance_token }
      });

      const connectData = await connectRes.json();
      const isConnected = connectData.instance?.status === "connected" || connectData.connected === true;
      const qrcode = connectData.instance?.qrcode || connectData.qrcode || connectData.base64;

      // Atualizar status no banco
      await adminClient
        .from("whats_api")
        .update({ 
          is_connected: isConnected,
          status: isConnected ? "connected" : "disconnected"
        })
        .eq("id", whatsApiInstance.id);

      if (action === "get-or-create") {
        return new Response(JSON.stringify({ 
          success: true, 
          instance: { ...whatsApiInstance, is_connected: isConnected, status: isConnected ? "connected" : "disconnected" } 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        qrcode: qrcode,
        connected: isConnected,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "status") {
      const statusRes = await fetch(`${server_url}/instance/status`, {
        method: "GET",
        headers: { "token": instance_token }
      });
      const statusData = await statusRes.json();
      const isConnected = statusData.instance?.status === "connected" || statusData.state === "CONNECTED";
      
      await adminClient
        .from("whats_api")
        .update({ 
          is_connected: isConnected,
          status: isConnected ? "connected" : "disconnected"
        })
        .eq("id", whatsApiInstance.id);

      return new Response(JSON.stringify({ success: true, status: statusData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (action === "delete") {
      console.log(`[whatsapp-manage] Deletando instância para usuário ${user.id}`);
      try {
        await fetch(`${server_url}/instance`, {
          method: "DELETE",
          headers: { "token": instance_token },
        });
      } catch (e: any) {
        console.error("[whatsapp-manage] Falha ao deletar na API externa:", e.message);
      }

      await adminClient
        .from("whats_api")
        .delete()
        .eq("user_id", user.id);

      return new Response(JSON.stringify({ success: true, deleted: true }), {
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
