CREATE TABLE IF NOT EXISTS public.whats_api (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  instance_token TEXT NOT NULL,
  server_url TEXT NOT NULL DEFAULT 'https://ipazua.uazapi.com',
  api_token TEXT,
  status TEXT DEFAULT 'disconnected',
  is_connected BOOLEAN DEFAULT false,
  device_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.whats_api ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own whats_api" 
ON public.whats_api FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own whats_api" 
ON public.whats_api FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own whats_api" 
ON public.whats_api FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own whats_api" 
ON public.whats_api FOR DELETE 
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_whats_api_updated_at
BEFORE UPDATE ON public.whats_api
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();