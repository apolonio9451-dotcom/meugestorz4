
-- Add column to track last auto-send date on clients
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS ultimo_envio_auto date;

-- Create table to log auto-send results
CREATE TABLE public.auto_send_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'success',
  error_message text DEFAULT '',
  phone text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.auto_send_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view send logs"
  ON public.auto_send_logs FOR SELECT
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "Edge function can insert logs"
  ON public.auto_send_logs FOR INSERT
  WITH CHECK (true);
