ALTER TABLE public.client_mac_keys ADD COLUMN app_name text NOT NULL DEFAULT '';
ALTER TABLE public.client_mac_keys ADD COLUMN expires_at date NULL;