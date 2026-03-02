
-- Create servers table
CREATE TABLE public.servers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Members can view servers"
ON public.servers FOR SELECT
USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "Admin/Owner can create servers"
ON public.servers FOR INSERT
WITH CHECK (is_company_admin_or_owner(auth.uid(), company_id));

CREATE POLICY "Admin/Owner can update servers"
ON public.servers FOR UPDATE
USING (is_company_admin_or_owner(auth.uid(), company_id));

CREATE POLICY "Admin/Owner can delete servers"
ON public.servers FOR DELETE
USING (is_company_admin_or_owner(auth.uid(), company_id));
