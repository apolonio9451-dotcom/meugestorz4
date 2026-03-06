
-- Drop and recreate as PERMISSIVE policies
DROP POLICY IF EXISTS "Admin/Owner can create servers" ON public.servers;
DROP POLICY IF EXISTS "Admin/Owner can delete servers" ON public.servers;
DROP POLICY IF EXISTS "Admin/Owner can update servers" ON public.servers;
DROP POLICY IF EXISTS "Members can view servers" ON public.servers;
DROP POLICY IF EXISTS "Reseller can view company servers" ON public.servers;

CREATE POLICY "Admin/Owner can create servers"
ON public.servers FOR INSERT TO authenticated
WITH CHECK (is_company_admin_or_owner(auth.uid(), company_id));

CREATE POLICY "Admin/Owner can delete servers"
ON public.servers FOR DELETE TO authenticated
USING (is_company_admin_or_owner(auth.uid(), company_id));

CREATE POLICY "Admin/Owner can update servers"
ON public.servers FOR UPDATE TO authenticated
USING (is_company_admin_or_owner(auth.uid(), company_id));

CREATE POLICY "Members can view servers"
ON public.servers FOR SELECT TO authenticated
USING (is_company_member(auth.uid(), company_id));

CREATE POLICY "Reseller can view company servers"
ON public.servers FOR SELECT TO authenticated
USING (company_id = get_reseller_company_id(auth.uid()));
