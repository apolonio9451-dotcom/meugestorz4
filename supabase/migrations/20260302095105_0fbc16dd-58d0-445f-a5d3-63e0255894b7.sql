
-- Create trial_links table for temporary access links
CREATE TABLE public.trial_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  reseller_id UUID REFERENCES public.resellers(id),
  created_by UUID NOT NULL,
  client_name TEXT NOT NULL,
  client_whatsapp TEXT DEFAULT '',
  token TEXT NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  status TEXT NOT NULL DEFAULT 'pending',
  activated_at TIMESTAMP WITH TIME ZONE,
  client_id UUID REFERENCES public.clients(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trial_links ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Members can view trial links"
  ON public.trial_links FOR SELECT
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "Members can create trial links"
  ON public.trial_links FOR INSERT
  WITH CHECK (is_company_member(auth.uid(), company_id));

CREATE POLICY "Admin/Owner can update trial links"
  ON public.trial_links FOR UPDATE
  USING (is_company_admin_or_owner(auth.uid(), company_id));

CREATE POLICY "Admin/Owner can delete trial links"
  ON public.trial_links FOR DELETE
  USING (is_company_admin_or_owner(auth.uid(), company_id));

-- Reseller policies
CREATE POLICY "Reseller can view own trial links"
  ON public.trial_links FOR SELECT
  USING (created_by = auth.uid());

CREATE POLICY "Reseller can create trial links"
  ON public.trial_links FOR INSERT
  WITH CHECK (created_by = auth.uid());
