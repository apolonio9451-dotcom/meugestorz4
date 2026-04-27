ALTER TABLE public.whats_api 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'disconnected',
ADD COLUMN IF NOT EXISTS is_connected BOOLEAN DEFAULT false;