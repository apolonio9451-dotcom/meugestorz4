
-- Activity log for client management
CREATE TABLE public.client_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  client_name text NOT NULL DEFAULT '',
  action text NOT NULL,
  details text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.client_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view activity logs"
  ON public.client_activity_logs FOR SELECT
  USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "Members can create activity logs"
  ON public.client_activity_logs FOR INSERT
  WITH CHECK (is_company_member(auth.uid(), company_id));

CREATE INDEX idx_client_activity_logs_company ON public.client_activity_logs(company_id);
CREATE INDEX idx_client_activity_logs_created ON public.client_activity_logs(created_at DESC);
