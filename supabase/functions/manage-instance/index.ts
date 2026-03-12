import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminToken = Deno.env.get("UAZAPI_ADMIN_TOKEN");

  if (!adminToken) {
    return new Response(JSON.stringify({ error: "UAZAPI_ADMIN_TOKEN not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Auth check
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = claimsData.claims.sub as string;
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json();
    const { action, company_id, base_url } = body;

    if (!company_id) {
      return new Response(JSON.stringify({ error: "company_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const uazapiBaseUrl = (base_url || "https://ipazua.uazapi.com").replace(/\/$/, "");

    if (action === "create") {
      // Create a new UAZAPI instance
      const instanceName = `company-${company_id.slice(0, 8)}-${Date.now()}`;

      console.log(`Creating UAZAPI instance: ${instanceName} on ${uazapiBaseUrl}`);

      const createResp = await fetch(`${uazapiBaseUrl}/instance/init`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          admintoken: adminToken,
        },
        body: JSON.stringify({ name: instanceName }),
      });

      if (!createResp.ok) {
        const errText = await createResp.text();
        console.error(`UAZAPI create instance failed: ${createResp.status} - ${errText}`);
        return new Response(JSON.stringify({ error: `Failed to create instance: ${createResp.status}`, details: errText }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const createData = await createResp.json();
      console.log("Instance created:", JSON.stringify(createData).slice(0, 500));

      const instanceToken = createData.token || createData.Token || "";
      const createdInstanceName = createData.instance || createData.name || instanceName;

      // Save to api_settings
      const { data: existing } = await supabaseAdmin
        .from("api_settings")
        .select("id")
        .eq("company_id", company_id)
        .maybeSingle();

      const payload = {
        company_id,
        api_url: `${uazapiBaseUrl}`,
        api_token: instanceToken,
        instance_name: createdInstanceName,
        uazapi_base_url: uazapiBaseUrl,
      };

      if (existing) {
        await supabaseAdmin.from("api_settings").update(payload).eq("id", existing.id);
      } else {
        await supabaseAdmin.from("api_settings").insert(payload);
      }

      // Auto-configure webhook
      const webhookUrl = `${supabaseUrl}/functions/v1/chatbot-webhook?company_id=${company_id}`;
      console.log(`Setting webhook to: ${webhookUrl}`);

      try {
        const webhookResp = await fetch(`${uazapiBaseUrl}/instance/webhook`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            token: instanceToken,
          },
          body: JSON.stringify({
            webhookUrl: webhookUrl,
            enabled: true,
          }),
        });

        if (!webhookResp.ok) {
          console.error("Webhook setup failed:", await webhookResp.text());
        } else {
          console.log("Webhook configured successfully");
        }
      } catch (whErr) {
        console.error("Webhook setup error:", whErr);
      }

      return new Response(JSON.stringify({
        success: true,
        instance_name: createdInstanceName,
        instance_token: instanceToken,
        webhook_url: webhookUrl,
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "qrcode") {
      // Get QR code / connection state
      const { data: apiSettings } = await supabaseAdmin
        .from("api_settings")
        .select("instance_name, api_token, uazapi_base_url, api_url")
        .eq("company_id", company_id)
        .maybeSingle();

      if (!apiSettings?.instance_name) {
        return new Response(JSON.stringify({ error: "No instance found. Create one first." }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const baseUrl = (apiSettings.uazapi_base_url || apiSettings.api_url || uazapiBaseUrl).replace(/\/$/, "");
      const instName = apiSettings.instance_name;

      console.log(`Getting QR code for instance: ${instName} from ${baseUrl}`);

      const stateResp = await fetch(`${baseUrl}/instance/connectionState/${instName}`, {
        method: "GET",
        headers: { admintoken: adminToken },
      });

      if (!stateResp.ok) {
        const errText = await stateResp.text();
        console.error(`QR code fetch failed: ${stateResp.status} - ${errText}`);
        return new Response(JSON.stringify({ error: `Failed to get QR code: ${stateResp.status}`, details: errText }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const stateData = await stateResp.json();
      console.log("Connection state:", JSON.stringify(stateData).slice(0, 500));

      return new Response(JSON.stringify({
        success: true,
        state: stateData.state || stateData.status || stateData.connectionState || "unknown",
        qrcode: stateData.qrcode || stateData.qr || stateData.QRCode || stateData.base64 || null,
        instance_name: instName,
        raw: stateData,
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "status") {
      // Check if instance exists
      const { data: apiSettings } = await supabaseAdmin
        .from("api_settings")
        .select("instance_name, api_token, uazapi_base_url, api_url")
        .eq("company_id", company_id)
        .maybeSingle();

      return new Response(JSON.stringify({
        success: true,
        has_instance: !!apiSettings?.instance_name,
        instance_name: apiSettings?.instance_name || null,
        has_token: !!apiSettings?.api_token,
      }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else {
      return new Response(JSON.stringify({ error: "Invalid action. Use: create, qrcode, status" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err: any) {
    console.error("manage-instance error:", err);
    return new Response(JSON.stringify({ error: err?.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
