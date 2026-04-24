import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LEAGUES = [
  { id: 71, name: "Brasileirão Série A" },
  { id: 72, name: "Brasileirão Série B" },
  { id: 2, name: "Champions League" },
  { id: 13, name: "Libertadores" },
  { id: 39, name: "Premier League" },
  { id: 140, name: "La Liga" },
  { id: 135, name: "Serie A" },
  { id: 78, name: "Bundesliga" },
  { id: 61, name: "Ligue 1" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let apiKey = Deno.env.get("FOOTBALL_API_KEY");
    
    if (!apiKey) {
      // Try to get from api_settings table (first one that has it)
      const { data: settings } = await supabase
        .from("api_settings")
        .select("football_api_key")
        .not("football_api_key", "is", null)
        .limit(1)
        .maybeSingle();
      
      apiKey = settings?.football_api_key;
    }

    if (!apiKey) {
      throw new Error("FOOTBALL_API_KEY not set in secrets or api_settings");
    }

    const today = new Date().toISOString().split("T")[0];
    
    console.log(`Fetching matches for date: ${today}`);

    const allMatches = [];

    // Ligas solicitadas
    const TARGET_LEAGUES = [71, 72, 2, 13, 39, 140, 135, 78, 61];

    console.log(`Fetching from RapidAPI...`);
    const response = await fetch(
      `https://api-football-v1.p.rapidapi.com/v3/fixtures?date=${today}`,
      {
        method: "GET",
        headers: {
          "x-rapidapi-host": "api-football-v1.p.rapidapi.com",
          "x-rapidapi-key": apiKey,
        },
      }
    );

    const data = await response.json();
    if (data.response) {
      // Filtrar apenas as ligas alvo
      const filtered = data.response.filter((m: any) => TARGET_LEAGUES.includes(m.league.id));
      allMatches.push(...filtered);
    }

    console.log(`Total matches found: ${allMatches.length}`);

    const upsertData = allMatches.map((m) => ({
      external_id: m.fixture.id,
      home_team: m.teams.home.name,
      away_team: m.teams.away.name,
      home_logo: m.teams.home.logo,
      away_logo: m.teams.away.logo,
      match_time: m.fixture.date,
      match_date: today,
      league_name: m.league.name,
      league_logo: m.league.logo,
      // API-Football doesn't provide channels in the basic fixture response usually, 
      // but some endpoints might. For now, we'll leave it empty or mock it if needed.
      channels: [], 
      updated_at: new Date().toISOString(),
    }));

    if (upsertData.length > 0) {
      const { error } = await supabase
        .from("sports_matches")
        .upsert(upsertData, { onConflict: "external_id" });

      if (error) throw error;
    }

    return new Response(JSON.stringify({ success: true, count: upsertData.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
