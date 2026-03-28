
-- Add Admin/Owner management policy (the Members view policy already exists)
DROP POLICY IF EXISTS "Admin/Owner can manage trial links" ON public.trial_links;
CREATE POLICY "Admin/Owner can manage trial links"
ON public.trial_links
FOR ALL
TO authenticated
USING (is_company_admin_or_owner(auth.uid(), company_id))
WITH CHECK (is_company_admin_or_owner(auth.uid(), company_id));
