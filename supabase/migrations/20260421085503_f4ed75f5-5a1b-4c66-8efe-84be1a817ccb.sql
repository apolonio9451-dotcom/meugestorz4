ALTER TABLE public.api_settings
  ADD COLUMN IF NOT EXISTS overdue_sends_per_cycle integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS overdue_cycle_cooldown_days integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS overdue_max_cycles integer NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS overdue_inactive_after_days integer NOT NULL DEFAULT 30;

COMMENT ON COLUMN public.api_settings.overdue_sends_per_cycle IS 'Quantos envios seguidos de cobrança vencida por ciclo (1-7)';
COMMENT ON COLUMN public.api_settings.overdue_cycle_cooldown_days IS 'Dias de pausa entre ciclos de cobrança (1-15)';
COMMENT ON COLUMN public.api_settings.overdue_max_cycles IS 'Máximo de ciclos de cobrança antes de parar e inativar (1-10)';
COMMENT ON COLUMN public.api_settings.overdue_inactive_after_days IS 'Dias vencido para marcar cliente como inativo automaticamente (7-180)';