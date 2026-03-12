
-- Add new columns to chatbot_settings for comprehensive bot configuration
ALTER TABLE public.chatbot_settings
  ADD COLUMN IF NOT EXISTS welcome_message text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS away_message text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS business_hours_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS business_hours_start text NOT NULL DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS business_hours_end text NOT NULL DEFAULT '18:00',
  ADD COLUMN IF NOT EXISTS business_days integer[] NOT NULL DEFAULT '{1,2,3,4,5}',
  ADD COLUMN IF NOT EXISTS min_delay_seconds integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS max_delay_seconds integer NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS transfer_keyword text NOT NULL DEFAULT 'atendente',
  ADD COLUMN IF NOT EXISTS transfer_message text NOT NULL DEFAULT 'Estou transferindo você para um atendente humano. Aguarde um momento...',
  ADD COLUMN IF NOT EXISTS transfer_phone text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS max_messages_per_contact integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unknown_message text NOT NULL DEFAULT 'Desculpe, não entendi. Pode reformular sua pergunta?',
  ADD COLUMN IF NOT EXISTS closing_message text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS send_welcome_media_id uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ai_model text NOT NULL DEFAULT 'google/gemini-2.5-flash',
  ADD COLUMN IF NOT EXISTS ai_temperature numeric NOT NULL DEFAULT 0.7;

-- Create chatbot_auto_replies table for keyword triggers and quick replies
CREATE TABLE IF NOT EXISTS public.chatbot_auto_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  trigger_keyword text NOT NULL DEFAULT '',
  trigger_type text NOT NULL DEFAULT 'contains',
  response_text text NOT NULL DEFAULT '',
  response_media_id uuid DEFAULT NULL REFERENCES public.chatbot_media(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chatbot_auto_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Owner can manage auto replies"
  ON public.chatbot_auto_replies FOR ALL TO authenticated
  USING (is_company_admin_or_owner(auth.uid(), company_id))
  WITH CHECK (is_company_admin_or_owner(auth.uid(), company_id));

CREATE POLICY "Members can view auto replies"
  ON public.chatbot_auto_replies FOR SELECT TO authenticated
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "Reseller can manage own auto replies"
  ON public.chatbot_auto_replies FOR ALL TO authenticated
  USING (company_id = get_user_company_id(auth.uid()))
  WITH CHECK (company_id = get_user_company_id(auth.uid()));

-- Create chatbot_blocked_contacts table
CREATE TABLE IF NOT EXISTS public.chatbot_blocked_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  phone text NOT NULL DEFAULT '',
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chatbot_blocked_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Owner can manage blocked contacts"
  ON public.chatbot_blocked_contacts FOR ALL TO authenticated
  USING (is_company_admin_or_owner(auth.uid(), company_id))
  WITH CHECK (is_company_admin_or_owner(auth.uid(), company_id));

CREATE POLICY "Members can view blocked contacts"
  ON public.chatbot_blocked_contacts FOR SELECT TO authenticated
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "Reseller can manage own blocked contacts"
  ON public.chatbot_blocked_contacts FOR ALL TO authenticated
  USING (company_id = get_user_company_id(auth.uid()))
  WITH CHECK (company_id = get_user_company_id(auth.uid()));

-- Add trigger for updated_at on auto_replies
CREATE TRIGGER update_chatbot_auto_replies_updated_at
  BEFORE UPDATE ON public.chatbot_auto_replies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
