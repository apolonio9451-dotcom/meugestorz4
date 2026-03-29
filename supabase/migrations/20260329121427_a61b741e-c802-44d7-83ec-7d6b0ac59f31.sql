
-- 1. Remove dangerous INSERT policy on company_memberships
-- All legitimate inserts happen via SECURITY DEFINER triggers (handle_new_user, handle_trial_signup)
DROP POLICY IF EXISTS "Users can only create own membership" ON public.company_memberships;

-- 2. Fix saas_subscriptions policies to check company_id
DROP POLICY IF EXISTS "Owners can insert subscriptions" ON public.saas_subscriptions;
DROP POLICY IF EXISTS "Owners can update subscriptions" ON public.saas_subscriptions;
DROP POLICY IF EXISTS "Owners can delete subscriptions" ON public.saas_subscriptions;

CREATE POLICY "Owners can insert subscriptions" ON public.saas_subscriptions
FOR INSERT TO authenticated
WITH CHECK (is_company_admin_or_owner(auth.uid(), company_id));

CREATE POLICY "Owners can update subscriptions" ON public.saas_subscriptions
FOR UPDATE TO authenticated
USING (is_company_admin_or_owner(auth.uid(), company_id));

CREATE POLICY "Owners can delete subscriptions" ON public.saas_subscriptions
FOR DELETE TO authenticated
USING (is_company_admin_or_owner(auth.uid(), company_id));

-- 3. Restrict api_settings SELECT to admin/owner only (operators don't need API tokens)
DROP POLICY IF EXISTS "Members can view api settings" ON public.api_settings;
CREATE POLICY "Admin/Owner can view api settings" ON public.api_settings
FOR SELECT TO authenticated
USING (is_company_admin_or_owner(auth.uid(), company_id));

-- Keep reseller access policy if it exists
DROP POLICY IF EXISTS "Reseller can view own api settings" ON public.api_settings;
CREATE POLICY "Reseller can view own api settings" ON public.api_settings
FOR SELECT TO authenticated
USING (company_id = get_user_company_id(auth.uid()));

-- 4. Restrict client_credentials SELECT to admin/owner only
DROP POLICY IF EXISTS "Members can view client credentials" ON public.client_credentials;
CREATE POLICY "Admin/Owner can view client credentials" ON public.client_credentials
FOR SELECT TO authenticated
USING (is_company_admin_or_owner(auth.uid(), company_id));
