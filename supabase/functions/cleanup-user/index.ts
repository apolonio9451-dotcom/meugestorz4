import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { user_id } = await req.json();

  // Delete company memberships
  await adminClient.from("company_memberships").delete().eq("user_id", user_id);
  
  // Find and delete orphaned companies
  const { data: membership } = await adminClient.from("company_memberships").select("company_id").eq("user_id", user_id);
  
  // Delete profile
  await adminClient.from("profiles").delete().eq("id", user_id);
  
  // Delete auth user
  const { error } = await adminClient.auth.admin.deleteUser(user_id);

  return new Response(JSON.stringify({ success: !error, error: error?.message }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
