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

    const apiKey = Deno.env.get("FOOTBALL_API_KEY");
    if (!apiKey) {
      throw new Error("FOOTBALL_API_KEY not set");
    }

    const today = new Date().toISOString().split("T")[0];
    
    console.log(`Fetching matches for date: ${today}`);

    const allMatches = [];

    for (const league of LEAGUES) {
      console.log(`Fetching ${league.name}...`);
      const response = await fetch(
        `https://v3.football.api-sports.io/fixtures?league=${league.id}&season=${new Date().getFullYear()}&date=${today}`,
        {
          method: "GET",
          headers: {
            "x-rapidapi-host": "v3.football.api-sports.io",
            "x-rapidapi-key": apiKey,
          },
        }
      );

      const data = await response.json();
      if (data.response) {
        allMatches.push(...data.response);
      }
      
      // Respect rate limits if necessary, though 10 req/min is usually okay for free tier
      // await new Promise(r => setTimeout(r, 100));
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
