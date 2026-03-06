CREATE POLICY "Reseller can view company settings"
ON public.company_settings
FOR SELECT
TO authenticated
USING (company_id = get_reseller_company_id(auth.uid()));