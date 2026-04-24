-- Create sports_matches table
CREATE TABLE public.sports_matches (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    external_id INTEGER UNIQUE, -- ID from API-Football
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    home_logo TEXT,
    away_logo TEXT,
    match_time TIMESTAMP WITH TIME ZONE NOT NULL,
    match_date DATE NOT NULL,
    league_name TEXT,
    league_logo TEXT,
    channels TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sports_matches ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Matches are viewable by everyone" 
ON public.sports_matches 
FOR SELECT 
USING (true);

-- Add index for date queries
CREATE INDEX idx_sports_matches_date ON public.sports_matches(match_date);

-- Create trigger for updated_at
CREATE TRIGGER update_sports_matches_updated_at
BEFORE UPDATE ON public.sports_matches
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
