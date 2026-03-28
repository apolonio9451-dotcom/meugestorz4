-- 1. Remove blanket anon SELECT on trial_links (exposes all rows to unauthenticated users)
DROP POLICY IF EXISTS "Anyone can view trial links by token" ON public.trial_links;

-- 2. Fix company_memberships INSERT: restrict to only operator role
DROP POLICY IF EXISTS "Users can only create own membership" ON public.company_memberships;

CREATE POLICY "Users can only create own membership"
  ON public.company_memberships
  FOR INSERT
  TO public
  WITH CHECK (
    user_id = auth.uid()
    AND role = 'operator'::public.app_role
  );

-- 3. Restrict resellers SELECT to admin/owner only (protects password_plain)
DROP POLICY IF EXISTS "Members can view resellers" ON public.resellers;

CREATE POLICY "Admin/Owner can view resellers"
  ON public.resellers
  FOR SELECT
  TO public
  USING (is_company_admin_or_owner(auth.uid(), company_id));