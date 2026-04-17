ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS genero TEXT NOT NULL DEFAULT 'Não informado';