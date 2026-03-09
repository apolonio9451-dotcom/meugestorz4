
-- Add permissive policies for resellers to manage their own api_settings
-- Resellers who have their own company (via trial) need to CRUD their own api_settings

CREATE POLICY "Reseller can view own api settings"
ON public.api_settings FOR SELECT
TO authenticated
USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Reseller can insert own api settings"
ON public.api_settings FOR INSERT
TO authenticated
WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Reseller can update own api settings"
ON public.api_settings FOR UPDATE
TO authenticated
USING (company_id = get_user_company_id(auth.uid()));
