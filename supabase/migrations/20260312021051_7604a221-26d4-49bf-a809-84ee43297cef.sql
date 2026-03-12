
ALTER TABLE public.chatbot_settings
  ADD COLUMN IF NOT EXISTS interactive_menu_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS interactive_menu_type text NOT NULL DEFAULT 'buttons',
  ADD COLUMN IF NOT EXISTS interactive_menu_title text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS interactive_menu_body text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS interactive_menu_footer text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS interactive_menu_button_text text NOT NULL DEFAULT 'Ver Opções',
  ADD COLUMN IF NOT EXISTS interactive_menu_items jsonb NOT NULL DEFAULT '[]'::jsonb;
