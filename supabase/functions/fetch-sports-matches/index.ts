import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BOLAO_LEAGUES = [
  71, // Brasileirão Série A
  72, // Brasileirão Série B
  73, // Copa do Brasil
  13, // Libertadores
  11, // Sul-Americana
];

const OTHER_TARGET_LEAGUES = [
  2,  // Champions League
  3,  // Europa League
  39, // Premier League
  140, // La Liga
  135, // Serie A
  78,  // Bundesliga
  61   // Ligue 1
];

const ALL_TARGET_LEAGUES = [...BOLAO_LEAGUES, ...OTHER_TARGET_LEAGUES];

const getAutoChannels = (leagueId: number, leagueName: string) => {
  const name = leagueName.toLowerCase();
  if (leagueId === 71 || name.includes("brasileirão série a")) return ["Globo", "Premiere", "SporTV"];
  if (leagueId === 13 || name.includes("libertadores")) return ["Globo", "ESPN", "Paramount+"];
  if (leagueId === 11 || name.includes("sul-americana")) return ["ESPN", "Star+", "SBT"];
  if (leagueId === 73 || name.includes("copa do brasil")) return ["Globo", "Prime Video", "SporTV"];
  if (leagueId === 2 || name.includes("champions league")) return ["TNT", "Max", "SBT"];
  if (leagueId === 3 || name.includes("europa league")) return ["ESPN", "Star+"];
  if (leagueId === 72 || name.includes("brasileirão série b")) return ["Premiere", "SporTV", "Band"];
  if (name.includes("premier league") || name.includes("la liga") || name.includes("serie a") || name.includes("bundesliga") || name.includes("ligue 1")) return ["ESPN", "Star+"];
  return ["TV MAX"];
};

function cleanChannelName(name: string): string {
  if (!name) return "";
  let clean = name.split(/\s(RJ|SP|MG|RS|PR|SC|GO|BA|PE|CE|MT|MS|PA|AM|ES|AL|SE|PB|RN|MA|PI|RO|AC|AP|TO|RR|DF)/i)[0];
  clean = clean.replace(/\s\d+$/g, "");
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

    const datesToFetch = [
      new Date().toISOString().split("T")[0],
      new Date(Date.now() + 86400000).toISOString().split("T")[0]
    ];
    
    const allFetchedMatches: any[] = [];

    for (const date of datesToFetch) {
      console.log(`Fetching matches for date: ${date}`);
      const response = await fetch(
        `https://api-football-v1.p.rapidapi.com/v3/fixtures?date=${date}`,
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
        const filtered = data.response.filter((m: any) => ALL_TARGET_LEAGUES.includes(m.league.id));
        allFetchedMatches.push(...filtered.map((m: any) => ({ ...m, fetch_date: date })));
      }
    }

    const upsertData = allFetchedMatches.map((m) => {
      let matchChannels: string[] = [];
      if (m.fixture.broadcasters && Array.isArray(m.fixture.broadcasters)) {
        matchChannels = m.fixture.broadcasters.map((b: any) => cleanChannelName(b.name));
      }
      if (matchChannels.length === 0) {
        matchChannels = getAutoChannels(m.league.id, m.league.name);
      }
      matchChannels = [...new Set(matchChannels)];

      return {
        external_id: m.fixture.id,
        home_team: m.teams.home.name,
        away_team: m.teams.away.name,
        home_logo: m.teams.home.logo,
        away_logo: m.teams.away.logo,
        match_time: m.fixture.date,
        match_date: m.fetch_date,
        league_name: m.league.name,
        league_logo: m.league.logo,
        channels: matchChannels,
        league_id: m.league.id,
        home_score: m.goals.home,
        away_score: m.goals.away,
        updated_at: new Date().toISOString(),
      };
    });

    if (upsertData.length > 0) {
      const { error } = await supabase
        .from("sports_matches")
        .upsert(upsertData, { onConflict: "external_id" });

      if (error) throw error;
      
      // Automatic Bolão Selection
      // Select matches from BOLAO_LEAGUES for today and tomorrow
      const bolaoMatches = upsertData
        .filter(m => BOLAO_LEAGUES.includes(m.league_id))
        .sort((a, b) => new Date(a.match_time).getTime() - new Date(b.match_time).getTime());

      if (bolaoMatches.length > 0) {
        const matchIds = bolaoMatches.map(m => {
          // We need the UUID from the database, but since we just upserted, 
          // we can use a select to get them by external_id
          return m.external_id;
        });

        // Get UUIDs for these external IDs
        const { data: dbMatches } = await supabase
          .from("sports_matches")
          .select("id")
          .in("external_id", matchIds);

        const dbMatchIds = dbMatches?.map(m => m.id) || [];

        if (dbMatchIds.length > 0) {
          // Update or Create Active Challenge
          const { data: activeChallenge } = await supabase
            .from("bolao_challenges")
            .select("id")
            .eq("status", "active")
            .maybeSingle();

          const challengeTitle = `BOLÃO TV MAX - ${new Date().toLocaleDateString('pt-BR')}`;
          
          if (activeChallenge) {
            await supabase
              .from("bolao_challenges")
              .update({
                title: challengeTitle,
                match_ids: dbMatchIds,
                updated_at: new Date().toISOString()
              } as any)
              .eq("id", activeChallenge.id);
          } else {
            await supabase
              .from("bolao_challenges")
              .insert({
                title: challengeTitle,
                description: "Acerte os placares dos jogos brasileiros e ganhe prêmios!",
                match_ids: dbMatchIds,
                status: "active"
              } as any);
          }
        }
      }
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