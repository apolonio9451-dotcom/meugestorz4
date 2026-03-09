
-- Table to store UAZAPI credentials per company
CREATE TABLE public.api_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  api_url TEXT NOT NULL DEFAULT '',
  api_token TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

-- RLS
ALTER TABLE public.api_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Owner can manage api settings"
  ON public.api_settings FOR ALL
  TO authenticated
  USING (is_company_admin_or_owner(auth.uid(), company_id))
  WITH CHECK (is_company_admin_or_owner(auth.uid(), company_id));

CREATE POLICY "Members can view api settings"
  ON public.api_settings FOR SELECT
  TO authenticated
  USING (is_company_member(auth.uid(), company_id));
