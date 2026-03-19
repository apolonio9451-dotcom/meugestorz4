ALTER TABLE public.mass_broadcast_campaigns
  ADD COLUMN IF NOT EXISTS seller_instructions text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS offer_timeout_minutes integer NOT NULL DEFAULT 5;