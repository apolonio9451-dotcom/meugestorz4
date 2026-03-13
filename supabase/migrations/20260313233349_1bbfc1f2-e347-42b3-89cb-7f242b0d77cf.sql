
-- Fix UPDATE policy to include with_check
DROP POLICY IF EXISTS "Admin/Owner can update message templates" ON public.message_templates;
CREATE POLICY "Admin/Owner can update message templates"
ON public.message_templates
FOR UPDATE
TO authenticated
USING (is_company_admin_or_owner(auth.uid(), company_id))
WITH CHECK (is_company_admin_or_owner(auth.uid(), company_id));
