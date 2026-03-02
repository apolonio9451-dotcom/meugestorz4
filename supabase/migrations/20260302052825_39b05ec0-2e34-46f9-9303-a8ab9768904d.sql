
-- Create company_settings table for branding
CREATE TABLE public.company_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  brand_name TEXT NOT NULL DEFAULT '',
  login_slug TEXT,
  logo_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#00db49',
  secondary_color TEXT NOT NULL DEFAULT '#00c0f5',
  background_color TEXT NOT NULL DEFAULT '#0357a5',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT company_settings_company_id_key UNIQUE (company_id)
);

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can view settings"
ON public.company_settings FOR SELECT
USING (public.is_company_member(company_id, auth.uid()));

CREATE POLICY "Company admins can update settings"
ON public.company_settings FOR UPDATE
USING (public.is_company_admin_or_owner(company_id, auth.uid()));

CREATE POLICY "Company admins can insert settings"
ON public.company_settings FOR INSERT
WITH CHECK (public.is_company_admin_or_owner(company_id, auth.uid()));

-- Storage bucket for logos
INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true);

CREATE POLICY "Anyone can view logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'logos');

CREATE POLICY "Authenticated users can upload logos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'logos' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update logos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'logos' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete logos"
ON storage.objects FOR DELETE
USING (bucket_id = 'logos' AND auth.role() = 'authenticated');

-- Trigger for updated_at
CREATE TRIGGER update_company_settings_updated_at
BEFORE UPDATE ON public.company_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
