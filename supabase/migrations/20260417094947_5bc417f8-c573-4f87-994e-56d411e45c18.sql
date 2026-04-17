-- Adiciona campo de automação por campanha
ALTER TABLE public.campaign_presets
ADD COLUMN IF NOT EXISTS automation_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS last_auto_run_year integer;

-- Adiciona master switch e telefone admin para teste em api_settings
ALTER TABLE public.api_settings
ADD COLUMN IF NOT EXISTS campaigns_engine_enabled boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS campaigns_admin_test_phone text NOT NULL DEFAULT '';