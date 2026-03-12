import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { instanceId } = await req.json();
    const API_KEY = "10c3ab83-17ba-4921-ae88-c096ed1d0144";
    // ⚠️ Esta URL é do servidor WhatsApi, NÃO do Supabase deste projeto. Não altere!
    const SUPABASE_FUNCTIONS_URL = "https://xukeukdwhelyttifzveb.supabase.co/functions/v1";

    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/delete-instance-external`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: API_KEY,
        instanceId,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro ao deletar instância");

    return new Response(
      JSON.stringify({ success: true, message: "Instância deletada permanentemente" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
