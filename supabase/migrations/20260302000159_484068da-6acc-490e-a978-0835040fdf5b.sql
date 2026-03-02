
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS whatsapp text DEFAULT '';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS cpf text DEFAULT '';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS notes text DEFAULT '';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS server text DEFAULT '';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS iptv_user text DEFAULT '';
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS iptv_password text DEFAULT '';
