-- Fix client_credentials: use get_reseller_company_id instead of get_user_company_id
DROP POLICY IF EXISTS "Reseller can manage own client credentials" ON public.client_credentials;
CREATE POLICY "Reseller can manage own client credentials"
ON public.client_credentials FOR ALL TO authenticated
USING (company_id = public.get_reseller_company_id(auth.uid()))
WITH CHECK (company_id = public.get_reseller_company_id(auth.uid()));

-- Fix bot_training_rules: use get_reseller_company_id
DROP POLICY IF EXISTS "Reseller can manage own training rules" ON public.bot_training_rules;
CREATE POLICY "Reseller can manage own training rules"
ON public.bot_training_rules FOR ALL TO authenticated
USING (company_id = public.get_reseller_company_id(auth.uid()))
WITH CHECK (company_id = public.get_reseller_company_id(auth.uid()));

-- Fix chatbot_auto_replies: use get_reseller_company_id
DROP POLICY IF EXISTS "Reseller can manage own auto replies" ON public.chatbot_auto_replies;
CREATE POLICY "Reseller can manage own auto replies"
ON public.chatbot_auto_replies FOR ALL TO authenticated
USING (company_id = public.get_reseller_company_id(auth.uid()))
WITH CHECK (company_id = public.get_reseller_company_id(auth.uid()));

-- Fix chatbot_blocked_contacts: use get_reseller_company_id
DROP POLICY IF EXISTS "Reseller can manage own blocked contacts" ON public.chatbot_blocked_contacts;
CREATE POLICY "Reseller can manage own blocked contacts"
ON public.chatbot_blocked_contacts FOR ALL TO authenticated
USING (company_id = public.get_reseller_company_id(auth.uid()))
WITH CHECK (company_id = public.get_reseller_company_id(auth.uid()));

-- Fix chatbot_media: use get_reseller_company_id
DROP POLICY IF EXISTS "Reseller can manage own chatbot media" ON public.chatbot_media;
CREATE POLICY "Reseller can manage own chatbot media"
ON public.chatbot_media FOR ALL TO authenticated
USING (company_id = public.get_reseller_company_id(auth.uid()))
WITH CHECK (company_id = public.get_reseller_company_id(auth.uid()));

-- Fix message_templates: use get_reseller_company_id
DROP POLICY IF EXISTS "Reseller can manage own message templates" ON public.message_templates;
CREATE POLICY "Reseller can manage own message templates"
ON public.message_templates FOR ALL TO authenticated
USING (company_id = public.get_reseller_company_id(auth.uid()))
WITH CHECK (company_id = public.get_reseller_company_id(auth.uid()));

-- Fix chatbot_conversation_messages: use get_reseller_company_id
DROP POLICY IF EXISTS "Reseller can view own conversation messages" ON public.chatbot_conversation_messages;
CREATE POLICY "Reseller can view own conversation messages"
ON public.chatbot_conversation_messages FOR SELECT TO authenticated
USING (company_id = public.get_reseller_company_id(auth.uid()));

-- Fix chatbot_logs: use get_reseller_company_id
DROP POLICY IF EXISTS "Reseller can view own chatbot logs" ON public.chatbot_logs;
CREATE POLICY "Reseller can view own chatbot logs"
ON public.chatbot_logs FOR SELECT TO authenticated
USING (company_id = public.get_reseller_company_id(auth.uid()));

-- Add UPDATE WITH CHECK to reseller api_settings policy
DROP POLICY IF EXISTS "Reseller can update own api settings" ON public.api_settings;
CREATE POLICY "Reseller can update own api settings"
ON public.api_settings FOR UPDATE TO authenticated
USING (company_id = public.get_reseller_company_id(auth.uid()))
WITH CHECK (company_id = public.get_reseller_company_id(auth.uid()));