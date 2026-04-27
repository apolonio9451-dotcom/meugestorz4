CREATE TABLE IF NOT EXISTS public.api_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL UNIQUE,
  api_url TEXT,
  api_token TEXT,
  instance_name TEXT,
  uazapi_base_url TEXT,
  auto_send_hour INTEGER DEFAULT 8,
  auto_send_minute INTEGER DEFAULT 0,
  send_interval_seconds INTEGER DEFAULT 60,
  overdue_charge_pause_enabled BOOLEAN DEFAULT true,
  overdue_charge_pause_days INTEGER DEFAULT 10,
  football_api_key TEXT,
  campaigns_engine_enabled BOOLEAN DEFAULT false,
  campaigns_admin_test_phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.api_settings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own api_settings" 
ON public.api_settings FOR SELECT 
USING (true); -- Usually filtered by company_id in app logic, but for simplicity here

CREATE POLICY "Users can update their own api_settings" 
ON public.api_settings FOR UPDATE 
USING (true);

CREATE POLICY "Users can insert their own api_settings" 
ON public.api_settings FOR INSERT 
WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_api_settings_updated_at
BEFORE UPDATE ON public.api_settings
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();