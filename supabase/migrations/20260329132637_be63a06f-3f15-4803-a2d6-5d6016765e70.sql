-- Fix: Restrict trial_links INSERT for resellers to their own company
DROP POLICY IF EXISTS "Reseller can create trial links" ON public.trial_links;

CREATE POLICY "Reseller can create trial links"
ON public.trial_links
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND company_id = public.get_reseller_company_id(auth.uid())
);