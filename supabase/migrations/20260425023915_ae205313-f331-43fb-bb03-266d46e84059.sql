-- Drop existing policies for banner_templates to recreate them correctly
DROP POLICY IF EXISTS "Users can view their company's templates" ON public.banner_templates;
DROP POLICY IF EXISTS "Users can create their company's templates" ON public.banner_templates;
DROP POLICY IF EXISTS "Users can update their company's templates" ON public.banner_templates;
DROP POLICY IF EXISTS "Users can delete their company's templates" ON public.banner_templates;

-- Re-enable RLS (just in case)
ALTER TABLE public.banner_templates ENABLE ROW LEVEL SECURITY;

-- Create more robust policies based on company_memberships
CREATE POLICY "Users can view their company's templates" 
ON public.banner_templates 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM company_memberships 
    WHERE company_memberships.company_id = banner_templates.company_id 
    AND company_memberships.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create their company's templates" 
ON public.banner_templates 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM company_memberships 
    WHERE company_memberships.company_id = banner_templates.company_id 
    AND company_memberships.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their company's templates" 
ON public.banner_templates 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM company_memberships 
    WHERE company_memberships.company_id = banner_templates.company_id 
    AND company_memberships.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their company's templates" 
ON public.banner_templates 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM company_memberships 
    WHERE company_memberships.company_id = banner_templates.company_id 
    AND company_memberships.user_id = auth.uid()
  )
);
