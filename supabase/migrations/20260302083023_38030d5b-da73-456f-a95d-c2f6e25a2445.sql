
-- Add permission columns to resellers table
ALTER TABLE public.resellers
  ADD COLUMN IF NOT EXISTS can_resell boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS can_create_subreseller boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_create_trial boolean NOT NULL DEFAULT true;

-- Create credit_settings table for master global config
CREATE TABLE public.credit_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  credit_cost_client integer NOT NULL DEFAULT 1,
  credit_cost_trial integer NOT NULL DEFAULT 1,
  credit_cost_subreseller integer NOT NULL DEFAULT 5,
  default_credit_value numeric NOT NULL DEFAULT 1.00,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

ALTER TABLE public.credit_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view credit settings"
  ON public.credit_settings FOR SELECT
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "Admin/Owner can manage credit settings"
  ON public.credit_settings FOR ALL
  USING (is_company_admin_or_owner(auth.uid(), company_id))
  WITH CHECK (is_company_admin_or_owner(auth.uid(), company_id));

-- Add trigger for updated_at
CREATE TRIGGER update_credit_settings_updated_at
  BEFORE UPDATE ON public.credit_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_resellers_parent ON public.resellers(parent_reseller_id);
CREATE INDEX IF NOT EXISTS idx_resellers_credit_balance ON public.resellers(credit_balance);
CREATE INDEX IF NOT EXISTS idx_reseller_credit_transactions_date ON public.reseller_credit_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_reseller_credit_transactions_reseller ON public.reseller_credit_transactions(reseller_id);
CREATE INDEX IF NOT EXISTS idx_reseller_activity_logs_reseller ON public.reseller_activity_logs(reseller_id);
