
ALTER TABLE public.chatbot_settings 
  ADD COLUMN IF NOT EXISTS new_contact_instructions text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS client_instructions text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS presence_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ai_decision_log boolean NOT NULL DEFAULT true;
