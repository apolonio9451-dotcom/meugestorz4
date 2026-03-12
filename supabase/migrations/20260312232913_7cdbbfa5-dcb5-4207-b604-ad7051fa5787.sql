
-- Create bot_training_rules table
CREATE TABLE public.bot_training_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  trigger_question TEXT NOT NULL DEFAULT '',
  instruction TEXT NOT NULL DEFAULT '',
  media_id UUID REFERENCES public.chatbot_media(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL DEFAULT 'text',
  action_config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bot_training_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admin/Owner can manage training rules"
  ON public.bot_training_rules
  FOR ALL
  TO authenticated
  USING (is_company_admin_or_owner(auth.uid(), company_id))
  WITH CHECK (is_company_admin_or_owner(auth.uid(), company_id));

CREATE POLICY "Members can view training rules"
  ON public.bot_training_rules
  FOR SELECT
  TO authenticated
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "Reseller can manage own training rules"
  ON public.bot_training_rules
  FOR ALL
  TO authenticated
  USING (company_id = get_user_company_id(auth.uid()))
  WITH CHECK (company_id = get_user_company_id(auth.uid()));
