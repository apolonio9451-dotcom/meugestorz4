
CREATE TABLE public.chatbot_conversation_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  phone TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user',
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookups by company + phone + time
CREATE INDEX idx_chatbot_conv_msgs_lookup ON public.chatbot_conversation_messages (company_id, phone, created_at DESC);

-- Enable RLS
ALTER TABLE public.chatbot_conversation_messages ENABLE ROW LEVEL SECURITY;

-- RLS: Members can view conversation messages
CREATE POLICY "Members can view conversation messages"
  ON public.chatbot_conversation_messages
  FOR SELECT
  TO authenticated
  USING (is_company_member(auth.uid(), company_id));

-- RLS: Reseller can view own conversation messages
CREATE POLICY "Reseller can view own conversation messages"
  ON public.chatbot_conversation_messages
  FOR SELECT
  TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));

-- Auto-cleanup: delete messages older than 24 hours (via cron or manual)
-- For now, the edge function will handle cleanup inline
