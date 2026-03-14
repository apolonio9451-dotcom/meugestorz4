
-- Add send_interval_seconds to api_settings (default 60 seconds)
ALTER TABLE public.api_settings ADD COLUMN IF NOT EXISTS send_interval_seconds integer NOT NULL DEFAULT 60;

-- Add message_sent column to auto_send_logs to store the actual sent text
ALTER TABLE public.auto_send_logs ADD COLUMN IF NOT EXISTS message_sent text NOT NULL DEFAULT '';

-- Enable realtime for auto_send_logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.auto_send_logs;
