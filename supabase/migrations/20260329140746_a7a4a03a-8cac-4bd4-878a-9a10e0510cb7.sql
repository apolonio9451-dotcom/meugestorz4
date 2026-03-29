DROP POLICY IF EXISTS "Reseller can insert own api settings" ON public.api_settings;
CREATE POLICY "Reseller can insert own api settings"
ON public.api_settings FOR INSERT TO authenticated
WITH CHECK (company_id = public.get_reseller_company_id(auth.uid()));

DROP POLICY IF EXISTS "Reseller can update own api settings" ON public.api_settings;
CREATE POLICY "Reseller can update own api settings"
ON public.api_settings FOR UPDATE TO authenticated
USING (company_id = public.get_reseller_company_id(auth.uid()));

DROP POLICY IF EXISTS "Reseller can view own api settings" ON public.api_settings;
CREATE POLICY "Reseller can view own api settings"
ON public.api_settings FOR SELECT TO authenticated
USING (company_id = public.get_reseller_company_id(auth.uid()));

DROP POLICY IF EXISTS "Reseller can insert own chatbot settings" ON public.chatbot_settings;
CREATE POLICY "Reseller can insert own chatbot settings"
ON public.chatbot_settings FOR INSERT TO authenticated
WITH CHECK (company_id = public.get_reseller_company_id(auth.uid()));

DROP POLICY IF EXISTS "Reseller can update own chatbot settings" ON public.chatbot_settings;
CREATE POLICY "Reseller can update own chatbot settings"
ON public.chatbot_settings FOR UPDATE TO authenticated
USING (company_id = public.get_reseller_company_id(auth.uid()));

DROP POLICY IF EXISTS "Reseller can view own chatbot settings" ON public.chatbot_settings;
CREATE POLICY "Reseller can view own chatbot settings"
ON public.chatbot_settings FOR SELECT TO authenticated
USING (company_id = public.get_reseller_company_id(auth.uid()));