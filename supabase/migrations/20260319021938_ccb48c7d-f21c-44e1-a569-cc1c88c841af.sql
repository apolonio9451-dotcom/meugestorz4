ALTER TABLE public.api_settings
ADD COLUMN IF NOT EXISTS overdue_charge_pause_days integer NOT NULL DEFAULT 10;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'api_settings_overdue_charge_pause_days_nonnegative'
  ) THEN
    ALTER TABLE public.api_settings
    ADD CONSTRAINT api_settings_overdue_charge_pause_days_nonnegative
    CHECK (overdue_charge_pause_days >= 0);
  END IF;
END $$;