
CREATE TABLE public.system_announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.system_announcements ENABLE ROW LEVEL SECURITY;

-- Only owners can manage announcements
CREATE POLICY "Owner can manage announcements"
ON public.system_announcements
FOR ALL
TO authenticated
USING (is_company_admin_or_owner(auth.uid(), company_id))
WITH CHECK (is_company_admin_or_owner(auth.uid(), company_id));

-- All company members can view active announcements
CREATE POLICY "Members can view active announcements"
ON public.system_announcements
FOR SELECT
TO authenticated
USING (is_company_member(auth.uid(), company_id) AND is_active = true);

-- Resellers can view announcements from their company
CREATE POLICY "Reseller can view announcements"
ON public.system_announcements
FOR SELECT
TO authenticated
USING (company_id = get_reseller_company_id(auth.uid()) AND is_active = true);
