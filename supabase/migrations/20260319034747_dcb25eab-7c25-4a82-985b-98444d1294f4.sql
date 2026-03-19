-- Monitor de conversas do disparo em massa
CREATE TABLE IF NOT EXISTS public.mass_broadcast_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.mass_broadcast_campaigns(id) ON DELETE CASCADE,
  recipient_id UUID NULL REFERENCES public.mass_broadcast_recipients(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  normalized_phone TEXT NOT NULL,
  contact_name TEXT NOT NULL DEFAULT '',
  conversation_status TEXT NOT NULL DEFAULT 'bot_active',
  has_reply BOOLEAN NOT NULL DEFAULT false,
  last_message_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_outgoing_at TIMESTAMP WITH TIME ZONE NULL,
  last_incoming_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, normalized_phone)
);

CREATE TABLE IF NOT EXISTS public.mass_broadcast_conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES public.mass_broadcast_campaigns(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.mass_broadcast_conversations(id) ON DELETE CASCADE,
  recipient_id UUID NULL REFERENCES public.mass_broadcast_recipients(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  normalized_phone TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'outbound',
  sender_type TEXT NOT NULL DEFAULT 'bot',
  source TEXT NOT NULL DEFAULT 'mass_broadcast',
  message_type TEXT NOT NULL DEFAULT 'text',
  message TEXT NOT NULL DEFAULT '',
  delivery_status TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mass_broadcast_conversations_company_campaign_last_message
  ON public.mass_broadcast_conversations (company_id, campaign_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_mass_broadcast_conversations_campaign_phone
  ON public.mass_broadcast_conversations (campaign_id, normalized_phone);

CREATE INDEX IF NOT EXISTS idx_mass_broadcast_conversation_messages_conversation_created
  ON public.mass_broadcast_conversation_messages (conversation_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_mass_broadcast_conversation_messages_company_campaign
  ON public.mass_broadcast_conversation_messages (company_id, campaign_id, created_at DESC);

ALTER TABLE public.mass_broadcast_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mass_broadcast_conversation_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'mass_broadcast_conversations'
      AND policyname = 'Admins can manage mass broadcast conversations'
  ) THEN
    CREATE POLICY "Admins can manage mass broadcast conversations"
    ON public.mass_broadcast_conversations
    FOR ALL
    TO authenticated
    USING (public.is_company_admin_or_owner(auth.uid(), company_id))
    WITH CHECK (public.is_company_admin_or_owner(auth.uid(), company_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'mass_broadcast_conversations'
      AND policyname = 'Members can view mass broadcast conversations'
  ) THEN
    CREATE POLICY "Members can view mass broadcast conversations"
    ON public.mass_broadcast_conversations
    FOR SELECT
    TO authenticated
    USING (public.is_company_member(auth.uid(), company_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'mass_broadcast_conversation_messages'
      AND policyname = 'Admins can manage mass broadcast conversation messages'
  ) THEN
    CREATE POLICY "Admins can manage mass broadcast conversation messages"
    ON public.mass_broadcast_conversation_messages
    FOR ALL
    TO authenticated
    USING (public.is_company_admin_or_owner(auth.uid(), company_id))
    WITH CHECK (public.is_company_admin_or_owner(auth.uid(), company_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'mass_broadcast_conversation_messages'
      AND policyname = 'Members can view mass broadcast conversation messages'
  ) THEN
    CREATE POLICY "Members can view mass broadcast conversation messages"
    ON public.mass_broadcast_conversation_messages
    FOR SELECT
    TO authenticated
    USING (public.is_company_member(auth.uid(), company_id));
  END IF;
END $$;

DROP TRIGGER IF EXISTS update_mass_broadcast_conversations_updated_at ON public.mass_broadcast_conversations;
CREATE TRIGGER update_mass_broadcast_conversations_updated_at
BEFORE UPDATE ON public.mass_broadcast_conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.mass_broadcast_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.mass_broadcast_conversation_messages;