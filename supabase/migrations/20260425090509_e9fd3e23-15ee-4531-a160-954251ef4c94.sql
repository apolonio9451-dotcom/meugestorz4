-- Create bolao_challenges table
CREATE TABLE public.bolao_challenges (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    match_ids UUID[] NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'finished')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create bolao_guesses table
CREATE TABLE public.bolao_guesses (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    challenge_id UUID NOT NULL REFERENCES public.bolao_challenges(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    participant_name TEXT NOT NULL,
    participant_phone TEXT NOT NULL,
    guesses JSONB NOT NULL, -- Format: [{"match_id": "...", "home_score": 0, "away_score": 0}]
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'winner', 'loser')),
    celebration_image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bolao_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bolao_guesses ENABLE ROW LEVEL SECURITY;

-- Admin Policies (for simplicity, assuming auth.uid() is the admin)
CREATE POLICY "Admins can manage challenges" ON public.bolao_challenges
    FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage guesses" ON public.bolao_guesses
    FOR ALL USING (auth.role() = 'authenticated');

-- Public Policies (for the customer portal)
CREATE POLICY "Anyone can view active challenges" ON public.bolao_challenges
    FOR SELECT USING (status = 'active');

CREATE POLICY "Anyone can submit guesses" ON public.bolao_guesses
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view their own guesses by phone" ON public.bolao_guesses
    FOR SELECT USING (true); -- We will filter by phone in the application logic

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_bolao_challenges_updated_at
    BEFORE UPDATE ON public.bolao_challenges
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bolao_guesses_updated_at
    BEFORE UPDATE ON public.bolao_guesses
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
