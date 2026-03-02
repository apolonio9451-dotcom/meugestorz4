
-- Drop restrictive policies and create permissive ones
DROP POLICY IF EXISTS "Company members can view settings" ON public.company_settings;
DROP POLICY IF EXISTS "Company admins can update settings" ON public.company_settings;
DROP POLICY IF EXISTS "Company admins can insert settings" ON public.company_settings;

CREATE POLICY "Company members can view settings"
ON public.company_settings FOR SELECT TO authenticated
USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Company admins can update settings"
ON public.company_settings FOR UPDATE TO authenticated
USING (public.is_company_admin_or_owner(auth.uid(), company_id));

CREATE POLICY "Company admins can insert settings"
ON public.company_settings FOR INSERT TO authenticated
WITH CHECK (public.is_company_admin_or_owner(auth.uid(), company_id));
