-- Monitor state for auto-send control panel
CREATE TABLE IF NOT EXISTS public.auto_send_control_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'idle',
  stop_requested BOOLEAN NOT NULL DEFAULT false,
  pause_requested BOOLEAN NOT NULL DEFAULT false,
  last_action TEXT NOT NULL DEFAULT '',
  last_error TEXT,
  last_error_body TEXT,
  last_activity_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT auto_send_control_states_status_check CHECK (status IN ('idle','running','paused','stopped','error'))
);

ALTER TABLE public.auto_send_control_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage auto send control states"
ON public.auto_send_control_states
FOR ALL
TO authenticated
USING (public.is_company_admin_or_owner(auth.uid(), company_id))
WITH CHECK (public.is_company_admin_or_owner(auth.uid(), company_id));

CREATE POLICY "Members can view auto send control states"
ON public.auto_send_control_states
FOR SELECT
TO authenticated
USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Resellers can manage own auto send control states"
ON public.auto_send_control_states
FOR ALL
TO authenticated
USING (company_id = public.get_reseller_company_id(auth.uid()))
WITH CHECK (company_id = public.get_reseller_company_id(auth.uid()));

CREATE TRIGGER update_auto_send_control_states_updated_at
BEFORE UPDATE ON public.auto_send_control_states
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_auto_send_control_states_company_id
ON public.auto_send_control_states(company_id);

-- Real-time operational feed for monitor UI
CREATE TABLE IF NOT EXISTS public.auto_send_runtime_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  level TEXT NOT NULL DEFAULT 'info',
  event_type TEXT NOT NULL DEFAULT 'runtime',
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT auto_send_runtime_events_level_check CHECK (level IN ('info','warn','error','success'))
);

ALTER TABLE public.auto_send_runtime_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage auto send runtime events"
ON public.auto_send_runtime_events
FOR ALL
TO authenticated
USING (public.is_company_admin_or_owner(auth.uid(), company_id))
WITH CHECK (public.is_company_admin_or_owner(auth.uid(), company_id));

CREATE POLICY "Members can view auto send runtime events"
ON public.auto_send_runtime_events
FOR SELECT
TO authenticated
USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Resellers can manage own auto send runtime events"
ON public.auto_send_runtime_events
FOR ALL
TO authenticated
USING (company_id = public.get_reseller_company_id(auth.uid()))
WITH CHECK (company_id = public.get_reseller_company_id(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_auto_send_runtime_events_company_created
ON public.auto_send_runtime_events(company_id, created_at DESC);

ALTER PUBLICATION supabase_realtime ADD TABLE public.auto_send_control_states;
ALTER PUBLICATION supabase_realtime ADD TABLE public.auto_send_runtime_events;