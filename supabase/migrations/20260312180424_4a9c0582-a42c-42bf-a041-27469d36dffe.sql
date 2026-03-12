
CREATE POLICY "Reseller can manage own message templates"
  ON public.message_templates FOR ALL
  TO authenticated
  USING (company_id = get_user_company_id(auth.uid()))
  WITH CHECK (company_id = get_user_company_id(auth.uid()));
