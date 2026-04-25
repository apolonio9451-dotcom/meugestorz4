import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TARGET_LEAGUES = [71, 72, 2, 13, 39, 140, 135, 78, 61, 73]; // Added 73 for Copa do Brasil

const getAutoChannels = (leagueId: number, leagueName: string) => {
  const name = leagueName.toLowerCase();
  // Fixed mapping based on league ID or Name
  if (leagueId === 71 || name.includes("brasileirão série a")) return ["Premiere", "Globo", "SporTV"];
  if (leagueId === 72 || name.includes("brasileirão série b")) return ["Premiere", "SporTV", "Band"];
  if (leagueId === 2 || name.includes("champions league")) return ["Max", "TNT"];
  if (leagueId === 13 || name.includes("libertadores")) return ["Globo", "ESPN", "Paramount+"];
  if (leagueId === 73 || name.includes("copa do brasil")) return ["Prime Video", "Globo", "SporTV"];
  if (name.includes("premier league") || name.includes("la liga") || name.includes("serie a") || name.includes("bundesliga") || name.includes("ligue 1")) return ["ESPN", "Star+"];
  return ["TV MAX"];
};

function cleanChannelName(name: string): string {
  if (!name) return "";
  let clean = name.split(/\s(RJ|SP|MG|RS|PR|SC|GO|BA|PE|CE|MT|MS|PA|AM|ES|AL|SE|PB|RN|MA|PI|RO|AC|AP|TO|RR|DF)/i)[0];
  clean = clean.replace(/\s\d+$/g, ""); // Remove numbers at the end like "Premiere 4"
  return clean.trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const apiKey = "397803b5d8mshb0d13da532b0eb2p1a6f54jsn7f2592250ff9";

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

    const getAutoChannels = (leagueName: string) => {
      const name = leagueName.toLowerCase();
      if (name.includes("brasileirão")) return ["Premiere", "Globo"];
      if (name.includes("champions league")) return ["Max", "TNT"];
      if (name.includes("libertadores")) return ["Globo", "ESPN", "Paramount+"];
      if (name.includes("premier league")) return ["ESPN", "Star+"];
      if (name.includes("la liga") || name.includes("serie a") || name.includes("bundesliga") || name.includes("ligue 1")) return ["ESPN", "Star+"];
      return ["TV MAX"];
    };

    const upsertData = allMatches.map((m) => {
      // Extract channels from API if available, otherwise use defaults
      let matchChannels = [];
      // Some API versions or data plans might include broadcasters
      if (m.fixture.broadcasters && Array.isArray(m.fixture.broadcasters)) {
        matchChannels = m.fixture.broadcasters.map((b: any) => b.name);
      }
      
      if (matchChannels.length === 0) {
        matchChannels = getAutoChannels(m.league.name);
      }

      return {
        external_id: m.fixture.id,
        home_team: m.teams.home.name,
        away_team: m.teams.away.name,
        home_logo: m.teams.home.logo,
        away_logo: m.teams.away.logo,
        match_time: m.fixture.date,
        match_date: today,
        league_name: m.league.name,
        league_logo: m.league.logo,
        channels: matchChannels,
        updated_at: new Date().toISOString(),
      };
    });

    if (upsertData.length > 0) {
      const { error } = await supabase
        .from("sports_matches")
        .upsert(upsertData, { onConflict: "external_id" });

      if (error) throw error;
    }

    return new Response(JSON.stringify({ success: true, count: upsertData.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
