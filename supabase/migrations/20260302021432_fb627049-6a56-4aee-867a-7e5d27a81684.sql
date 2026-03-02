
-- Table to store message templates per category per company
CREATE TABLE public.message_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  category TEXT NOT NULL, -- 'vence_hoje', 'vence_amanha', 'a_vencer', 'vencidos', 'followup'
  message TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, category)
);

-- Enable RLS
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Members can view message templates"
ON public.message_templates FOR SELECT
USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "Admin/Owner can create message templates"
ON public.message_templates FOR INSERT
WITH CHECK (is_company_admin_or_owner(auth.uid(), company_id));

CREATE POLICY "Admin/Owner can update message templates"
ON public.message_templates FOR UPDATE
USING (is_company_admin_or_owner(auth.uid(), company_id));

CREATE POLICY "Admin/Owner can delete message templates"
ON public.message_templates FOR DELETE
USING (is_company_admin_or_owner(auth.uid(), company_id));

-- Trigger for updated_at
CREATE TRIGGER update_message_templates_updated_at
BEFORE UPDATE ON public.message_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
