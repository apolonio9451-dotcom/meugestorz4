
-- ==========================================
-- SaaS Plans (plans for selling system access)
-- ==========================================
CREATE TABLE public.saas_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price NUMERIC NOT NULL DEFAULT 0,
  max_clients INTEGER NOT NULL DEFAULT 50,
  max_resellers INTEGER NOT NULL DEFAULT 0,
  allow_sub_resellers BOOLEAN NOT NULL DEFAULT false,
  duration_days INTEGER NOT NULL DEFAULT 30,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.saas_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view active saas plans"
  ON public.saas_plans FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Company owners can insert saas plans"
  ON public.saas_plans FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.company_memberships WHERE user_id = auth.uid() AND role = 'owner')
  );

CREATE POLICY "Company owners can update saas plans"
  ON public.saas_plans FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.company_memberships WHERE user_id = auth.uid() AND role = 'owner')
  );

CREATE POLICY "Company owners can delete saas plans"
  ON public.saas_plans FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.company_memberships WHERE user_id = auth.uid() AND role = 'owner')
  );

CREATE TRIGGER update_saas_plans_updated_at
  BEFORE UPDATE ON public.saas_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- SaaS Subscriptions (company subscriptions to SaaS plans)
-- ==========================================
CREATE TABLE public.saas_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  saas_plan_id UUID NOT NULL REFERENCES public.saas_plans(id),
  status TEXT NOT NULL DEFAULT 'active',
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.saas_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own subscription"
  ON public.saas_subscriptions FOR SELECT TO authenticated
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "Owners can insert subscriptions"
  ON public.saas_subscriptions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.company_memberships WHERE user_id = auth.uid() AND role = 'owner')
  );

CREATE POLICY "Owners can update subscriptions"
  ON public.saas_subscriptions FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.company_memberships WHERE user_id = auth.uid() AND role = 'owner')
  );

CREATE POLICY "Owners can delete subscriptions"
  ON public.saas_subscriptions FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.company_memberships WHERE user_id = auth.uid() AND role = 'owner')
  );

CREATE TRIGGER update_saas_subscriptions_updated_at
  BEFORE UPDATE ON public.saas_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==========================================
-- Multi-level reseller hierarchy
-- ==========================================
ALTER TABLE public.resellers
  ADD COLUMN IF NOT EXISTS parent_reseller_id UUID REFERENCES public.resellers(id) ON DELETE SET NULL;

ALTER TABLE public.resellers
  ADD COLUMN IF NOT EXISTS level INTEGER NOT NULL DEFAULT 1;

-- RLS for sub-resellers: resellers can view their sub-resellers
CREATE POLICY "Reseller can view sub-resellers"
  ON public.resellers FOR SELECT TO authenticated
  USING (parent_reseller_id = get_reseller_id(auth.uid()));

CREATE POLICY "Reseller can create sub-resellers"
  ON public.resellers FOR INSERT TO authenticated
  WITH CHECK (parent_reseller_id = get_reseller_id(auth.uid()));

CREATE POLICY "Reseller can update sub-resellers"
  ON public.resellers FOR UPDATE TO authenticated
  USING (parent_reseller_id = get_reseller_id(auth.uid()));
