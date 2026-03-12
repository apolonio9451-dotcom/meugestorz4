ALTER TABLE public.api_settings ADD COLUMN IF NOT EXISTS instance_name text NOT NULL DEFAULT '';
ALTER TABLE public.api_settings ADD COLUMN IF NOT EXISTS uazapi_base_url text NOT NULL DEFAULT '';