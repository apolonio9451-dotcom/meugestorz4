
-- Chatbot settings per company (multi-tenant)
CREATE TABLE public.chatbot_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT false,
  personality text NOT NULL DEFAULT '',
  billing_cron_hour integer NOT NULL DEFAULT 8,
  billing_cron_minute integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

ALTER TABLE public.chatbot_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view chatbot settings" ON public.chatbot_settings
  FOR SELECT TO authenticated
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "Admin/Owner can manage chatbot settings" ON public.chatbot_settings
  FOR ALL TO authenticated
  USING (is_company_admin_or_owner(auth.uid(), company_id))
  WITH CHECK (is_company_admin_or_owner(auth.uid(), company_id));

CREATE POLICY "Reseller can insert own chatbot settings" ON public.chatbot_settings
  FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Reseller can update own chatbot settings" ON public.chatbot_settings
  FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Reseller can view own chatbot settings" ON public.chatbot_settings
  FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));

-- Chatbot media files (audio/video)
CREATE TABLE public.chatbot_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  file_name text NOT NULL DEFAULT '',
  file_url text NOT NULL DEFAULT '',
  file_type text NOT NULL DEFAULT 'audio',
  file_size bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chatbot_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view chatbot media" ON public.chatbot_media
  FOR SELECT TO authenticated
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "Admin/Owner can manage chatbot media" ON public.chatbot_media
  FOR ALL TO authenticated
  USING (is_company_admin_or_owner(auth.uid(), company_id))
  WITH CHECK (is_company_admin_or_owner(auth.uid(), company_id));

CREATE POLICY "Reseller can manage own chatbot media" ON public.chatbot_media
  FOR ALL TO authenticated
  USING (company_id = get_user_company_id(auth.uid()))
  WITH CHECK (company_id = get_user_company_id(auth.uid()));

-- Chatbot interaction logs
CREATE TABLE public.chatbot_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  phone text NOT NULL DEFAULT '',
  client_name text NOT NULL DEFAULT 'Desconhecido',
  message_received text NOT NULL DEFAULT '',
  message_sent text NOT NULL DEFAULT '',
  context_type text NOT NULL DEFAULT 'new_contact',
  status text NOT NULL DEFAULT 'success',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chatbot_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view chatbot logs" ON public.chatbot_logs
  FOR SELECT TO authenticated
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "Reseller can view own chatbot logs" ON public.chatbot_logs
  FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));

-- Trigger for updated_at on chatbot_settings
CREATE TRIGGER update_chatbot_settings_updated_at
  BEFORE UPDATE ON public.chatbot_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
