
-- 1. Restrict client_credentials SELECT to admin/owner only (remove operator access)
DROP POLICY IF EXISTS "Client credentials scoped select" ON public.client_credentials;
CREATE POLICY "Client credentials admin select"
  ON public.client_credentials FOR SELECT TO authenticated
  USING (public.is_company_admin_or_owner(auth.uid(), company_id));

-- 2. Restrict client_credentials INSERT/UPDATE/DELETE to admin/owner only
DROP POLICY IF EXISTS "Client credentials scoped insert" ON public.client_credentials;
DROP POLICY IF EXISTS "Client credentials scoped update" ON public.client_credentials;
DROP POLICY IF EXISTS "Client credentials scoped delete" ON public.client_credentials;

CREATE POLICY "Client credentials admin insert"
  ON public.client_credentials FOR INSERT TO authenticated
  WITH CHECK (public.is_company_admin_or_owner(auth.uid(), company_id));

CREATE POLICY "Client credentials admin update"
  ON public.client_credentials FOR UPDATE TO authenticated
  USING (public.is_company_admin_or_owner(auth.uid(), company_id))
  WITH CHECK (public.is_company_admin_or_owner(auth.uid(), company_id));

CREATE POLICY "Client credentials admin delete"
  ON public.client_credentials FOR DELETE TO authenticated
  USING (public.is_company_admin_or_owner(auth.uid(), company_id));

-- 3. Recreate resellers_safe view with security_invoker to inherit RLS
DROP VIEW IF EXISTS public.resellers_safe;
CREATE VIEW public.resellers_safe
  WITH (security_invoker = true)
AS SELECT
  id, company_id, name, email, whatsapp, status,
  can_create_subreseller, can_create_trial, can_resell,
  credit_balance, level, notes, parent_reseller_id,
  user_id, subscription_expires_at, created_at, updated_at
FROM public.resellers;
