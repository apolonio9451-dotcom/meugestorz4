-- Create bolao_leads table
CREATE TABLE IF NOT EXISTS public.bolao_leads (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for bolao_leads
ALTER TABLE public.bolao_leads ENABLE ROW LEVEL SECURITY;

-- Allow public insertion for leads
CREATE POLICY "Anyone can create leads" 
ON public.bolao_leads 
FOR INSERT 
WITH CHECK (true);

-- Allow admins to view leads
CREATE POLICY "Admins can view leads" 
ON public.bolao_leads 
FOR SELECT 
USING (true);

-- Add helper columns to bolao_guesses if they don't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bolao_guesses' AND column_name = 'is_client') THEN
        ALTER TABLE public.bolao_guesses ADD COLUMN is_client BOOLEAN DEFAULT false;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'bolao_guesses' AND column_name = 'admin_notification') THEN
        ALTER TABLE public.bolao_guesses ADD COLUMN admin_notification TEXT;
    END IF;
END $$;
