
-- Allow admins/owners to update company_memberships (needed for trial activation)
CREATE POLICY "Admin can update memberships"
ON public.company_memberships
FOR UPDATE
USING (is_company_admin_or_owner(auth.uid(), company_id));

-- Allow admins to view profiles of users in their company (for trial management)
CREATE POLICY "Admin can view company member profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.company_memberships cm1
    JOIN public.company_memberships cm2 ON cm1.company_id = cm2.company_id
    WHERE cm1.user_id = auth.uid()
      AND cm2.user_id = profiles.id
      AND cm1.role IN ('owner', 'admin')
  )
);
