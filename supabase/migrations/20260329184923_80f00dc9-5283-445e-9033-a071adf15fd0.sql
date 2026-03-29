-- Harden reseller and credential access, and remove plaintext password storage.

-- 1) Remove plaintext reseller password surface
DROP FUNCTION IF EXISTS public.get_reseller_password(uuid);

ALTER TABLE public.resellers
  DROP COLUMN IF EXISTS password_plain;

-- 2) Enforce strict reseller self-access (plus admin/owner access already present)
DROP POLICY IF EXISTS "Reseller can create sub-resellers" ON public.resellers;
DROP POLICY IF EXISTS "Reseller can view sub-resellers" ON public.resellers;
DROP POLICY IF EXISTS "Reseller can update sub-resellers" ON public.resellers;

DROP POLICY IF EXISTS "Reseller can view own record" ON public.resellers;
CREATE POLICY "Reseller can view own record"
ON public.resellers
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Reseller can update own record" ON public.resellers;
CREATE POLICY "Reseller can update own record"
ON public.resellers
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 3) Protect view access and ensure it inherits base-table RLS behavior
ALTER VIEW public.resellers_safe SET (security_invoker = true);
REVOKE ALL ON TABLE public.resellers_safe FROM PUBLIC;
REVOKE ALL ON TABLE public.resellers_safe FROM anon;
REVOKE ALL ON TABLE public.resellers_safe FROM authenticated;
GRANT SELECT ON TABLE public.resellers_safe TO authenticated;
GRANT ALL ON TABLE public.resellers_safe TO service_role;

-- 4) Tighten client_credentials access to admin/owner OR owning reseller only
CREATE OR REPLACE FUNCTION public.can_access_client_credentials(_company_id uuid, _client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_company_admin_or_owner(auth.uid(), _company_id)
    OR EXISTS (
      SELECT 1
      FROM public.clients c
      WHERE c.id = _client_id
        AND c.company_id = _company_id
        AND c.reseller_id = public.get_reseller_id(auth.uid())
    );
$$;

DROP POLICY IF EXISTS "Admin/Owner can view client credentials" ON public.client_credentials;
DROP POLICY IF EXISTS "Admin/Owner can update client credentials" ON public.client_credentials;
DROP POLICY IF EXISTS "Admin/Owner can delete client credentials" ON public.client_credentials;
DROP POLICY IF EXISTS "Members can create client credentials" ON public.client_credentials;
DROP POLICY IF EXISTS "Reseller can manage own client credentials" ON public.client_credentials;

CREATE POLICY "Scoped access to client credentials (select)"
ON public.client_credentials
FOR SELECT
TO authenticated
USING (public.can_access_client_credentials(company_id, client_id));

CREATE POLICY "Scoped access to client credentials (insert)"
ON public.client_credentials
FOR INSERT
TO authenticated
WITH CHECK (public.can_access_client_credentials(company_id, client_id));

CREATE POLICY "Scoped access to client credentials (update)"
ON public.client_credentials
FOR UPDATE
TO authenticated
USING (public.can_access_client_credentials(company_id, client_id))
WITH CHECK (public.can_access_client_credentials(company_id, client_id));

CREATE POLICY "Scoped access to client credentials (delete)"
ON public.client_credentials
FOR DELETE
TO authenticated
USING (public.can_access_client_credentials(company_id, client_id));