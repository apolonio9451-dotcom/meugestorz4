
-- Resellers table
CREATE TABLE public.resellers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT DEFAULT '',
  whatsapp TEXT DEFAULT '',
  credit_balance INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.resellers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view resellers" ON public.resellers FOR SELECT USING (is_company_member(auth.uid(), company_id));
CREATE POLICY "Admin/Owner can create resellers" ON public.resellers FOR INSERT WITH CHECK (is_company_admin_or_owner(auth.uid(), company_id));
CREATE POLICY "Admin/Owner can update resellers" ON public.resellers FOR UPDATE USING (is_company_admin_or_owner(auth.uid(), company_id));
CREATE POLICY "Admin/Owner can delete resellers" ON public.resellers FOR DELETE USING (is_company_admin_or_owner(auth.uid(), company_id));

CREATE TRIGGER update_resellers_updated_at BEFORE UPDATE ON public.resellers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Credit transactions table
CREATE TABLE public.reseller_credit_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reseller_id UUID NOT NULL REFERENCES public.resellers(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'purchase',
  description TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.reseller_credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view credit transactions" ON public.reseller_credit_transactions FOR SELECT USING (is_company_member(auth.uid(), company_id));
CREATE POLICY "Admin/Owner can create credit transactions" ON public.reseller_credit_transactions FOR INSERT WITH CHECK (is_company_admin_or_owner(auth.uid(), company_id));
