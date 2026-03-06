
-- Fix servers RLS: drop restrictive and recreate as explicitly PERMISSIVE
DROP POLICY IF EXISTS "Admin/Owner can create servers" ON public.servers;
DROP POLICY IF EXISTS "Admin/Owner can delete servers" ON public.servers;
DROP POLICY IF EXISTS "Admin/Owner can update servers" ON public.servers;
DROP POLICY IF EXISTS "Members can view servers" ON public.servers;
DROP POLICY IF EXISTS "Reseller can view company servers" ON public.servers;

CREATE POLICY "Admin/Owner can create servers"
ON public.servers AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK (is_company_admin_or_owner(auth.uid(), company_id));

CREATE POLICY "Admin/Owner can delete servers"
ON public.servers AS PERMISSIVE FOR DELETE TO authenticated
USING (is_company_admin_or_owner(auth.uid(), company_id));

CREATE POLICY "Admin/Owner can update servers"
ON public.servers AS PERMISSIVE FOR UPDATE TO authenticated
USING (is_company_admin_or_owner(auth.uid(), company_id));

CREATE POLICY "Members can view servers"
ON public.servers AS PERMISSIVE FOR SELECT TO authenticated
USING (is_company_member(auth.uid(), company_id));

-- Also fix other critical tables that may have same restrictive issue
-- clients
DROP POLICY IF EXISTS "Admin/Owner can delete clients" ON public.clients;
DROP POLICY IF EXISTS "Admin/Owner can update clients" ON public.clients;
DROP POLICY IF EXISTS "Members can create clients" ON public.clients;
DROP POLICY IF EXISTS "Members can view clients" ON public.clients;
DROP POLICY IF EXISTS "Reseller can create clients" ON public.clients;
DROP POLICY IF EXISTS "Reseller can delete own clients" ON public.clients;
DROP POLICY IF EXISTS "Reseller can update own clients" ON public.clients;
DROP POLICY IF EXISTS "Reseller can view own clients" ON public.clients;

CREATE POLICY "Admin/Owner can delete clients"
ON public.clients AS PERMISSIVE FOR DELETE TO authenticated
USING (is_company_admin_or_owner(auth.uid(), company_id));

CREATE POLICY "Admin/Owner can update clients"
ON public.clients AS PERMISSIVE FOR UPDATE TO authenticated
USING (is_company_admin_or_owner(auth.uid(), company_id));

CREATE POLICY "Members can create clients"
ON public.clients AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK (is_company_member(auth.uid(), company_id));

CREATE POLICY "Members can view clients"
ON public.clients AS PERMISSIVE FOR SELECT TO authenticated
USING (is_company_member(auth.uid(), company_id));

-- subscription_plans
DROP POLICY IF EXISTS "Admin/Owner can create plans" ON public.subscription_plans;
DROP POLICY IF EXISTS "Admin/Owner can delete plans" ON public.subscription_plans;
DROP POLICY IF EXISTS "Admin/Owner can update plans" ON public.subscription_plans;
DROP POLICY IF EXISTS "Members can view plans" ON public.subscription_plans;
DROP POLICY IF EXISTS "Reseller can view company plans" ON public.subscription_plans;

CREATE POLICY "Admin/Owner can create plans"
ON public.subscription_plans AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK (is_company_admin_or_owner(auth.uid(), company_id));

CREATE POLICY "Admin/Owner can delete plans"
ON public.subscription_plans AS PERMISSIVE FOR DELETE TO authenticated
USING (is_company_admin_or_owner(auth.uid(), company_id));

CREATE POLICY "Admin/Owner can update plans"
ON public.subscription_plans AS PERMISSIVE FOR UPDATE TO authenticated
USING (is_company_admin_or_owner(auth.uid(), company_id));

CREATE POLICY "Members can view plans"
ON public.subscription_plans AS PERMISSIVE FOR SELECT TO authenticated
USING (is_company_member(auth.uid(), company_id));

-- company_settings
DROP POLICY IF EXISTS "Company admins can insert settings" ON public.company_settings;
DROP POLICY IF EXISTS "Company admins can update settings" ON public.company_settings;
DROP POLICY IF EXISTS "Company members can view settings" ON public.company_settings;
DROP POLICY IF EXISTS "Reseller can view company settings" ON public.company_settings;

CREATE POLICY "Company admins can insert settings"
ON public.company_settings AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK (is_company_admin_or_owner(auth.uid(), company_id));

CREATE POLICY "Company admins can update settings"
ON public.company_settings AS PERMISSIVE FOR UPDATE TO authenticated
USING (is_company_admin_or_owner(auth.uid(), company_id));

CREATE POLICY "Company members can view settings"
ON public.company_settings AS PERMISSIVE FOR SELECT TO authenticated
USING (is_company_member(auth.uid(), company_id));

-- client_subscriptions
DROP POLICY IF EXISTS "Admin/Owner can create subscriptions" ON public.client_subscriptions;
DROP POLICY IF EXISTS "Admin/Owner can delete subscriptions" ON public.client_subscriptions;
DROP POLICY IF EXISTS "Admin/Owner can update subscriptions" ON public.client_subscriptions;
DROP POLICY IF EXISTS "Members can view subscriptions" ON public.client_subscriptions;
DROP POLICY IF EXISTS "Reseller can create client subs" ON public.client_subscriptions;
DROP POLICY IF EXISTS "Reseller can update client subs" ON public.client_subscriptions;
DROP POLICY IF EXISTS "Reseller can view own client subs" ON public.client_subscriptions;

CREATE POLICY "Admin/Owner can create subscriptions"
ON public.client_subscriptions AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK (is_company_admin_or_owner(auth.uid(), company_id));

CREATE POLICY "Admin/Owner can delete subscriptions"
ON public.client_subscriptions AS PERMISSIVE FOR DELETE TO authenticated
USING (is_company_admin_or_owner(auth.uid(), company_id));

CREATE POLICY "Admin/Owner can update subscriptions"
ON public.client_subscriptions AS PERMISSIVE FOR UPDATE TO authenticated
USING (is_company_admin_or_owner(auth.uid(), company_id));

CREATE POLICY "Members can view subscriptions"
ON public.client_subscriptions AS PERMISSIVE FOR SELECT TO authenticated
USING (is_company_member(auth.uid(), company_id));

-- system_announcements  
DROP POLICY IF EXISTS "Members can view active announcements" ON public.system_announcements;
DROP POLICY IF EXISTS "Owner can manage announcements" ON public.system_announcements;
DROP POLICY IF EXISTS "Reseller can view announcements" ON public.system_announcements;

CREATE POLICY "Owner can manage announcements"
ON public.system_announcements AS PERMISSIVE FOR ALL TO authenticated
USING (is_company_admin_or_owner(auth.uid(), company_id))
WITH CHECK (is_company_admin_or_owner(auth.uid(), company_id));

CREATE POLICY "Members can view active announcements"
ON public.system_announcements AS PERMISSIVE FOR SELECT TO authenticated
USING (is_company_member(auth.uid(), company_id) AND is_active = true);

CREATE POLICY "Reseller can view announcements"
ON public.system_announcements AS PERMISSIVE FOR SELECT TO authenticated
USING (company_id = get_reseller_company_id(auth.uid()) AND is_active = true);
