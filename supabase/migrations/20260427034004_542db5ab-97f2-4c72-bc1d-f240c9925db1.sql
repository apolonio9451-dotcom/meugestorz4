CREATE TABLE IF NOT EXISTS public.whats_api (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    device_name TEXT,
    server_url TEXT NOT NULL,
    instance_token TEXT NOT NULL,
    api_token TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.whats_api ENABLE ROW LEVEL SECURITY;

-- Políticas
CREATE POLICY "Users can view their own WhatsApp instances" 
ON public.whats_api FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own WhatsApp instances" 
ON public.whats_api FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own WhatsApp instances" 
ON public.whats_api FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own WhatsApp instances" 
ON public.whats_api FOR DELETE 
USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_whats_api_updated_at
    BEFORE UPDATE ON public.whats_api
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();