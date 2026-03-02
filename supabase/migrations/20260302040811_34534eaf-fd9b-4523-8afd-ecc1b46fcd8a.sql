
-- White-label settings per reseller
CREATE TABLE public.reseller_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  service_name text NOT NULL DEFAULT '',
  logo_url text DEFAULT '',
  primary_color text DEFAULT '#3b82f6',
  billing_message text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(reseller_id)
);

ALTER TABLE public.reseller_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reseller can view own settings"
ON public.reseller_settings FOR SELECT
USING (reseller_id = get_reseller_id(auth.uid()));

CREATE POLICY "Reseller can insert own settings"
ON public.reseller_settings FOR INSERT
WITH CHECK (reseller_id = get_reseller_id(auth.uid()));

CREATE POLICY "Reseller can update own settings"
ON public.reseller_settings FOR UPDATE
USING (reseller_id = get_reseller_id(auth.uid()));

CREATE POLICY "Admin can manage reseller settings"
ON public.reseller_settings FOR ALL
USING (EXISTS (
  SELECT 1 FROM resellers r
  WHERE r.id = reseller_settings.reseller_id
  AND is_company_admin_or_owner(auth.uid(), r.company_id)
));

CREATE TRIGGER update_reseller_settings_updated_at
BEFORE UPDATE ON public.reseller_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Activity logs for resellers
CREATE TABLE public.reseller_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_id uuid NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  action text NOT NULL,
  entity_type text DEFAULT '',
  entity_id uuid,
  details jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reseller_logs_reseller ON public.reseller_activity_logs(reseller_id);
CREATE INDEX idx_reseller_logs_created ON public.reseller_activity_logs(created_at DESC);

ALTER TABLE public.reseller_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reseller can view own logs"
ON public.reseller_activity_logs FOR SELECT
USING (reseller_id = get_reseller_id(auth.uid()));

CREATE POLICY "Reseller can insert own logs"
ON public.reseller_activity_logs FOR INSERT
WITH CHECK (reseller_id = get_reseller_id(auth.uid()));

CREATE POLICY "Admin can view all logs"
ON public.reseller_activity_logs FOR SELECT
USING (is_company_member(auth.uid(), company_id));

-- Add custom_price to client_subscriptions for reseller margin
ALTER TABLE public.client_subscriptions ADD COLUMN IF NOT EXISTS custom_price numeric DEFAULT 0;
ALTER TABLE public.client_subscriptions ADD COLUMN IF NOT EXISTS financial_notes text DEFAULT '';

-- Add auto_block_days setting to company level
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS auto_block_days integer DEFAULT 0;
