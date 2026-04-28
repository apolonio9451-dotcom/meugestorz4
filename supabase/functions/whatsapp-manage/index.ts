import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, admintoken, token",
};

const FIXED_SERVER_URL = "https://ipazua.uazapi.com";

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

    let { data: whatsApiInstance } = await adminClient
      .from("whats_api")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!whatsApiInstance && action !== "save-config") {
      throw new Error("Configuração do WhatsApp não encontrada. Configure primeiro nas configurações.");
    }

    if (action === "save-config") {
      const { name, instance_token } = body;
      const { data, error } = whatsApiInstance 
        ? await adminClient.from("whats_api").update({ name, instance_token, server_url: FIXED_SERVER_URL }).eq("id", whatsApiInstance.id).select().single()
        : await adminClient.from("whats_api").insert({ user_id: user.id, name, instance_token, server_url: FIXED_SERVER_URL }).select().single();
      
      if (error) throw error;

      return new Response(JSON.stringify({ success: true, instance: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const { server_url, instance_token } = whatsApiInstance;

    if (action === "qrcode" || action === "reconnect" || action === "get-or-create" || action === "status") {
      // Tentar verificar status por vários endpoints possíveis na uazapi/whatsapi
      const checkEndpoints = [
        `${server_url}/instance/connect`,
        `${server_url}/connect`,
        `${server_url}/instance/status`,
        `${server_url}/status`
      ];

      let connectData: any = null;
      let isConnected = false;
      let qrcode = null;
      let lastError = "Não foi possível validar o status";

      for (const endpoint of checkEndpoints) {
        try {
          console.log(`[whatsapp-manage] Verificando: ${endpoint}`);
          const res = await fetch(endpoint, {
            method: "GET",
            headers: { "token": instance_token }
          });

          if (res.ok) {
            const data = await res.json();
            console.log(`[whatsapp-manage] Resposta de ${endpoint}:`, JSON.stringify(data).substring(0, 200));
            
            // Lógica de detecção de conexão (abrangente para uazapi)
            const status = (data.instance?.status || data.status || data.state || "").toUpperCase();
            if (status === "CONNECTED" || status === "OPEN" || data.connected === true) {
              isConnected = true;
            }
            
            qrcode = data.qrcode || data.base64 || data.instance?.qrcode;
            connectData = data;
            break; // Encontrou um endpoint válido que respondeu
          } else {
            const errText = await res.text();
            lastError = `API Error (${res.status}): ${errText}`;
          }
        } catch (e: any) {
          console.warn(`[whatsapp-manage] Falha ao chamar ${endpoint}:`, e.message);
        }
      }

      // Se nenhum endpoint funcionou mas temos uma instância, vamos manter o status anterior ou setar erro
      if (connectData === null && action !== "get-or-create") {
        return new Response(JSON.stringify({ success: false, error: lastError }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      await adminClient
        .from("whats_api")
        .update({ is_connected: isConnected, status: isConnected ? "connected" : "disconnected" })
        .eq("id", whatsApiInstance.id);

      return new Response(JSON.stringify({
        success: true,
        qrcode,
        connected: isConnected,
        instance: { ...whatsApiInstance, is_connected: isConnected, status: isConnected ? "connected" : "disconnected" }
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "pause" || action === "restart") {
      const endpoint = `${server_url}/instance/${action}`;
      try {
        console.log(`[whatsapp-manage] Executando ${action} em: ${endpoint}`);
        const res = await fetch(endpoint, {
          method: "GET",
          headers: { "token": instance_token }
        });
        
        const data = await res.json().catch(() => ({}));
        
        return new Response(JSON.stringify({ 
          success: res.ok, 
          action, 
          data 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ success: false, error: e.message }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    if (action === "delete") {
      await adminClient.from("whats_api").delete().eq("user_id", user.id);
      return new Response(JSON.stringify({ success: true, deleted: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ success: true, instance: whatsApiInstance }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: error.message === "Unauthorized" ? 401 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
