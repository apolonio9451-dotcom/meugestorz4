ALTER TABLE public.api_settings 
ADD COLUMN IF NOT EXISTS broadcast_api_url text NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS broadcast_api_token text NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS broadcast_instance_name text NOT NULL DEFAULT '';