
CREATE TABLE public.auto_send_category_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  category TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(company_id, category)
);

ALTER TABLE public.auto_send_category_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their company category settings"
  ON public.auto_send_category_settings FOR SELECT TO authenticated
  USING (public.is_company_member(company_id, auth.uid()));

CREATE POLICY "Admins can manage category settings"
  ON public.auto_send_category_settings FOR ALL TO authenticated
  USING (public.is_company_admin_or_owner(company_id, auth.uid()))
  WITH CHECK (public.is_company_admin_or_owner(company_id, auth.uid()));
