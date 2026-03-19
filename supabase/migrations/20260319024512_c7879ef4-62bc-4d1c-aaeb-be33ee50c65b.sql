ALTER TABLE public.api_settings
ADD COLUMN IF NOT EXISTS overdue_charge_pause_enabled boolean NOT NULL DEFAULT true;

UPDATE public.api_settings
SET overdue_charge_pause_enabled = CASE
  WHEN overdue_charge_pause_days = 0 THEN false
  ELSE true
END
WHERE overdue_charge_pause_enabled IS DISTINCT FROM CASE
  WHEN overdue_charge_pause_days = 0 THEN false
  ELSE true
END;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'api_settings_overdue_charge_pause_days_max_90'
  ) THEN
    ALTER TABLE public.api_settings
    ADD CONSTRAINT api_settings_overdue_charge_pause_days_max_90
    CHECK (overdue_charge_pause_days >= 0 AND overdue_charge_pause_days <= 90);
  END IF;
END $$;