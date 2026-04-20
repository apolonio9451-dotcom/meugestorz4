ALTER TABLE public.campaign_presets
ADD COLUMN IF NOT EXISTS audience_status text NOT NULL DEFAULT 'todos';

ALTER TABLE public.campaign_presets
DROP CONSTRAINT IF EXISTS campaign_presets_audience_status_check;

ALTER TABLE public.campaign_presets
ADD CONSTRAINT campaign_presets_audience_status_check
CHECK (audience_status IN ('todos', 'ativos', 'vencidos', 'inativos'));

CREATE INDEX IF NOT EXISTS idx_campaign_presets_audience_status
ON public.campaign_presets (company_id, audience_status);