-- Create banner_templates table
CREATE TABLE public.banner_templates (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id),
    name TEXT NOT NULL,
    background_url TEXT NOT NULL,
    config JSONB NOT NULL DEFAULT '{
        "title": {"x": 540, "y": 280, "fontSize": 140, "color": "#FFFFFF", "text": "JOGOS"},
        "dayOfWeek": {"x": 540, "y": 350, "fontSize": 50, "color": "#3b82f6"},
        "logo": {"x": 840, "y": 60, "width": 180},
        "matches": {
            "startY": 420,
            "rowHeight": 180,
            "shieldSize": 100,
            "nameFontSize": 44,
            "infoFontSize": 34,
            "maxPerPage": 8
        },
        "footer": {"y": 1740, "text": "ASSINE AGORA E ASSISTA EM 4K", "bgColor": "#2563eb"}
    }'::jsonb,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.banner_templates ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their company's templates"
ON public.banner_templates
FOR SELECT
USING (EXISTS (
    SELECT 1 FROM company_memberships 
    WHERE company_memberships.company_id = banner_templates.company_id 
    AND company_memberships.user_id = auth.uid()
));

CREATE POLICY "Users can create their company's templates"
ON public.banner_templates
FOR INSERT
WITH CHECK (EXISTS (
    SELECT 1 FROM company_memberships 
    WHERE company_memberships.company_id = banner_templates.company_id 
    AND company_memberships.user_id = auth.uid()
));

CREATE POLICY "Users can update their company's templates"
ON public.banner_templates
FOR UPDATE
USING (EXISTS (
    SELECT 1 FROM company_memberships 
    WHERE company_memberships.company_id = banner_templates.company_id 
    AND company_memberships.user_id = auth.uid()
));

CREATE POLICY "Users can delete their company's templates"
ON public.banner_templates
FOR DELETE
USING (EXISTS (
    SELECT 1 FROM company_memberships 
    WHERE company_memberships.company_id = banner_templates.company_id 
    AND company_memberships.user_id = auth.uid()
));

-- Trigger for updated_at
CREATE TRIGGER update_banner_templates_updated_at
BEFORE UPDATE ON public.banner_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
