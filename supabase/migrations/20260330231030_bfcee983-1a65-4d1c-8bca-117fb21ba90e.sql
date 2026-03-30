
-- Fix auto_send_logs: replace broad member policy with scoped policies
DROP POLICY IF EXISTS "Members can view send logs" ON public.auto_send_logs;

-- Admin/Owner can see all logs for their company
CREATE POLICY "Admin/Owner can view send logs"
  ON public.auto_send_logs FOR SELECT
  TO authenticated
  USING (public.is_company_admin_or_owner(auth.uid(), company_id));

-- Reseller can only see logs for their own clients
CREATE POLICY "Reseller can view own client send logs"
  ON public.auto_send_logs FOR SELECT
  TO authenticated
  USING (
    client_id IS NOT NULL
    AND public.can_access_client_record(company_id, client_id)
  );

-- Fix chatbot_logs: replace broad member policy with scoped policies
DROP POLICY IF EXISTS "Members can view chatbot logs" ON public.chatbot_logs;

-- Admin/Owner can see all chatbot logs
CREATE POLICY "Admin/Owner can view chatbot logs"
  ON public.chatbot_logs FOR SELECT
  TO authenticated
  USING (public.is_company_admin_or_owner(auth.uid(), company_id));

-- Fix chatbot_conversation_messages: replace broad member policy
DROP POLICY IF EXISTS "Members can view conversation messages" ON public.chatbot_conversation_messages;

CREATE POLICY "Admin/Owner can view conversation messages"
  ON public.chatbot_conversation_messages FOR SELECT
  TO authenticated
  USING (public.is_company_admin_or_owner(auth.uid(), company_id));
