import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function resolveAuthorizedCompanyId(adminClient: any, userId: string, requestedCompanyId?: string) {
  const { data: memberships } = await adminClient
    .from("company_memberships")
    .select("company_id")
    .eq("user_id", userId);
  
  if (!memberships || memberships.length === 0) return "";
  
  if (requestedCompanyId) {
    const hasAccess = memberships.some((m: any) => m.company_id === requestedCompanyId);
    if (hasAccess) return requestedCompanyId;
  }
  
  return memberships[0].company_id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = req.headers.get("Authorization")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const body = await req.json();
    const resolvedCompanyId = await resolveAuthorizedCompanyId(adminClient, user.id, body.company_id);
    
    if (!resolvedCompanyId) throw new Error("No company access");

    const { action, instance_name, server_url, token, force_new } = body;

    // Load API settings for the company
    const { data: apiSettings } = await adminClient
      .from("api_settings")
      .select("api_url, api_token, instance_name")
      .eq("company_id", resolvedCompanyId)
      .maybeSingle();

    const baseUrl = apiSettings?.api_url || server_url || "https://ipazua.uazapi.com";
    const apiToken = apiSettings?.api_token || token || "Meu gestor";
    const finalInstanceName = instance_name || apiSettings?.instance_name || `instancia-${user.id.substring(0, 8)}`;

    if (action === "create" || action === "get-or-create") {
      // Check if instance already exists in DB
      const { data: existingInstance } = await adminClient
        .from("whatsapp_instances")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingInstance && !force_new) {
        // Just return the existing one
        return new Response(JSON.stringify({ success: true, instance: existingInstance }), { 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      // If we need to create/recreate on the remote server
      const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook?user_id=${user.id}`;
      
      console.log(`[whatsapp-manage] Creating/reconnecting instance ${finalInstanceName} at ${baseUrl}`);
      
      // UA-ZAPI call to create/start instance
      const createRes = await fetch(`${baseUrl}/instance/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiToken}`
        },
        body: JSON.stringify({
          instanceName: finalInstanceName,
          token: apiToken,
          webhookUrl: webhookUrl
        })
      });

      const createData = await createRes.json();
      console.log(`[whatsapp-manage] API Response:`, createData);

      // Update or insert in DB
      const instancePayload = {
        user_id: user.id,
        instance_name: finalInstanceName,
        server_url: baseUrl,
        token: apiToken,
        instance_token: apiToken,
        status: "disconnected",
        is_connected: false,
        webhook_url: webhookUrl
      };

      if (existingInstance) {
        await adminClient.from("whatsapp_instances").update(instancePayload).eq("id", existingInstance.id);
      } else {
        await adminClient.from("whatsapp_instances").insert(instancePayload);
      }

      const { data: updatedInstance } = await adminClient
        .from("whatsapp_instances")
        .select("*")
        .eq("user_id", user.id)
        .single();

      return new Response(JSON.stringify({ success: true, instance: updatedInstance, is_new: true }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    if (action === "qrcode" || action === "reconnect") {
      console.log(`[whatsapp-manage] Fetching QR Code for ${finalInstanceName}`);
      
      const qrRes = await fetch(`${baseUrl}/instance/qrcode?instanceName=${finalInstanceName}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiToken}`
        }
      });

      if (!qrRes.ok) {
        const errorData = await qrRes.json().catch(() => ({}));
        throw new Error(errorData.message || "Erro ao obter QR Code da API");
      }

      const qrData = await qrRes.json();
      
      return new Response(JSON.stringify({ 
        success: true, 
        qrcode: qrData.base64 || qrData.qrcode,
        connected: qrData.connected || false
      }), { 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    if (action === "profile-picture") {
      const picRes = await fetch(`${baseUrl}/instance/profilePicture?instanceName=${finalInstanceName}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiToken}`
        }
      });
      const picData = await picRes.json().catch(() => ({}));
      return new Response(JSON.stringify(picData), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "disconnect") {
      await fetch(`${baseUrl}/instance/logout?instanceName=${finalInstanceName}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${apiToken}` }
      });
      
      await adminClient.from("whatsapp_instances").update({ is_connected: false, status: "disconnected" }).eq("user_id", user.id);
      
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "delete") {
      await fetch(`${baseUrl}/instance/delete?instanceName=${finalInstanceName}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${apiToken}` }
      });

      const { error } = await adminClient
        .from("whatsapp_instances")
        .delete()
        .eq("user_id", user.id);
      
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, deleted: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true, company_id: resolvedCompanyId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error(`[whatsapp-manage] Error:`, err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
