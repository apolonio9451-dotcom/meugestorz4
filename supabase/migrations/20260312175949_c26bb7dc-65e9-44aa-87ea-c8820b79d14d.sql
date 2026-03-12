
CREATE TABLE public.client_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  username TEXT NOT NULL DEFAULT '',
  password TEXT NOT NULL DEFAULT '',
  label TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.client_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view client credentials"
  ON public.client_credentials FOR SELECT
  TO authenticated
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "Members can create client credentials"
  ON public.client_credentials FOR INSERT
  TO authenticated
  WITH CHECK (is_company_member(auth.uid(), company_id));

CREATE POLICY "Admin/Owner can update client credentials"
  ON public.client_credentials FOR UPDATE
  TO authenticated
  USING (is_company_admin_or_owner(auth.uid(), company_id));

CREATE POLICY "Admin/Owner can delete client credentials"
  ON public.client_credentials FOR DELETE
  TO authenticated
  USING (is_company_admin_or_owner(auth.uid(), company_id));

CREATE POLICY "Reseller can manage own client credentials"
  ON public.client_credentials FOR ALL
  TO authenticated
  USING (company_id = get_user_company_id(auth.uid()))
  WITH CHECK (company_id = get_user_company_id(auth.uid()));
