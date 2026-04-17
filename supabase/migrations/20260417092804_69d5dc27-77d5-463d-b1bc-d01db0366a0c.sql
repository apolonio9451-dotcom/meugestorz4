-- Tabela de campanhas predefinidas (calendário de datas comemorativas)
CREATE TABLE public.campaign_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  date_name TEXT NOT NULL,
  day_month TEXT NOT NULL,
  message_text TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  target_audience TEXT NOT NULL DEFAULT 'Todos' CHECK (target_audience IN ('Homens', 'Mulheres', 'Todos')),
  save_preset BOOLEAN NOT NULL DEFAULT true,
  is_configured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaign_presets_company ON public.campaign_presets(company_id);

ALTER TABLE public.campaign_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Owner can manage campaign presets"
ON public.campaign_presets
FOR ALL
TO authenticated
USING (public.is_company_admin_or_owner(auth.uid(), company_id))
WITH CHECK (public.is_company_admin_or_owner(auth.uid(), company_id));

CREATE POLICY "Members can view campaign presets"
ON public.campaign_presets
FOR SELECT
TO authenticated
USING (public.is_company_member(auth.uid(), company_id));

CREATE TRIGGER update_campaign_presets_updated_at
BEFORE UPDATE ON public.campaign_presets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bucket público para artes de campanhas
INSERT INTO storage.buckets (id, name, public)
VALUES ('campaigns', 'campaigns', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage para o bucket campaigns
CREATE POLICY "Campaigns images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'campaigns');

CREATE POLICY "Authenticated users can upload campaign images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'campaigns');

CREATE POLICY "Authenticated users can update campaign images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'campaigns');

CREATE POLICY "Authenticated users can delete campaign images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'campaigns');