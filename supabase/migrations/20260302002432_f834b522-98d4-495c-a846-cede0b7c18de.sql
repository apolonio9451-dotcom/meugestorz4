
CREATE TABLE public.client_mac_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  mac TEXT NOT NULL DEFAULT '',
  key TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.client_mac_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view mac_keys"
ON public.client_mac_keys FOR SELECT
USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "Members can create mac_keys"
ON public.client_mac_keys FOR INSERT
WITH CHECK (is_company_member(auth.uid(), company_id));

CREATE POLICY "Admin/Owner can update mac_keys"
ON public.client_mac_keys FOR UPDATE
USING (is_company_admin_or_owner(auth.uid(), company_id));

CREATE POLICY "Admin/Owner can delete mac_keys"
ON public.client_mac_keys FOR DELETE
USING (is_company_admin_or_owner(auth.uid(), company_id));
