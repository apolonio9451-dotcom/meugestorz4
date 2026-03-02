
CREATE TABLE public.winback_campaign_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  current_step INTEGER NOT NULL DEFAULT 0,
  last_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, client_id)
);

ALTER TABLE public.winback_campaign_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view campaign progress"
ON public.winback_campaign_progress FOR SELECT
USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "Admin/Owner can manage campaign progress"
ON public.winback_campaign_progress FOR ALL
USING (is_company_admin_or_owner(auth.uid(), company_id));

CREATE TRIGGER update_winback_progress_updated_at
BEFORE UPDATE ON public.winback_campaign_progress
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
